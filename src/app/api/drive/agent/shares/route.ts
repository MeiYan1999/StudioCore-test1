import { NextResponse } from "next/server";
import { driveErrorResponse, publicSiteOrigin, readJsonBody, requireDriveDevice } from "@/lib/drive/http";
import {
  createDriveShare,
  listDriveSharesForDevice,
  type DriveFileInput,
  type DriveShareKind,
} from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const { db, device } = requireDriveDevice(request);
    const origin = publicSiteOrigin(request);
    return NextResponse.json({
      shares: listDriveSharesForDevice(db, device).map((s) => ({ ...s, url: `${origin}/drive/${s.slug}` })),
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { db, device } = requireDriveDevice(request);
    const body = await readJsonBody(request);
    const share = createDriveShare(db, device, {
      title: String(body.title ?? ""),
      clientName: typeof body.clientName === "string" ? body.clientName : null,
      kind: body.kind as DriveShareKind,
      pin: (body.pin as string | null | undefined) ?? null,
      maxSelect: Number(body.maxSelect ?? 0),
      allowOriginal: body.allowOriginal === true,
      expiresInDays: (body.expiresInDays as number | null | undefined) ?? null,
      files: body.files as DriveFileInput[],
    });
    return NextResponse.json({
      id: share.id,
      slug: share.slug,
      url: `${publicSiteOrigin(request)}/drive/${share.slug}`,
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
