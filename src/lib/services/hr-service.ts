import crypto from "node:crypto";
import { and, desc, eq, gte, isNull, lte, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  attendance,
  branches,
  leaveRequests,
  orders,
  staff,
  staffBranches,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import {
  assertBranchAccess,
  assertPermission,
  getBranchScope,
  hasPermission,
} from "../auth/permissions";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";
import { createNotification } from "./notification-service";

export type AttendanceView = {
  id: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  branchName: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  method: string;
  latitude: string | null;
  longitude: string | null;
  notes: string | null;
};

export type LeaveView = {
  id: string;
  staffId: string;
  staffName: string;
  branchName: string;
  startAt: Date;
  endAt: Date;
  status: string;
  reason: string | null;
  createdAt: Date;
};

function canManageHr(actor: ActorContext): boolean {
  return (
    hasPermission(actor.permissions, "staff.manage") ||
    hasPermission(actor.permissions, "schedule.manage")
  );
}

function assertHrManage(actor: ActorContext): void {
  if (!canManageHr(actor)) {
    throw new AuthorizationError("Bạn không có quyền quản lý chấm công/nghỉ phép.");
  }
}

export function listAttendance(
  db: AppDb,
  actor: ActorContext,
  filters: { from?: string; to?: string; staffId?: string } = {},
): AttendanceView[] {
  assertPermission(actor, "staff.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(attendance.tenantId, actor.tenantId)];
  if (scope.mode === "branch") conditions.push(eq(attendance.branchId, scope.branchId));
  if (filters.staffId) conditions.push(eq(attendance.staffId, filters.staffId));
  if (filters.from) conditions.push(gte(attendance.checkInAt, new Date(`${filters.from}T00:00:00+07:00`)));
  if (filters.to) conditions.push(lte(attendance.checkInAt, new Date(`${filters.to}T23:59:59+07:00`)));
  return db
    .select({
      id: attendance.id,
      staffId: attendance.staffId,
      staffName: staff.name,
      staffCode: staff.code,
      branchName: branches.name,
      checkInAt: attendance.checkInAt,
      checkOutAt: attendance.checkOutAt,
      method: attendance.method,
      latitude: attendance.latitude,
      longitude: attendance.longitude,
      notes: attendance.notes,
    })
    .from(attendance)
    .innerJoin(staff, eq(attendance.staffId, staff.id))
    .innerJoin(branches, eq(attendance.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(desc(attendance.checkInAt))
    .limit(300)
    .all();
}

export function recordCheckIn(
  db: AppDb,
  actor: ActorContext,
  input: {
    staffId: string;
    branchId: string;
    method: "manual" | "gps" | "qr";
    checkIn: string;
    latitude: string;
    longitude: string;
    device: string;
    notes: string;
  },
): string {
  assertHrManage(actor);
  assertBranchAccess(actor, input.branchId);
  const staffRow = db
    .select()
    .from(staff)
    .where(and(eq(staff.id, input.staffId), eq(staff.tenantId, actor.tenantId)))
    .get();
  if (!staffRow || !staffRow.active || staffRow.archivedAt) {
    throw new ValidationError("Nhân sự không hợp lệ.");
  }
  const branchLink = db
    .select({ staffId: staffBranches.staffId })
    .from(staffBranches)
    .where(
      and(
        eq(staffBranches.staffId, input.staffId),
        eq(staffBranches.branchId, input.branchId),
        eq(staffBranches.tenantId, actor.tenantId),
      ),
    )
    .get();
  if (!branchLink) {
    throw new ValidationError("Nhân sự không thuộc chi nhánh đã chọn.");
  }
  if (!["manual", "gps", "qr"].includes(input.method)) {
    throw new ValidationError("Phương thức chấm công không hợp lệ.");
  }
  if (input.method === "gps" && (!input.latitude || !input.longitude)) {
    throw new ValidationError("Chấm công GPS cần latitude/longitude.");
  }
  const checkInAt = input.checkIn
    ? parseVietnamDateTimeLocal(input.checkIn)
    : new Date();
  if (!checkInAt) throw new ValidationError("Thời điểm check-in không hợp lệ.");
  const open = db
    .select({ id: attendance.id })
    .from(attendance)
    .where(
      and(
        eq(attendance.tenantId, actor.tenantId),
        eq(attendance.staffId, input.staffId),
        isNull(attendance.checkOutAt),
      ),
    )
    .get();
  if (open) throw new ValidationError("Nhân sự đang có ca chưa check-out.");
  const id = crypto.randomUUID();
  db.insert(attendance)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      staffId: input.staffId,
      checkInAt,
      method: input.method,
      latitude: input.latitude.trim() || null,
      longitude: input.longitude.trim() || null,
      device: input.device.trim().slice(0, 300) || null,
      notes: input.notes.trim() || null,
      createdBy: actor.staffId,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "staff.attendance.check_in",
    entity: "attendance",
    entityId: id,
    metadata: { staffId: input.staffId, method: input.method },
  });
  return id;
}

export function recordCheckOut(
  db: AppDb,
  actor: ActorContext,
  attendanceId: string,
  checkOut: string,
  notes: string,
): void {
  assertHrManage(actor);
  const row = db
    .select()
    .from(attendance)
    .where(
      and(eq(attendance.id, attendanceId), eq(attendance.tenantId, actor.tenantId)),
    )
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy bản ghi chấm công.");
  assertBranchAccess(actor, row.branchId);
  if (row.checkOutAt) throw new ValidationError("Ca này đã check-out.");
  const checkOutAt = checkOut ? parseVietnamDateTimeLocal(checkOut) : new Date();
  if (!checkOutAt || checkOutAt < row.checkInAt) {
    throw new ValidationError("Thời điểm check-out không hợp lệ.");
  }
  db.update(attendance)
    .set({
      checkOutAt,
      notes: notes.trim() ? `${row.notes ?? ""}\n${notes.trim()}`.trim() : row.notes,
      updatedAt: new Date(),
    })
    .where(eq(attendance.id, attendanceId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "staff.attendance.check_out",
    entity: "attendance",
    entityId: attendanceId,
  });
}

export function listLeaveRequests(
  db: AppDb,
  actor: ActorContext,
  status?: string,
): LeaveView[] {
  assertPermission(actor, "staff.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(leaveRequests.tenantId, actor.tenantId)];
  if (scope.mode === "branch") conditions.push(eq(leaveRequests.branchId, scope.branchId));
  if (status) conditions.push(eq(leaveRequests.status, status));
  return db
    .select({
      id: leaveRequests.id,
      staffId: leaveRequests.staffId,
      staffName: staff.name,
      branchName: branches.name,
      startAt: leaveRequests.startAt,
      endAt: leaveRequests.endAt,
      status: leaveRequests.status,
      reason: leaveRequests.reason,
      createdAt: leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .innerJoin(staff, eq(leaveRequests.staffId, staff.id))
    .innerJoin(branches, eq(leaveRequests.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.createdAt))
    .limit(200)
    .all();
}

export function createLeaveRequest(
  db: AppDb,
  actor: ActorContext,
  input: {
    staffId: string;
    branchId: string;
    startAt: string;
    endAt: string;
    reason: string;
  },
): string {
  assertPermission(actor, "staff.view");
  if (actor.role !== "owner" && input.staffId !== actor.staffId) {
    throw new AuthorizationError("Bạn chỉ tạo được đơn nghỉ cho chính mình.");
  }
  assertBranchAccess(actor, input.branchId);
  const startAt = parseVietnamDateTimeLocal(input.startAt);
  const endAt = parseVietnamDateTimeLocal(input.endAt);
  if (!startAt || !endAt || endAt <= startAt) {
    throw new ValidationError("Khoảng nghỉ không hợp lệ.");
  }
  const id = crypto.randomUUID();
  db.insert(leaveRequests)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      staffId: input.staffId,
      startAt,
      endAt,
      status: "pending",
      reason: input.reason.trim() || null,
      createdBy: actor.staffId,
    })
    .run();
  const owners = db
    .select({ id: staff.id })
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.role, "owner"),
        eq(staff.active, true),
      ),
    )
    .all();
  for (const owner of owners) {
    createNotification(db, {
      tenantId: actor.tenantId,
      userId: owner.id,
      type: "leave_request",
      title: "Đơn nghỉ phép mới",
      content: `${actor.staffName} gửi đơn nghỉ từ ${startAt.toLocaleString("vi-VN")} đến ${endAt.toLocaleString("vi-VN")}.`,
      link: "/manage/staff/leave",
    });
  }
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "staff.leave.create",
    entity: "leave_request",
    entityId: id,
  });
  return id;
}

