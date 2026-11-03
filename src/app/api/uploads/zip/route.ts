import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http/security";
import { addUploadedPhotos } from "@/lib/services/album-service";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/local-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ZIP_BYTES = 200 * 1024 * 1024;
const MAX_ENTRIES = 200;

export async function POST(request: Request): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  }

  try {
    assertSameOrigin(request);
    const formData = await request.formData();
    const albumId = String(formData.get("albumId") ?? "");
    const zipFile = formData.get("zip");
    if (!albumId || !(zipFile instanceof File)) {
      return NextResponse.json(
        { error: "Thiếu albumId hoặc file ZIP." },
        { status: 400 },
      );
    }
    if (zipFile.size > MAX_ZIP_BYTES) {
      return NextResponse.json(
        { error: "File ZIP vượt quá 200MB." },
        { status: 400 },
      );
    }

    const archive = await JSZip.loadAsync(await zipFile.arrayBuffer());
    const entries = Object.values(archive.files).filter(
      (entry) => !entry.dir && !entry.name.includes("__MACOSX"),
    );
    if (entries.length > MAX_ENTRIES) {
      return NextResponse.json(
        { error: `ZIP có quá nhiều file (tối đa ${MAX_ENTRIES}).` },
        { status: 400 },
      );
    }

    const files: { filename: string; relativePath: string; buffer: Buffer }[] = [];
    const skipped: { filename: string; reason: string }[] = [];

    for (const entry of entries) {
      const normalized = entry.name.replace(/\\/g, "/").replace(/^\/+/, "");
      if (
        normalized.includes("..") ||
        normalized.split("/").some((segment) => segment.startsWith("."))
      ) {
        skipped.push({ filename: entry.name, reason: "Đường dẫn không an toàn." });
        continue;
      }
      if (!/\.(jpe?g|png|webp|raw|cr2|nef|arw|dng|raf)$/i.test(normalized)) {
        skipped.push({ filename: entry.name, reason: "Không phải định dạng ảnh hỗ trợ." });
        continue;
      }
      const uncompressedSize = (
        entry as unknown as { _data?: { uncompressedSize?: number } }
      )._data?.uncompressedSize;
      if (uncompressedSize && uncompressedSize > MAX_UPLOAD_BYTES) {
        skipped.push({ filename: entry.name, reason: "Ảnh vượt quá 20MB." });
        continue;
      }
      const buffer = await entry.async("nodebuffer");
      if (buffer.length > MAX_UPLOAD_BYTES) {
        skipped.push({ filename: entry.name, reason: "Ảnh vượt quá 20MB." });
        continue;
      }
      files.push({
        filename: normalized.split("/").pop() ?? normalized,
        relativePath: normalized,
        buffer,
      });
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "ZIP không có ảnh hợp lệ để tải lên.", skipped },
        { status: 400 },
      );
    }

    const result = await addUploadedPhotos(getDb(), actor, albumId, files);
    return NextResponse.json({
      added: result.added,
      skipped: [...skipped, ...result.skipped],
    });
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
      { error: "Không thể giải nén hoặc lưu ảnh. Vui lòng kiểm tra file ZIP." },
      { status: 500 },
    );
  }
}
