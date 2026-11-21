import { driveErrorResponse, readJsonBody } from "@/lib/drive/http";
import { driveStateResponse, resolveDrivePublicAccess } from "@/lib/drive/public-access";
import { wakeDriveDevice } from "@/lib/drive/relay";
import { assertSameOrigin } from "@/lib/http/security";
import { submitDriveSelection } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const { db, state, share } = await resolveDrivePublicAccess(slug);
    if (state !== "ok" || !share) return driveStateResponse(state);
    const body = await readJsonBody(request, 8192);
    const result = submitDriveSelection(db, share, typeof body.note === "string" ? body.note : null);
    wakeDriveDevice(share.deviceId);
    return Response.json(result);
  } catch (error) {
    return driveErrorResponse(error);
  }
}
