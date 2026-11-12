import { expireHolds } from '../omnichannel/booking';
import {
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  appointments,
  branches,
  customers,
  leaveRequests,
  notifications,
  orderStatusHistory,
  orders,
  rooms,
  staff,
  staffBranches,
  staffShifts,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import {
  assertBranchAccess,
  assertPermission,
  getBranchScope,
  hasPermission,
} from "../auth/permissions";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_META,
  type AppointmentStatus,
} from "../scheduling/status";
import { canTransitionOrder, ORDER_STATUS_META, type OrderStatus } from "../orders/status";
import {
  addDaysToKey,
  addMonthsToKey,
  formatDateKey,
  formatDateRangeLabel,
  formatMonthLabel,
  formatTimeLabel,
  formatWeekdayLabel,
  getDateKeysInRange,
  getDayRange,
  getLocalMinutes,
  getMonthGridRange,
  getMonthKey,
  getTodayKey,
  getVietnamDateKey,
  getWeekRange,
  getWorkingHoursForDate,
  isWithinWorkingHours,
  parseDateKey,
} from "../scheduling/time";
import {
  isSqliteBusy,
  sleep,
  withKeyedMutex,
} from "../concurrency/keyed-mutex";
import {
  AuthorizationError,
  BookingConflictError,
  NotFoundError,
  ValidationError,
} from "../errors";
import { writeAudit } from "../audit";
import { formatDateTime } from "../utils";

function notifyAppointmentStaff(
  db: AppDb,
  actor: ActorContext,
  input: {
    appointmentId: string;
    staffIds: (string | null)[];
    title: string;
    content: string;
  },
): void {
  const recipients = [...new Set(input.staffIds.filter((id): id is string => Boolean(id)))];
  if (recipients.length === 0) {
    return;
  }

  db.insert(notifications)
    .values(
      recipients.map((staffId) => ({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        userId: staffId,
        type: "appointment",
        title: input.title,
        content: input.content,
        link: `/manage/calendar/${input.appointmentId}`,
        createdAt: new Date(),
      })),
    )
    .run();
}

export type CalendarView = "day" | "week" | "month" | "timeline";

export type AppointmentInput = {
  orderId: string;
  branchId: string;
  roomId: string;
  photographerId: string | null;
  makeupId: string | null;
  editorId: string | null;
  startAt: string;
  endAt: string;
  notes: string;
  idempotencyKey: string;
};

export type AppointmentListFilters = {
  date: string;
  view: CalendarView;
  branchId?: string;
  photographerId?: string;
  roomId?: string;
};

export type CalendarAppointment = {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  branchId: string;
  branchName: string;
  roomId: string | null;
  roomName: string | null;
  photographerId: string | null;
  photographerName: string | null;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  colorKey: string;
};

export type CalendarDay = {
  dateKey: string;
  label: string;
  weekdayLabel: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  appointments: CalendarAppointment[];
};

export type CalendarData = {
  view: CalendarView;
  dateKey: string;
  rangeStartKey: string;
  rangeEndKey: string;
  rangeLabel: string;
  monthLabel: string | null;
  todayKey: string;
  prevDateKey: string;
  nextDateKey: string;
  branchId: string | null;
  photographerId: string | null;
  roomId: string | null;
  days: CalendarDay[];
  appointments: CalendarAppointment[];
};

export type AppointmentDetail = {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  orderId: string;
  orderCode: string;
  orderStatus: OrderStatus;
  customerId: string;
  customerName: string;
  customerPhone: string;
  roomId: string | null;
  roomName: string | null;
  photographer: { id: string; name: string } | null;
  makeup: { id: string; name: string } | null;
  editor: { id: string; name: string } | null;
  startAt: Date;
  endAt: Date;
  bufferMinutes: number;
  status: AppointmentStatus;
  notes: string | null;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
};

function appointmentScopeConditions(actor: ActorContext): SQL[] {
  const scope = getBranchScope(actor);
  const conditions: SQL[] = [
    eq(appointments.tenantId, actor.tenantId),
    isNull(appointments.archivedAt),
  ];
  if (scope.mode === "branch") {
    conditions.push(eq(appointments.branchId, scope.branchId));
  }
  if (scope.mode === "none") {
    conditions.push(eq(appointments.id, "__scope_none__"));
  }
  return conditions;
}

