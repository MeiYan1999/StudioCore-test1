"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  canManageGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarConfig,
  GOOGLE_CALENDAR_STATE_COOKIE,
  GOOGLE_CALENDAR_STATE_TTL,
  startGoogleCalendarOAuth,
} from "@/lib/services/google-calendar-service";

export async function connectGoogleCalendarAction(form: FormData) {
  const actor = await getActorContext();
  if (!canManageGoogleCalendar(actor)) redirect("/manage/calendar");
  const config = getGoogleCalendarConfig();
  if (!config) redirect("/manage/calendar?googleCalendar=unconfigured");
  const flow = startGoogleCalendarOAuth(config, actor, {
    branchId: form.get("branchId"), calendarId: form.get("calendarId"),
  });
  if (!flow) redirect("/manage/calendar?googleCalendar=invalid");
  const store = await cookies();
  store.set(GOOGLE_CALENDAR_STATE_COOKIE, flow.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.redirectUri.protocol === "https:",
    path: config.redirectUri.pathname,
    maxAge: GOOGLE_CALENDAR_STATE_TTL,
  });
  redirect(flow.url.toString());
}

export async function disconnectGoogleCalendarAction() {
  const actor = await getActorContext();
  if (!canManageGoogleCalendar(actor)) redirect("/manage/calendar");
  disconnectGoogleCalendar(getDb(), actor.tenantId);
  const config = getGoogleCalendarConfig();
  if (config) {
    const store = await cookies();
    store.set(GOOGLE_CALENDAR_STATE_COOKIE, "", {
      path: config.redirectUri.pathname,
      maxAge: 0,
    });
  }
  redirect("/manage/calendar?googleCalendar=disconnected");
}
