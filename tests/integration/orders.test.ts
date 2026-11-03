import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { customers, vouchers } from "@/lib/db/schema";
import {
  changeOrderStatus,
  confirmOrderContract,
  createOrder,
  getOrderDetail,
  listOrders,
  recordOrderPayment,
} from "@/lib/services/order-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let photographer: ActorContext;
let secondaryOwner: ActorContext;

beforeAll(async () => {
  db = createTestDb();
  const ownerLogin = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.20", userAgent: "vitest-orders" },
  );
  if (!ownerLogin.ok) throw new Error("Không login được owner");
  const ownerActor = await getActorFromToken(db, ownerLogin.token);
  if (!ownerActor) throw new Error("Không tạo được owner actor");
  owner = ownerActor;

  const photoLogin = await authenticate(
    db,
    { mode: "pin", identifier: "SC-PHOTO", secret: "444444" },
    { ip: "192.0.2.21", userAgent: "vitest-orders-photo" },
  );
  if (!photoLogin.ok) throw new Error("Không login được photographer");
  const photoActor = await getActorFromToken(db, photoLogin.token);
  if (!photoActor) throw new Error("Không tạo được photographer actor");
  photographer = photoActor;

  const secondaryLogin = await authenticate(
    db,
    {
      mode: "password",
      identifier: "owner@studiobinhminh.demo",
      secret: "Demo@123",
    },
    { ip: "192.0.2.22", userAgent: "vitest-orders-secondary" },
  );
  if (!secondaryLogin.ok) throw new Error("Không login được tenant phụ");
  const secondaryActor = await getActorFromToken(db, secondaryLogin.token);
  if (!secondaryActor) throw new Error("Không tạo được secondary actor");
  secondaryOwner = secondaryActor;
});

const baseOrder = {
  customerMode: "existing" as const,
  customerId: "customer-demo-01",
  customerName: "",
  customerPhone: "",
  branchId: "branch-demo-q1",
  scheduledAt: "2026-11-20T09:00",
  location: "Studio Quận 1",
  photographerId: "staff-sc-photo",
  editorId: "staff-sc-retouch",
  makeupId: "staff-sc-makeup",
  items: [
    {
      itemType: "service" as const,
      refId: "service-demo-wedding",
      name: "Sai tên client",
      quantity: 1,
      unitPrice: 1,
    },
    {
      itemType: "addon" as const,
      refId: "addon-demo-makeup",
      name: "Sai giá client",
      quantity: 1,
      unitPrice: 1,
    },
    {
      itemType: "product" as const,
      refId: "product-demo-album",
      name: "Sai giá client",
      quantity: 1,
      unitPrice: 1,
    },
  ],
  surcharge: 0,
  discount: 200_000,
  voucherCode: "WELCOME10",
  deposit: 5_000_000,
  depositMethod: "bank_transfer",
  notes: "Đơn integration test",
};

describe("tạo đơn hàng", () => {
  it("server lấy giá catalog và tính voucher đúng", () => {
    const voucherBefore = db
      .select({ usedCount: vouchers.usedCount })
      .from(vouchers)
      .where(eq(vouchers.code, "WELCOME10"))
      .get();

    const orderId = createOrder(db, owner, baseOrder);
    const detail = getOrderDetail(db, owner, orderId);
    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.items).toHaveLength(3);
    expect(detail.subtotal).toBe(14_700_000);
    expect(detail.voucherDiscount).toBe(1_000_000);
    expect(detail.total).toBe(13_500_000);
    expect(detail.paid).toBe(5_000_000);
    expect(detail.remaining).toBe(8_500_000);
    expect(detail.status).toBe("deposit_received");
    expect(detail.payments).toHaveLength(1);

    const voucherAfter = db
      .select({ usedCount: vouchers.usedCount })
      .from(vouchers)
      .where(eq(vouchers.code, "WELCOME10"))
      .get();
    expect((voucherAfter?.usedCount ?? 0) - (voucherBefore?.usedCount ?? 0)).toBe(1);

    const paymentId = recordOrderPayment(db, owner, orderId, {
      amount: 8_500_000,
      method: "cash",
      reference: "TEST-FINAL",
      paidAt: "2026-11-21T10:00",
    });
    expect(paymentId).toBeTruthy();

    const paidDetail = getOrderDetail(db, owner, orderId);
    expect(paidDetail?.paid).toBe(13_500_000);
    expect(paidDetail?.remaining).toBe(0);

    changeOrderStatus(db, owner, orderId, "confirmed", "Khách xác nhận.");
    changeOrderStatus(db, owner, orderId, "scheduled", "Đã xếp lịch.");
    expect(() =>
      changeOrderStatus(db, owner, orderId, "completed", "Nhảy cóc"),
    ).toThrow(/Không thể chuyển/);

    confirmOrderContract(db, owner, orderId);
    const finalDetail = getOrderDetail(db, owner, orderId);
    expect(finalDetail?.contractConfirmedAt).not.toBeNull();
    expect(finalDetail?.history.length).toBeGreaterThanOrEqual(3);
  });

  it("tạo khách mới cùng đơn và chặn trùng SĐT", () => {
    const orderId = createOrder(db, owner, {
      ...baseOrder,
      customerMode: "new",
      customerId: "",
      customerName: "Khách Mới Đơn",
      customerPhone: "0912 888 999",
      items: [
        {
          itemType: "custom",
          refId: null,
          name: "Dịch vụ tự nhập",
          quantity: 1,
          unitPrice: 1_000_000,
        },
      ],
      voucherCode: "",
      discount: 0,
      deposit: 0,
      depositMethod: "cash",
    });

    const detail = getOrderDetail(db, owner, orderId);
    expect(detail?.customer.name).toBe("Khách Mới Đơn");
    expect(detail?.total).toBe(1_000_000);
    expect(detail?.paid).toBe(0);
    expect(detail?.status).toBe("new");

    const created = db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.phone, "0912888999"))
      .get();
    expect(created).toBeTruthy();

    expect(() =>
      createOrder(db, owner, {
        ...baseOrder,
        customerMode: "new",
        customerId: "",
        customerName: "Khách Trùng",
        customerPhone: "0912 888 999",
      }),
    ).toThrow(/đã tồn tại/);
  });

  it("chặn photographer tạo đơn và tenant phụ xem đơn demo", () => {
    expect(() => createOrder(db, photographer, baseOrder)).toThrow(/quyền/);

    const demoOrders = listOrders(db, owner, { pageSize: 100 });
    const demoOrder = demoOrders.items[0];
    expect(demoOrder).toBeTruthy();
    if (!demoOrder) return;

    expect(getOrderDetail(db, secondaryOwner, demoOrder.id)).toBeNull();
    expect(listOrders(db, secondaryOwner, {}).total).toBe(0);
  });

  it("chặn cọc vượt tổng tiền", () => {
    expect(() =>
      createOrder(db, owner, {
        ...baseOrder,
        items: [
          {
            itemType: "custom",
            refId: null,
            name: "Item nhỏ",
            quantity: 1,
            unitPrice: 100_000,
          },
        ],
        voucherCode: "",
        discount: 0,
        deposit: 200_000,
      }),
    ).toThrow(/cọc/i);
  });
});