function assertActiveOrderForBranch(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
  branchId: string,
): { id: string; status: OrderStatus; branchId: string } {
  const order = db
    .select({ id: orders.id, status: orders.status, branchId: orders.branchId })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.tenantId, actor.tenantId),
        isNull(orders.archivedAt),
      ),
    )
    .get();

  if (!order) {
    throw new ValidationError("Đơn hàng không hợp lệ.");
  }
  if (order.branchId !== branchId) {
    throw new ValidationError("Đơn hàng không thuộc chi nhánh đã chọn.");
  }
  if (order.status === "cancelled" || order.status === "completed") {
    throw new ValidationError("Không thể xếp lịch cho đơn đã hủy hoặc hoàn tất.");
  }

  return order;
}

function assertRoom(
  db: AppDb,
  actor: ActorContext,
  roomId: string,
  branchId: string,
): void {
  const room = db
    .select({ id: rooms.id, status: rooms.status, branchId: rooms.branchId })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.tenantId, actor.tenantId)))
    .get();

  if (!room || room.branchId !== branchId || room.status !== "active") {
    throw new ValidationError("Phòng chụp không hợp lệ hoặc đã ngưng sử dụng.");
  }
}

function getStaffForBranch(
  db: AppDb,
  actor: ActorContext,
  staffId: string,
  branchId: string,
  role: "photographer" | "makeup" | "retoucher",
): { id: string; name: string } {
  const row = db
    .select({ id: staff.id, name: staff.name, role: staff.role })
    .from(staff)
    .innerJoin(staffBranches, eq(staffBranches.staffId, staff.id))
    .where(
      and(
        eq(staff.id, staffId),
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        isNull(staff.archivedAt),
        eq(staffBranches.branchId, branchId),
      ),
    )
    .get();

  if (!row || row.role !== role) {
    throw new ValidationError("Nhân sự được phân công không đúng vai trò hoặc chi nhánh.");
  }

  return { id: row.id, name: row.name };
}

function conflictTimeLabel(start: Date, end: Date): string {
  return `${formatTimeLabel(start)}–${formatTimeLabel(end)}`;
}

function checkStaffShift(
  db: AppDb,
  actor: ActorContext,
  staffId: string,
  staffName: string,
  startAt: Date,
  endAt: Date,
): string | null {
  const dateKey = getVietnamDateKey(startAt);
  const dayStart = parseDateKey(dateKey);
  const dayEnd = parseDateKey(addDaysToKey(dateKey, 1));
  const shifts = db
    .select({ startAt: staffShifts.startAt, endAt: staffShifts.endAt })
    .from(staffShifts)
    .where(
      and(
        eq(staffShifts.tenantId, actor.tenantId),
        eq(staffShifts.staffId, staffId),
        eq(staffShifts.status, "active"),
        gte(staffShifts.startAt, dayStart),
        lt(staffShifts.startAt, dayEnd),
      ),
    )
    .all();

  if (shifts.length === 0) {
    return null;
  }

  const inside = shifts.some(
    (shift) => shift.startAt <= startAt && shift.endAt >= endAt,
  );
  return inside ? null : `${staffName} nằm ngoài ca làm việc đã đăng ký.`;
}

