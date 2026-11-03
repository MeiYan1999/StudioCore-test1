import { cookies } from "next/headers";
import { getDb } from "@/lib/db/client";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { attachmentHeader, mimeForFilename } from "@/lib/http/download";
import { authorizeShareDownload, getShareAlbumByToken } from "@/lib/services/share-service";
import {
  shareAccessCookieName,
  verifyShareAccess,
} from "@/lib/share/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> },
): Promise<Response> {
  const { token, photoId } = await params;
  const db = getDb();
  const album = getShareAlbumByToken(db, token);
  if (!album) {
    return new Response("Không tìm thấy album.", { status: 404 });
  }

  const cookieStore = await cookies();
  const passwordVerified = await verifyShareAccess(
    cookieStore.get(shareAccessCookieName(album.id))?.value ?? null,
    album.id,
    album.token,
  );

  try {
    const result = authorizeShareDownload(db, token, passwordVerified, photoId);
    const buffer = await getStorageAdapter().read(result.photo.storageKey);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeForFilename(result.photo.filename),
        "Content-Length": String(buffer.length),
        "Content-Disposition": attachmentHeader(result.photo.filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof ValidationError ||
      error instanceof NotFoundError
    ) {
      return new Response(error.message, { status: 403 });
    }
    return new Response("Không thể tải ảnh.", { status: 500 });
  }
}
