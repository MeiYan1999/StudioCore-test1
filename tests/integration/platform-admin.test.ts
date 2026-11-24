import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PlatformPage from "@/app/platform/page";
import {
  deleteTenantFromPlatformAction,
  extendTenantPlanAction,
  resetTenantOwnerPasswordAction,
  updateTenantPlanAction,
  updateTenantStatusAction,
} from "@/lib/actions/platform-actions";
import { authenticate } from "@/lib/auth/login-service";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { bootstrapPlatformAdmin, INTERNAL_PLATFORM_TENANT_ID, PlatformAdminConflictError } from "@/lib/auth/platform-admin";
import { getActorFromToken } from "@/lib/auth/session-core";
import { createDb, getDb } from "@/lib/db/client";
import { staff, tenants } from "@/lib/db/schema";
import { formatVnd } from "@/lib/utils";
import { passwordLoginSchema } from "@/lib/validators/staff";

vi.mock("@/lib/auth/session", () => ({
  requireActor: async () => ({ permissions: ["tenants.manage"] }),
}));
vi.mock("@/lib/db/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/db/client")>(),
  getDb: vi.fn(),
}));

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

  it("nhận diện slug đã thuộc một studio khác mà không thay đổi dữ liệu", () => {
    const db = createMigratedDb();
    db.insert(tenants).values({ id: "customer", name: "Customer", slug: "studiocore-platform" }).run();

    expect(() => bootstrapPlatformAdmin(db, "admin", hashSecret(password))).toThrow(PlatformAdminConflictError);
    expect(db.select().from(tenants).all()).toMatchObject([{ id: "customer", slug: "studiocore-platform" }]);
    expect(db.select().from(staff).all()).toHaveLength(0);
  });

  it("không dừng startup khi slug nội bộ đã được sử dụng", () => {
    mkdirSync("data", { recursive: true });
    const directory = mkdtempSync(path.join("data", "platform-admin-"));
    const url = path.join(directory, "collision.db");
    const sqlite = new Database(url);
    const db = drizzle(sqlite);
    try {
      migrate(db, { migrationsFolder: path.resolve("drizzle") });
      db.insert(tenants).values({ id: "customer", name: "Customer", slug: "studiocore-platform" }).run();
      const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/bootstrap-platform-admin.ts"], {
        env: {
          ...process.env,
          DATABASE_URL: url,
          PLATFORM_ADMIN_LOGIN: "admin",
          PLATFORM_ADMIN_PASSWORD_HASH: hashSecret(password),
        },
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toContain("Bỏ qua khởi tạo");
      expect(db.select().from(staff).all()).toHaveLength(0);
    } finally {
      sqlite.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("không tính studio nội bộ vào danh sách và MRR khách hàng", async () => {
    const db = createMigratedDb();
    bootstrapPlatformAdmin(db, "admin", hashSecret(password));
    db.update(tenants).set({ plan: "business" }).run();
    db.insert(tenants).values({ id: "customer", name: "Customer Fixture", slug: "customer", plan: "basic" }).run();
    vi.mocked(getDb).mockReturnValueOnce(db);

    const markup = renderToStaticMarkup(await PlatformPage({ searchParams: Promise.resolve({}) }));
    expect(markup).toContain("Customer Fixture");
    expect(markup).not.toContain("StudioCore Platform");
    expect(markup).toContain(formatVnd(399_000) + "/tháng");
    expect(markup).toMatch(/Tổng Studio<\/span>.*?<p[^>]*>1<\/p>/);
  });

  it("không cho đổi trạng thái, đổi gói, gia hạn hoặc xóa studio nội bộ", async () => {
    const input = new FormData();
    input.set("tenantId", INTERNAL_PLATFORM_TENANT_ID);
    input.set("status", "suspended");
    input.set("plan", "pro");

    const message = "Không thể thay đổi studio nội bộ của nền tảng.";
    await expect(updateTenantStatusAction(input)).rejects.toThrow(message);
    await expect(updateTenantPlanAction(input)).rejects.toThrow(message);
    await expect(resetTenantOwnerPasswordAction(input)).rejects.toThrow(message);
    await expect(extendTenantPlanAction(input)).resolves.toMatchObject({ success: false, error: message });
    await expect(deleteTenantFromPlatformAction(input)).resolves.toMatchObject({ success: false, error: message });
  });

  it("chỉ in hash khi mật khẩu stdin đạt chính sách 8–128 ký tự", () => {
    const run = (input: string) => spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/hash-platform-admin-password.ts"],
      { input, encoding: "utf8" },
    );
    for (const invalid of ["", "x".repeat(7), "x".repeat(129)]) {
      expect(run(invalid)).toMatchObject({ status: 1, stdout: "" });
    }
    const valid = run(password);
    expect(valid.status).toBe(0);
    expect(verifySecret(password, valid.stdout.trim())).toBe(true);
  });
});
