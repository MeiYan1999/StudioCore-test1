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
};
