import { and, asc, count, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { branches, rolePermissions, sessions, staff, staffBranches } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission } from "../auth/permissions";
import {
  DEFAULT_ROLE_PERMISSIONS,
  isPermission,
  isTenantRole,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  type Permission,
  type Role,
  type TenantRole,
} from "../auth/roles";
import { hashSecret } from "../auth/password";
import { normalizeVietnamesePhone } from "../utils/phone";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";

export type StaffListItem = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  roleLabel: string;
  active: boolean;
  branches: { id: string; name: string }[];
  createdAt: Date;
};

export type StaffDetail = StaffListItem & {
  branchIds: string[];
};

export type StaffCreateData = {
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  role: TenantRole;
  pin: string;
  password: string | null;
  branchIds: string[];
  active: boolean;
};

export type StaffUpdateData = Omit<StaffCreateData, "pin" | "password"> & {
  pin: string | null;
  password: string | null;
};

export type RoleMatrixItem = {
  role: Role;
  label: string;
  description: string;
  permissions: Permission[];
  readOnly: boolean;
};

export type SessionListItem = {
  id: string;
  staffName: string;
  staffCode: string;
  role: Role;
  roleLabel: string;
  ip: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
};

function normalizeOptionalPhone(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") {
    return null;
  }

  const phone = normalizeVietnamesePhone(value);
  if (!phone) {
    throw new ValidationError("Số điện thoại không hợp lệ.");
  }

  return phone;
}

function assertBranchesInTenant(
  db: AppDb,
  tenantId: string,
  branchIds: string[],
): string[] {
  const uniqueIds = [...new Set(branchIds)];
  if (uniqueIds.length === 0) {
    throw new ValidationError("Chọn ít nhất một chi nhánh.");
  }

  const rows = db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.tenantId, tenantId),
        eq(branches.status, "active"),
        inArray(branches.id, uniqueIds),
      ),
    )
    .all();

  if (rows.length !== uniqueIds.length) {
    throw new ValidationError("Có chi nhánh không thuộc studio hiện tại.");
  }

  return uniqueIds;
}

function getBranchesByStaff(
  db: AppDb,
  tenantId: string,
  staffIds: string[],
): Map<string, { id: string; name: string }[]> {
  const map = new Map<string, { id: string; name: string }[]>();
  if (staffIds.length === 0) {
    return map;
  }

  const rows = db
    .select({
      staffId: staffBranches.staffId,
      branchId: branches.id,
      branchName: branches.name,
    })
    .from(staffBranches)
    .innerJoin(branches, eq(staffBranches.branchId, branches.id))
    .where(
      and(
        eq(staffBranches.tenantId, tenantId),
        inArray(staffBranches.staffId, staffIds),
      ),
    )
    .all();

  for (const row of rows) {
    const current = map.get(row.staffId) ?? [];
    current.push({ id: row.branchId, name: row.branchName });
    map.set(row.staffId, current);
  }

  return map;
}

function assertUniqueStaffFields(
  db: AppDb,
  tenantId: string,
  code: string,
  email: string | null,
  excludeId?: string,
): void {
  const codeConditions = [eq(staff.code, code)];
  const emailConditions = email ? [eq(staff.email, email)] : [];

  if (excludeId) {
    codeConditions.push(ne(staff.id, excludeId));
    if (emailConditions.length > 0) {
      emailConditions.push(ne(staff.id, excludeId));
    }
  }

  const duplicatedCode = db
    .select({ id: staff.id })
    .from(staff)
    .where(and(...codeConditions))
    .get();

  if (duplicatedCode) {
    throw new ValidationError("Mã nhân viên đã được sử dụng.");
  }

  if (email) {
    const duplicatedEmail = db
      .select({ id: staff.id })
      .from(staff)
      .where(and(...emailConditions))
      .get();

    if (duplicatedEmail) {
      throw new ValidationError("Email đã được sử dụng.");
    }
  }

  if (tenantId.length === 0) {
    throw new ValidationError("Tenant không hợp lệ.");
  }
}

