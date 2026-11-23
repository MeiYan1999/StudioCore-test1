import { NextResponse } from "next/server";
import { driveErrorResponse, readJsonBody, requireDriveDevice } from "@/lib/drive/http";
import { setDriveShareFaces } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const { db, device } = requireDriveDevice(request);
    setDriveShareFaces(db, device, id, await readJsonBody(request, 2 * 1024 * 1024));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
