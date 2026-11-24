import { and, asc, desc, eq, isNull, like, ne, or } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { appointments, branches, equipment, equipmentUsages, orders, staff } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";

export type EquipmentItem = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  category: string;
  serialNumber: string;
  status: string;
  notes: string | null;
};

export type EquipmentUsageView = {
  id: string;
  equipmentId: string;
  orderCode: string | null;
  staffName: string | null;
  checkedOutAt: Date;
  returnedAt: Date | null;
  conditionOut: string;
  conditionIn: string | null;
  notes: string | null;
};

export type EquipmentDetail = EquipmentItem & {
  usages: EquipmentUsageView[];
};

export type EquipmentInput = {
  branchId: string;
  name: string;
  category: string;
  serialNumber: string;
  status: string;
  notes: string;
};

function equipmentScopeConditions(actor: ActorContext) {
  const scope = getBranchScope(actor);
  const conditions = [eq(equipment.tenantId, actor.tenantId)];
  if (scope.mode === "branch") {
    conditions.push(eq(equipment.branchId, scope.branchId));
  }
  if (scope.mode === "none") {
    conditions.push(eq(equipment.id, "__scope_none__"));
  }
  return conditions;
}

export function listEquipment(
  db: AppDb,
  actor: ActorContext,
  filters: { q?: string; status?: string; branchId?: string } = {},
): EquipmentItem[] {
  assertPermission(actor, "schedule.view");
  const conditions = equipmentScopeConditions(actor);

  if (filters.branchId) {
    assertBranchAccess(actor, filters.branchId);
    conditions.push(eq(equipment.branchId, filters.branchId));
  }
  if (filters.status) {
    conditions.push(eq(equipment.status, filters.status));
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    const search = or(
      like(equipment.name, term),
      like(equipment.serialNumber, term),
    );
    if (search) conditions.push(search);
  }

  return db
    .select({
      id: equipment.id,
      branchId: equipment.branchId,
      branchName: branches.name,
      name: equipment.name,
      category: equipment.category,
      serialNumber: equipment.serialNumber,
      status: equipment.status,
      notes: equipment.notes,
    })
    .from(equipment)
    .leftJoin(branches, eq(equipment.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(asc(equipment.name))
    .all()
    .map((row) => ({
      ...row,
      branchName: row.branchName ?? "Không xác định",
    }));
}

export function getEquipmentDetail(
  db: AppDb,
  actor: ActorContext,
  equipmentId: string,
): EquipmentDetail | null {
  assertPermission(actor, "schedule.view");
  const row = db
    .select({
      item: equipment,
      branchName: branches.name,
    })
    .from(equipment)
    .leftJoin(branches, eq(equipment.branchId, branches.id))
    .where(and(...equipmentScopeConditions(actor), eq(equipment.id, equipmentId)))
    .get();

  if (!row) return null;

  const usages = db
    .select({
      id: equipmentUsages.id,
      equipmentId: equipmentUsages.equipmentId,
      orderCode: orders.code,
      staffName: staff.name,
      checkedOutAt: equipmentUsages.checkedOutAt,
      returnedAt: equipmentUsages.returnedAt,
      conditionOut: equipmentUsages.conditionOut,
      conditionIn: equipmentUsages.conditionIn,
      notes: equipmentUsages.notes,
    })
    .from(equipmentUsages)
    .leftJoin(orders, eq(equipmentUsages.orderId, orders.id))
    .leftJoin(staff, eq(equipmentUsages.staffId, staff.id))
    .where(
      and(
        eq(equipmentUsages.tenantId, actor.tenantId),
        eq(equipmentUsages.equipmentId, equipmentId),
      ),
    )
    .orderBy(desc(equipmentUsages.checkedOutAt))
    .all();

  return {
    id: row.item.id,
    branchId: row.item.branchId,
    branchName: row.branchName ?? "Không xác định",
    name: row.item.name,
    category: row.item.category,
    serialNumber: row.item.serialNumber,
    status: row.item.status,
    notes: row.item.notes,
    usages,
  };
}

export function createEquipment(
  db: AppDb,
  actor: ActorContext,
  input: EquipmentInput,
): string {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);
  const serialNumber = input.serialNumber.trim().toUpperCase();
  const duplicate = db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.tenantId, actor.tenantId),
        eq(equipment.serialNumber, serialNumber),
      ),
    )
    .get();
  if (duplicate) throw new ValidationError("Số serial thiết bị đã tồn tại.");

  const id = crypto.randomUUID();
  db.insert(equipment)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      category: input.category,
      serialNumber,
      status: input.status,
      notes: input.notes.trim() || null,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "equipment.create",
    entity: "equipment",
    entityId: id,
    metadata: { name: input.name, serialNumber, branchId: input.branchId },
  });

  return id;
}

