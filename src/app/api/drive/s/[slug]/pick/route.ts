import { driveErrorResponse, readJsonBody } from "@/lib/drive/http";
import { driveStateResponse, resolveDrivePublicAccess } from "@/lib/drive/public-access";
import { assertSameOrigin } from "@/lib/http/security";
import { setDrivePick } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const { db, state, share } = await resolveDrivePublicAccess(slug);
    if (state !== "ok" || !share) return driveStateResponse(state);
    const body = await readJsonBody(request, 80_000);
    const result = setDrivePick(db, share, String(body.fileId ?? ""), {
      picked: typeof body.picked === "boolean" ? body.picked : undefined,
      note: body.note === undefined ? undefined : body.note === null ? null : String(body.note),
      markup: body.markup,
    });
    return Response.json(result);
  } catch (error) {
    return driveErrorResponse(error);
  }
}
