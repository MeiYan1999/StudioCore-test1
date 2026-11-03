import type { ReactNode } from "react";
import type { ActorContext } from "@/lib/auth/types";
import type { Permission } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/permissions";

export function PermissionGate({
  actor,
  permission,
  children,
  fallback = null,
}: {
  actor: ActorContext;
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return hasPermission(actor.permissions, permission) ? <>{children}</> : <>{fallback}</>;
}
