import { and, asc, eq, ne } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { branches, rooms } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";

export type RoomItem = {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  capacity: number;
  status: string;
  notes: string | null;
};

export type RoomInput = {
  branchId: string;
  name: string;
  capacity: number;
  status: string;
  notes: string;
};

export function listRooms(db: AppDb, actor: ActorContext): RoomItem[] {
  assertPermission(actor, "schedule.view");
  const scope = getBranchScope(actor);
  const conditions = [eq(rooms.tenantId, actor.tenantId)];

  if (scope.mode === "branch") {
    conditions.push(eq(rooms.branchId, scope.branchId));
  }
  if (scope.mode === "none") {
    return [];
  }

  return db
    .select({
      id: rooms.id,
      branchId: rooms.branchId,
      branchName: branches.name,
      name: rooms.name,
      capacity: rooms.capacity,
      status: rooms.status,
      notes: rooms.notes,
    })
    .from(rooms)
    .leftJoin(branches, eq(rooms.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(asc(rooms.name))
    .all()
    .map((row) => ({
      ...row,
      branchName: row.branchName ?? "Không xác định",
    }));
}

export function createRoom(db: AppDb, actor: ActorContext, input: RoomInput): string {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);

  const name = input.name.trim();
  const duplicate = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(
      and(
        eq(rooms.tenantId, actor.tenantId),
        eq(rooms.branchId, input.branchId),
        eq(rooms.name, name),
      ),
    )
    .get();

  if (duplicate) {
    throw new ValidationError("Tên phòng đã tồn tại trong chi nhánh.");
  }

  const id = crypto.randomUUID();
  db.insert(rooms)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      name,
      capacity: input.capacity,
      status: input.status,
      notes: input.notes.trim() || null,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "rooms.create",
    entity: "room",
    entityId: id,
    metadata: { name, branchId: input.branchId },
  });

  return id;
}

export function updateRoom(
  db: AppDb,
  actor: ActorContext,
  roomId: string,
  input: RoomInput,
): void {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);

  const existing = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.id, roomId), eq(rooms.tenantId, actor.tenantId)))
    .get();

  if (!existing) {
    throw new NotFoundError("Không tìm thấy phòng chụp.");
  }

  const name = input.name.trim();
  const duplicate = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(
      and(
        eq(rooms.tenantId, actor.tenantId),
        eq(rooms.branchId, input.branchId),
        eq(rooms.name, name),
        ne(rooms.id, roomId),
      ),
    )
    .get();

  if (duplicate) {
    throw new ValidationError("Tên phòng đã tồn tại trong chi nhánh.");
  }

  db.update(rooms)
    .set({
      branchId: input.branchId,
      name,
      capacity: input.capacity,
      status: input.status,
      notes: input.notes.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(rooms.id, roomId), eq(rooms.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "rooms.update",
    entity: "room",
    entityId: roomId,
    metadata: { name, branchId: input.branchId, status: input.status },
  });
}
