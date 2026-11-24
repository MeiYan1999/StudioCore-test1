import { getStorageAdapter } from "@/lib/adapters/storage";
import { getActorContext } from "@/lib/auth/session";
import { attachmentHeader, mimeForFilename } from "@/lib/http/download";

import { and, eq, ne, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { photos } from "@/lib/db/schema";
import {
  isSafeStorageKey,
  looksLikeDerivativeKey,
  resolveFileAccess,
} from "@/lib/storage/file-access";
import { signedFileUrlRemainingMs } from "@/lib/storage/signed-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecordedDerivative(key: string): boolean {
  if (!looksLikeDerivativeKey(key)) return false;
  // Keys are `<tenantId>/<albumId>/<file>`; filtering by album uses its index.
  const [tenantId, albumId] = key.split("/");
  if (!tenantId || !albumId) return false;
  const row = getDb()
    .select({ id: photos.id })
    .from(photos)
    .where(
      and(
        eq(photos.albumId, albumId),
        eq(photos.tenantId, tenantId),
        or(eq(photos.thumbnailKey, key), eq(photos.previewKey, key)),
        ne(photos.storageKey, key),
      ),
    )
    .get();
  return Boolean(row);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await params;
  const storageKey = key.join("/");
  // A thumbnail/preview is served without a session only through a URL signed
  // for a share gallery; the signature expires, so a revoked link stops working.
  const query = new URL(request.url).searchParams;
  const signedMs = isSafeStorageKey(storageKey)
    ? signedFileUrlRemainingMs(storageKey, query.get("exp"), query.get("sig"))
    : 0;
  let access = resolveFileAccess(
    storageKey,
    null,
    signedMs > 0 && isRecordedDerivative(storageKey),
  );
  const isDemo = access === "public" && signedMs === 0;
  if (access === "denied" && isSafeStorageKey(storageKey)) {
    access = resolveFileAccess(storageKey, await getActorContext());
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