export function updateEquipment(
  db: AppDb,
  actor: ActorContext,
  equipmentId: string,
  input: EquipmentInput,
): void {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);

  const existing = db
    .select({ id: equipment.id, branchId: equipment.branchId })
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, actor.tenantId)))
    .get();
  if (!existing) throw new NotFoundError("Không tìm thấy thiết bị.");

  const serialNumber = input.serialNumber.trim().toUpperCase();
  const duplicate = db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.tenantId, actor.tenantId),
        eq(equipment.serialNumber, serialNumber),
        ne(equipment.id, equipmentId),
      ),
    )
    .get();
  if (duplicate) throw new ValidationError("Số serial thiết bị đã tồn tại.");

  const openUsage = db
    .select({ id: equipmentUsages.id })
    .from(equipmentUsages)
    .where(
      and(
        eq(equipmentUsages.tenantId, actor.tenantId),
        eq(equipmentUsages.equipmentId, equipmentId),
        isNull(equipmentUsages.returnedAt),
      ),
    )
    .get();
  if (openUsage && (input.status !== "in_use" || input.branchId !== existing.branchId)) {
    throw new ValidationError(
      "Thiết bị đang được mượn. Hãy nhận lại thiết bị trước khi đổi trạng thái hoặc chi nhánh.",
    );
  }

  db.update(equipment)
    .set({
      branchId: input.branchId,
      name: input.name.trim(),
      category: input.category,
      serialNumber,
      status: input.status,
      notes: input.notes.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "equipment.update",
    entity: "equipment",
    entityId: equipmentId,
    metadata: { name: input.name, serialNumber, status: input.status },
  });
}

export type AppointmentEquipmentUsage = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  serialNumber: string;
  staffName: string | null;
  checkedOutAt: Date;
  returnedAt: Date | null;
  conditionOut: string;
  conditionIn: string | null;
};

/** Equipment checked out for one appointment, open usages first. */
export function listAppointmentEquipment(
  db: AppDb,
  actor: ActorContext,
  appointmentId: string,
): AppointmentEquipmentUsage[] {
  assertPermission(actor, "schedule.view");
  return db
    .select({
      id: equipmentUsages.id,
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      serialNumber: equipment.serialNumber,
      staffName: staff.name,
      checkedOutAt: equipmentUsages.checkedOutAt,
      returnedAt: equipmentUsages.returnedAt,
      conditionOut: equipmentUsages.conditionOut,
      conditionIn: equipmentUsages.conditionIn,
    })
    .from(equipmentUsages)
    .innerJoin(equipment, eq(equipmentUsages.equipmentId, equipment.id))
    .leftJoin(staff, eq(equipmentUsages.staffId, staff.id))
    .where(
      and(
        ...equipmentScopeConditions(actor),
        eq(equipmentUsages.tenantId, actor.tenantId),
        eq(equipmentUsages.appointmentId, appointmentId),
      ),
    )
    .orderBy(asc(equipmentUsages.returnedAt), desc(equipmentUsages.checkedOutAt))
    .all();
}

/**
 * Hands a piece of equipment to a shooting appointment. One open usage per
 * item: the status flip from `available` is the guard against double booking.
 */
