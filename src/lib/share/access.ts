import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "../env";

const SHARE_COOKIE_PREFIX = "studiocore_share_";
const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export function shareAccessCookieName(albumId: string): string {
  return `${SHARE_COOKIE_PREFIX}${albumId}`;
}

export async function signShareAccess(
  albumId: string,
  tokenHash: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<string> {
  return new SignJWT({ aid: albumId, th: tokenHash })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getSecret());
}

export async function verifyShareAccess(
  cookieValue: string | null,
  albumId: string,
  tokenHash: string,
): Promise<boolean> {
  if (!cookieValue) {
    return false;
  }
  try {
    const { payload } = await jwtVerify(cookieValue, getSecret());
    return payload.aid === albumId && payload.th === tokenHash;
  } catch {
    return false;
  }
}

export function shareAccessTtlSeconds(expiresAt: Date | null): number {
  if (!expiresAt) {
    return DEFAULT_TTL_SECONDS;
  }
  const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  return Math.max(0, Math.min(DEFAULT_TTL_SECONDS, remaining));
}
