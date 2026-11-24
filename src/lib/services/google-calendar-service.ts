import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getBranchScope, hasPermission } from "@/lib/auth/permissions";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { googleCalendarConnections } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import {
  addDaysToKey,
  formatTimeLabel,
  getVietnamDateKey,
  parseDateKey,
  VIETNAM_TIME_ZONE,
} from "@/lib/scheduling/time";
import { decryptSecret, encryptSecret } from "@/lib/security/secret-crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned.readonly";
export const GOOGLE_CALENDAR_STATE_COOKIE = "studiocore_google_calendar";
export const GOOGLE_CALENDAR_STATE_TTL = 600;
const CALLBACK_PATH = "/api/calendar/google/callback";

export function getGoogleCalendarConfig() {
  const env = getEnv();
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  return clientId && clientSecret
    ? { clientId, clientSecret, redirectUri: new URL(CALLBACK_PATH, env.NEXT_PUBLIC_SITE_URL) }
    : null;
}

type Config = NonNullable<ReturnType<typeof getGoogleCalendarConfig>>;
type Connection = typeof googleCalendarConnections.$inferSelect;

export function canManageGoogleCalendar(actor: ActorContext | null): actor is ActorContext {
  return !!actor && actor.role === "owner" && !actor.readOnly &&
    hasPermission(actor.permissions, "schedule.manage") && hasPermission(actor.permissions, "schedule.view");
}

export function getGoogleCalendarConnection(db: AppDb, tenantId: string) {
  return db.select().from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.tenantId, tenantId)).get();
}

export function canViewGoogleCalendar(
  actor: ActorContext,
  connection: Pick<Connection, "tenantId" | "branchId">,
  filterBranchId: string | null,
) {
  if (actor.tenantId !== connection.tenantId || !hasPermission(actor.permissions, "schedule.view") ||
    !actor.branches.some(({ id }) => id === connection.branchId)) return false;
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return false;
  if (filterBranchId) return filterBranchId === connection.branchId;
  return scope.mode === "all" || (scope.mode === "branch" && scope.branchId === connection.branchId);
}

const calendarIdSchema = z.string().trim().max(320)
  .regex(/^[a-zA-Z0-9._+%-]+@[a-zA-Z0-9.-]+$/)
  .refine((value) => !value.toLowerCase().endsWith("@import.calendar.google.com"));

const oauthStateSchema = z.object({
  nonce: z.string().length(43),
  verifier: z.string().length(43),
  sessionId: z.string().min(1),
  tenantId: z.string().min(1),
  branchId: z.string().min(1),
  calendarId: calendarIdSchema,
  expiresAt: z.number(),
});

export function startGoogleCalendarOAuth(config: Config, actor: ActorContext, input: {
  calendarId: unknown; branchId: unknown;
}) {
  const calendarId = calendarIdSchema.safeParse(input.calendarId);
  const branch = actor.branches.find(({ id }) => id === input.branchId);
  if (!canManageGoogleCalendar(actor) || !branch || !calendarId.success) return null;
  const nonce = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const cookieValue = encryptSecret(JSON.stringify({
    nonce, verifier, calendarId: calendarId.data, branchId: branch.id,
    sessionId: actor.sessionId, tenantId: actor.tenantId,
    expiresAt: Date.now() + GOOGLE_CALENDAR_STATE_TTL * 1000,
  }));
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri.toString(),
    response_type: "code",
    scope: EVENTS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { url, cookieValue };
}

export function readGoogleCalendarOAuthState(actor: ActorContext, cookie: string | null, nonce: string | null) {
  if (!canManageGoogleCalendar(actor) || !nonce || nonce.length !== 43) return null;
  const payload = decryptSecret(cookie);
  if (!payload) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  const result = oauthStateSchema.safeParse(parsed);
  if (!result.success) return null;
  const state = result.data;
  if (state.sessionId !== actor.sessionId || state.tenantId !== actor.tenantId ||
    state.expiresAt <= Date.now() || !actor.branches.some(({ id }) => id === state.branchId)) return null;
  const actual = Buffer.from(nonce);
  const expected = Buffer.from(state.nonce);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? state : null;
}

class GoogleCalendarError extends Error {
  constructor(readonly reconnect: boolean) {
    super("Không thể đọc Google Calendar.");
  }
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  expires_in: z.number().positive(),
});

