import crypto from "node:crypto";
import { getEnv } from "../env";
import { publicUploadUrl } from "./local-storage";

const HOUR_MS = 60 * 60 * 1000;

function signature(key: string, expiresAt: number): string {
  return crypto
    .createHmac("sha256", getEnv().AUTH_SECRET)
    .update(`file-url:${key}:${expiresAt}`)
    .digest("base64url");
}

/**
 * URL for a thumbnail/preview shown to a share-link visitor. It stops working
 * within two hours, or at `notAfter` (the link's own expiry) if that is sooner,
 * so a revoked or expired link cannot keep serving images. The expiry is
 * rounded to the hour so the URL stays stable for browser caching.
 */
export function signedFileUrl(
  key: string,
  options: { now?: Date; notAfter?: Date | null } = {},
): string {
  const base = publicUploadUrl(key);
  if (!base.startsWith("/api/files/")) return base;
  const now = (options.now ?? new Date()).getTime();
  let expiresAt = Math.ceil(now / HOUR_MS) * HOUR_MS + HOUR_MS;
  if (options.notAfter && options.notAfter.getTime() < expiresAt) {
    expiresAt = options.notAfter.getTime();
  }
  return `${base}?exp=${expiresAt}&sig=${signature(key, expiresAt)}`;
}

/** Milliseconds the signature stays valid, or 0 when it is missing, wrong or expired. */
export function signedFileUrlRemainingMs(
  key: string,
  exp: string | null,
  sig: string | null,
  now: Date = new Date(),
): number {
  if (!exp || !sig || !/^\d{1,16}$/.test(exp)) return 0;
  const expiresAt = Number(exp);
  const remaining = expiresAt - now.getTime();
  if (remaining <= 0) return 0;
  const expected = Buffer.from(signature(key, expiresAt));
  const given = Buffer.from(sig);
  if (expected.length !== given.length) return 0;
  return crypto.timingSafeEqual(expected, given) ? remaining : 0;
}