export function listStaff(db: AppDb, actor: ActorContext): StaffListItem[] {
  assertPermission(actor, "settings.manage");

  const rows = db
    .select()
    .from(staff)
    .where(and(eq(staff.tenantId, actor.tenantId), isNull(staff.archivedAt), ne(staff.role, "platform_admin")))
    .orderBy(asc(staff.name))
    .all();

  const branchMap = getBranchesByStaff(
    db,
    actor.tenantId,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role],
    active: row.active,
    branches: branchMap.get(row.id) ?? [],
    createdAt: row.createdAt,
  }));
}

export function getStaffDetail(
  db: AppDb,
  actor: ActorContext,
  staffId: string,
): StaffDetail | null {
  assertPermission(actor, "settings.manage");

  const row = db
    .select()
    .from(staff)
    .where(
      and(
        eq(staff.id, staffId),
        eq(staff.tenantId, actor.tenantId),
        isNull(staff.archivedAt),
        ne(staff.role, "platform_admin"),
      ),
    )
    .get();

  if (!row) {
    return null;
  }

  const branchMap = getBranchesByStaff(db, actor.tenantId, [row.id]);
  const staffBranchesList = branchMap.get(row.id) ?? [];

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role],
    active: row.active,
    branches: staffBranchesList,
    branchIds: staffBranchesList.map((branch) => branch.id),
    createdAt: row.createdAt,
  };
}

export function createStaff(
  db: AppDb,
  actor: ActorContext,
  input: StaffCreateData,
): string {
  assertPermission(actor, "settings.manage");

  if (input.role === "owner") {
    throw new ValidationError("Không thể tạo thêm tài khoản chủ studio tại màn hình này.");
  }

  const code = input.code.trim().toUpperCase();
  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizeOptionalPhone(input.phone);
  const branchIds = assertBranchesInTenant(db, actor.tenantId, input.branchIds);
  assertUniqueStaffFields(db, actor.tenantId, code, email);

  const staffId = crypto.randomUUID();

  db.transaction((tx) => {
    tx.insert(staff)
      .values({
        id: staffId,
        tenantId: actor.tenantId,
        code,
        name: input.name.trim(),
        role: input.role,
        pinHash: hashSecret(input.pin),
        passwordHash: input.password ? hashSecret(input.password) : null,
        email,
        phone,
        active: input.active,
      })
      .run();

    tx.insert(staffBranches)
      .values(
        branchIds.map((branchId) => ({
          staffId,
          branchId,
          tenantId: actor.tenantId,
        })),
      )
      .run();
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "settings.user.create",
    entity: "staff",
    entityId: staffId,
    metadata: { role: input.role, branchIds, active: input.active },
  });

  return staffId;
}

export function updateStaff(
  db: AppDb,
  actor: ActorContext,
  staffId: string,
  input: StaffUpdateData,
): void {
  assertPermission(actor, "settings.manage");

  const current = db
    .select()
    .from(staff)
    .where(
      and(
        eq(staff.id, staffId),
        eq(staff.tenantId, actor.tenantId),
        isNull(staff.archivedAt),
      ),
    )
    .get();

  if (!current) {
    throw new NotFoundError("Không tìm thấy nhân sự.");
  }

  if (current.role === "owner" && actor.role !== "owner") {
    throw new AuthorizationError("Chỉ chủ studio được cập nhật tài khoản chủ studio.");
  }

  if (current.role === "owner" && (input.role !== "owner" || !input.active)) {
    throw new ValidationError("Không thể hạ quyền hoặc khóa tài khoản chủ studio.");
  }

  if (input.role === "owner" && current.role !== "owner") {
    throw new ValidationError("Không thể chuyển vai trò thành chủ studio tại màn hình này.");
  }

  if (staffId === actor.staffId && (input.role !== actor.role || !input.active)) {
    throw new ValidationError("Bạn không thể tự đổi vai trò hoặc khóa tài khoản đang đăng nhập.");
  }

  const code = input.code.trim().toUpperCase();
  const email = input.email?.trim().toLowerCase() || null;
  const phone = normalizeOptionalPhone(input.phone);
  const branchIds = assertBranchesInTenant(db, actor.tenantId, input.branchIds);
  assertUniqueStaffFields(db, actor.tenantId, code, email, staffId);

  db.transaction((tx) => {
    tx.update(staff)
      .set({
        code,
        name: input.name.trim(),
        role: input.role,
        email,
        phone,
        active: input.active,
        updatedAt: new Date(),
        ...(input.pin ? { pinHash: hashSecret(input.pin) } : {}),
        ...(input.password ? { passwordHash: hashSecret(input.password) } : {}),
      })
      .where(and(eq(staff.id, staffId), eq(staff.tenantId, actor.tenantId)))
      .run();

    tx.delete(staffBranches).where(eq(staffBranches.staffId, staffId)).run();
    tx.insert(staffBranches)
      .values(
        branchIds.map((branchId) => ({
          staffId,
          branchId,
          tenantId: actor.tenantId,
        })),
      )
      .run();
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "settings.user.update",
    entity: "staff",
    entityId: staffId,
    metadata: {
      role: input.role,
      branchIds,
      active: input.active,
      credentialsChanged: Boolean(input.pin || input.password),
    },
  });
}