export function findConflict(
  db: AppDb,
  input: {
    actor: ActorContext;
    branchId: string;
    roomId: string | null;
    photographerId: string | null;
    makeupId: string | null;
    editorId: string | null;
    startAt: Date;
    endAt: Date;
    bufferMinutes: number;
    excludeAppointmentId?: string;
  },
): string | null {
  const bufferStart = new Date(
    input.startAt.getTime() - input.bufferMinutes * 60 * 1000,
  );
  const bufferEnd = new Date(
    input.endAt.getTime() + input.bufferMinutes * 60 * 1000,
  );

  const conditions: SQL[] = [
    eq(appointments.tenantId, input.actor.tenantId),
    ne(appointments.status, "cancelled"),
    ne(appointments.status, "no_show"),
    lt(appointments.startAt, bufferEnd),
    gt(appointments.endAt, bufferStart),
  ];
  if (input.excludeAppointmentId) {
    conditions.push(ne(appointments.id, input.excludeAppointmentId));
  }

  if (input.roomId) {
    const room = db
      .select({ name: rooms.name })
      .from(rooms)
      .where(and(eq(rooms.id, input.roomId), eq(rooms.tenantId, input.actor.tenantId)))
      .get();
    const roomConflict = db
      .select({ startAt: appointments.startAt, endAt: appointments.endAt })
      .from(appointments)
      .where(and(...conditions, eq(appointments.roomId, input.roomId)))
      .get();

    if (roomConflict) {
      return `Phòng ${room?.name ?? "đã chọn"} đã có lịch ${conflictTimeLabel(
        roomConflict.startAt,
        roomConflict.endAt,
      )}. Cần buffer ${input.bufferMinutes} phút giữa hai ca.`;
    }
  }

  const staffRoles: {
    id: string | null;
    role: "photographer" | "makeup" | "retoucher";
    label: string;
  }[] = [
    { id: input.photographerId, role: "photographer", label: "Photographer" },
    { id: input.makeupId, role: "makeup", label: "Makeup" },
    { id: input.editorId, role: "retoucher", label: "Editor" },
  ];

  for (const item of staffRoles) {
    if (!item.id) {
      continue;
    }

    const staffRow = db
      .select({ name: staff.name })
      .from(staff)
      .where(and(eq(staff.id, item.id), eq(staff.tenantId, input.actor.tenantId)))
      .get();
    const staffName = staffRow?.name ?? item.label;

    const conflict = db
      .select({ startAt: appointments.startAt, endAt: appointments.endAt })
      .from(appointments)
      .where(
        and(
          ...conditions,
          or(
            eq(appointments.photographerId, item.id),
            eq(appointments.makeupId, item.id),
            eq(appointments.editorId, item.id),
          ),
        ),
      )
      .get();

    if (conflict) {
      return `${staffName} đã có lịch ${conflictTimeLabel(
        conflict.startAt,
        conflict.endAt,
      )}. Cần buffer ${input.bufferMinutes} phút giữa hai ca.`;
    }

    const leave = db
      .select({ startAt: leaveRequests.startAt, endAt: leaveRequests.endAt })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenantId, input.actor.tenantId),
          eq(leaveRequests.staffId, item.id),
          eq(leaveRequests.status, "approved"),
          lt(leaveRequests.startAt, input.endAt),
          gt(leaveRequests.endAt, input.startAt),
        ),
      )
      .get();

    if (leave) {
      return `${staffName} đang nghỉ phép ${conflictTimeLabel(
        leave.startAt,
        leave.endAt,
      )}.`;
    }

    const shiftConflict = checkStaffShift(
      db,
      input.actor,
      item.id,
      staffName,
      input.startAt,
      input.endAt,
    );
    if (shiftConflict) {
      return shiftConflict;
    }
  }

  return null;
}

export function suggestSlots(
  db: AppDb,
  input: {
    actor: ActorContext;
    branchId: string;
    dateKey: string;
    durationMinutes: number;
    roomId: string | null;
    photographerId: string | null;
    makeupId: string | null;
    editorId: string | null;
    bufferMinutes?: number;
    limit?: number;
  },
): string[] {
  const limit = input.limit ?? 4;
  const suggestions: string[] = [];
  const bufferMinutes = input.bufferMinutes ?? 30;
  const branch = db
    .select({ workingHours: branches.workingHours })
    .from(branches)
    .where(
      and(
        eq(branches.id, input.branchId),
        eq(branches.tenantId, input.actor.tenantId),
      ),
    )
    .get();

  if (!branch) {
    return suggestions;
  }

  for (let dayOffset = 0; dayOffset < 3 && suggestions.length < limit; dayOffset += 1) {
    const dateKey = addDaysToKey(input.dateKey, dayOffset);
    const hours = getWorkingHoursForDate(branch.workingHours, dateKey);
    if (!hours) {
      continue;
    }

    const [openValue, closeValue] = hours.split("-");
    const [openHour, openMinute] = (openValue ?? "08:00").split(":").map(Number);
    const [closeHour, closeMinute] = (closeValue ?? "18:00").split(":").map(Number);
    const open = (openHour ?? 8) * 60 + (openMinute ?? 0);
    const close = (closeHour ?? 18) * 60 + (closeMinute ?? 0);
    const now = new Date();
    const isToday = dateKey === getTodayKey();
    const nowMinutes = getLocalMinutes(now);

    for (let minute = open; minute + input.durationMinutes <= close; minute += 30) {
      if (isToday && minute <= nowMinutes) {
        continue;
      }
      const startAt = new Date(
        parseDateKey(dateKey).getTime() + minute * 60 * 1000,
      );
      const endAt = new Date(startAt.getTime() + input.durationMinutes * 60 * 1000);

      if (
        isWithinWorkingHours(branch.workingHours, startAt, endAt) &&
        !findConflict(db, {
          actor: input.actor,
          branchId: input.branchId,
          roomId: input.roomId,
          photographerId: input.photographerId,
          makeupId: input.makeupId,
          editorId: input.editorId,
          startAt,
          endAt,
          bufferMinutes,
        })
      ) {
        suggestions.push(
          `${dateKey === getTodayKey() ? "Hôm nay" : formatDateKey(dateKey)} ${formatTimeLabel(startAt)}`,
        );
        if (suggestions.length >= limit) {
          break;
        }
      }
    }
  }

  return suggestions;
}

