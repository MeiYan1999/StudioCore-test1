"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireActor } from "../auth/session";
import { assertPermission } from "../auth/permissions";
import { getDb } from "../db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { grantDriveAccess, hasDriveAccess } from "../share/drive-access";
import { getFormString, type ActionState } from "./action-state";
import * as drive from "../services/drive-service";

type DriveActionState = ActionState & { key?: string };

function failure(error: unknown): ActionState {
  return {
    status: "error",
    message:
      error instanceof AuthorizationError ||
      error instanceof NotFoundError ||
      error instanceof ValidationError
        ? error.message
        : "Không thể thực hiện thao tác. Vui lòng thử lại.",
  };
}

export async function createDriveDeviceAction(): Promise<DriveActionState> {
  const actor = await requireActor();
  try {
    assertPermission(actor, "albums.manage");
    const { key } = drive.createDriveDevice(getDb(), actor);
    revalidatePath("/manage/drive");
    return { status: "success", key, message: "Đã thêm máy tính. Hãy lưu khóa ngay." };
  } catch (error) {
    return failure(error);
  }
}

export async function manageDriveAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireActor();
  try {
    assertPermission(actor, "albums.manage");
    const id = z.string().min(1).parse(getFormString(form, "id"));
    const operation = z
      .enum(["revokeDevice", "active", "paused", "revoked", "reopen"])
      .parse(getFormString(form, "operation"));
    if (operation === "revokeDevice") drive.revokeDriveDevice(getDb(), actor, id);
    else if (operation === "reopen") drive.reopenDriveSelection(getDb(), actor, id);
    else drive.updateDriveShareStatus(getDb(), actor, id, operation);
    revalidatePath("/manage/drive");
    revalidatePath(`/manage/drive/${id}`);
    revalidatePath("/drive", "layout");
    return { status: "success", message: "Đã cập nhật StudioCore Drive." };
  } catch (error) {
    return failure(error);
  }
}

export async function verifyDrivePinAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const token = getFormString(form, "token");
    const share = drive.getDriveShareByToken(getDb(), token);
    if (!share) throw new NotFoundError();
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      "127.0.0.1";
    if (!drive.verifyDrivePin(getDb(), token, getFormString(form, "pin"), ip))
      throw new ValidationError(
        "PIN không đúng hoặc đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.",
      );
    await grantDriveAccess(share);
    revalidatePath(`/drive/${token}`);
    return { status: "success", message: "Đã mở album." };
  } catch (error) {
    return failure(error);
  }
}

export async function mutateDriveGalleryAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const token = getFormString(form, "token");
    const share = drive.getDriveShareByToken(getDb(), token);
    if (!share) throw new NotFoundError();
    if (!(await hasDriveAccess(share)))
      throw new AuthorizationError("Vui lòng nhập PIN để tiếp tục.");
    if (share.status !== "active" || (share.expiresAt && +share.expiresAt <= Date.now()))
      throw new ValidationError("Link không còn hoạt động.");
    const operation = z
      .enum(["like", "note", "finalize", "comment"])
      .parse(getFormString(form, "operation"));
    const fileId = getFormString(form, "fileId");
    if (operation === "like") drive.toggleDriveLike(getDb(), token, fileId);
    else if (operation === "note")
      drive.setDriveNote(getDb(), token, fileId, getFormString(form, "note"));
    else if (operation === "finalize") drive.finalizeDriveSelection(getDb(), token);
    else
      drive.addDriveVideoComment(getDb(), token, {
        fileId,
        seconds: Number(getFormString(form, "seconds")),
        author: getFormString(form, "author"),
        content: getFormString(form, "content"),
      });
    revalidatePath(`/drive/${token}`);
    revalidatePath(`/manage/drive/${share.id}`);
    revalidatePath("/manage/drive");
    return { status: "success", message: "Đã lưu thay đổi." };
  } catch (error) {
    return failure(error);
  }
}
