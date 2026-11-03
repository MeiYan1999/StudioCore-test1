import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import {
  exchangeGoogleCode,
  saveGoogleConnection,
  verifyGoogleStateToken,
} from "@/lib/services/drive-connection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectWith(
  request: Request,
  status: string,
  message?: string,
): Response {
  const url = new URL("/manage/settings/integrations", request.url);
  url.searchParams.set("google", status);
  if (message) {
    url.searchParams.set("message", message.slice(0, 200));
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!hasPermission(actor.permissions, "integrations.manage")) {
    return redirectWith(request, "forbidden");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return redirectWith(request, "error", "Google không trả code/state.");
  }
  const statePayload = await verifyGoogleStateToken(state);
  if (
    !statePayload ||
    statePayload.tenantId !== actor.tenantId ||
    statePayload.staffId !== actor.staffId
  ) {
    return redirectWith(request, "error", "State OAuth không hợp lệ hoặc đã hết hạn.");
  }

  try {
    const result = await exchangeGoogleCode(code);
    saveGoogleConnection(getDb(), actor, result.refreshToken);
    return redirectWith(request, "connected");
  } catch (error) {
    return redirectWith(
      request,
      "error",
      error instanceof Error ? error.message : "Không kết nối được Google Drive.",
    );
  }
}