async function runWithBusyRetry<T>(fn: () => T): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return fn();
    } catch (error) {
      lastError = error;
      if (!isSqliteBusy(error) || attempt === 2) {
        break;
      }
      await sleep(60 * (attempt + 1));
    }
  }

  if (isSqliteBusy(lastError)) {
    throw new ValidationError(
      "Hệ thống đang bận xử lý lịch. Vui lòng thử lại sau vài giây.",
    );
  }
  throw lastError;
}

export async function createAppointment(
  db: AppDb,
  actor: ActorContext,
  input: AppointmentInput,
): Promise<{ appointmentId: string; created: boolean }> {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new ValidationError("Khung giờ hẹn không hợp lệ.");
  }
  if (!input.idempotencyKey.trim()) {
    throw new ValidationError("Thiếu idempotency key cho lịch hẹn.");
  }

  const order = assertActiveOrderForBranch(db, actor, input.orderId, input.branchId);
  if (input.roomId) assertRoom(db, actor, input.roomId, input.branchId);
  const photographer = input.photographerId
    ? getStaffForBranch(db, actor, input.photographerId, input.branchId, "photographer")
    : null;
  const makeup = input.makeupId
    ? getStaffForBranch(db, actor, input.makeupId, input.branchId, "makeup")
    : null;
  const editor = input.editorId
    ? getStaffForBranch(db, actor, input.editorId, input.branchId, "retoucher")
    : null;

  const branch = db
    .select({ workingHours: branches.workingHours })
    .from(branches)
    .where(
      and(eq(branches.id, input.branchId), eq(branches.tenantId, actor.tenantId)),
    )
    .get();
  if (!branch) {
    throw new ValidationError("Chi nhánh không hợp lệ.");
  }
  if (!isWithinWorkingHours(branch.workingHours, startAt, endAt)) {
    throw new ValidationError(
      "Khung giờ nằm ngoài giờ làm việc hoặc ngày chi nhánh đóng cửa.",
    );
  }

  const dateKey = getVietnamDateKey(startAt);
  const mutexKeys = [
    `booking:${actor.tenantId}:${input.branchId}:${dateKey}`,
    ...(input.roomId ? [`booking:room:${input.roomId}:${dateKey}`] : []),
    ...(photographer ? [`booking:staff:${photographer.id}:${dateKey}`] : []),
    ...(makeup ? [`booking:staff:${makeup.id}:${dateKey}`] : []),
    ...(editor ? [`booking:staff:${editor.id}:${dateKey}`] : []),
  ];

  let result: { appointmentId: string; created: boolean };
  try {
    result = await withKeyedMutex(mutexKeys, async () =>
      runWithBusyRetry(() =>
        db.transaction(
          (tx) => {
            const txDb = tx as unknown as AppDb;
            const existing = txDb
              .select({ id: appointments.id })
              .from(appointments)
              .where(
                and(
                  eq(appointments.tenantId, actor.tenantId),
                  eq(appointments.idempotencyKey, input.idempotencyKey),
                ),
              )
              .get();

            if (existing) {
              return { appointmentId: existing.id, created: false };
            }

            const conflict = findConflict(txDb, {
              actor,
              branchId: input.branchId,
              roomId: input.roomId || null,
              photographerId: photographer?.id ?? null,
              makeupId: makeup?.id ?? null,
              editorId: editor?.id ?? null,
              startAt,
              endAt,
              bufferMinutes: 30,
            });

            if (conflict) {
              throw new BookingConflictError(conflict);
            }

            const appointmentId = crypto.randomUUID();
            tx.insert(appointments)
              .values({
                id: appointmentId,
                tenantId: actor.tenantId,
                branchId: input.branchId,
                orderId: input.orderId,
                roomId: input.roomId || null,
                photographerId: photographer?.id ?? null,
                makeupId: makeup?.id ?? null,
                editorId: editor?.id ?? null,
                startAt,
                endAt,
                bufferMinutes: 30,
                status: "scheduled",
                idempotencyKey: input.idempotencyKey.trim(),
                notes: input.notes.trim() || null,
                createdBy: actor.staffId,
              })
              .run();

            if (canTransitionOrder(order.status, "scheduled")) {
              tx.update(orders)
                .set({ status: "scheduled", updatedAt: new Date() })
                .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)))
                .run();
              tx.insert(orderStatusHistory)
                .values({
                  id: crypto.randomUUID(),
                  tenantId: actor.tenantId,
                  orderId: input.orderId,
                  fromStatus: order.status,
                  toStatus: "scheduled",
                  note: "Xếp lịch chụp.",
                  changedBy: actor.staffId,
                  createdAt: new Date(),
                })
                .run();
            }

            return { appointmentId, created: true };
          },
          { behavior: "immediate" },
        ),
      ),
    );
  } catch (error) {
    if (error instanceof BookingConflictError) {
      throw new BookingConflictError(
        error.message,
        suggestSlots(db, {
          actor,
          branchId: input.branchId,
          dateKey,
          durationMinutes: Math.max(30, Math.round((endAt.getTime() - startAt.getTime()) / 60000)),
          roomId: input.roomId || null,
          photographerId: photographer?.id ?? null,
          makeupId: makeup?.id ?? null,
          editorId: editor?.id ?? null,
        }),
      );
    }
    throw error;
  }

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "appointments.create",
    entity: "appointment",
    entityId: result.appointmentId,
    metadata: {
      orderId: input.orderId,
      branchId: input.branchId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      created: result.created,
    },
  });

  if (result.created) {
    notifyAppointmentStaff(db, actor, {
      appointmentId: result.appointmentId,
      staffIds: [photographer?.id ?? null, makeup?.id ?? null, editor?.id ?? null],
      title: "Lịch chụp mới",
      content: `Bạn được phân công lịch chụp ${formatDateTime(startAt)} – ${formatDateTime(endAt)}.`,
    });
  }

  return result;
}