export function checkOutEquipment(
  db: AppDb,
  actor: ActorContext,
  input: { equipmentId: string; appointmentId: string; notes?: string },
): string {
  assertPermission(actor, "schedule.manage");
  const item = db
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, input.equipmentId), eq(equipment.tenantId, actor.tenantId)))
    .get();
  if (!item) throw new NotFoundError("Không tìm thấy thiết bị.");
  assertBranchAccess(actor, item.branchId);

  const appointment = db
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.id, input.appointmentId), eq(appointments.tenantId, actor.tenantId)),
    )
    .get();
  if (!appointment) throw new NotFoundError("Không tìm thấy lịch chụp.");
  if (appointment.branchId !== item.branchId) {
    throw new ValidationError("Thiết bị thuộc chi nhánh khác với lịch chụp.");
  }
  if (appointment.status !== "scheduled" && appointment.status !== "checked_in") {
    throw new ValidationError("Chỉ xuất thiết bị cho lịch chụp chưa hoàn tất và chưa hủy.");
  }

  const id = crypto.randomUUID();
  db.transaction(
    (tx) => {
      const claimed = tx
        .update(equipment)
        .set({ status: "in_use", updatedAt: new Date() })
        .where(
          and(
            eq(equipment.id, item.id),
            eq(equipment.tenantId, actor.tenantId),
            eq(equipment.status, "available"),
          ),
        )
        .run();
      if (claimed.changes !== 1) {
        throw new ValidationError("Thiết bị không sẵn sàng (đang được mượn, bảo trì hoặc ngừng dùng).");
      }
      tx.insert(equipmentUsages)
        .values({
          id,
          tenantId: actor.tenantId,
          equipmentId: item.id,
          orderId: appointment.orderId,
          appointmentId: appointment.id,
          staffId: appointment.photographerId,
          checkedOutAt: new Date(),
          conditionOut: "good",
          notes: input.notes?.trim() || null,
          createdBy: actor.staffId,
        })
        .run();
      writeAudit(tx as unknown as AppDb, {
        tenantId: actor.tenantId,
        actorId: actor.staffId,
        action: "equipment.checkout",
        entity: "equipment",
        entityId: item.id,
        metadata: { usageId: id, appointmentId: appointment.id },
      });
    },
    { behavior: "immediate" },
  );
  return id;
}

/** Takes equipment back; damaged items go to maintenance instead of available. */
export function checkInEquipment(
  db: AppDb,
  actor: ActorContext,
  usageId: string,
  input: { conditionIn: "good" | "damaged"; notes?: string },
): void {
  assertPermission(actor, "schedule.manage");
  const row = db
    .select({ usage: equipmentUsages, branchId: equipment.branchId })
    .from(equipmentUsages)
    .innerJoin(equipment, eq(equipmentUsages.equipmentId, equipment.id))
    .where(
      and(
        eq(equipmentUsages.id, usageId),
        eq(equipmentUsages.tenantId, actor.tenantId),
        eq(equipment.tenantId, actor.tenantId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy lượt mượn thiết bị.");
  assertBranchAccess(actor, row.branchId);

  db.transaction(
    (tx) => {
      const closed = tx
        .update(equipmentUsages)
        .set({
          returnedAt: new Date(),
          conditionIn: input.conditionIn,
          ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
        })
        .where(and(eq(equipmentUsages.id, usageId), isNull(equipmentUsages.returnedAt)))
        .run();
      if (closed.changes !== 1) {
        throw new ValidationError("Thiết bị này đã được nhận lại.");
      }
      tx.update(equipment)
        .set({
          status: input.conditionIn === "damaged" ? "maintenance" : "available",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(equipment.id, row.usage.equipmentId),
            eq(equipment.tenantId, actor.tenantId),
            eq(equipment.status, "in_use"),
          ),
        )
        .run();
      writeAudit(tx as unknown as AppDb, {
        tenantId: actor.tenantId,
        actorId: actor.staffId,
        action: "equipment.checkin",
        entity: "equipment",
        entityId: row.usage.equipmentId,
        metadata: { usageId, conditionIn: input.conditionIn },
      });
    },
    { behavior: "immediate" },
  );
}
