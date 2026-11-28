import { getStorageAdapter } from "@/lib/adapters/storage";
import { getActorContext } from "@/lib/auth/session";
import { attachmentHeader, mimeForFilename } from "@/lib/http/download";

import { and, eq, or } from "drizzle-orm";
import { albums, photos } from "@/lib/db/schema";
import { getBranchScope } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { isLiveShareDerivative } from "@/lib/services/share-service";
import {
  isSafeStorageKey,
  looksLikeDerivativeKey,
  resolveFileAccess,
} from "@/lib/storage/file-access";
import { signedFileUrlRemainingMs } from "@/lib/storage/signed-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await params;
  const storageKey = key.join("/");
  // A thumbnail/preview is served without a session only through a URL signed
  // for a share gallery, and only while that album's link is still live.
  const query = new URL(request.url).searchParams;
  const signedMs = isSafeStorageKey(storageKey)
    ? signedFileUrlRemainingMs(storageKey, query.get("exp"), query.get("sig"))
    : 0;
  let access = resolveFileAccess(
    storageKey,
    null,
    signedMs > 0 && isLiveShareDerivative(getDb(), storageKey),
  );
  const isDemo = access === "public" && signedMs === 0;
  if (access === "denied" && isSafeStorageKey(storageKey)) {
    const actor = await getActorContext();
    access = resolveFileAccess(storageKey, actor);
    if (access === "private" && actor) {
      const scope = getBranchScope(actor);
      const albumId = storageKey.split("/")[1];
      const photo = scope.mode !== "none" && getDb().select({ id: photos.id }).from(photos)
        .innerJoin(albums, eq(albums.id, photos.albumId))
        .where(and(eq(photos.tenantId, actor.tenantId), eq(albums.tenantId, actor.tenantId),
          eq(photos.albumId, albumId), scope.mode === "branch" ? eq(albums.branchId, scope.branchId) : undefined,
          or(eq(photos.storageKey, storageKey), eq(photos.previewKey, storageKey), eq(photos.thumbnailKey, storageKey)))).get();
      if (!photo) access = "denied";
    }
  }
  if (access === "denied") {
    return new Response("Not found", { status: 404 });
  }
  const cacheControl =
    access === "private"
      ? looksLikeDerivativeKey(storageKey)
        ? "private, max-age=3600"
        : "private, no-store"
      : isDemo
        ? "public, max-age=3600"
        : `private, max-age=${Math.min(3600, Math.floor(signedMs / 1000))}`;
  try {
    const buffer = await getStorageAdapter().read(storageKey);
    const filename = key.at(-1) ?? "image";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeForFilename(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control": cacheControl,
        // A cached staff copy must not be reused after logout or account switch.
        ...(access === "private" ? { Vary: "Cookie" } : {}),
        "Content-Disposition": attachmentHeader(filename).replace(
          "attachment;",
          "inline;",
        ),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
