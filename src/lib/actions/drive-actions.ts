"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { dropCachedDriveThumbs } from "@/lib/drive/relay";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createDrivePairingCode,
  deleteDriveShareByActor,
  drivePickCodes,
  getDrivePicksForActor,
  revokeDriveDevice,
  updateDriveShareByActor,
  type DrivePick,
  type DriveSharePatch,
} from "@/lib/services/drive-service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  ) {
    return { ok: false, error: error.message };
  }
  console.error("[drive]", error);
  return { ok: false, error: "Không thể thực hiện thao tác. Vui lòng thử lại." };
}

async function actorForWrite() {
  const actor = await getActorContext();
  if (!actor) throw new AuthorizationError("Vui lòng đăng nhập lại.");
  if (actor.readOnly || actor.planLapsed) throw new AuthorizationError("Tài khoản đang ở chế độ chỉ xem.");
  return actor;
}

export async function createDrivePairingCodeAction(): Promise<Result<{ code: string; expiresAt: number }>> {
  try {
    return { ok: true, ...createDrivePairingCode(getDb(), await actorForWrite()) };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeDriveDeviceAction(deviceId: string): Promise<Result> {
  try {
    revokeDriveDevice(getDb(), await actorForWrite(), String(deviceId));
    revalidatePath("/manage/drive");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function updateDriveShareAction(shareId: string, patch: DriveSharePatch): Promise<Result> {
  try {
    const safe: DriveSharePatch = {};
    if (patch.status !== undefined) safe.status = patch.status;
    if (patch.title !== undefined) safe.title = String(patch.title);
    if (patch.clientName !== undefined) safe.clientName = patch.clientName === null ? null : String(patch.clientName);
    if (patch.message !== undefined) safe.message = patch.message === null ? null : String(patch.message);
    if (patch.pin !== undefined) safe.pin = patch.pin === null ? null : String(patch.pin);
    if (patch.maxSelect !== undefined) safe.maxSelect = Number(patch.maxSelect);
    if (patch.allowOriginal !== undefined) safe.allowOriginal = patch.allowOriginal === true;
    if (patch.expiresInDays !== undefined) {
      safe.expiresInDays = patch.expiresInDays === null ? null : Number(patch.expiresInDays);
    }
    if (patch.reopen) safe.reopen = true;
    updateDriveShareByActor(getDb(), await actorForWrite(), String(shareId), safe);
    revalidatePath("/manage/drive");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDriveShareAction(shareId: string): Promise<Result> {
  try {
    deleteDriveShareByActor(getDb(), await actorForWrite(), String(shareId));
    dropCachedDriveThumbs(String(shareId));
    revalidatePath("/manage/drive");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function getDrivePicksAction(shareId: string): Promise<Result<{ picks: DrivePick[]; codes: string[] }>> {
  try {
    const actor = await getActorContext();
    if (!actor) throw new AuthorizationError("Vui lòng đăng nhập lại.");
    const picks = getDrivePicksForActor(getDb(), actor, String(shareId));
    return { ok: true, picks, codes: drivePickCodes(picks) };
  } catch (error) {
    return fail(error);
  }
}
