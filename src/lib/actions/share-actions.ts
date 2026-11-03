"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFormString, type ActionState } from "@/lib/actions/action-state";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  evaluateShareAccess,
  getShareAlbumByToken,
  getShareGalleryPage,
  getShareSelectedCodes,
  submitShareSelection,
  updateSharePhotoSelection,
  verifySharePassword,
  type ShareCodeItem,
  type ShareGalleryPage,
  type ShareSelectionSummary,
} from "@/lib/services/share-service";
import {
  shareAccessCookieName,
  shareAccessTtlSeconds,
  signShareAccess,
  verifyShareAccess,
} from "@/lib/share/access";

async function clientIp(): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "127.0.0.1"
  );
}

async function shareContext(rawToken: string): Promise<{
  albumId: string | null;
  tokenHash: string | null;
  passwordVerified: boolean;
}> {
  const album = getShareAlbumByToken(getDb(), rawToken);
  if (!album) {
    return { albumId: null, tokenHash: null, passwordVerified: false };
  }
  const cookieStore = await cookies();
  const cookieValue =
    cookieStore.get(shareAccessCookieName(album.id))?.value ?? null;
  const passwordVerified = await verifyShareAccess(
    cookieValue,
    album.id,
    album.token,
  );
  return { albumId: album.id, tokenHash: album.token, passwordVerified };
}

export async function verifySharePasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = getFormString(formData, "token");
  const password = getFormString(formData, "password");
  const ip = await clientIp();

  const result = verifySharePassword(
    getDb(),
    token,
    password,
    ip,
  );
  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  const ttl = shareAccessTtlSeconds(result.expiresAt);
  const cookieStore = await cookies();
  cookieStore.set({
    name: shareAccessCookieName(result.albumId),
    value: await signShareAccess(result.albumId, result.tokenHash, ttl),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });

  revalidatePath(`/share/${token}`);
  redirect(`/share/${token}`);
}

export async function loadSharePageAction(input: {
  token: string;
  tab?: string;
  folderId?: string;
  page?: number;
}): Promise<
  | { ok: true; page: ShareGalleryPage }
  | { ok: false; reason: string }
> {
  const context = await shareContext(input.token);
  const access = evaluateShareAccess(
    getDb(),
    input.token,
    context.passwordVerified,
  );
  if (!access.ok) {
    return { ok: false, reason: access.reason };
  }
  return {
    ok: true,
    page: getShareGalleryPage(getDb(), access, {
      tab: input.tab,
      folderId: input.folderId,
      page: input.page,
      pageSize: 24,
    }),
  };
}

export async function loadShareCodesAction(input: {
  token: string;
}): Promise<{ ok: true; items: ShareCodeItem[] } | { ok: false; error: string }> {
  const context = await shareContext(input.token);
  const access = evaluateShareAccess(
    getDb(),
    input.token,
    context.passwordVerified,
  );
  if (!access.ok) {
    return { ok: false, error: "Không thể truy cập album chia sẻ này." };
  }
  return { ok: true, items: getShareSelectedCodes(getDb(), access) };
}

export type SharePhotoActionResult =
  | { ok: true; summary: ShareSelectionSummary }
  | { ok: false; error: string };

export async function updateSharePhotoAction(input: {
  token: string;
  photoId: string;
  favorite?: boolean;
  selected?: boolean;
  note?: string;
}): Promise<SharePhotoActionResult> {
  const context = await shareContext(input.token);
  try {
    const summary = updateSharePhotoSelection(
      getDb(),
      input.token,
      context.passwordVerified,
      input.photoId,
      {
        favorite: input.favorite,
        selected: input.selected,
        note: input.note,
      },
    );
    revalidatePath(`/share/${input.token}`);
    return { ok: true, summary };
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof ValidationError ||
      error instanceof NotFoundError
    ) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Không thể cập nhật lựa chọn. Vui lòng thử lại." };
  }
}

export type ShareSubmitActionResult =
  | {
      ok: true;
      summary: ShareSelectionSummary;
      paymentRequestCode: string | null;
    }
  | { ok: false; error: string };

export async function submitShareSelectionAction(input: {
  token: string;
}): Promise<ShareSubmitActionResult> {
  const context = await shareContext(input.token);
  try {
    const result = submitShareSelection(
      getDb(),
      input.token,
      context.passwordVerified,
    );
    revalidatePath(`/share/${input.token}`);
    return {
      ok: true,
      summary: result.summary,
      paymentRequestCode: result.paymentRequestCode,
    };
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof ValidationError ||
      error instanceof NotFoundError
    ) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Không thể gửi lựa chọn. Vui lòng thử lại." };
  }
}
