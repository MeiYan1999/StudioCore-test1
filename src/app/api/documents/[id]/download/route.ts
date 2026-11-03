import fs from "node:fs";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { attachmentHeader, mimeForFilename } from "@/lib/http/download";
import { getDocumentFile } from "@/lib/services/document-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  try {
    const result = getDocumentFile(getDb(), actor, id);
    const buffer = fs.readFileSync(result.absolutePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeForFilename(result.document.name),
        "Content-Length": String(buffer.length),
        "Content-Disposition": attachmentHeader(result.document.name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response(error.message, { status: 403 });
    }
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return new Response(error.message, { status: 404 });
    }
    return new Response("Không tải được tài liệu.", { status: 500 });
  }
}
