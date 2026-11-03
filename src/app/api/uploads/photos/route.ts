import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http/security";
import { addUploadedPhotos } from "@/lib/services/album-service";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/local-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    const formData = await request.formData();
    const albumId = String(formData.get("albumId") ?? "");
    if (!albumId) {
      return NextResponse.json({ error: "Thiếu albumId." }, { status: 400 });
    }

    const entries = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    if (entries.length === 0) {
      return NextResponse.json({ error: "Chưa chọn file ảnh." }, { status: 400 });
    }

    const relativePaths = formData
      .getAll("relativePaths")
      .map((value) => (typeof value === "string" ? value : ""));

    let total = 0;
    const files: { filename: string; relativePath: string; buffer: Buffer }[] = [];
    for (const [index, entry] of entries.entries()) {
      if (entry.size === 0) continue;
      if (entry.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `${entry.name} vượt quá 20MB.` },
          { status: 400 },
        );
      }
      total += entry.size;
      if (total > MAX_TOTAL_BYTES) {
        return NextResponse.json(
          { error: "Tổng dung lượng tải lên vượt quá 200MB." },
          { status: 400 },
        );
      }
      files.push({
        filename: entry.name,
        relativePath: relativePaths[index] || entry.name,
        buffer: Buffer.from(await entry.arrayBuffer()),
      });
    }

    const result = await addUploadedPhotos(getDb(), actor, albumId, files);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Không thể tải ảnh lên. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
