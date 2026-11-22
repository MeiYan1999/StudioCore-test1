import { driveErrorResponse } from "@/lib/drive/http";
import { driveStateResponse, resolveDrivePublicAccess } from "@/lib/drive/public-access";
import {
  cacheDriveThumb,
  getCachedDriveThumb,
  requestDriveFile,
  type DriveVariant,
} from "@/lib/drive/relay";
import { attachmentHeader } from "@/lib/http/download";
import { getDriveShareFile, isDriveDeviceOnline } from "@/lib/services/drive-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cache-Control": "private, max-age=600",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; fileId: string }> },
): Promise<Response> {
  try {
    const { slug, fileId } = await params;
    const { db, state, share, device } = await resolveDrivePublicAccess(slug);
    if (state !== "ok" || !share || !device) return driveStateResponse(state);
    const file = getDriveShareFile(db, share.id, fileId);
    if (!file) return new Response("Không tìm thấy tệp.", { status: 404 });

    const url = new URL(request.url);
    const requested = url.searchParams.get("v");
    const variant: DriveVariant = requested === "thumb" || requested === "original" ? requested : "preview";
    if (variant === "original" && !share.allowOriginal) {
      return new Response("Studio chưa cho phép tải tệp gốc.", { status: 403 });
    }

    if (variant === "thumb") {
      const cached = getCachedDriveThumb(share.id, file.fileKey);
      if (cached) {
        return new Response(cached.data.slice().buffer, {
          headers: { ...SAFE_HEADERS, "Content-Type": cached.type, "Content-Length": String(cached.data.byteLength) },
        });
      }
    }
    if (!isDriveDeviceOnline(device)) {
      return new Response("Máy studio đang ngoại tuyến.", { status: 503, headers: { "Retry-After": "30" } });
    }

    const result = await requestDriveFile(device.id, {
      shareId: share.id,
      fileKey: file.fileKey,
      variant,
      range: variant === "thumb" ? null : request.headers.get("range"),
    });
    if (!result.body || (result.status !== 200 && result.status !== 206)) {
      const status = result.status === 200 || result.status === 206 ? 502 : result.status;
      return new Response("Không lấy được tệp từ máy studio.", { status });
    }

    const headers = new Headers({ ...SAFE_HEADERS, "Content-Type": result.contentType, "Accept-Ranges": "bytes" });
    if (result.contentLength && /^\d+$/.test(result.contentLength)) headers.set("Content-Length", result.contentLength);
    if (result.contentRange) headers.set("Content-Range", result.contentRange);
    if (variant === "original" || url.searchParams.get("download") === "1") {
      headers.set("Content-Disposition", attachmentHeader(file.name));
    }

    if (variant === "thumb") {
      const data = new Uint8Array(await new Response(result.body).arrayBuffer());
      cacheDriveThumb(share.id, file.fileKey, result.contentType, data);
      headers.set("Content-Length", String(data.byteLength));
      return new Response(data.buffer, { status: 200, headers });
    }
    return new Response(result.body, { status: result.status, headers });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
