import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { driveErrorResponse, readJsonBody } from "@/lib/drive/http";
import { AuthorizationError } from "@/lib/errors";
import { pairDriveDevice } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    if (request.headers.get("origin")) {
      throw new AuthorizationError("API này chỉ dành cho ứng dụng StudioCore Drive.");
    }
    const body = await readJsonBody(request, 4096);
    const result = pairDriveDevice(getDb(), {
      code: String(body.code ?? ""),
      name: String(body.name ?? ""),
      platform: String(body.platform ?? ""),
      appVersion: String(body.appVersion ?? ""),
    });
    return NextResponse.json(result);
  } catch (error) {
    return driveErrorResponse(error);
  }
}
