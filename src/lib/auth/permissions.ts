import type { Permission, Role } from "./roles";
import { DEFAULT_ROLE_PERMISSIONS } from "./roles";
import type { ActorBranch, ActorContext } from "./types";
import { AuthorizationError } from "../errors";

export function hasPermission(
  permissions: readonly Permission[],
  permission: Permission,
): boolean {
  return permissions.includes(permission);
}

export function assertPermission(actor: ActorContext, permission: Permission): void {
  if (!hasPermission(actor.permissions, permission)) {
    throw new AuthorizationError();
  }
}

export type BranchScope =
  | { mode: "all" }
  | { mode: "branch"; branchId: string }
  | { mode: "none" };

export function getBranchScope(actor: ActorContext): BranchScope {
  if (actor.role === "owner" && actor.activeBranchId === null) {
    return { mode: "all" };
  }

  const branchId = actor.activeBranchId ?? actor.branches[0]?.id;
  if (!branchId) {
    return { mode: "none" };
  }

  if (!actor.branches.some((branch) => branch.id === branchId)) {
    return { mode: "none" };
  }

  return { mode: "branch", branchId };
}

export function assertBranchAccess(actor: ActorContext, branchId: string): void {
  if (actor.role === "owner") {
    if (!actor.branches.some((branch) => branch.id === branchId)) {
      throw new AuthorizationError("Chi nhánh không thuộc studio hiện tại.");
    }
    return;
  }

  if (!actor.branches.some((branch) => branch.id === branchId)) {
    throw new AuthorizationError("Bạn không được giao chi nhánh này.");
  }
}

export function getActiveBranch(
  branches: ActorBranch[],
  activeBranchId: string | null,
): ActorBranch | null {
  if (!activeBranchId) {
    return null;
  }

  return branches.find((branch) => branch.id === activeBranchId) ?? null;
}

export function permissionsForRole(role: Role): readonly Permission[] {
  return DEFAULT_ROLE_PERMISSIONS[role];
}
