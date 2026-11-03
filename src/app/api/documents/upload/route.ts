import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/http/security";
import { createUploadedDocument } from "@/lib/services/document-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  }
  try {
    assertSameOrigin(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chưa chọn file." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const documentId = createUploadedDocument(getDb(), actor, {
      name: String(formData.get("name") ?? file.name),
      category: String(formData.get("category") ?? "other"),
      visibility: String(formData.get("visibility") ?? "internal"),
      branchId: String(formData.get("branchId") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      filename: file.name,
      buffer,
    });
    return NextResponse.json({ id: documentId });
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
    return NextResponse.json({ error: "Không tải được tài liệu." }, { status: 500 });
  }
}