export async function updateAppointment(
  db: AppDb,
  actor: ActorContext,
  appointmentId: string,
  input: Omit<AppointmentInput, "idempotencyKey">,
): Promise<void> {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);

  const current = db
    .select()
    .from(appointments)
    .where(and(...appointmentScopeConditions(actor), eq(appointments.id, appointmentId)))
    .get();
  if (!current) {
    throw new NotFoundError("Không tìm thấy lịch hẹn.");
  }
  if (current.status !== "scheduled") {
    throw new ValidationError("Chỉ có thể sửa lịch đang ở trạng thái đã lên lịch.");
  }

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
    throw new ValidationError("Khung giờ hẹn không hợp lệ.");
  }
  assertActiveOrderForBranch(db, actor, input.orderId, input.branchId);
  if (input.roomId) assertRoom(db, actor, input.roomId, input.branchId);
  const photographer = input.photographerId
    ? getStaffForBranch(db, actor, input.photographerId, input.branchId, "photographer")
    : null;
  const makeup = input.makeupId
    ? getStaffForBranch(db, actor, input.makeupId, input.branchId, "makeup")
    : null;
  const editor = input.editorId
    ? getStaffForBranch(db, actor, input.editorId, input.branchId, "retoucher")
    : null;

  const branch = db
    .select({ workingHours: branches.workingHours })
    .from(branches)
    .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, actor.tenantId)))
    .get();
  if (!branch || !isWithinWorkingHours(branch.workingHours, startAt, endAt)) {
    throw new ValidationError("Khung giờ nằm ngoài giờ làm việc của chi nhánh.");
  }

  const dateKey = getVietnamDateKey(startAt);
  const mutexKeys = [
    `booking:${actor.tenantId}:${input.branchId}:${dateKey}`,
    ...(input.roomId ? [`booking:room:${input.roomId}:${dateKey}`] : []),
    ...(photographer ? [`booking:staff:${photographer.id}:${dateKey}`] : []),
    ...(makeup ? [`booking:staff:${makeup.id}:${dateKey}`] : []),
    ...(editor ? [`booking:staff:${editor.id}:${dateKey}`] : []),
  ];

  try {
    await withKeyedMutex(mutexKeys, async () =>
      runWithBusyRetry(() =>
        db.transaction(
          (tx) => {
            const txDb = tx as unknown as AppDb;
            const conflict = findConflict(txDb, {
              actor,
              branchId: input.branchId,
              roomId: input.roomId || null,
              photographerId: photographer?.id ?? null,
              makeupId: makeup?.id ?? null,
              editorId: editor?.id ?? null,
              startAt,
              endAt,
              bufferMinutes: current.bufferMinutes,
              excludeAppointmentId: appointmentId,
            });
            if (conflict) {
              throw new BookingConflictError(conflict);
            }

            tx.update(appointments)
              .set({
                orderId: input.orderId,
                roomId: input.roomId || null,
                photographerId: photographer?.id ?? null,
                makeupId: makeup?.id ?? null,
                editorId: editor?.id ?? null,
                startAt,
                endAt,
                notes: input.notes.trim() || null,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(appointments.id, appointmentId),
                  eq(appointments.tenantId, actor.tenantId),
                ),
              )
              .run();
          },
          { behavior: "immediate" },
        ),
      ),
    );
  } catch (error) {
    if (error instanceof BookingConflictError) {
      throw new BookingConflictError(
        error.message,
        suggestSlots(db, {
          actor,
          branchId: input.branchId,
          dateKey,
          durationMinutes: Math.max(30, Math.round((endAt.getTime() - startAt.getTime()) / 60000)),
          roomId: input.roomId || null,
          photographerId: photographer?.id ?? null,
          makeupId: makeup?.id ?? null,
          editorId: editor?.id ?? null,
          bufferMinutes: current.bufferMinutes,
        }),
      );
    }
    throw error;
  }

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "appointments.update",
    entity: "appointment",
    entityId: appointmentId,
    metadata: {
      orderId: input.orderId,
      branchId: input.branchId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    },
  });

  notifyAppointmentStaff(db, actor, {
    appointmentId,
    staffIds: [photographer?.id ?? null, makeup?.id ?? null, editor?.id ?? null],
    title: "Lịch chụp đã thay đổi",
    content: `Lịch chụp đã được cập nhật: ${formatDateTime(startAt)} – ${formatDateTime(endAt)}.`,
  });
}

