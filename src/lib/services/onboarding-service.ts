import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  branches,
  rolePermissions,
  settings,
  staff,
  staffBranches,
  tenants,
} from "../db/schema";
import { DEFAULT_ROLE_PERMISSIONS, TENANT_ROLES } from "../auth/roles";
import { hashSecret } from "../auth/password";
import { normalizeVietnamesePhone } from "../utils/phone";
import { writeAudit } from "../audit";
import { triggerDbBackupDebounced } from "../db/r2-backup";
import { AuthorizationError, ValidationError } from "../errors";

export type RegisterInput = {
  studioName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
};

export type RegisterResult = {
  tenantId: string;
  tenantSlug: string;
  staffId: string;
  branchId: string;
};

export function slugifyStudioName(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "studio"
  );
}

export function registerTenant(
  db: AppDb,
  input: RegisterInput,
): RegisterResult {
  const studioName = input.studioName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (studioName.length < 2 || studioName.length > 120) {
    throw new ValidationError("Tên studio phải từ 2–120 ký tự.");
  }
  if (ownerName.length < 2 || ownerName.length > 120) {
    throw new ValidationError("Tên chủ studio phải từ 2–120 ký tự.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Email không hợp lệ.");
  }
  if (password.length < 8 || password.length > 72) {
    throw new ValidationError("Mật khẩu phải từ 8–72 ký tự.");
  }
  const phone = input.phone.trim()
    ? normalizeVietnamesePhone(input.phone)
    : null;
  if (input.phone.trim() && !phone) {
    throw new ValidationError("Số điện thoại không hợp lệ.");
  }
  const branchPhone = input.branchPhone.trim()
    ? normalizeVietnamesePhone(input.branchPhone)
    : null;
  if (input.branchPhone.trim() && !branchPhone) {
    throw new ValidationError("Số điện thoại chi nhánh không hợp lệ.");
  }
  const duplicateEmail = db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.email, email))
    .get();
  if (duplicateEmail) {
    throw new ValidationError("Email đã được sử dụng.");
  }

  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const staffId = crypto.randomUUID();
  const baseSlug = slugifyStudioName(studioName);
  let slug = baseSlug;
  let suffix = 1;
  while (
    db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).get()
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  const ownerCode = `OWN-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const passwordHash = hashSecret(password);
  const branchName =
    input.branchName.trim() || `${studioName} — Chi nhánh chính`;

  db.transaction((tx) => {
    tx.insert(tenants)
      .values({
        id: tenantId,
        name: studioName,
        slug,
        status: "active",
        plan: "trial",
      })
      .run();
    tx.insert(branches)
      .values({
        id: branchId,
        tenantId,
        name: branchName,
        address: input.branchAddress.trim() || "Chưa cập nhật",
        phone: branchPhone ?? phone ?? "",
        workingHours: JSON.stringify({
          monday: "08:00-18:00",
          tuesday: "08:00-18:00",
          wednesday: "08:00-18:00",
          thursday: "08:00-18:00",
          friday: "08:00-18:00",
          saturday: "08:00-17:00",
          sunday: "closed",
        }),
      })
      .run();
    tx.insert(staff)
      .values({
        id: staffId,
        tenantId,
        code: ownerCode,
        name: ownerName,
        role: "owner",
        passwordHash,
        pinHash: null,
        email,
        phone,
        baseSalary: 0,
        active: true,
      })
      .run();
    tx.insert(staffBranches)
      .values({ staffId, branchId, tenantId })
      .run();
    const permissionRows = TENANT_ROLES.flatMap((role) =>
      DEFAULT_ROLE_PERMISSIONS[role].map((permission) => ({
        id: `rp-${tenantId}-${role}-${permission}`,
        tenantId,
        role,
        permission,
      })),
    );
    tx.insert(rolePermissions).values(permissionRows).run();
    tx.insert(settings)
      .values([
        {
          id: `setting-${tenantId}-studio-name`,
          tenantId,
          key: "studio.name",
          value: studioName,
        },
        {
          id: `setting-${tenantId}-studio-address`,
          tenantId,
          key: "studio.address",
          value: input.branchAddress.trim() || "Chưa cập nhật",
        },
        {
          id: `setting-${tenantId}-studio-phone`,
          tenantId,
          key: "studio.phone",
          value: phone ?? "",
        },
        {
          id: `setting-${tenantId}-studio-email`,
          tenantId,
          key: "studio.email",
          value: email,
        },
      ])
      .run();
  });

  writeAudit(db, {
    tenantId,
    actorId: staffId,
    action: "tenant.register",
    entity: "tenant",
    entityId: tenantId,
    metadata: { studioName, branchName, plan: "trial" },
  });

  triggerDbBackupDebounced(500);

  return { tenantId, tenantSlug: slug, staffId, branchId };
}

export function assertTenantOwner(role: string): void {
  if (role !== "owner") {
    throw new AuthorizationError("Chỉ owner được thực hiện thao tác này.");
  }
}

export function findTenantDemoOwner(db: AppDb): {
  tenantId: string;
  staffId: string;
  staffName: string;
} | null {
  const row = db
    .select({
      tenantId: tenants.id,
      staffId: staff.id,
      staffName: staff.name,
      tenantStatus: tenants.status,
    })
    .from(tenants)
    .innerJoin(staff, eq(staff.tenantId, tenants.id))
    .where(and(eq(tenants.slug, "studio-anh-duong"), eq(staff.role, "owner")))
    .get();
  if (!row || row.tenantStatus !== "active") return null;
  return {
    tenantId: row.tenantId,
    staffId: row.staffId,
    staffName: row.staffName,
  };
}
