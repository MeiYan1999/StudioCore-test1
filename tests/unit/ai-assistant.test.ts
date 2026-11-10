import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/test-db";
import {
  generateDraftWriterKey,
  generateHmacSecret,
  getAiAssistantSettings,
  saveAiAssistantWebhook,
  setAiAssistantEnabled,
  setAiAssistantPaused,
  toggleBranchAiAssistant,
} from "@/lib/services/ai-assistant-service";
import { branches, tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("AI Assistant Draft Writer Settings Service", () => {
  const db = createTestDb();
  const testTenantId = "tenant-ai-assistant-test";
  const testBranchId = "branch-ai-assistant-test";

  beforeEach(() => {
    const existing = db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, testTenantId))
      .get();

    if (!existing) {
      db.insert(tenants)
        .values({
          id: testTenantId,
          name: "Studio AI Assistant Test",
          slug: "studio-ai-assistant-test",
          status: "active",
        })
        .run();

      db.insert(branches)
        .values({
          id: testBranchId,
          tenantId: testTenantId,
          name: "Cửa hàng chính",
          address: "456 Đường AI, TP.HCM",
          phone: "0987654321",
          status: "active",
        })
        .run();
    }
  });

  it("getAiAssistantSettings trả về cấu hình mặc định (tắt và có chi nhánh)", () => {
    const settings = getAiAssistantSettings(db, testTenantId);
    expect(settings.enabled).toBe(false);
    expect(settings.paused).toBe(false);
    expect(settings.branches.length).toBeGreaterThanOrEqual(1);
    expect(settings.branches.some((b) => b.id === testBranchId)).toBe(true);
  });

  it("setAiAssistantEnabled và setAiAssistantPaused cập nhật đúng trạng thái", () => {
    setAiAssistantEnabled(db, testTenantId, true);
    let settings = getAiAssistantSettings(db, testTenantId);
    expect(settings.enabled).toBe(true);

    setAiAssistantPaused(db, testTenantId, true);
    settings = getAiAssistantSettings(db, testTenantId);
    expect(settings.paused).toBe(true);

    setAiAssistantPaused(db, testTenantId, false);
    settings = getAiAssistantSettings(db, testTenantId);
    expect(settings.paused).toBe(false);
  });

  it("toggleBranchAiAssistant cho phép bật/tắt từng chi nhánh", () => {
    toggleBranchAiAssistant(db, testTenantId, testBranchId, true);
    let settings = getAiAssistantSettings(db, testTenantId);
    const branch = settings.branches.find((b) => b.id === testBranchId);
    expect(branch?.enabled).toBe(true);

    toggleBranchAiAssistant(db, testTenantId, testBranchId, false);
    settings = getAiAssistantSettings(db, testTenantId);
    const branchOff = settings.branches.find((b) => b.id === testBranchId);
    expect(branchOff?.enabled).toBe(false);
  });

  it("saveAiAssistantWebhook lưu webhook URL và HMAC secret", () => {
    const secret = generateHmacSecret();
    expect(secret.length).toBe(48);

    saveAiAssistantWebhook(
      db,
      testTenantId,
      "https://bot.example.com/studiocore/drafts",
      secret,
    );
    const settings = getAiAssistantSettings(db, testTenantId);
    expect(settings.webhookUrl).toBe("https://bot.example.com/studiocore/drafts");
    expect(settings.hmacSecret).toBe(secret);
  });

  it("generateDraftWriterKey tạo khóa agent đúng định dạng scmcp_draft_writer_", () => {
    const key = generateDraftWriterKey(db, testTenantId);
    expect(key).toMatch(/^scmcp_draft_writer_/);

    const settings = getAiAssistantSettings(db, testTenantId);
    expect(settings.agentKey).toBe(key);
  });
});
