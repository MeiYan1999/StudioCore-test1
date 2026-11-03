import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { attachmentHeader } from "@/lib/http/download";
import { getAlbumSelectionExport } from "@/lib/services/album-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  }
  const { id } = await params;

  try {
    const data = getAlbumSelectionExport(getDb(), actor, id);
    if (data.rows.length === 0) {
      return NextResponse.json(
        { error: "Album chưa có ảnh khách chọn để xuất ZIP." },
        { status: 400 },
      );
    }

    const zip = new JSZip();
    const missing: string[] = [];
    const manifestLines = [
      "code,filename,folder,note,selected_at,extra_fee,status,zip_entry",
    ];

    for (const row of data.rows) {
      let zipEntry = "";
      if (row.status === "ready") {
        try {
          const buffer = await getStorageAdapter().read(row.storageKey);
          zipEntry = `photos/${row.code}-${row.filename}`;
          zip.file(zipEntry, buffer);
        } catch {
          missing.push(`${row.code}\t${row.filename}\tKhông đọc được file gốc`);
        }
      } else {
        missing.push(`${row.code}\t${row.filename}\tẢnh missing trong album`);
      }
      manifestLines.push(
        [
          csvEscape(row.code),
          csvEscape(row.filename),
          csvEscape(row.folderName ?? ""),
          csvEscape(row.note ?? ""),
          row.selectedAt ? row.selectedAt.toISOString() : "",
          String(row.extraFee),
          row.status,
          csvEscape(zipEntry),
        ].join(","),
      );
    }

    zip.file("manifest.csv", `\uFEFF${manifestLines.join("\r\n")}\r\n`);
    zip.file(
      "missing.txt",
      missing.length > 0 ? `${missing.join("\n")}\n` : "",
    );

    const nodeStream = zip.generateNodeStream({
      type: "nodebuffer",
      streamFiles: true,
      compression: "STORE",
    });
    const webStream = Readable.toWeb(
      nodeStream as unknown as Readable,
    ) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachmentHeader(
          `album-${data.albumId}-selected.zip`,
        ),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Không thể tạo ZIP ảnh đã chọn." },
      { status: 500 },
    );
  }
}