export function listRoleMatrix(db: AppDb, actor: ActorContext): RoleMatrixItem[] {
  assertPermission(actor, "settings.manage");

  const rows = db
    .select({ role: rolePermissions.role, permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.tenantId, actor.tenantId))
    .all();

  const byRole = new Map<Role, Permission[]>();
  for (const role of ROLES) {
    byRole.set(role, []);
  }

  for (const row of rows) {
    const permissions = byRole.get(row.role) ?? [];
    if (isPermission(row.permission)) {
      permissions.push(row.permission);
    }
    byRole.set(row.role, permissions);
  }

  return ROLES.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    description: ROLE_DESCRIPTIONS[role],
    permissions: [...new Set(byRole.get(role) ?? [])].sort(
      (left, right) => PERMISSIONS.indexOf(left) - PERMISSIONS.indexOf(right),
    ),
    readOnly: role === "owner" || role === "platform_admin",
  }));
}

export function updateRolePermissions(
  db: AppDb,
  actor: ActorContext,
  role: string,
  permissions: string[],
): void {
  assertPermission(actor, "settings.manage");

  if (!isTenantRole(role) || role === "owner") {
    throw new ValidationError("Vai trò này không thể chỉnh sửa.");
  }

  const nextPermissions = [...new Set(permissions.filter(isPermission))];

  db.transaction((tx) => {
    tx.delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.tenantId, actor.tenantId),
          eq(rolePermissions.role, role),
        ),
      )
      .run();

    if (nextPermissions.length > 0) {
      tx.insert(rolePermissions)
        .values(
          nextPermissions.map((permission) => ({
            id: `${actor.tenantId}-${role}-${permission}`,
            tenantId: actor.tenantId,
            role,
            permission,
          })),
        )
        .run();
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "settings.role.update",
    entity: "role",
    entityId: role,
    metadata: { permissions: nextPermissions },
  });
}

export function listActiveSessions(db: AppDb, actor: ActorContext): SessionListItem[] {
  assertPermission(actor, "settings.manage");

  const rows = db
    .select({
      id: sessions.id,
      staffName: staff.name,
      staffCode: staff.code,
      role: staff.role,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(staff, eq(sessions.staffId, staff.id))
    .where(
      and(
        eq(sessions.tenantId, actor.tenantId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.createdAt))
    .all();

  return rows.map((row) => ({
    ...row,
    roleLabel: ROLE_LABELS[row.role],
    isCurrent: row.id === actor.sessionId,
  }));
}

export function revokeSession(
  db: AppDb,
  actor: ActorContext,
  sessionId: string,
): void {
  assertPermission(actor, "settings.manage");

  if (sessionId === actor.sessionId) {
    throw new ValidationError("Không thể thu hồi phiên hiện tại. Hãy dùng chức năng đăng xuất.");
  }

  const row = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.tenantId, actor.tenantId)))
    .get();

  if (!row) {
    throw new NotFoundError("Không tìm thấy phiên đăng nhập.");
  }

  db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "settings.session.revoke",
    entity: "session",
    entityId: sessionId,
  });
}

export function countSessions(db: AppDb, tenantId: string): number {
  return (
    db
      .select({ value: count() })
      .from(sessions)
      .where(
        and(
          eq(sessions.tenantId, tenantId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .get()?.value ?? 0
  );
}

export function defaultPermissionsForRole(role: Role): readonly Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role];
}
