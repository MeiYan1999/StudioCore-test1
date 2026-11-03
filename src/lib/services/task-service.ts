import crypto from "node:crypto";
import { and, count, desc, eq, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  albums,
  customers,
  orders,
  staff,
  taskComments,
  tasks,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";
import { createNotification } from "./notification-service";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "../tasks/constants";

export type TaskView = {
  id: string;
  title: string;
  description: string | null;
  branchId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  orderId: string | null;
  orderCode: string | null;
  customerId: string | null;
  customerName: string | null;
  albumId: string | null;
  albumTitle: string | null;
  priority: string;
  status: string;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  commentCount: number;
  overdue: boolean;
};

export type TaskCommentView = {
  id: string;
  authorName: string | null;
  content: string;
  createdAt: Date;
};

export type TaskDetail = TaskView & { comments: TaskCommentView[] };

function taskConditions(actor: ActorContext, filters: {
  q?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  customerId?: string;
  branchId?: string;
}): SQL[] | null {
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return null;
  const conditions: SQL[] = [eq(tasks.tenantId, actor.tenantId)];
  if (scope.mode === "branch") conditions.push(eq(tasks.branchId, scope.branchId));
  else if (filters.branchId) conditions.push(eq(tasks.branchId, filters.branchId));
  if (filters.status && (TASK_STATUSES as readonly string[]).includes(filters.status)) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (
    filters.priority &&
    (TASK_PRIORITIES as readonly string[]).includes(filters.priority)
  ) {
    conditions.push(eq(tasks.priority, filters.priority));
  }
  if (filters.assigneeId) conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  if (filters.customerId) conditions.push(eq(tasks.customerId, filters.customerId));
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().toLowerCase()}%`;
    const search = or(
      sql`lower(${tasks.title}) like ${term}`,
      sql`lower(coalesce(${tasks.description}, '')) like ${term}`,
      sql`lower(coalesce(${staff.name}, '')) like ${term}`,
      sql`lower(coalesce(${customers.name}, '')) like ${term}`,
    );
    if (search) conditions.push(search);
  }
  return conditions;
}

const taskSelect = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  branchId: tasks.branchId,
  assigneeId: tasks.assigneeId,
  assigneeName: staff.name,
  orderId: tasks.orderId,
  orderCode: orders.code,
  customerId: tasks.customerId,
  customerName: customers.name,
  albumId: tasks.albumId,
  albumTitle: albums.title,
  priority: tasks.priority,
  status: tasks.status,
  dueAt: tasks.dueAt,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  commentCount: sql<number>`(
    select count(*) from task_comments
    where task_comments.task_id = ${tasks.id}
      and task_comments.tenant_id = ${tasks.tenantId}
  )`,
};

function withOverdue<T extends { dueAt: Date | null; status: string }>(
  row: T,
): T & { overdue: boolean } {
  return {
    ...row,
    overdue:
      row.status !== "done" &&
      row.dueAt !== null &&
      row.dueAt.getTime() < Date.now(),
  };
}

export function listTasks(
  db: AppDb,
  actor: ActorContext,
  filters: {
    q?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    customerId?: string;
    branchId?: string;
  } = {},
): TaskView[] {
  assertPermission(actor, "tasks.view");
  const conditions = taskConditions(actor, filters);
  if (!conditions) return [];
  return db
    .select(taskSelect)
    .from(tasks)
    .leftJoin(staff, eq(tasks.assigneeId, staff.id))
    .leftJoin(orders, eq(tasks.orderId, orders.id))
    .leftJoin(customers, eq(tasks.customerId, customers.id))
    .leftJoin(albums, eq(tasks.albumId, albums.id))
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .limit(300)
    .all()
    .map(withOverdue);
}

export function getTaskDetail(
  db: AppDb,
  actor: ActorContext,
  taskId: string,
): TaskDetail {
  assertPermission(actor, "tasks.view");
  const row = db
    .select(taskSelect)
    .from(tasks)
    .leftJoin(staff, eq(tasks.assigneeId, staff.id))
    .leftJoin(orders, eq(tasks.orderId, orders.id))
    .leftJoin(customers, eq(tasks.customerId, customers.id))
    .leftJoin(albums, eq(tasks.albumId, albums.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, actor.tenantId)))
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy công việc.");
  assertBranchAccess(actor, row.branchId);
  const comments = db
    .select({
      id: taskComments.id,
      authorName: staff.name,
      content: taskComments.content,
      createdAt: taskComments.createdAt,
    })
    .from(taskComments)
    .leftJoin(staff, eq(taskComments.authorId, staff.id))
    .where(
      and(eq(taskComments.taskId, taskId), eq(taskComments.tenantId, actor.tenantId)),
    )
    .orderBy(taskComments.createdAt)
    .all();
  return { ...withOverdue(row), comments };
}

export function getTasksForCustomer(
  db: AppDb,
  actor: ActorContext,
  customerId: string,
): TaskView[] {
  assertPermission(actor, "tasks.view");
  return listTasks(db, actor, { customerId });
}

export type TaskInput = {
  title: string;
  description: string;
  branchId: string;
  assigneeId: string;
  orderId: string;
  customerId: string;
  albumId: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string;
};

function validateTaskRelations(
  db: AppDb,
  actor: ActorContext,
  input: TaskInput,
): void {
  assertBranchAccess(actor, input.branchId);
  if (input.assigneeId) {
    const assignee = db
      .select({ id: staff.id })
      .from(staff)
      .where(
        and(
          eq(staff.id, input.assigneeId),
          eq(staff.tenantId, actor.tenantId),
          eq(staff.active, true),
          isNull(staff.archivedAt),
        ),
      )
      .get();
    if (!assignee) throw new ValidationError("Người phụ trách không hợp lệ.");
  }
  if (input.orderId) {
    const order = db
      .select({ id: orders.id, branchId: orders.branchId })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)))
      .get();
    if (!order) throw new ValidationError("Đơn hàng không hợp lệ.");
  }
  if (input.customerId) {
    const customer = db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.id, input.customerId), eq(customers.tenantId, actor.tenantId)),
      )
      .get();
    if (!customer) throw new ValidationError("Khách hàng không hợp lệ.");
  }
  if (input.albumId) {
    const album = db
      .select({ id: albums.id })
      .from(albums)
      .where(and(eq(albums.id, input.albumId), eq(albums.tenantId, actor.tenantId)))
      .get();
    if (!album) throw new ValidationError("Album không hợp lệ.");
  }
}

export function createTask(
  db: AppDb,
  actor: ActorContext,
  input: TaskInput,
): string {
  assertPermission(actor, "tasks.manage");
  if (!input.title.trim()) throw new ValidationError("Tiêu đề task là bắt buộc.");
  if (!TASK_STATUSES.includes(input.status)) {
    throw new ValidationError("Trạng thái task không hợp lệ.");
  }
  if (!TASK_PRIORITIES.includes(input.priority)) {
    throw new ValidationError("Độ ưu tiên không hợp lệ.");
  }
  validateTaskRelations(db, actor, input);
  const dueAt = input.dueAt ? parseVietnamDateTimeLocal(input.dueAt) : null;
  if (input.dueAt && !dueAt) throw new ValidationError("Deadline không hợp lệ.");
  const id = crypto.randomUUID();
  db.insert(tasks)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      title: input.title.trim(),
      description: input.description.trim() || null,
      assigneeId: input.assigneeId || null,
      orderId: input.orderId || null,
      customerId: input.customerId || null,
      albumId: input.albumId || null,
      priority: input.priority,
      status: input.status,
      dueAt,
      completedAt: input.status === "done" ? new Date() : null,
      createdBy: actor.staffId,
    })
    .run();
  if (input.assigneeId && input.assigneeId !== actor.staffId) {
    createNotification(db, {
      tenantId: actor.tenantId,
      userId: input.assigneeId,
      type: "task_assigned",
      title: "Bạn được giao việc mới",
      content: input.title.trim(),
      link: `/manage/tasks?taskId=${id}`,
    });
  }
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "tasks.create",
    entity: "task",
    entityId: id,
    metadata: { priority: input.priority, assigneeId: input.assigneeId },
  });
  return id;
}

export function updateTask(
  db: AppDb,
  actor: ActorContext,
  taskId: string,
  input: TaskInput,
): void {
  assertPermission(actor, "tasks.manage");
  const existing = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, actor.tenantId)))
    .get();
  if (!existing) throw new NotFoundError("Không tìm thấy task.");
  assertBranchAccess(actor, existing.branchId);
  validateTaskRelations(db, actor, input);
  const dueAt = input.dueAt ? parseVietnamDateTimeLocal(input.dueAt) : null;
  if (input.dueAt && !dueAt) throw new ValidationError("Deadline không hợp lệ.");
  db.update(tasks)
    .set({
      title: input.title.trim(),
      description: input.description.trim() || null,
      assigneeId: input.assigneeId || null,
      orderId: input.orderId || null,
      customerId: input.customerId || null,
      albumId: input.albumId || null,
      priority: input.priority,
      status: input.status,
      dueAt,
      completedAt: input.status === "done" ? existing.completedAt ?? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .run();
  if (
    input.assigneeId &&
    input.assigneeId !== existing.assigneeId &&
    input.assigneeId !== actor.staffId
  ) {
    createNotification(db, {
      tenantId: actor.tenantId,
      userId: input.assigneeId,
      type: "task_assigned",
      title: "Bạn được giao việc",
      content: input.title.trim(),
      link: `/manage/tasks?taskId=${taskId}`,
    });
  }
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "tasks.update",
    entity: "task",
    entityId: taskId,
    metadata: { status: input.status, priority: input.priority },
  });
}

export function setTaskStatus(
  db: AppDb,
  actor: ActorContext,
  taskId: string,
  status: TaskStatus,
): void {
  assertPermission(actor, "tasks.manage");
  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, actor.tenantId)))
    .get();
  if (!task) throw new NotFoundError("Không tìm thấy task.");
  assertBranchAccess(actor, task.branchId);
  if (!TASK_STATUSES.includes(status)) {
    throw new ValidationError("Trạng thái task không hợp lệ.");
  }
  db.update(tasks)
    .set({
      status,
      completedAt: status === "done" ? task.completedAt ?? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "tasks.status",
    entity: "task",
    entityId: taskId,
    metadata: { from: task.status, to: status },
  });
}

export function addTaskComment(
  db: AppDb,
  actor: ActorContext,
  taskId: string,
  content: string,
): void {
  assertPermission(actor, "tasks.view");
  if (!content.trim()) throw new ValidationError("Nội dung bình luận là bắt buộc.");
  if (content.length > 2000) {
    throw new ValidationError("Bình luận tối đa 2.000 ký tự.");
  }
  const task = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.tenantId, actor.tenantId)))
    .get();
  if (!task) throw new NotFoundError("Không tìm thấy task.");
  assertBranchAccess(actor, task.branchId);
  db.insert(taskComments)
    .values({
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      taskId,
      authorId: actor.staffId,
      content: content.trim(),
    })
    .run();
  const mentionedCodes = [...content.matchAll(/@([A-Z0-9-]{3,30})/gi)].map(
    (match) => (match[1] ?? "").toUpperCase(),
  );
  for (const code of new Set(mentionedCodes)) {
    const mentioned = db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.tenantId, actor.tenantId), eq(staff.code, code)))
      .get();
    if (mentioned && mentioned.id !== actor.staffId) {
      createNotification(db, {
        tenantId: actor.tenantId,
        userId: mentioned.id,
        type: "task_mention",
        title: `Bạn được nhắc trong task`,
        content: task.title,
        link: `/manage/tasks?taskId=${taskId}`,
      });
    }
  }
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "tasks.comment.create",
    entity: "task",
    entityId: taskId,
  });
}

export function listTaskLinkOptions(db: AppDb, actor: ActorContext) {
  assertPermission(actor, "tasks.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") {
    return { customers: [], orders: [], albums: [] };
  }
  const branchId = scope.mode === "branch" ? scope.branchId : null;
  return {
    customers: db
      .select({ id: customers.id, name: customers.name, phone: customers.phone })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, actor.tenantId),
          isNull(customers.archivedAt),
          branchId ? eq(customers.branchId, branchId) : undefined,
        ),
      )
      .orderBy(customers.name)
      .limit(200)
      .all(),
    orders: db
      .select({ id: orders.id, code: orders.code })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, actor.tenantId),
          branchId ? eq(orders.branchId, branchId) : undefined,
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(100)
      .all(),
    albums: db
      .select({ id: albums.id, title: albums.title })
      .from(albums)
      .where(
        and(
          eq(albums.tenantId, actor.tenantId),
          branchId ? eq(albums.branchId, branchId) : undefined,
        ),
      )
      .orderBy(desc(albums.createdAt))
      .limit(100)
      .all(),
  };
}

export function listTaskAssignees(db: AppDb, actor: ActorContext) {
  assertPermission(actor, "tasks.view");
  return db
    .select({ id: staff.id, name: staff.name, code: staff.code })
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        isNull(staff.archivedAt),
        ne(staff.role, "platform_admin"),
      ),
    )
    .orderBy(staff.name)
    .all();
}

export function countOverdueTasks(db: AppDb, actor: ActorContext): number {
  assertPermission(actor, "tasks.view");
  const conditions = taskConditions(actor, {});
  if (!conditions) return 0;
  return db
    .select({ value: count() })
    .from(tasks)
    .where(
      and(
        ...conditions,
        sql`${tasks.status} != 'done'`,
        sql`${tasks.dueAt} is not null and ${tasks.dueAt} < ${Date.now()}`,
      ),
    )
    .get()?.value ?? 0;
}
