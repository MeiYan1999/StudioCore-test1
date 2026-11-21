import { NextResponse } from "next/server";

// request.url behind a reverse proxy points at the internal host (e.g. localhost:10000),
// so redirect with a relative Location that the browser resolves against the public URL.
export function redirectToPath(path: string, status = 307): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("redirectToPath chỉ nhận đường dẫn nội bộ bắt đầu bằng '/'.");
  }
  return new NextResponse(null, { status, headers: { Location: path } });
}
