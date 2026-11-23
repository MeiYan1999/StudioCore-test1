import { driveErrorResponse, readJsonBody } from "@/lib/drive/http";
import { parseDriveFaceDescriptor } from "@/lib/drive/faces";
import { driveStateResponse, resolveDrivePublicAccess } from "@/lib/drive/public-access";
import { assertSameOrigin } from "@/lib/http/security";
import { matchDriveFaces } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const { db, state, share } = await resolveDrivePublicAccess(slug);
    if (state !== "ok" || !share) return driveStateResponse(state);
    if (!share.faceSearch) {
      return Response.json({ error: "Tìm ảnh bằng khuôn mặt chưa được bật." }, { status: 404 });
    }
    const body = await readJsonBody(request, 8 * 1024);
    return Response.json(matchDriveFaces(db, share.id, parseDriveFaceDescriptor(body.descriptor)));
  } catch (error) {
    return driveErrorResponse(error);
  }
}
