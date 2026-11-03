import { NextResponse } from "next/server";
import { getActorContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import {
  buildGoogleAuthUrl,
  createGoogleStateToken,
  getGoogleOAuthConfig,
} from "@/lib/services/drive-connection-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!hasPermission(actor.permissions, "integrations.manage")) {
    return NextResponse.redirect(
      new URL("/manage/settings/integrations?google=forbidden", request.url),
    );
  }
  if (!getGoogleOAuthConfig().configured) {
    return NextResponse.redirect(
      new URL("/manage/settings/integrations?google=unconfigured", request.url),
    );
  }
  const state = await createGoogleStateToken(actor.tenantId, actor.staffId);
  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
