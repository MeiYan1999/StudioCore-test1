import { NextResponse } from "next/server";
import {
  buildGoogleLoginUrl,
  createGoogleLoginStateToken,
  getGoogleLoginConfig,
  getGoogleLoginRedirectUri,
  resolvePublicUrl,
} from "@/lib/auth/google-auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const config = getGoogleLoginConfig();
  if (!config.configured) {
    return NextResponse.redirect(
      resolvePublicUrl("/login?error=google_not_configured", request),
    );
  }

  const redirectUri = getGoogleLoginRedirectUri(request);
  const state = await createGoogleLoginStateToken();
  const authUrl = buildGoogleLoginUrl(redirectUri, state);

  return NextResponse.redirect(authUrl);
}
