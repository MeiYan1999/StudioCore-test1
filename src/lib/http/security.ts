import { AuthorizationError } from "../errors";

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (origin !== requestOrigin && origin !== configuredOrigin) {
    throw new AuthorizationError("Yêu cầu không xuất phát từ ứng dụng hợp lệ.");
  }
}
