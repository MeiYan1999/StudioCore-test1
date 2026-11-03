import { assertPermission, getBranchScope, hasPermission } from "@/lib/auth/permissions";
import { ROLE_LABELS, type Permission } from "@/lib/auth/roles";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { staff } from "@/lib/db/schema";
import { and, asc, eq, isNull, ne } from "drizzle-orm";

export type StaffOption = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
};

export function listStaffOptions(
  db: AppDb,
  actor: ActorContext,
  permission: Permission,
): StaffOption[] {
  assertPermission(actor, permission);

  return db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
    })
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        isNull(staff.archivedAt), ne(staff.role, "platform_admin"),
      ),
    )
    .orderBy(asc(staff.name))
    .all()
    .map((row) => ({
      ...row,
      roleLabel: ROLE_LABELS[row.role],
    }));
}

export function listBranchOptions(actor: ActorContext): { id: string; name: string }[] {
  return actor.branches;
}

export function canUseBranchScope(actor: ActorContext): boolean {
  return hasPermission(actor.permissions, "customers.view");
}

export function assertCustomerScope(actor: ActorContext): void {
  const scope = getBranchScope(actor);
  if (scope.mode === "none") {
    throw new Error("Bạn chưa được gán chi nhánh.");
  }
}

export function currentBranchFilter(actor: ActorContext): string | null {
  const scope = getBranchScope(actor);
  return scope.mode === "branch" ? scope.branchId : null;
}
