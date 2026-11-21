import { NextResponse } from "next/server";
import { getDb, type AppDb } from "@/lib/db/client";
import type { DriveDevice } from "@/lib/db/schema";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { authenticateDriveDevice, touchDriveDevice } from "@/lib/services/drive-service";

export function driveErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[drive]", error);
  return NextResponse.json({ error: "Lỗi máy chủ." }, { status: 500 });
}

/**
 * Xác thực ứng dụng máy tính bằng Bearer token. Yêu cầu từ trình duyệt (có Origin/Cookie
 * phiên) bị từ chối để token thiết bị không bao giờ được dùng qua trang web bên thứ ba.
 */
export function requireDriveDevice(request: Request): { db: AppDb; device: DriveDevice } {
  if (request.headers.get("origin")) {
    throw new AuthorizationError("API này chỉ dành cho ứng dụng StudioCore Drive.");
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const db = getDb();
  const device = authenticateDriveDevice(db, token);
  touchDriveDevice(db, device, request.headers.get("x-drive-app-version") ?? undefined);
  return { db, device };
}

export async function readJsonBody(request: Request, maxBytes = 8 * 1024 * 1024): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new ValidationError("Dữ liệu gửi lên quá lớn.");
  try {
    const parsed: unknown = JSON.parse(text || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // rơi xuống lỗi chung
  }
  throw new ValidationError("Dữ liệu gửi lên không hợp lệ.");
}

export function publicSiteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return configured || new URL(request.url).origin;
}
