import { hasPermission } from "../auth/permissions";
import type { ActorContext } from "../auth/types";

export type FileAccess = "public" | "private" | "denied";

const DERIVATIVE_PATTERN = /-(thumb|preview)\.(jpe?g|webp|png)$/i;
const DEMO_PREFIX = "tenant-demo/";

export function isSafeStorageKey(key: string): boolean {
  return Boolean(
    key &&
      !key.startsWith("db/") &&
      !key.startsWith("documents/") &&
      !key.includes("..") &&
      !key.startsWith("/") &&
      !key.includes("\\"),
  );
}

/**
 * Recorded thumbnails/previews and the demo album are served without a session because
 * share galleries embed them. Every other key (original uploads) is only
 * readable by staff of the tenant that owns it: keys are `<tenantId>/<albumId>/…`.
 * Customers get originals through the share download route, which enforces
 * token, password, expiry and download permission.
 */
export function looksLikeDerivativeKey(key: string): boolean {
  return DERIVATIVE_PATTERN.test(key);
}

/**
 * `isDerivative` must come from the photos table: an original uploaded as
 * `x-thumb.jpg` also matches the name pattern, so the name alone proves nothing.
 */
export function resolveFileAccess(
  key: string,
  actor: Pick<ActorContext, "tenantId" | "permissions"> | null,
  isDerivative = false,
): FileAccess {
  if (!isSafeStorageKey(key)) return "denied";
  if (key.startsWith(DEMO_PREFIX) || isDerivative) return "public";
  if (!actor) return "denied";
  const ownerTenantId = key.split("/")[0];
  if (
    ownerTenantId === actor.tenantId ||
    hasPermission(actor.permissions, "tenants.manage")
  ) {
    return "private";
  }
  return "denied";
}
