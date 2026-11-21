import { z } from "zod";
import { getDb, type AppDb } from "../db/client";
import { resolvePublicUrl } from "../auth/google-auth-service";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { authenticateDriveDevice, type DriveDevice } from "./drive-service";

export function drivePublicUrl(path: string, request: Request): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return site ? new URL(path, site).toString() : resolvePublicUrl(path, process.env.NODE_ENV === "production" ? undefined : request).toString();
}
export async function driveAgentRequest(request: Request, handle: (db: AppDb, device: DriveDevice) => unknown | Promise<unknown>): Promise<Response> {
  try {
    const db = getDb();
    const match = /^Bearer (scd_[A-Za-z0-9_-]+)$/.exec(request.headers.get("authorization") || "");
    const device = match ? authenticateDriveDevice(db, match[1]) : null;
    if (!device) return Response.json({ error: "Khóa máy tính không hợp lệ." }, { status: 401 });
    return Response.json(await handle(db, device), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthorizationError ? 401 : error instanceof NotFoundError ? 404 : error instanceof z.ZodError || error instanceof ValidationError || error instanceof SyntaxError ? 400 : 500;
    return Response.json({ error: status === 500 ? "Không thể xử lý yêu cầu." : error instanceof Error ? error.message : "Yêu cầu không hợp lệ." }, { status });
  }
}
