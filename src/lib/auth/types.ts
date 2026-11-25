import type { Permission, Role } from "./roles";

export type ActorBranch = {
  id: string;
  name: string;
};

export type ActorContext = {
  sessionId: string;
  staffId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantPlan: string;
  staffName: string;
  staffCode: string;
  staffEmail: string | null;
  role: Role;
  permissions: Permission[];
  branches: ActorBranch[];
  activeBranchId: string | null;
  readOnly: boolean;
  /** Plan expired past the grace period: view/export only until renewed. */
  planLapsed?: boolean;
  /** The role may buy or renew a plan, kept even while planLapsed strips manage permissions. */
  canRenewPlan?: boolean;
  canChangePassword: boolean;
};
