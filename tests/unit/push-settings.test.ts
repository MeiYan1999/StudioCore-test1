import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "../helpers/test-db";
import {
  DEFAULT_PUSH_CATEGORIES,
  getPushSettings,
  setPushEnabled,
  updatePushCategory,
} from "@/lib/services/push-settings-service";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

describe("Web Push Settings Service", () => {
  const db = createTestDb();
  const testTenantId = "tenant-push-test";
  const testStaffId = "staff-push-test";

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
          name: "Studio Push Test",
          slug: "studio-push-test",
          status: "active",
        })
        .run();
    }
  });

  it("getPushSettings trả về cấu hình mặc định đầy đủ 6 danh mục", () => {
    const settings = getPushSettings(db, testTenantId, testStaffId);
    expect(settings.enabled).toBe(true);
    expect(settings.categories).toEqual(DEFAULT_PUSH_CATEGORIES);
    expect(settings.categories.messages).toBe(true);
    expect(settings.categories.orders).toBe(true);
    expect(settings.categories.approvals).toBe(true);
    expect(settings.categories.calendar).toBe(true);
    expect(settings.categories.social).toBe(true);
    expect(settings.categories.system).toBe(true);
  });

  it("setPushEnabled cho phép bật/tắt thông báo đẩy", () => {
    setPushEnabled(db, testTenantId, testStaffId, false);
    let settings = getPushSettings(db, testTenantId, testStaffId);
    expect(settings.enabled).toBe(false);

    setPushEnabled(db, testTenantId, testStaffId, true);
    settings = getPushSettings(db, testTenantId, testStaffId);
    expect(settings.enabled).toBe(true);
  });

  it("updatePushCategory cho phép bật/tắt từng loại thông báo độc lập", () => {
    updatePushCategory(db, testTenantId, testStaffId, "social", false);
    let settings = getPushSettings(db, testTenantId, testStaffId);
    expect(settings.categories.social).toBe(false);
    expect(settings.categories.orders).toBe(true);
    expect(settings.categories.messages).toBe(true);

    updatePushCategory(db, testTenantId, testStaffId, "social", true);
    settings = getPushSettings(db, testTenantId, testStaffId);
    expect(settings.categories.social).toBe(true);
  });
});
