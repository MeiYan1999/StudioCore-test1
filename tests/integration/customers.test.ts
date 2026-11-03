import { beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import {
  addCustomerInteraction,
  createCustomer,
  getCustomerDetail,
  listCustomers,
  updateCustomer,
} from "@/lib/services/customer-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;

beforeAll(async () => {
  db = createTestDb();
  const login = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.10", userAgent: "vitest-crm" },
  );
  if (!login.ok) throw new Error("Không login được owner");
  const actor = await getActorFromToken(db, login.token);
  if (!actor) throw new Error("Không tạo được actor");
  owner = actor;
});

const baseCustomer = {
  name: "Khách Kiểm Thử",
  phone: "0912 345 678",
  email: "khach.test@example.demo",
  address: "Quận 1",
  birthday: "1995-05-20",
  source: "facebook" as const,
  tier: "vip" as const,
  status: "lead" as const,
  ownerId: null,
  branchId: "branch-demo-q1",
  tags: ["cưới", "follow-up"],
  heightCm: "165",
  dressSize: "M",
  shoeSize: "37",
  measurementsNote: "Ưu tiên makeup tự nhiên",
  followUpAt: "2026-11-20T09:00",
  notes: "Khách demo kiểm thử",
};

describe("CRM", () => {
  it("tạo khách, chuẩn hóa SĐT và chặn trùng", () => {
    const id = createCustomer(db, owner, baseCustomer);
    expect(id).toBeTruthy();

    expect(() => createCustomer(db, owner, baseCustomer)).toThrow(/Số điện thoại/);
    const list = listCustomers(db, owner, { q: "Khách Kiểm Thử" });
    expect(list.items.some((customer) => customer.id === id)).toBe(true);
  });

  it("cập nhật khách và ghi nhận tương tác", () => {
    const list = listCustomers(db, owner, { q: "Khách Kiểm Thử" });
    const customer = list.items[0];
    expect(customer).toBeTruthy();
    if (!customer) return;

    updateCustomer(db, owner, customer.id, {
      ...baseCustomer,
      name: "Khách Kiểm Thử Đã Sửa",
      tier: "vvip",
    });

    addCustomerInteraction(db, owner, {
      customerId: customer.id,
      type: "call",
      content: "Gọi tư vấn gói cưới.",
      occurredAt: "2026-11-03T10:00",
      followUpAt: "2026-11-10T09:00",
    });

    const detail = getCustomerDetail(db, owner, customer.id);
    expect(detail?.name).toBe("Khách Kiểm Thử Đã Sửa");
    expect(detail?.tier).toBe("vvip");
    expect(detail?.interactions.length).toBeGreaterThan(0);
    expect(detail?.lastContactAt).not.toBeNull();
  });

  it("lọc theo trạng thái và tìm theo SĐT", () => {
    const byPhone = listCustomers(db, owner, { q: "0912345678" });
    expect(byPhone.items.some((customer) => customer.phone === "0912345678")).toBe(true);
    const leads = listCustomers(db, owner, { status: "lead" });
    expect(leads.items.every((customer) => customer.status === "lead")).toBe(true);
  });

  it("lọc phân khúc VIP và công nợ", () => {
    const vip = listCustomers(db, owner, { segment: "vip" });
    expect(vip.items.every((customer) => ["vip", "vvip"].includes(customer.tier))).toBe(
      true,
    );

    const debt = listCustomers(db, owner, { segment: "debt" });
    expect(debt.items.some((customer) => customer.id === "customer-demo-02")).toBe(true);
    expect(debt.items.every((customer) => customer.id !== "customer-demo-05")).toBe(true);
  });

  it("tính metrics khách có đơn seed", () => {
    const detail = getCustomerDetail(db, owner, "customer-demo-01");
    expect(detail).not.toBeNull();
    expect(detail?.metrics.orderCount).toBeGreaterThan(0);
    expect(detail?.metrics.ltv).toBeGreaterThan(0);
    expect(detail?.orders.length).toBeGreaterThan(0);
  });

  it("tenant phụ không thấy khách tenant demo", async () => {
    const login = await authenticate(
      db,
      {
        mode: "password",
        identifier: "owner@studiobinhminh.demo",
        secret: "Demo@123",
      },
      { ip: "192.0.2.11", userAgent: "vitest-crm-tenant" },
    );
    if (!login.ok) throw new Error("Không login được tenant phụ");
    const secondary = await getActorFromToken(db, login.token);
    if (!secondary) throw new Error("Không tạo được actor tenant phụ");

    const result = listCustomers(db, secondary, {});
    expect(result.total).toBe(0);
  });
});
