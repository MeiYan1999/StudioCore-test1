import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import {
  createSubscriptionInvoice,
  DEFAULT_PLATFORM_SEPAY_API_KEY,
  getPlatformBillingConfig,
  isValidPlatformBillingKey,
  savePlatformBillingConfig,
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
    }, "Apikey studiocore_platform_secret");

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
    }, "Apikey studiocore_platform_secret");

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

  it("Webhook xác thực chính xác API Key SePay (Apikey studiocore_platform_secret)", () => {
    const invoice = createSubscriptionInvoice(
      db,
      TEST_TENANT_ID,
      "pro",
      "monthly",
    );

    // 1. Sai API Key -> Bị từ chối
    const failResult = processPlatformBillingWebhook(
      db,
      {
        gateway: "MBBank",
        transferType: "in",
        transferAmount: 499_000,
        content: `TT ${invoice.code}`,
      },
      "Apikey sai_api_key_123",
    );
    expect(failResult.success).toBe(false);
    expect(failResult.message).toContain("API Key xác thực Webhook không hợp lệ");

    // 2. Đúng API Key -> Thành công
    const successResult = processPlatformBillingWebhook(
      db,
      {
        gateway: "MBBank",
        transferType: "in",
        transferAmount: 499_000,
        content: `TT ${invoice.code}`,
      },
      "Apikey studiocore_platform_secret",
    );
    expect(successResult.success).toBe(true);
  });

  it("webhook thiếu API Key không được kích hoạt gói", () => {
    const invoice = createSubscriptionInvoice(db, TEST_TENANT_ID, "enterprise", "yearly");
    for (const header of [undefined, "", "Apikey "]) {
      const result = processPlatformBillingWebhook(
        db,
        { transferType: "in", transferAmount: 999_999_999, content: invoice.code },
        header,
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("API Key");
    }
    expect(getSubscriptionById(db, invoice.subscriptionId)?.status).toBe("pending");
  });

  it("production từ chối khóa mặc định công khai", () => {
    expect(isValidPlatformBillingKey(DEFAULT_PLATFORM_SEPAY_API_KEY, "Apikey studiocore_platform_secret", true)).toBe(false);
    expect(isValidPlatformBillingKey(DEFAULT_PLATFORM_SEPAY_API_KEY, "Apikey studiocore_platform_secret", false)).toBe(true);
    expect(isValidPlatformBillingKey("real-secret-key", "Bearer real-secret-key", true)).toBe(true);
    expect(isValidPlatformBillingKey("real-secret-key", "Bearer real-secret-keX", true)).toBe(false);
  });

  it("khóa mặc định đã lưu không che khóa cấu hình qua biến môi trường", () => {
    const fresh = createTestDb();
    fresh.insert(tenants).values({ id: "tenant-key", name: "Key", slug: "tenant-key", status: "active", plan: "trial" }).run();
    savePlatformBillingConfig(fresh, "tenant-key", { sepayApiKey: DEFAULT_PLATFORM_SEPAY_API_KEY });
    process.env.PLATFORM_SEPAY_API_KEY = "env-rotated-key";
    try {
      expect(getPlatformBillingConfig(fresh).sepayApiKey).toBe("env-rotated-key");
    } finally {
      delete process.env.PLATFORM_SEPAY_API_KEY;
    }
    expect(getPlatformBillingConfig(fresh).sepayApiKey).toBe(DEFAULT_PLATFORM_SEPAY_API_KEY);
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
