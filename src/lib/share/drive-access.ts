import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "../env";
import type { DriveShare } from "../services/drive-service";

export const driveCookieName = (id: string) => `studiocore_drive_${id}`;
const secret = () => new TextEncoder().encode(getEnv().AUTH_SECRET);

export async function hasDriveAccess(share: DriveShare): Promise<boolean> {
  if (!share.pinHash) return true;
  const value = (await cookies()).get(driveCookieName(share.id))?.value;
  if (!value) return false;
  try {
    const { payload } = await jwtVerify(value, secret(), {
      algorithms: ["HS256"],
      audience: "studiocore-drive",
    });
    return payload.sid === share.id && payload.th === share.tokenHash;
  } catch {
    return false;
  }
}

export async function grantDriveAccess(share: DriveShare) {
  const ttl = Math.min(
    7200,
    share.expiresAt ? Math.floor((+share.expiresAt - Date.now()) / 1000) : 7200,
  );
  if (ttl <= 0) return;
  const value = await new SignJWT({ sid: share.id, th: share.tokenHash })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("studiocore-drive")
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret());
  (await cookies()).set(driveCookieName(share.id), value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/drive`,
    maxAge: ttl,
  });
}
