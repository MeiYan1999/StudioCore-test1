import { getDb } from "@/lib/db/client";
import { driveErrorResponse, readJsonBody } from "@/lib/drive/http";
import { driveStateResponse, grantDriveAccess } from "@/lib/drive/public-access";
import { assertSameOrigin } from "@/lib/http/security";
import { getDriveShareBySlug, verifyDriveSharePin } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  try {
    assertSameOrigin(request);
    const { slug } = await params;
    const db = getDb();
    const { state, share } = getDriveShareBySlug(db, slug);
    if (state !== "ok" || !share) return driveStateResponse(state);
    if (!share.pinHash) return Response.json({ ok: true });
    const body = await readJsonBody(request, 1024);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const result = verifyDriveSharePin(db, share, String(body.pin ?? ""), ip);
    if (result.locked) {
      return Response.json({ error: "Nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút." }, { status: 429 });
    }
    if (!result.ok) return Response.json({ error: "Mã PIN không đúng." }, { status: 401 });
    await grantDriveAccess(share);
    return Response.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
