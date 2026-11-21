import { NextResponse } from "next/server";
import { driveErrorResponse, requireDriveDevice } from "@/lib/drive/http";
import { getDrivePicksForDevice } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const { db, device } = requireDriveDevice(request);
    return NextResponse.json({ picks: getDrivePicksForDevice(db, device, id) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
