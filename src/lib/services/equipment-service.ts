import { and, asc, desc, eq, like, ne, or } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { branches, equipment, equipmentUsages, orders, staff } from "../db/schema";
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
    .select({ id: equipment.id })
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