export function setLeaveStatus(
  db: AppDb,
  actor: ActorContext,
  leaveId: string,
  status: "approved" | "rejected",
): void {
  assertPermission(actor, "staff.manage");
  const row = db
    .select()
    .from(leaveRequests)
    .where(
      and(eq(leaveRequests.id, leaveId), eq(leaveRequests.tenantId, actor.tenantId)),
    )
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy đơn nghỉ.");
  assertBranchAccess(actor, row.branchId);
  if (row.status !== "pending") {
    throw new ValidationError("Đơn nghỉ đã được xử lý.");
  }
  db.update(leaveRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(leaveRequests.id, leaveId))
    .run();
  createNotification(db, {
    tenantId: actor.tenantId,
    userId: row.staffId,
    type: "leave_request",
    title: status === "approved" ? "Đơn nghỉ đã được duyệt" : "Đơn nghỉ bị từ chối",
    content: `Đơn nghỉ từ ${row.startAt.toLocaleString("vi-VN")} đến ${row.endAt.toLocaleString("vi-VN")} đã được ${status === "approved" ? "duyệt" : "từ chối"}.`,
    link: "/manage/staff/leave",
  });
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "staff.leave.status",
    entity: "leave_request",
    entityId: leaveId,
    metadata: { from: row.status, to: status },
  });
}

