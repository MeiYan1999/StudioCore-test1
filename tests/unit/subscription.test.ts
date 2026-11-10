import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import {
  createSubscriptionInvoice,
  getSubscriptionById,
  getTenantCurrentSubscription,
  processPlatformBillingWebhook,
  simulateDevSubscriptionPayment,
} from "@/lib/services/subscription-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
const TEST_TENANT_ID = "tenant-subscription-test";

beforeAll(() => {
  db = createTestDb();
  db.insert(tenants)
    .values({
      id: TEST_TENANT_ID,
      name: "Studio Thanh Toan Test",
      slug: "studio-thanh-toan-test",
      status: "active",
      plan: "trial",
    })
    .run();
});

describe("Subscription & Automated VietQR Billing Service", () => {
  it("khởi tạo đơn thanh toán gói Pro theo tháng với mã nạp SCxxxxx và VietQR hợp lệ", () => {
    const invoice = createSubscriptionInvoice(
      db,
      TEST_TENANT_ID,
      "pro",
      "monthly",
    );

    expect(invoice.subscriptionId).toBeDefined();
    expect(invoice.tenantId).toBe(TEST_TENANT_ID);
    expect(invoice.plan).toBe("pro");
    expect(invoice.billingCycle).toBe("monthly");
    expect(invoice.amount).toBe(499_000);
    expect(invoice.code).toMatch(/^SC[0-9]{5}$/);
    expect(invoice.status).toBe("pending");
    expect(invoice.vietQr.imageUrl).toContain("compact2.png");
    expect(invoice.vietQr.imageUrl).toContain("499000");
    expect(invoice.vietQr.imageUrl).toContain(invoice.code);
  });

  it("khởi tạo đơn thanh toán gói Cơ bản theo năm với chiết khấu tiết kiệm 2 tháng", () => {
    const invoice = createSubscriptionInvoice(
      db,
      TEST_TENANT_ID,
      "basic",
      "yearly",
    );

    expect(invoice.plan).toBe("basic");
    expect(invoice.billingCycle).toBe("yearly");
    expect(invoice.amount).toBe(3_990_000); // 399k * 10 tháng
  });

  it("Webhook từ chối duyệt nếu chuyển thiếu số tiền gói cước", () => {
    const invoice = createSubscriptionInvoice(
      db,
      TEST_TENANT_ID,
      "pro",
      "monthly",
    );

    const result = processPlatformBillingWebhook(db, {
      gateway: "MBBank",
      transactionDate: "2026-11-10 17:00:00",
      accountNumber: "0987654321",
      transferType: "in",
      transferAmount: 200_000, // Chuyển thiếu (cần 499_000)
      content: `${invoice.code} chuyen tien thieu`,
      referenceCode: "FT_TEST_01",
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain("chưa đủ giá trị gói cước");

    // Đơn vẫn ở trạng thái pending
    const sub = getSubscriptionById(db, invoice.subscriptionId);
    expect(sub?.status).toBe("pending");
  });

  it("Webhook tự động nhận diện mã nạp SCxxxxx, đối soát tiền và tự động duyệt nâng cấp gói", () => {
    const invoice = createSubscriptionInvoice(
      db,
      TEST_TENANT_ID,
      "pro",
      "monthly",
    );

    const result = processPlatformBillingWebhook(db, {
      gateway: "MBBank",
      transactionDate: "2026-11-10 17:00:00",
      accountNumber: "0987654321",
      transferType: "in",
      transferAmount: 499_000, // Đúng số tiền
      content: `MBVCB.738291.${invoice.code}.THANH TOAN GOI PRO`,
      referenceCode: "FT_SEPAY_SUCCESS_99",
    });

    expect(result.success).toBe(true);
    expect(result.plan).toBe("pro");

    // Đơn nạp chuyển thành completed
    const sub = getSubscriptionById(db, invoice.subscriptionId);
    expect(sub?.status).toBe("completed");
    expect(sub?.paidAt).toBeDefined();

    // Studio được nâng cấp lên gói Pro và có hạn dùng
    const current = getTenantCurrentSubscription(db, TEST_TENANT_ID);
    expect(current?.tenant.plan).toBe("pro");
    expect(current?.tenant.planExpiresAt).toBeDefined();
    expect(current?.tenant.planExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("chức năng giả lập thanh toán (Dev / Test Mode) kích hoạt gói thành công ngay lập tức", () => {
    const invoice = createSubscriptionInvoice(
      db,
      TEST_TENANT_ID,
      "enterprise",
      "monthly",
    );

    const result = simulateDevSubscriptionPayment(db, invoice.subscriptionId);
    expect(result.success).toBe(true);
    expect(result.plan).toBe("enterprise");

    const current = getTenantCurrentSubscription(db, TEST_TENANT_ID);
    expect(current?.tenant.plan).toBe("enterprise");
  });
});
