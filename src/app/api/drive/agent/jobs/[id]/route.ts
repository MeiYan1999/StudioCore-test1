import { NextResponse } from "next/server";
import { driveErrorResponse, requireDriveDevice } from "@/lib/drive/http";
import { fulfillDriveJob } from "@/lib/drive/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = /^(image\/(jpeg|png|webp|gif|heic|avif)|video\/(mp4|quicktime|webm|x-matroska)|application\/octet-stream)$/;

/** Máy studio đẩy dữ liệu tệp cho một yêu cầu đang chờ; nội dung được chuyển tiếp thẳng cho khách. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await params;
    const { device } = requireDriveDevice(request);
    const status = Number(request.headers.get("x-drive-status") ?? 200);
    const rawType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const contentType = ALLOWED_TYPES.test(rawType) ? rawType : "application/octet-stream";

    if (![200, 206].includes(status) || !request.body) {
      const ok = fulfillDriveJob(device.id, id, {
        status: status === 416 ? 416 : 404,
        contentType: "text/plain; charset=utf-8",
        contentLength: null,
        contentRange: null,
        body: null,
      });
      await request.body?.cancel().catch(() => undefined);
      return NextResponse.json({ ok }, { status: ok ? 200 : 410 });
    }

    const pipe = new TransformStream<Uint8Array, Uint8Array>();
    const ok = fulfillDriveJob(device.id, id, {
      status,
      contentType,
      contentLength: request.headers.get("x-drive-length"),
      contentRange: status === 206 ? request.headers.get("x-drive-range") : null,
      body: pipe.readable,
    });
    if (!ok) {
      await request.body.cancel().catch(() => undefined);
      return NextResponse.json({ ok: false }, { status: 410 });
    }
    // Giữ yêu cầu mở cho tới khi khách nhận xong (hoặc ngắt kết nối).
    await request.body.pipeTo(pipe.writable).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
