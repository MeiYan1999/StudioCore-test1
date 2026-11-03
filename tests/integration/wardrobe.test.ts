import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import {
  createRental,
  getWardrobeItemDetail,
  listWardrobeItems,
  returnRental,
} from "@/lib/services/wardrobe-service";
import {
  createEquipment,
  listEquipment,
  updateEquipment,
} from "@/lib/services/equipment-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let photographer: ActorContext;

beforeAll(async () => {
  db = createTestDb();
  const ownerLogin = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.40", userAgent: "vitest-wardrobe" },
  );
  if (!ownerLogin.ok) throw new Error("Không login owner");
  const ownerActor = await getActorFromToken(db, ownerLogin.token);
  if (!ownerActor) throw new Error("Không tạo owner actor");
  owner = ownerActor;

  const photoLogin = await authenticate(
    db,
    { mode: "pin", identifier: "SC-PHOTO", secret: "444444" },
    { ip: "192.0.2.41", userAgent: "vitest-wardrobe-photo" },
  );
  if (!photoLogin.ok) throw new Error("Không login photographer");
  const photoActor = await getActorFromToken(db, photoLogin.token);
  if (!photoActor) throw new Error("Không tạo photographer actor");
  photographer = photoActor;
});

describe("kho trang phục", () => {
  it("tìm theo mã QR và tạo/trả phiếu thuê, tính phí vào đơn", async () => {
    const found = listWardrobeItems(db, owner, { q: "QR-VD-002" });
    expect(found).toHaveLength(1);
    const item = found[0];
    expect(item?.status).toBe("available");
    if (!item) return;

    await expect(
      createRental(db, photographer, {
        wardrobeItemId: item.id,
        orderId: "order-demo-03",
        dueAt: new Date("2026-11-30T18:00:00+07:00").toISOString(),
        deposit: 1_000_000,
        conditionOut: "good",
        notes: "Thuê demo.",
      }),
    ).rejects.toThrow(/quyền/);

    const rentalId = await createRental(db, owner, {
      wardrobeItemId: item.id,
      orderId: "order-demo-03",
      dueAt: new Date("2026-11-30T18:00:00+07:00").toISOString(),
      deposit: 1_000_000,
      conditionOut: "good",
      notes: "Thuê demo.",
    });
    expect(rentalId).toBeTruthy();

    const rentedItem = getWardrobeItemDetail(db, owner, item.id);
    expect(rentedItem?.status).toBe("rented");
    expect(rentedItem?.rentals.some((rental) => rental.status === "active")).toBe(true);

    await expect(
      createRental(db, owner, {
        wardrobeItemId: item.id,
        orderId: "order-demo-03",
        dueAt: new Date("2026-12-10T18:00:00+07:00").toISOString(),
        deposit: 1_000_000,
        conditionOut: "good",
        notes: "Thuê trùng.",
      }),
    ).rejects.toThrow(/sẵn sàng|giao dịch khác/);

    const orderBefore = db
      .select({ total: orders.total, remaining: orders.remaining })
      .from(orders)
      .where(eq(orders.id, "order-demo-03"))
      .get();

    const returned = returnRental(db, owner, rentalId, {
      conditionIn: "cleaning",
      cleaningFee: 200_000,
      damageFee: 0,
      notes: "Cần giặt.",
    });
    expect(returned.totalFee).toBe(200_000);

    const itemAfterReturn = getWardrobeItemDetail(db, owner, item.id);
    expect(itemAfterReturn?.status).toBe("cleaning");
    expect(itemAfterReturn?.rentals.some((rental) => rental.status === "returned")).toBe(true);

    const orderAfter = db
      .select({ total: orders.total, remaining: orders.remaining })
      .from(orders)
      .where(eq(orders.id, "order-demo-03"))
      .get();
    expect((orderAfter?.total ?? 0) - (orderBefore?.total ?? 0)).toBe(200_000);
    expect((orderAfter?.remaining ?? 0) - (orderBefore?.remaining ?? 0)).toBe(200_000);
  });

  it("không cho thuê trang phục đang bảo trì", async () => {
    const maintenance = listWardrobeItems(db, owner, { q: "QR-VD-013" })[0];
    expect(maintenance?.status).toBe("maintenance");
    if (!maintenance) return;

    await expect(
      createRental(db, owner, {
        wardrobeItemId: maintenance.id,
        orderId: "",
        dueAt: new Date("2026-12-01T18:00:00+07:00").toISOString(),
        deposit: 0,
        conditionOut: "good",
        notes: "",
      }),
    ).rejects.toThrow(/sẵn sàng/);
  });
});

describe("thiết bị", () => {
  it("tạo, cập nhật và chặn serial trùng", () => {
    const id = createEquipment(db, owner, {
      branchId: "branch-demo-q1",
      name: "Máy test",
      category: "camera",
      serialNumber: "TEST-CAM-001",
      status: "available",
      notes: "Thiết bị test.",
    });

    const found = listEquipment(db, owner, { q: "TEST-CAM-001" });
    expect(found).toHaveLength(1);

    updateEquipment(db, owner, id, {
      branchId: "branch-demo-q1",
      name: "Máy test cập nhật",
      category: "camera",
      serialNumber: "TEST-CAM-001",
      status: "maintenance",
      notes: "",
    });
    expect(listEquipment(db, owner, { q: "Máy test cập nhật" })[0]?.status).toBe("maintenance");

    expect(() =>
      createEquipment(db, owner, {
        branchId: "branch-demo-q1",
        name: "Máy trùng",
        category: "camera",
        serialNumber: "TEST-CAM-001",
        status: "available",
        notes: "",
      }),
    ).toThrow(/serial/i);
  });
});
