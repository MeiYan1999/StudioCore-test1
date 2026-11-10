import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import {
  addAiHubApiKey,
  deleteAiHubApiKey,
  getAiHubData,
  resetAiHubFeatureStats,
  toggleAiHubApiKey,
  updateAiHubFeature,
} from "@/lib/services/ai-hub-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
const TEST_TENANT_ID = "tenant-ai-hub-test";

beforeAll(() => {
  db = createTestDb();
  db.insert(tenants)
    .values({
      id: TEST_TENANT_ID,
      name: "Studio AI Hub Test",
      slug: "studio-ai-hub-test",
      status: "active",
    })
    .run();
});

describe("AI Hub v2 Service", () => {
  it("khởi tạo đủ 6 tính năng mặc định với tổng định mức $65.00 và 6/6 tính năng bật", () => {
    const data = getAiHubData(db, TEST_TENANT_ID);

    expect(data.features).toHaveLength(6);
    expect(data.metrics.totalFeatures).toBe(6);
    expect(data.metrics.activeFeatures).toBe(6);
    expect(data.metrics.totalBudgetUsd).toBe(65.0);
    expect(data.metrics.costThisMonthUsd).toBe(0);
    expect(data.metrics.totalKeys).toBe(0);
    expect(data.metrics.activeKeys).toBe(0);

    const featureIds = data.features.map((f) => f.id);
    expect(featureIds).toEqual([
      "ceo_assistant",
      "messenger_assistant",
      "ads_analysis",
      "social_content",
      "photo_tools",
      "continuous_learning",
    ]);
  });

  it("cho phép bật/tắt tính năng và cập nhật số lượng tính năng đang bật", () => {
    // Tắt tính năng Trợ lý CEO AI
    const updated = updateAiHubFeature(db, TEST_TENANT_ID, "ceo_assistant", {
      enabled: false,
    });

    expect(updated.metrics.activeFeatures).toBe(5);
    const ceo = updated.features.find((f) => f.id === "ceo_assistant");
    expect(ceo?.enabled).toBe(false);

    // Bật lại
    const restored = updateAiHubFeature(db, TEST_TENANT_ID, "ceo_assistant", {
      enabled: true,
    });
    expect(restored.metrics.activeFeatures).toBe(6);
  });

  it("cho phép cập nhật mô hình AI, định mức tháng và ngưỡng cảnh báo", () => {
    const updated = updateAiHubFeature(db, TEST_TENANT_ID, "photo_tools", {
      model: "GPT Image Flare (nhanh)",
      budgetUsd: 35,
      warningPercent: 90,
    });

    const photo = updated.features.find((f) => f.id === "photo_tools");
    expect(photo?.model).toBe("GPT Image Flare (nhanh)");
    expect(photo?.budgetUsd).toBe(35);
    expect(photo?.warningPercent).toBe(90);
    // Tổng định mức mới: 10 + 15 + 5 + 5 + 35 + 10 = 80
    expect(updated.metrics.totalBudgetUsd).toBe(80);
  });

  it("hỗ trợ reset số liệu token và lượt gọi của từng tính năng", () => {
    // Giả lập tính năng đã tiêu thụ
    updateAiHubFeature(db, TEST_TENANT_ID, "messenger_assistant", {
      tokensUsed: 12500,
      callsCount: 42,
      usedUsd: 0.25,
    });

    let current = getAiHubData(db, TEST_TENANT_ID);
    let msgr = current.features.find((f) => f.id === "messenger_assistant");
    expect(msgr?.tokensUsed).toBe(12500);
    expect(msgr?.callsCount).toBe(42);

    // Reset
    const afterReset = resetAiHubFeatureStats(db, TEST_TENANT_ID, "messenger_assistant");
    msgr = afterReset.features.find((f) => f.id === "messenger_assistant");
    expect(msgr?.tokensUsed).toBe(0);
    expect(msgr?.callsCount).toBe(0);
    expect(msgr?.usedUsd).toBe(0);
  });

  it("quản lý Pool API Key: thêm key, mask key, bật/tắt và xóa key", () => {
    // Thêm key
    const withKey = addAiHubApiKey(db, TEST_TENANT_ID, {
      name: "Key OpenAI Chính",
      provider: "openai",
      apiKey: "sk-proj-1234567890abcdef12345678",
      priority: 1,
    });

    expect(withKey.apiKeys).toHaveLength(1);
    expect(withKey.metrics.totalKeys).toBe(1);
    expect(withKey.metrics.activeKeys).toBe(1);
    const key = withKey.apiKeys[0];
    expect(key.keyMasked).toContain("sk-pr");
    expect(key.keyMasked).toContain("5678");
    expect(key.status).toBe("active");

    // Tạm dừng key
    const paused = toggleAiHubApiKey(db, TEST_TENANT_ID, key.id, false);
    expect(paused.metrics.activeKeys).toBe(0);
    expect(paused.apiKeys[0].status).toBe("paused");

    // Xóa key
    const deleted = deleteAiHubApiKey(db, TEST_TENANT_ID, key.id);
    expect(deleted.metrics.totalKeys).toBe(0);
    expect(deleted.metrics.activeKeys).toBe(0);
  });
});
