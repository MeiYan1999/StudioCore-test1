import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/test-db";
import {
  findTenantBySepayApiKey,
  getSepaySettings,
  handleSepayWebhookCall,
  regenerateSepayApiKey,
  setSepayWebhookEnabled,
} from "@/lib/services/sepay-service";
import {
  branches,
  customers,
  orders,
  paymentWebhookEvents,
  settings,
  staff,
  tenants,
  transactions,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

describe("SePay Webhook & Connection Service", () => {
  const db = createTestDb();
  const testTenantId = "tenant-sepay-test";
  const testBranchId = "branch-sepay-test";

  beforeEach(() => {
    // Setup tenant & branch
    const existingTenant = db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, testTenantId))
      .get();

    if (!existingTenant) {
      db.insert(tenants)
        .values({
          id: testTenantId,
          name: "Studio Test SePay",
          slug: "studio-test-sepay",
          status: "active",
        })
        .run();

      db.insert(branches)
        .values({
          id: testBranchId,
          tenantId: testTenantId,
          name: "Chi nhánh chính",
          address: "123 Đường Test, Hà Nội",
          phone: "0901234567",
          status: "active",
        })
        .run();
    }
  });

  it("getSepaySettings tự sinh API Key và trả về Webhook URL chuẩn", () => {
    const sepay = getSepaySettings(db, testTenantId);
    expect(sepay.apiKey).toBeDefined();
    expect(sepay.apiKey).toMatch(/^sepay_/);
    expect(sepay.enabled).toBe(true);
    expect(sepay.webhookUrl).toContain("/api/webhooks/sepay");
    expect(sepay.stats.totalCalls).toBe(0);
    expect(sepay.stats.hasSignals).toBe(false);
  });

  it("regenerateSepayApiKey tạo API Key mới khác key cũ", () => {
    const sepay1 = getSepaySettings(db, testTenantId);
    const newKey = regenerateSepayApiKey(db, testTenantId);

    expect(newKey).not.toBe(sepay1.apiKey);
    const sepay2 = getSepaySettings(db, testTenantId);
    expect(sepay2.apiKey).toBe(newKey);
  });

  it("findTenantBySepayApiKey tìm đúng tenant từ API Key", () => {
    const sepay = getSepaySettings(db, testTenantId);
    const foundTenant = findTenantBySepayApiKey(db, sepay.apiKey);
    expect(foundTenant).toBe(testTenantId);

    // Also handles Bearer or Apikey prefix
    expect(findTenantBySepayApiKey(db, `Apikey ${sepay.apiKey}`)).toBe(testTenantId);
    expect(findTenantBySepayApiKey(db, `Bearer ${sepay.apiKey}`)).toBe(testTenantId);
    expect(findTenantBySepayApiKey(db, "wrong-key")).toBeNull();
  });

  it("handleSepayWebhookCall từ chối khi API Key không hợp lệ", async () => {
    const res = await handleSepayWebhookCall(
      db,
      "invalid-key",
      { id: 1, transferAmount: 10000 },
      JSON.stringify({ id: 1 }),
    );
    expect(res.success).toBe(false);
    expect(res.status).toBe(401);
  });

  it("handleSepayWebhookCall ghi nhận biến động số dư SePay thành công", async () => {
    const sepay = getSepaySettings(db, testTenantId);
    const payload = {
      id: 999901,
      gateway: "Vietcombank",
      transactionDate: "2026-11-10 11:30:00",
      accountNumber: "0123456789",
      transferType: "in" as const,
      content: "Chuyen khoan tien chup anh",
      transferAmount: 200000,
      referenceCode: "MBVCB.999901",
    };

    const res = await handleSepayWebhookCall(
      db,
      sepay.apiKey,
      payload,
      JSON.stringify(payload),
    );

    expect(res.success).toBe(true);
    expect(res.status).toBe(200);

    // Verify stats updated
    const updated = getSepaySettings(db, testTenantId);
    expect(updated.stats.totalCalls).toBeGreaterThanOrEqual(1);
    expect(updated.stats.recordedCount).toBeGreaterThanOrEqual(1);
    expect(updated.stats.hasSignals).toBe(true);
    expect(updated.stats.lastTransactionText).toBe("+200.000đ");

    // Idempotency: duplicate call returns duplicate message without throwing
    const duplicateRes = await handleSepayWebhookCall(
      db,
      sepay.apiKey,
      payload,
      JSON.stringify(payload),
    );
    expect(duplicateRes.success).toBe(true);
    expect(duplicateRes.message).toContain("Duplicate");
  });

  it("handleSepayWebhookCall tự động ghi nhận thanh toán khi nội dung có mã đơn hàng", async () => {
    const sepay = getSepaySettings(db, testTenantId);
    const customerId = "cust-sepay-test";
    const orderId = "ord-sepay-test";
    const orderCode = "DH-SEPAY-001";

    db.insert(customers)
      .values({
        id: customerId,
        tenantId: testTenantId,
        branchId: testBranchId,
        name: "Khách hàng Test SePay",
        phone: "0912345678",
      })
      .run();

    const staffUser = db.select({ id: staff.id }).from(staff).limit(1).get();
    const staffId = staffUser?.id || "staff-owner";

    db.insert(orders)
      .values({
        id: orderId,
        tenantId: testTenantId,
        branchId: testBranchId,
        customerId,
        code: orderCode,
        status: "new",
        total: 1000000,
        paid: 0,
        remaining: 1000000,
        createdBy: staffId,
      })
      .run();

    const payload = {
      id: 999902,
      gateway: "MBBank",
      transactionDate: "2026-11-10 11:35:00",
      accountNumber: "9876543210",
      transferType: "in" as const,
      content: `KHACH HANG CHUYEN TIEN DON ${orderCode}`,
      transferAmount: 500000,
      referenceCode: "MB.999902",
    };

    const res = await handleSepayWebhookCall(
      db,
      sepay.apiKey,
      payload,
      JSON.stringify(payload),
    );

    expect(res.success).toBe(true);
    expect(res.message).toContain(orderCode);

    // Verify order paid updated
    const updatedOrder = db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .get();

    expect(updatedOrder?.paid).toBe(500000);
    expect(updatedOrder?.remaining).toBe(500000);
    expect(updatedOrder?.status).toBe("deposit_received");
  });
});
