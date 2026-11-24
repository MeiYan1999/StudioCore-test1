import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { hashSecret } from "@/lib/auth/password";
import { bootstrapPlatformAdmin } from "@/lib/auth/platform-admin";
import { getActorFromToken } from "@/lib/auth/session-core";
import { createDb } from "@/lib/db/client";
import { staff, tenants } from "@/lib/db/schema";
import { passwordLoginSchema } from "@/lib/validators/staff";

function createMigratedDb() {
  const db = createDb(":memory:");
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  return db;
}

const password = "fixture-password";

describe("khởi tạo tài khoản quản trị nền tảng", () => {
  it("đăng nhập bằng tên quản trị trên DB không có seed và giữ nguyên mật khẩu khi khởi động lại", async () => {
    const db = createMigratedDb();
    const hash = hashSecret(password);
    const parsed = passwordLoginSchema.parse({ email: " Admin ", password });

    expect(bootstrapPlatformAdmin(db, parsed.email, hash)).toBe(true);
    expect(bootstrapPlatformAdmin(db, "ADMIN", hashSecret("different-fixture-password"))).toBe(false);
    expect(db.select().from(tenants).all()).toHaveLength(1);
    expect(db.select().from(staff).all()).toMatchObject([
      { role: "platform_admin", code: "PLATFORM-ADMIN", passwordHash: hash, pinHash: null, email: null },
    ]);

    const result = await authenticate(db, {
      mode: "password",
      identifier: parsed.email,
      secret: parsed.password,
    }, { ip: "127.0.0.1", userAgent: "vitest" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await getActorFromToken(db, result.token)).toMatchObject({
      role: "platform_admin",
      permissions: ["tenants.manage"],
      activeBranchId: null,
    });
  });

  it("từ chối username của nhân viên thường và không thay đổi tài khoản trùng mã", async () => {
    const db = createMigratedDb();
    const hash = hashSecret(password);
    db.insert(tenants).values({ id: "studio", name: "Studio", slug: "studio" }).run();
    db.insert(staff).values({
      id: "studio-owner", tenantId: "studio", name: "Owner", role: "owner",
      code: "PLATFORM-ADMIN", email: "owner@example.com", passwordHash: hash,
    }).run();

    expect(() => bootstrapPlatformAdmin(db, "admin", hash)).toThrow("trùng mã nhân viên");
    const meta = { ip: "127.0.0.1", userAgent: "vitest" };
    expect(await authenticate(db, { mode: "password", identifier: "admin", secret: password }, meta))
      .toMatchObject({ ok: false });
    expect(await authenticate(db, { mode: "password", identifier: "owner@example.com", secret: password }, meta))
      .toMatchObject({ ok: true });
  });

  it("từ chối dữ liệu không hợp lệ mà không tạo tài khoản hoặc tenant", () => {
    const db = createMigratedDb();
    expect(() => bootstrapPlatformAdmin(db, "not a username", hashSecret(password))).toThrow("PLATFORM_ADMIN_LOGIN");
    expect(() => bootstrapPlatformAdmin(db, "admin", "not-a-password-hash")).toThrow("PLATFORM_ADMIN_PASSWORD_HASH");
    expect(db.select().from(tenants).all()).toHaveLength(0);
  });
});
