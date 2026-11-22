import { NextResponse } from "next/server";
import { driveErrorResponse, readJsonBody, requireDriveDevice } from "@/lib/drive/http";
import { dropCachedDriveThumbs } from "@/lib/drive/relay";
import {
  deleteDriveShareFromDevice,
  replaceDriveShareFiles,
  updateDriveShareFromDevice,
  type DriveSharePatch,
} from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  try {
    const { id } = await params;
    const { db, device } = requireDriveDevice(request);
    updateDriveShareFromDevice(db, device, id, (await readJsonBody(request, 4096)) as DriveSharePatch);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

/** Thay danh mục tệp sau khi quét lại thư mục. */
export async function PUT(request: Request, { params }: Context): Promise<Response> {
  try {
    const { id } = await params;
    const { db, device } = requireDriveDevice(request);
    const body = await readJsonBody(request);
    replaceDriveShareFiles(db, device, id, body.files);
    dropCachedDriveThumbs(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Context): Promise<Response> {
  try {
    const { id } = await params;
    const { db, device } = requireDriveDevice(request);
    deleteDriveShareFromDevice(db, device, id);
    dropCachedDriveThumbs(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
