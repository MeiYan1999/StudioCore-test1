import { DEMO_ALBUM, demoPhotoStorageKey, demoPhotoPreviewKey, demoPhotoThumbnailKey } from "../demo-album";
import { hasPermission } from "../auth/permissions";
import type { ActorContext } from "../auth/types";

export type FileAccess = "public" | "private" | "denied";

const DERIVATIVE_PATTERN = /-(thumb|preview)\.(jpe?g|webp|png)$/i;
const publicDemoKeys = new Set(DEMO_ALBUM.photos.flatMap(photo => [
  demoPhotoStorageKey(photo.folder, photo.filename), demoPhotoPreviewKey(photo.folder, photo.filename),
  demoPhotoThumbnailKey(photo.folder, photo.filename),
]));

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
 * The demo album is public. Recorded thumbnails/previews are served without a
 * session only through a signed, expiring URL issued to a share gallery. Every
 * other request is only readable by staff of the tenant that owns the key:
 * keys are `<tenantId>/<albumId>/…`. Customers get originals through the share
 * download route, which enforces token, password, expiry and download permission.
 */
export function looksLikeDerivativeKey(key: string): boolean {
  return DERIVATIVE_PATTERN.test(key);
}

/**
 * `isDerivative` means "recorded in the photos table as a thumbnail/preview and
 * requested with a valid signature": an original uploaded as `x-thumb.jpg` also
 * matches the name pattern, so the name alone proves nothing.
 */
export function resolveFileAccess(
  key: string,
  actor: Pick<ActorContext, "tenantId" | "permissions"> | null,
  isDerivative = false,
): FileAccess {
  if (!isSafeStorageKey(key)) return "denied";
  if (publicDemoKeys.has(key) || isDerivative) return "public";
  if (!actor) return "denied";
  const ownerTenantId = key.split("/")[0];
  if (
    ownerTenantId === actor.tenantId &&
    hasPermission(actor.permissions, "albums.view")
  ) {
    return "private";
  }
  return "denied";
}