async function fetchToken(config: Config, grant: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...grant }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(data);
    throw new GoogleCalendarError(error.success && ["invalid_grant", "invalid_client"].includes(error.data.error));
  }
  return tokenSchema.parse(data);
}

function eventsUrl(calendarId: string) {
  return new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
}

async function fetchEventsPage(url: URL, accessToken: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const reconnectStatuses = [401, 404, 410];
    if (response.status === 403) {
      const error = z.object({ error: z.object({ errors: z.array(z.object({ reason: z.string() })) }) })
        .safeParse(await response.json());
      throw new GoogleCalendarError(error.success &&
        error.data.error.errors.some(({ reason }) => reason === "insufficientPermissions" || reason === "forbidden"));
    }
    throw new GoogleCalendarError(reconnectStatuses.includes(response.status));
  }
  return response.json() as Promise<unknown>;
}

export async function completeGoogleCalendarOAuth(
  db: AppDb, config: Config, state: z.infer<typeof oauthStateSchema>, code: string,
) {
  const token = await fetchToken(config, {
    grant_type: "authorization_code", code, code_verifier: state.verifier,
    redirect_uri: config.redirectUri.toString(),
  });
  if (!token.refresh_token || !token.scope?.split(" ").includes(EVENTS_SCOPE)) {
    throw new GoogleCalendarError(true);
  }
  const url = eventsUrl(state.calendarId);
  url.search = new URLSearchParams({ maxResults: "1", fields: "accessRole" }).toString();
  z.object({ accessRole: z.literal("owner") }).parse(
    await fetchEventsPage(url, token.access_token, AbortSignal.timeout(5000)),
  );

  const values = {
    tenantId: state.tenantId,
    branchId: state.branchId,
    calendarId: state.calendarId,
    refreshTokenEncrypted: encryptSecret(token.refresh_token),
  };
  db.insert(googleCalendarConnections).values(values).onConflictDoUpdate({
    target: googleCalendarConnections.tenantId,
    set: values,
  }).run();
}

export function disconnectGoogleCalendar(db: AppDb, tenantId: string) {
  const deleted = db.delete(googleCalendarConnections)
    .where(eq(googleCalendarConnections.tenantId, tenantId))
    .returning({ credential: googleCalendarConnections.refreshTokenEncrypted }).get();
  if (deleted) {
    accessTokens.delete(deleted.credential);
    for (const key of snapshots.keys()) {
      if (key.startsWith(`${deleted.credential}:`)) snapshots.delete(key);
    }
  }
}

const dateKey = z.iso.date();
const eventBoundary = z.object({ date: dateKey.optional(), dateTime: z.iso.datetime({ offset: true }).optional() });
const rawEventSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  visibility: z.string().optional(),
  summary: z.string().optional(),
  start: eventBoundary.optional(),
  end: eventBoundary.optional(),
});
const eventListSchema = z.object({
  accessRole: z.literal("owner"),
  items: z.array(z.unknown()).optional(),
  nextPageToken: z.string().min(1).optional(),
});

export type GoogleCalendarEvent = {
  kind: "google";
  id: string;
  title: string;
  startAt: Date;
  timeLabel: string;
};

function placeEvents(raw: Iterable<unknown>, startKey: string, endKey: string) {
  const days = new Map<string, GoogleCalendarEvent[]>();
  const seen = new Set<string>();
  let count = 0;
  for (const item of raw) {
    const parsed = rawEventSchema.safeParse(item);
    if (!parsed.success) continue;
    const { id, status, summary, visibility, start, end } = parsed.data;
    if (status === "cancelled" || seen.has(id)) continue;
    const startDate = start?.date;
    const endDate = end?.date;
    const allDay = startDate !== undefined && endDate !== undefined;
    const first = allDay ? parseDateKey(startDate) : new Date(start?.dateTime ?? NaN);
    const last = allDay ? parseDateKey(endDate) : new Date(end?.dateTime ?? NaN);
    if (!(last > first)) continue;

    const firstKey = getVietnamDateKey(first);
    const lastKey = getVietnamDateKey(new Date(last.getTime() - 1));
    const title = visibility === "private" || visibility === "confidential"
      ? "Bận (sự kiện riêng tư)"
      : summary?.trim().slice(0, 250) || "Sự kiện không có tiêu đề";
    let included = false;
    for (let key = firstKey < startKey ? startKey : firstKey; key <= lastKey && key < endKey; key = addDaysToKey(key, 1)) {
      const dayStart = parseDateKey(key);
      const dayEnd = parseDateKey(addDaysToKey(key, 1));
      const day = days.get(key) ?? [];
      day.push({
        kind: "google", id, title,
        startAt: first < dayStart ? dayStart : first,
        timeLabel: allDay ? "Cả ngày" :
          `${first < dayStart ? "00:00" : formatTimeLabel(first)}–${last >= dayEnd ? "24:00" : formatTimeLabel(last)}`,
      });
      days.set(key, day);
      included = true;
    }
    if (included) {
      seen.add(id);
      count++;
    }
  }
  return { days, count };
}

