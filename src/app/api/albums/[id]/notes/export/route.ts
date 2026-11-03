import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  }
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "txt" ? "txt" : "csv";

  try {
    const data = getAlbumSelectionExport(getDb(), actor, id);
    if (format === "txt") {
      const lines = data.rows.map((row) =>
        row.note?.trim() ? `${row.code}\t${row.note.trim()}` : row.code,
      );
      return new Response(`\uFEFF${lines.join("\n")}\n`, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": attachmentHeader(
            `album-${data.albumId}-notes.txt`,
          ),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const header = [
      "code",
      "filename",
      "folder",
      "note",
      "selected_at",
      "extra_fee",
      "status",
    ];
    const lines = [header.join(",")];
    for (const row of data.rows) {
      lines.push(
        [
          csvEscape(row.code),
          csvEscape(row.filename),
          csvEscape(row.folderName ?? ""),
          csvEscape(row.note ?? ""),
          row.selectedAt ? row.selectedAt.toISOString() : "",
          String(row.extraFee),
          row.status,
        ].join(","),
      );
    }
    return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": attachmentHeader(
          `album-${data.albumId}-notes.csv`,
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
      { error: "Không thể xuất ghi chú." },
      { status: 500 },
    );
  }
}