export function cancelAppointment(
  db: AppDb,
  actor: ActorContext,
  appointmentId: string,
  reason: string,
): void {
  assertPermission(actor, "schedule.manage");
  const current = db
    .select()
    .from(appointments)
    .where(and(...appointmentScopeConditions(actor), eq(appointments.id, appointmentId)))
    .get();
  if (!current) throw new NotFoundError("Không tìm thấy lịch hẹn.");
  if (current.status !== "scheduled") {
    throw new ValidationError("Chỉ có thể hủy lịch đang ở trạng thái đã lên lịch.");
  }
  if (!reason.trim()) {
    throw new ValidationError("Vui lòng nhập lý do hủy lịch.");
  }

  db.update(appointments)
    .set({
      status: "cancelled",
      cancelReason: reason.trim(),
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "appointments.cancel",
    entity: "appointment",
    entityId: appointmentId,
    metadata: { reason: reason.trim() },
  });

  notifyAppointmentStaff(db, actor, {
    appointmentId,
    staffIds: [current.photographerId, current.makeupId, current.editorId],
    title: "Lịch chụp đã hủy",
    content: `Lịch chụp ${formatDateTime(current.startAt)} đã bị hủy. Lý do: ${reason.trim()}`,
  });
}

function assertCheckInPermission(actor: ActorContext, appointment: { photographerId: string | null }): void {
  if (
    hasPermission(actor.permissions, "schedule.manage") ||
    (appointment.photographerId !== null && appointment.photographerId === actor.staffId)
  ) {
    return;
  }
  throw new AuthorizationError("Bạn không có quyền check-in lịch hẹn này.");
}

export function checkInAppointment(
  db: AppDb,
  actor: ActorContext,
  appointmentId: string,
): void {
  const current = db
    .select()
    .from(appointments)
    .where(and(...appointmentScopeConditions(actor), eq(appointments.id, appointmentId)))
    .get();
  if (!current) throw new NotFoundError("Không tìm thấy lịch hẹn.");
  assertCheckInPermission(actor, current);
  if (current.status !== "scheduled") {
    throw new ValidationError("Chỉ check-in lịch đang ở trạng thái đã lên lịch.");
  }

  const now = new Date();
  db.transaction((tx) => {
    tx.update(appointments)
      .set({
        status: "checked_in",
        checkInAt: now,
        checkedInBy: actor.staffId,
        updatedAt: now,
      })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, actor.tenantId)))
      .run();

    const order = tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, current.orderId), eq(orders.tenantId, actor.tenantId)))
      .get();
    if (order && canTransitionOrder(order.status, "shooting")) {
      tx.update(orders)
        .set({ status: "shooting", updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, actor.tenantId)))
        .run();
      tx.insert(orderStatusHistory)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "shooting",
          note: "Check-in buổi chụp.",
          changedBy: actor.staffId,
          createdAt: now,
        })
        .run();
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "appointments.check_in",
    entity: "appointment",
    entityId: appointmentId,
  });
}

