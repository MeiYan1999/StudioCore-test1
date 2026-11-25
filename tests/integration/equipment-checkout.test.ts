import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { appointments, equipment, equipmentUsages } from "@/lib/db/schema";
import {
  checkInEquipment,
  checkOutEquipment,
  listAppointmentEquipment,
  updateEquipment,
} from "@/lib/services/equipment-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let secondaryOwner: ActorContext;
let appointmentId: string;
const cameraId = "equipment-demo-camera";

async function actorFor(email: string, ip: string): Promise<ActorContext> {
  const login = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip, userAgent: "vitest-equipment" },
  );
  if (!login.ok) throw new Error(login.error);
  const actor = await getActorFromToken(db, login.token);
  if (!actor) throw new Error(`Không dựng được actor ${email}`);
  return actor;
}

function cameraStatus(): string | undefined {
  return db.select().from(equipment).where(eq(equipment.id, cameraId)).get()?.status;
}

beforeAll(async () => {
  db = createTestDb();
  owner = { ...(await actorFor("owner@studiocore.demo", "10.8.0.1")), activeBranchId: null };
  secondaryOwner = await actorFor("owner@studiobinhminh.demo", "10.8.0.2");
  const camera = db.select().from(equipment).where(eq(equipment.id, cameraId)).get();
  const appointment = db
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.tenantId, owner.tenantId), eq(appointments.branchId, camera!.branchId)),
    )
    .get();
  if (!appointment) throw new Error("Thiếu lịch chụp ở chi nhánh của thiết bị");
  appointmentId = appointment.id;
  db.update(appointments).set({ status: "scheduled" }).where(eq(appointments.id, appointmentId)).run();
});

describe("mượn/trả thiết bị theo lịch chụp", () => {
  it("xuất thiết bị gắn lịch chụp và chặn xuất trùng", () => {
    const usageId = checkOutEquipment(db, owner, { equipmentId: cameraId, appointmentId });
    expect(cameraStatus()).toBe("in_use");
    const usage = db.select().from(equipmentUsages).where(eq(equipmentUsages.id, usageId)).get();
    expect(usage?.appointmentId).toBe(appointmentId);
    expect(usage?.returnedAt).toBeNull();
    expect(listAppointmentEquipment(db, owner, appointmentId).map((row) => row.id)).toContain(usageId);

    expect(() => checkOutEquipment(db, owner, { equipmentId: cameraId, appointmentId })).toThrow(
      /không sẵn sàng/,
    );
    const open = db
      .select()
      .from(equipmentUsages)
      .where(and(eq(equipmentUsages.equipmentId, cameraId), isNull(equipmentUsages.returnedAt)))
      .all();
    expect(open).toHaveLength(1);
  });

  it("không cho đổi trạng thái thủ công khi đang mượn", () => {
    const item = db.select().from(equipment).where(eq(equipment.id, cameraId)).get()!;
    expect(() =>
      updateEquipment(db, owner, cameraId, {
        branchId: item.branchId,
        name: item.name,
        category: item.category,
        serialNumber: item.serialNumber,
        status: "available",
        notes: "",
      }),
    ).toThrow(/đang được mượn/);
  });

  it("tenant khác không xuất hay nhận lại được", () => {
    const usage = db
      .select()
      .from(equipmentUsages)
      .where(and(eq(equipmentUsages.equipmentId, cameraId), isNull(equipmentUsages.returnedAt)))
      .get()!;
    expect(() => checkInEquipment(db, secondaryOwner, usage.id, { conditionIn: "good" })).toThrow(
      /Không tìm thấy/,
    );
    expect(() =>
      checkOutEquipment(db, secondaryOwner, { equipmentId: "equipment-demo-lens", appointmentId }),
    ).toThrow(/Không tìm thấy/);
  });

  it("nhận lại một lần; hư hỏng chuyển sang bảo trì", () => {
    const usage = db
      .select()
      .from(equipmentUsages)
      .where(and(eq(equipmentUsages.equipmentId, cameraId), isNull(equipmentUsages.returnedAt)))
      .get()!;
    checkInEquipment(db, owner, usage.id, { conditionIn: "good" });
    expect(cameraStatus()).toBe("available");
    expect(() => checkInEquipment(db, owner, usage.id, { conditionIn: "good" })).toThrow(
      /đã được nhận lại/,
    );

    const second = checkOutEquipment(db, owner, { equipmentId: cameraId, appointmentId });
    checkInEquipment(db, owner, second, { conditionIn: "damaged" });
    expect(cameraStatus()).toBe("maintenance");
    expect(() => checkOutEquipment(db, owner, { equipmentId: cameraId, appointmentId })).toThrow(
      /không sẵn sàng/,
    );
  });

  it("từ chối thiết bị khác chi nhánh và lịch đã hủy", () => {
    expect(() =>
      checkOutEquipment(db, owner, { equipmentId: "equipment-demo-reflector", appointmentId }),
    ).toThrow(/chi nhánh khác/);
    db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointmentId)).run();
    expect(() =>
      checkOutEquipment(db, owner, { equipmentId: "equipment-demo-lens", appointmentId }),
    ).toThrow(/chưa hoàn tất/);
  });
});
