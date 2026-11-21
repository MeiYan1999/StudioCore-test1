import { cookies } from "next/headers";
import { getDb, type AppDb } from "@/lib/db/client";
import type { DriveDevice, DriveShareRow } from "@/lib/db/schema";
import {
  driveSharePinVersion,
  getDriveShareBySlug,
  type DrivePublicState,
} from "@/lib/services/drive-service";
import { signShareAccess, verifyShareAccess } from "@/lib/share/access";

export const DRIVE_ACCESS_TTL_SECONDS = 12 * 60 * 60;

export function driveAccessCookieName(shareId: string): string {
  return `studiocore_drive_${shareId}`;
}

export type DrivePublicContext = {
  db: AppDb;
  state: DrivePublicState | "locked";
  share: DriveShareRow | null;
  device: DriveDevice | null;
};

/** Trạng thái truy cập của khách với một link: tồn tại, còn hạn, đã nhập đúng PIN. */
export async function resolveDrivePublicAccess(slug: string): Promise<DrivePublicContext> {
  const db = getDb();
  const { state, share, device } = getDriveShareBySlug(db, slug);
  if (state !== "ok" || !share) return { db, state, share, device };
  if (share.pinHash) {
    const cookieStore = await cookies();
    const unlocked = await verifyShareAccess(
      cookieStore.get(driveAccessCookieName(share.id))?.value ?? null,
      share.id,
      driveSharePinVersion(share),
    );
    if (!unlocked) return { db, state: "locked", share, device };
  }
  return { db, state: "ok", share, device };
}

export async function grantDriveAccess(share: DriveShareRow): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: driveAccessCookieName(share.id),
    value: await signShareAccess(share.id, driveSharePinVersion(share), DRIVE_ACCESS_TTL_SECONDS),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DRIVE_ACCESS_TTL_SECONDS,
  });
}

const STATE_STATUS: Record<string, number> = {
  not_found: 404,
  paused: 403,
  expired: 410,
  locked: 401,
};

const STATE_MESSAGE: Record<string, string> = {
  not_found: "Không tìm thấy link.",
  paused: "Link đang tạm dừng.",
  expired: "Link đã hết hạn.",
  locked: "Cần nhập mã PIN.",
};

export function driveStateResponse(state: string): Response {
  return Response.json({ error: STATE_MESSAGE[state] ?? "Không thể truy cập." }, { status: STATE_STATUS[state] ?? 403 });
}
