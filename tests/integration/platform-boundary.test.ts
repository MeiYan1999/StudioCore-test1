import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { hasPermission } from "@/lib/auth/permissions";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { rolePermissions } from "@/lib/db/schema";
import { setTenantSetting } from "@/lib/services/settings-write-service";
import { updateRolePermissions, updateStaff } from "@/lib/services/staff-service";
import { getPlatformBillingConfig } from "@/lib/services/subscription-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let ipCounter = 0;

async function login(email: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip: `192.0.2.${++ipCounter}`, userAgent: "vitest-platform-boundary" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

beforeAll(() => {
  db = createTestDb();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ranh giới quyền quản trị nền tảng", () => {
  it("chủ studio không tự cấp được tenants.manage cho vai trò của studio", async () => {
    const owner = await login("owner@studiobinhminh.demo");
    updateRolePermissions(db, owner, "manager", ["orders.view", "tenants.manage"]);

    const stored = db
      .select({ role: rolePermissions.role, permission: rolePermissions.permission })
      .from(rolePermissions)
      .where(eq(rolePermissions.tenantId, owner.tenantId))
      .all()
      .filter((row) => row.role === "manager");
    expect(stored.map((row) => row.permission)).toEqual(["orders.view"]);
  });

  it("dòng tenants.manage đã lưu sẵn cho vai trò studio không có hiệu lực", async () => {
    const before = await login("owner@studiobinhminh.demo");
    db.insert(rolePermissions)
      .values({
        id: `${before.tenantId}-owner-tenants.manage-legacy`,
        tenantId: before.tenantId,
        role: "owner",
        permission: "tenants.manage",
      })
      .run();

    const owner = await login("owner@studiobinhminh.demo");
    expect(hasPermission(owner.permissions, "tenants.manage")).toBe(false);
    expect(hasPermission(owner.permissions, "settings.manage")).toBe(true);
  });

  it("tài khoản quản trị nền tảng demo mất quyền nền tảng khi chạy production", async () => {
    expect(hasPermission((await login("platform@studiocore.demo")).permissions, "tenants.manage")).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    expect(hasPermission((await login("platform@studiocore.demo")).permissions, "tenants.manage")).toBe(false);
  });

  it("chủ studio không sửa được tài khoản quản trị nền tảng nằm trong studio mình", async () => {
    const owner = await login("owner@studiocore.demo");
    expect(() => updateStaff(db, owner, "staff-sc-platform", {} as never)).toThrow(
      "Không tìm thấy nhân sự.",
    );
  });

  it("cấu hình thanh toán nền tảng không đọc setting platform.* của studio thường", async () => {
    const studioOwner = await login("owner@studiobinhminh.demo");
    setTenantSetting(db, studioOwner.tenantId, "platform.bank_account", "ATTACKER-ACCOUNT");
    expect(getPlatformBillingConfig(db).accountNumber).not.toBe("ATTACKER-ACCOUNT");

    const platformAdmin = await login("platform@studiocore.demo");
    setTenantSetting(db, platformAdmin.tenantId, "platform.bank_account", "PLATFORM-ACCOUNT");
    expect(getPlatformBillingConfig(db).accountNumber).toBe("PLATFORM-ACCOUNT");
  });
});