export function updateStaffBaseSalary(
  db: AppDb,
  actor: ActorContext,
  staffId: string,
  baseSalary: number,
): void {
  assertPermission(actor, "staff.manage");
  if (!Number.isInteger(baseSalary) || baseSalary < 0) {
    throw new ValidationError("Lương cơ bản không hợp lệ.");
  }
  const row = db
    .select()
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.tenantId, actor.tenantId)))
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy nhân sự.");
  db.update(staff)
    .set({ baseSalary, updatedAt: new Date() })
    .where(eq(staff.id, staffId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "staff.salary.update",
    entity: "staff",
    entityId: staffId,
    metadata: { baseSalary },
  });
}

export type PhotographerKpi = {
  staffId: string;
  staffName: string;
  shoots: number;
  completedOrders: number;
  revenue: number;
  commissionApproved: number;
};

export function getPhotographerKpi(
  db: AppDb,
  actor: ActorContext,
): PhotographerKpi[] {
  assertPermission(actor, "reports.view");
  const photographers = db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.role, "photographer"),
        eq(staff.active, true),
      ),
    )
    .all();
  return photographers.map((photographer) => {
    const rows = db
      .select({
        status: orders.status,
        total: orders.total,
      })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, actor.tenantId),
          eq(orders.photographerId, photographer.id),
        ),
      )
      .all();
    return {
      staffId: photographer.id,
      staffName: photographer.name,
      shoots: rows.length,
      completedOrders: rows.filter((row) => row.status === "completed").length,
      revenue: rows
        .filter((row) => row.status === "completed")
        .reduce((sum, row) => sum + row.total, 0),
      commissionApproved: 0,
    };
  });
}
