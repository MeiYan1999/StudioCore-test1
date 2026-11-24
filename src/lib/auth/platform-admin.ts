import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { rolePermissions, staff, tenants } from "../db/schema";
import { platformAdminLoginSchema } from "../validators/staff";
import { DEFAULT_ROLE_PERMISSIONS } from "./roles";

export const INTERNAL_PLATFORM_TENANT_ID = "tenant-platform";
const PLATFORM_TENANT_SLUG = "studiocore-platform";

export class PlatformAdminConflictError extends Error {}

export function platformAdminCode(login: string): string {
  return `PLATFORM-${login.toUpperCase()}`;
}

export function bootstrapPlatformAdmin(db: AppDb, loginInput: string, passwordHash: string): boolean {
  const login = platformAdminLoginSchema.safeParse(loginInput);
  if (!login.success) throw new Error("PLATFORM_ADMIN_LOGIN không hợp lệ.");
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(passwordHash)) {
    throw new Error("PLATFORM_ADMIN_PASSWORD_HASH không đúng định dạng scrypt của ứng dụng.");
  }

  const code = platformAdminCode(login.data);
  return db.transaction((tx) => {
    const existing = tx.select({ role: staff.role, tenantId: staff.tenantId })
      .from(staff).where(eq(staff.code, code)).get();
    if (existing) {
      if (existing.role !== "platform_admin" || existing.tenantId !== INTERNAL_PLATFORM_TENANT_ID) {
        throw new PlatformAdminConflictError("Tên đăng nhập quản trị đã trùng mã nhân viên.");
      }
      return false;
    }
    const internalTenant = tx.select({ slug: tenants.slug }).from(tenants)
      .where(eq(tenants.id, INTERNAL_PLATFORM_TENANT_ID)).get();
    if (internalTenant && internalTenant.slug !== PLATFORM_TENANT_SLUG) {
      throw new PlatformAdminConflictError("Mã studio nội bộ đã được sử dụng.");
    }
    const slugConflict = tx.select({ id: tenants.id }).from(tenants)
      .where(and(eq(tenants.slug, PLATFORM_TENANT_SLUG), ne(tenants.id, INTERNAL_PLATFORM_TENANT_ID))).get();
    if (slugConflict) throw new PlatformAdminConflictError("URL studio nội bộ đã được sử dụng.");

    tx.insert(tenants)
      .values({
        id: INTERNAL_PLATFORM_TENANT_ID,
        name: "StudioCore Platform",
        slug: PLATFORM_TENANT_SLUG,
        status: "active",
        plan: "enterprise",
      })
      .onConflictDoNothing({ target: tenants.id })
      .run();
    tx.insert(staff).values({
      id: randomUUID(),
      tenantId: INTERNAL_PLATFORM_TENANT_ID,
      name: "Quản trị nền tảng",
      code,
      role: "platform_admin",
      passwordHash,
    }).run();
    tx.insert(rolePermissions).values(
      DEFAULT_ROLE_PERMISSIONS.platform_admin.map((permission) => ({
        id: randomUUID(),
        tenantId: INTERNAL_PLATFORM_TENANT_ID,
        role: "platform_admin" as const,
        permission,
      })),
    ).onConflictDoNothing({
      target: [rolePermissions.tenantId, rolePermissions.role, rolePermissions.permission],
    }).run();
    return true;
  }, { behavior: "immediate" });
}