export function checkOutAppointment(
  db: AppDb,
  actor: ActorContext,
  appointmentId: string,
): void {
  const current = db
    .select()
    .from(appointments)
    .where(and(...appointmentScopeConditions(actor), eq(appointments.id, appointmentId)))
    .get();
  if (!current) throw new NotFoundError("Không tìm thấy lịch hẹn.");
  assertCheckInPermission(actor, current);
  if (current.status !== "checked_in") {
    throw new ValidationError("Chỉ check-out lịch đang check-in.");
  }

  const now = new Date();
  db.transaction((tx) => {
    tx.update(appointments)
      .set({
        status: "completed",
        checkOutAt: now,
        checkedOutBy: actor.staffId,
        updatedAt: now,
      })
      .where(and(eq(appointments.id, appointmentId), eq(appointments.tenantId, actor.tenantId)))
      .run();

    const order = tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, current.orderId), eq(orders.tenantId, actor.tenantId)))
      .get();
    if (order && canTransitionOrder(order.status, "awaiting_edit")) {
      tx.update(orders)
        .set({ status: "awaiting_edit", updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, actor.tenantId)))
        .run();
      tx.insert(orderStatusHistory)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "awaiting_edit",
          note: "Check-out buổi chụp.",
          changedBy: actor.staffId,
          createdAt: now,
        })
        .run();
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "appointments.check_out",
    entity: "appointment",
    entityId: appointmentId,
  });
}

