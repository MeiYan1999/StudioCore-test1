import { getStorageAdapter } from "@/lib/adapters/storage";
import { getActorContext } from "@/lib/auth/session";
import { attachmentHeader, mimeForFilename } from "@/lib/http/download";

import { isSafeStorageKey, resolveFileAccess } from "@/lib/storage/file-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await params;
  const storageKey = key.join("/");
  let access = resolveFileAccess(storageKey, null);
  if (access === "denied" && isSafeStorageKey(storageKey)) {
    access = resolveFileAccess(storageKey, await getActorContext());
  }
  if (access === "denied") {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buffer = await getStorageAdapter().read(storageKey);
    const filename = key.at(-1) ?? "image";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeForFilename(filename),
        "Content-Length": String(buffer.length),
        "Cache-Control":
          access === "public" ? "public, max-age=3600" : "private, no-store",
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
