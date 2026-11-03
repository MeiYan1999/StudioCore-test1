"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fieldErrorsFromZod,
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createAlbum,
  previewAlbumSource,
  rescanAlbum,
  rotateAlbumShareToken,
  setAlbumSelectionLock,
  setAlbumShareRevoked,
  updateAlbum,
  updateAlbumStatus,
  type AlbumSourcePreview,
} from "@/lib/services/album-service";
import { getDb } from "@/lib/db/client";
import {
  albumIdSchema,
  albumStatusSchema,
  createAlbumSchema,
  shareToggleSchema,
  updateAlbumSchema,
} from "@/lib/validators/albums";

export type AlbumShareLinkState = ActionState & {
  shareLink?: string;
};

function errorMessage(error: unknown): string {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

function booleanField(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

function albumValues(formData: FormData): Record<string, string> {
  const keys = [
    "branchId",
    "customerId",
    "orderId",
    "title",
    "notes",
    "sourceType",
    "sourceUrl",
    "sourceUrls",
    "selectionLimit",
    "extraPhotoPrice",
    "downloadLimit",
    "password",
    "expiresAt",
  ];
  return Object.fromEntries(
    keys.map((key) => [key, getFormString(formData, key)]),
  );
}

function parseCreate(formData: FormData) {
  return createAlbumSchema.safeParse({
    branchId: getFormString(formData, "branchId"),
    customerId: getFormString(formData, "customerId"),
    orderId: getFormString(formData, "orderId"),
    title: getFormString(formData, "title"),
    notes: getFormString(formData, "notes"),
    sourceType: getFormString(formData, "sourceType") || "drive",
    sourceUrl: getFormString(formData, "sourceUrl"),
    sourceUrls: getFormString(formData, "sourceUrls"),
    selectionLimit: getFormString(formData, "selectionLimit") || "10",
    extraPhotoEnabled: booleanField(formData, "extraPhotoEnabled"),
    extraPhotoPrice: getFormString(formData, "extraPhotoPrice") || "0",
    allowFavorites: booleanField(formData, "allowFavorites"),
    allowNotes: booleanField(formData, "allowNotes"),
    allowDownloads: booleanField(formData, "allowDownloads"),
    downloadLimit: getFormString(formData, "downloadLimit"),
    password: getFormString(formData, "password"),
    expiresAt: getFormString(formData, "expiresAt"),
  });
}

export async function previewAlbumSourceAction(input: {
  sourceType: "drive" | "multi_link" | "upload";
  sourceUrl: string;
  sourceUrls: string;
}): Promise<{ ok: true; data: AlbumSourcePreview } | { ok: false; error: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  try {
    return {
      ok: true,
      data: await previewAlbumSource(getDb(), actor, input),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ValidationError || error instanceof AuthorizationError
          ? error.message
          : "Không quét được nguồn ảnh. Vui lòng kiểm tra link.",
    };
  }
}

export async function createAlbumAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = albumValues(formData);
  const parsed = parseCreate(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin album.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  let albumId: string;
  try {
    const result = await createAlbum(getDb(), actor, {
      branchId: parsed.data.branchId,
      customerId: parsed.data.customerId || "",
      orderId: parsed.data.orderId || "",
      title: parsed.data.title,
      notes: parsed.data.notes || "",
      sourceType: parsed.data.sourceType,
      sourceUrl: parsed.data.sourceUrl || "",
      sourceUrls: parsed.data.sourceUrls || "",
      selectionLimit: parsed.data.selectionLimit,
      extraPhotoEnabled: parsed.data.extraPhotoEnabled,
      extraPhotoPrice: parsed.data.extraPhotoPrice,
      allowFavorites: parsed.data.allowFavorites,
      allowNotes: parsed.data.allowNotes,
      allowDownloads: parsed.data.allowDownloads,
      downloadLimit:
        typeof parsed.data.downloadLimit === "number"
          ? parsed.data.downloadLimit
          : null,
      password: parsed.data.password || "",
      expiresAt: parsed.data.expiresAt || "",
    });
    albumId = result.albumId;
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }

  revalidatePath("/manage/photos");
  redirect(`/manage/albums/${albumId}?created=1`);
}

export async function updateAlbumAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = albumValues(formData);
  const parsed = updateAlbumSchema.safeParse({
    albumId: getFormString(formData, "albumId"),
    customerId: getFormString(formData, "customerId"),
    orderId: getFormString(formData, "orderId"),
    title: getFormString(formData, "title"),
    notes: getFormString(formData, "notes"),
    selectionLimit: getFormString(formData, "selectionLimit") || "10",
    extraPhotoEnabled: booleanField(formData, "extraPhotoEnabled"),
    extraPhotoPrice: getFormString(formData, "extraPhotoPrice") || "0",
    allowFavorites: booleanField(formData, "allowFavorites"),
    allowNotes: booleanField(formData, "allowNotes"),
    allowDownloads: booleanField(formData, "allowDownloads"),
    downloadLimit: getFormString(formData, "downloadLimit"),
    password: getFormString(formData, "password"),
    expiresAt: getFormString(formData, "expiresAt"),
    clearPassword: booleanField(formData, "clearPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin album.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateAlbum(getDb(), actor, parsed.data.albumId, {
      title: parsed.data.title,
      customerId: parsed.data.customerId || "",
      orderId: parsed.data.orderId || "",
      notes: parsed.data.notes || "",
      selectionLimit: parsed.data.selectionLimit,
      extraPhotoEnabled: parsed.data.extraPhotoEnabled,
      extraPhotoPrice: parsed.data.extraPhotoPrice,
      allowFavorites: parsed.data.allowFavorites,
      allowNotes: parsed.data.allowNotes,
      allowDownloads: parsed.data.allowDownloads,
      downloadLimit:
        typeof parsed.data.downloadLimit === "number"
          ? parsed.data.downloadLimit
          : null,
      expiresAt: parsed.data.expiresAt || "",
      password: parsed.data.password || "",
      clearPassword: parsed.data.clearPassword,
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }

  revalidatePath("/manage/photos");
  revalidatePath(`/manage/albums/${parsed.data.albumId}`);
  return { status: "success", message: "Đã lưu cấu hình album." };
}

export async function updateAlbumStatusAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const parsed = albumStatusSchema.safeParse({
    albumId: getFormString(formData, "albumId"),
    status: getFormString(formData, "status"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Trạng thái album không hợp lệ." };
  }

  try {
    updateAlbumStatus(getDb(), actor, parsed.data.albumId, parsed.data.status);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath("/manage/photos");
  revalidatePath(`/manage/albums/${parsed.data.albumId}`);
  return { status: "success", message: "Đã cập nhật trạng thái album." };
}

export async function rotateShareLinkAction(
  _previousState: AlbumShareLinkState,
  formData: FormData,
): Promise<AlbumShareLinkState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const parsed = albumIdSchema.safeParse({
    albumId: getFormString(formData, "albumId"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Album không hợp lệ." };
  }

  try {
    const result = rotateAlbumShareToken(getDb(), actor, parsed.data.albumId);
    revalidatePath(`/manage/albums/${parsed.data.albumId}`);
    return {
      status: "success",
      message: "Đã tạo link chia sẻ mới. Link cũ không còn hiệu lực.",
      shareLink: result.shareLink,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function setShareRevokedAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const parsed = shareToggleSchema.safeParse({
    albumId: getFormString(formData, "albumId"),
    revoked: booleanField(formData, "revoked"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Yêu cầu không hợp lệ." };
  }

  try {
    setAlbumShareRevoked(
      getDb(),
      actor,
      parsed.data.albumId,
      parsed.data.revoked,
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(`/manage/albums/${parsed.data.albumId}`);
  return {
    status: "success",
    message: parsed.data.revoked
      ? "Đã thu hồi link chia sẻ."
      : "Đã mở lại link chia sẻ.",
  };
}

export async function setSelectionLockAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const albumId = getFormString(formData, "albumId");
  const locked = booleanField(formData, "locked");
  if (!albumId) {
    return { status: "error", message: "Album không hợp lệ." };
  }

  try {
    setAlbumSelectionLock(getDb(), actor, albumId, locked);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath(`/manage/albums/${albumId}`);
  revalidatePath(`/manage/albums/${albumId}/notes`);
  return {
    status: "success",
    message: locked
      ? "Đã khóa lựa chọn của khách."
      : "Đã mở khóa lựa chọn của khách.",
  };
}

export async function rescanAlbumAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const albumId = getFormString(formData, "albumId");
  if (!albumId) {
    return { status: "error", message: "Album không hợp lệ." };
  }

  try {
    const result = await rescanAlbum(getDb(), actor, albumId);
    revalidatePath(`/manage/albums/${albumId}`);
    return {
      status: "success",
      message: `Quét lại xong: +${result.added} ảnh mới, ${result.updated} ảnh cập nhật, ${result.missing} ảnh missing.`,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}
