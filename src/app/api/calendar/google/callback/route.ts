import { NextResponse, type NextRequest } from "next/server";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import {
  canManageGoogleCalendar,
  completeGoogleCalendarOAuth,
  getGoogleCalendarConfig,
  GOOGLE_CALENDAR_STATE_COOKIE,
  readGoogleCalendarOAuthState,
} from "@/lib/services/google-calendar-service";

export async function GET(request: NextRequest) {
  const config = getGoogleCalendarConfig(request.headers);
  const origin = config?.redirectUri.origin ?? getEnv().NEXT_PUBLIC_SITE_URL;
  const actor = await getActorContext();
  if (!actor) return NextResponse.redirect(new URL("/login", origin));
  if (!canManageGoogleCalendar(actor)) return NextResponse.redirect(new URL("/manage/calendar", origin));
  const query = request.nextUrl.searchParams;
  const state = readGoogleCalendarOAuthState(
    actor, request.cookies.get(GOOGLE_CALENDAR_STATE_COOKIE)?.value ?? null, query.get("state"),
  );
  let status = "invalid";
  if (config && state) {
    status = "error";
    const code = query.get("code");
    if (code && !query.has("error")) {
      try {
        await completeGoogleCalendarOAuth(getDb(), config, state, code);
        status = "connected";
      } catch {
        // Do not disclose OAuth credentials or upstream diagnostics in the redirect.
      }
    }
  }
  const response = NextResponse.redirect(new URL(`/manage/calendar?googleCalendar=${status}`, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (state && config) {
    response.cookies.set(GOOGLE_CALENDAR_STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: config.redirectUri.protocol === "https:",
      path: config.redirectUri.pathname,
      maxAge: 0,
    });
  }
  return response;
}
