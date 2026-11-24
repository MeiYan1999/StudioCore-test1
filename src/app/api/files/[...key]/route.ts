import { getStorageAdapter } from "@/lib/adapters/storage";
import { getActorContext } from "@/lib/auth/session";
import { attachmentHeader, mimeForFilename } from "@/lib/http/download";

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