export function getAppointmentDetail(
  db: AppDb,
  actor: ActorContext,
  appointmentId: string,
): AppointmentDetail | null {
  assertPermission(actor, "schedule.view");
  const row = db
    .select({
      appointment: appointments,
      orderCode: orders.code,
      orderStatus: orders.status,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      branchName: branches.name,
      roomName: rooms.name,
    })
    .from(appointments)
    .innerJoin(orders, eq(appointments.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(branches, eq(appointments.branchId, branches.id))
    .leftJoin(rooms, eq(appointments.roomId, rooms.id))
    .where(and(...appointmentScopeConditions(actor), eq(appointments.id, appointmentId)))
    .get();

  if (!row) return null;

  const staffIds = [
    row.appointment.photographerId,
    row.appointment.makeupId,
    row.appointment.editorId,
  ].filter((id): id is string => Boolean(id));
  const staffRows = staffIds.length
    ? db
        .select({ id: staff.id, name: staff.name })
        .from(staff)
        .where(inArray(staff.id, staffIds))
        .all()
    : [];
  const staffMap = new Map(staffRows.map((item) => [item.id, item.name]));
  const makeStaff = (id: string | null) =>
    id ? { id, name: staffMap.get(id) ?? "Không xác định" } : null;

  return {
    id: row.appointment.id,
    tenantId: row.appointment.tenantId,
    branchId: row.appointment.branchId,
    branchName: row.branchName ?? "Không xác định",
    orderId: row.appointment.orderId,
    orderCode: row.orderCode,
    orderStatus: row.orderStatus,
    customerId: row.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    roomId: row.appointment.roomId,
    roomName: row.roomName,
    photographer: makeStaff(row.appointment.photographerId),
    makeup: makeStaff(row.appointment.makeupId),
    editor: makeStaff(row.appointment.editorId),
    startAt: row.appointment.startAt,
    endAt: row.appointment.endAt,
    bufferMinutes: row.appointment.bufferMinutes,
    status: row.appointment.status,
    notes: row.appointment.notes,
    checkInAt: row.appointment.checkInAt,
    checkOutAt: row.appointment.checkOutAt,
    cancelReason: row.appointment.cancelReason,
    createdAt: row.appointment.createdAt,
  };
}

export function getCalendarData(
  db: AppDb,
  actor: ActorContext,
  filters: AppointmentListFilters,
): CalendarData {
  expireHolds(db);
  assertPermission(actor, "schedule.view");
  const todayKey = getTodayKey();
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(filters.date) ? filters.date : todayKey;
  const view = (["day", "week", "month", "timeline"] as const).includes(filters.view)
    ? filters.view
    : "week";

  let rangeStart: Date;
  let rangeEnd: Date;
  let monthKey: string | null = null;
  if (view === "day") {
    const range = getDayRange(dateKey);
    rangeStart = range.start;
    rangeEnd = range.end;
  } else if (view === "week") {
    const range = getWeekRange(dateKey);
    rangeStart = range.start;
    rangeEnd = range.end;
  } else if (view === "month") {
    const range = getMonthGridRange(dateKey);
    rangeStart = range.start;
    rangeEnd = range.end;
    monthKey = range.monthKey;
  } else {
    rangeStart = parseDateKey(dateKey);
    rangeEnd = parseDateKey(addDaysToKey(dateKey, 30));
  }

  const scope = getBranchScope(actor);
  const prevDateKey =
    view === "month"
      ? addMonthsToKey(dateKey, -1)
      : view === "week" || view === "timeline"
        ? addDaysToKey(dateKey, -7)
        : addDaysToKey(dateKey, -1);
  const nextDateKey =
    view === "month"
      ? addMonthsToKey(dateKey, 1)
      : view === "week" || view === "timeline"
        ? addDaysToKey(dateKey, 7)
        : addDaysToKey(dateKey, 1);

  if (scope.mode === "none") {
    return {
      view,
      dateKey,
      rangeStartKey: getVietnamDateKey(rangeStart),
      rangeEndKey: getVietnamDateKey(rangeEnd),
      rangeLabel: formatDateRangeLabel(getVietnamDateKey(rangeStart), getVietnamDateKey(rangeEnd)),
      monthLabel: monthKey ? formatMonthLabel(dateKey) : null,
      todayKey,
      prevDateKey,
      nextDateKey,
      branchId: null,
      photographerId: filters.photographerId ?? null,
      roomId: filters.roomId ?? null,
      days: [],
      appointments: [],
    };
  }

  const branchId =
    filters.branchId && filters.branchId !== ""
      ? filters.branchId
      : actor.activeBranchId ?? (scope.mode === "branch" ? scope.branchId : null);
  if (branchId) assertBranchAccess(actor, branchId);

  const conditions: SQL[] = [
    eq(appointments.tenantId, actor.tenantId),
    isNull(appointments.archivedAt),
    gte(appointments.startAt, rangeStart),
    lt(appointments.startAt, rangeEnd),
  ];
  if (branchId) {
    conditions.push(eq(appointments.branchId, branchId));
  } else if (scope.mode === "branch") {
    conditions.push(eq(appointments.branchId, scope.branchId));
  }
  if (filters.photographerId) {
    conditions.push(eq(appointments.photographerId, filters.photographerId));
  }
  if (filters.roomId) {
    conditions.push(eq(appointments.roomId, filters.roomId));
  }

  const rows = db
    .select({
      appointment: appointments,
      orderCode: orders.code,
      customerName: customers.name,
      branchName: branches.name,
      roomName: rooms.name,
    })
    .from(appointments)
    .innerJoin(orders, eq(appointments.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(branches, eq(appointments.branchId, branches.id))
    .leftJoin(rooms, eq(appointments.roomId, rooms.id))
    .where(and(...conditions))
    .orderBy(asc(appointments.startAt))
    .limit(1000)
    .all();

  const staffIds = [
    ...new Set(
      rows
        .flatMap((row) => [
          row.appointment.photographerId,
          row.appointment.makeupId,
          row.appointment.editorId,
        ])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const staffRows = staffIds.length
    ? db
        .select({ id: staff.id, name: staff.name })
        .from(staff)
        .where(inArray(staff.id, staffIds))
        .all()
    : [];
  const staffMap = new Map(staffRows.map((item) => [item.id, item.name]));

  const mapped: CalendarAppointment[] = rows.map((row) => ({
    id: row.appointment.id,
    orderId: row.appointment.orderId,
    orderCode: row.orderCode,
    customerName: row.customerName,
    branchId: row.appointment.branchId,
    branchName: row.branchName ?? "Không xác định",
    roomId: row.appointment.roomId,
    roomName: row.roomName,
    photographerId: row.appointment.photographerId,
    photographerName: row.appointment.photographerId
      ? staffMap.get(row.appointment.photographerId) ?? "Không xác định"
      : null,
    startAt: row.appointment.startAt,
    endAt: row.appointment.endAt,
    status: row.appointment.status,
    colorKey: row.appointment.photographerId
      ? `staff:${row.appointment.photographerId}`
      : row.appointment.roomId
        ? `room:${row.appointment.roomId}`
        : `branch:${row.appointment.branchId}`,
  }));

  const startKey = getVietnamDateKey(rangeStart);
  const endKey = getVietnamDateKey(rangeEnd);
  const dateKeys = getDateKeysInRange(startKey, endKey);
  const days: CalendarDay[] = dateKeys.map((key) => ({
    dateKey: key,
    label: formatDateKey(key),
    weekdayLabel: formatWeekdayLabel(key),
    isToday: key === todayKey,
    isCurrentMonth: monthKey ? getMonthKey(key) === monthKey : true,
    appointments: mapped.filter(
      (appointment) => getVietnamDateKey(appointment.startAt) === key,
    ),
  }));

  return {
    view,
    dateKey,
    rangeStartKey: startKey,
    rangeEndKey: endKey,
    rangeLabel: formatDateRangeLabel(startKey, endKey),
    monthLabel: monthKey ? formatMonthLabel(dateKey) : null,
    todayKey,
    prevDateKey,
    nextDateKey,
    branchId: branchId ?? null,
    photographerId: filters.photographerId ?? null,
    roomId: filters.roomId ?? null,
    days,
    appointments: mapped,
  };
}

export function appointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_META[status].label;
}

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_META[status].label;
}

export function isAppointmentActive(status: AppointmentStatus): boolean {
  return APPOINTMENT_STATUSES.includes(status) && status !== "cancelled" && status !== "no_show";
}
