import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { rolePermissions, staff, tenants } from "../db/schema";
import { platformAdminLoginSchema } from "../validators/staff";
import { DEFAULT_ROLE_PERMISSIONS } from "./roles";

const PLATFORM_TENANT_ID = "tenant-platform";

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
    const existing = tx.select({ role: staff.role }).from(staff).where(eq(staff.code, code)).get();
    if (existing) {
      if (existing.role !== "platform_admin") throw new Error("Tên đăng nhập quản trị đã trùng mã nhân viên.");
      return false;
    }

    tx.insert(tenants)
      .values({
        id: PLATFORM_TENANT_ID,
        name: "StudioCore Platform",
        slug: "studiocore-platform",
        status: "active",
        plan: "enterprise",
      })
      .onConflictDoNothing({ target: tenants.id })
      .run();
    tx.insert(staff).values({
      id: randomUUID(),
      tenantId: PLATFORM_TENANT_ID,
      name: "Quản trị nền tảng",
      code,
      role: "platform_admin",
      passwordHash,
    }).run();
    tx.insert(rolePermissions).values(
      DEFAULT_ROLE_PERMISSIONS.platform_admin.map((permission) => ({
        id: randomUUID(),
        tenantId: PLATFORM_TENANT_ID,
        role: "platform_admin" as const,
        permission,
      })),
    ).onConflictDoNothing({
      target: [rolePermissions.tenantId, rolePermissions.role, rolePermissions.permission],
    }).run();
    return true;
  }, { behavior: "immediate" });
}