function trimCache<K, V>(map: Map<K, V>, limit: number) {
  if (map.size > limit) map.delete(map.keys().next().value!);
}

type AccessToken = { value: string; expiresAt: number };
const accessTokens = new Map<string, Promise<AccessToken>>();

async function getAccessToken(config: Config, credential: string) {
  const pending = accessTokens.get(credential);
  if (pending) {
    const cached = await pending;
    if (cached.expiresAt > Date.now() + 30_000) return cached.value;
    if (accessTokens.get(credential) !== pending) return getAccessToken(config, credential);
  }
  const token = (async () => {
    const refreshToken = decryptSecret(credential);
    if (!refreshToken) throw new GoogleCalendarError(true);
    const result = await fetchToken(config, { grant_type: "refresh_token", refresh_token: refreshToken });
    return { value: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
  })();
  accessTokens.set(credential, token);
  trimCache(accessTokens, 128);
  try {
    return (await token).value;
  } catch (error) {
    if (accessTokens.get(credential) === token) accessTokens.delete(credential);
    throw error;
  }
}

type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;
const snapshots = new Map<string, { expiresAt: number; result: Promise<Snapshot> }>();

async function loadSnapshot(config: Config, connection: Connection, startKey: string, endKey: string) {
  try {
    const url = eventsUrl(connection.calendarId);
    url.search = new URLSearchParams({
      timeMin: parseDateKey(addDaysToKey(startKey, -1)).toISOString(),
      timeMax: parseDateKey(addDaysToKey(endKey, 1)).toISOString(),
      singleEvents: "true",
      showDeleted: "false",
      timeZone: VIETNAM_TIME_ZONE,
      maxResults: "250",
      fields: "accessRole,nextPageToken,items(id,status,visibility,summary,start(date,dateTime),end(date,dateTime))",
    }).toString();
    const accessToken = await getAccessToken(config, connection.refreshTokenEncrypted);
    const signal = AbortSignal.timeout(6000);
    const items: unknown[] = [];
    const tokens = new Set<string>();
    while (true) {
      const page = eventListSchema.parse(await fetchEventsPage(url, accessToken, signal));
      items.push(...(page.items ?? []));
      if (!page.nextPageToken) break;
      if (items.length >= 5000 || tokens.size >= 20 || tokens.has(page.nextPageToken)) {
        throw new GoogleCalendarError(false);
      }
      tokens.add(page.nextPageToken);
      url.searchParams.set("pageToken", page.nextPageToken);
    }
    return { status: "ok" as const, ...placeEvents(items, startKey, endKey) };
  } catch (error) {
    const reconnect = error instanceof GoogleCalendarError && error.reconnect;
    if (reconnect) accessTokens.delete(connection.refreshTokenEncrypted);
    return { status: reconnect ? "reconnect" as const : "unavailable" as const,
      days: new Map<string, GoogleCalendarEvent[]>(), count: 0 };
  }
}

export function getGoogleCalendarSnapshot(config: Config, connection: Connection, startKey: string, endKey: string) {
  const key = `${connection.refreshTokenEncrypted}:${startKey}:${endKey}`;
  const cached = snapshots.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const result = loadSnapshot(config, connection, startKey, endKey);
  snapshots.set(key, { expiresAt: Date.now() + 12_000, result });
  trimCache(snapshots, 128);
  return result;
}
