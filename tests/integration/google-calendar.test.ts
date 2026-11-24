import { afterEach, describe, expect, it, vi } from "vitest";
import { permissionsForRole } from "@/lib/auth/permissions";
import type { ActorContext } from "@/lib/auth/types";
import { appointments, branches, tenants } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/security/secret-crypto";
import {
  canManageGoogleCalendar,
  canViewGoogleCalendar,
  completeGoogleCalendarOAuth,
  disconnectGoogleCalendar,
  getGoogleCalendarConnection,
  getGoogleCalendarSnapshot,
  readGoogleCalendarOAuthState,
  startGoogleCalendarOAuth,
} from "@/lib/services/google-calendar-service";
import { createTestDb } from "../helpers/test-db";

const config = {
  clientId: "dummy-client",
  clientSecret: "dummy-client-secret",
  redirectUri: new URL("https://www.studiocore.io.vn/api/calendar/google/callback"),
};
const calendarId = "studio@group.calendar.google.com";
const scope = "https://www.googleapis.com/auth/calendar.events.owned.readonly";
const owner: ActorContext = {
  sessionId: "test-session",
  tenantId: "test-tenant",
  tenantSlug: "test",
  tenantName: "Test studio",
  tenantPlan: "pro",
  staffId: "test-owner",
  staffName: "Test owner",
  staffCode: "SC-TEST",
  staffEmail: null,
  role: "owner",
  permissions: [...permissionsForRole("owner")],
  branches: [{ id: "branch-a", name: "A" }, { id: "branch-b", name: "B" }],
  activeBranchId: null,
  readOnly: false,
  canChangePassword: true,
};

const input = { branchId: "branch-a", calendarId };
const token = { access_token: "mock-access", expires_in: 3600 };

function mockConnection() {
  return { ...input, tenantId: owner.tenantId, refreshTokenEncrypted: encryptSecret("mock-refresh") };
}

function timed(id: string, summary: string) {
  return {
    id,
    summary,
    start: { dateTime: "2026-11-24T17:30:00Z" },
    end: { dateTime: "2026-11-24T18:15:00Z" },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Google Calendar inbound", () => {
  it("authorizes management and views independently, with tenant and branch checks", () => {
    const connection = mockConnection();
    expect(canManageGoogleCalendar(owner)).toBe(true);
    expect(canManageGoogleCalendar({ ...owner, readOnly: true })).toBe(false);
    expect(canManageGoogleCalendar({ ...owner, role: "manager" })).toBe(false);
    expect(canViewGoogleCalendar(owner, connection, null)).toBe(true);
    expect(canViewGoogleCalendar(owner, connection, "branch-b")).toBe(false);
    expect(canViewGoogleCalendar({ ...owner, activeBranchId: "branch-b" }, connection, null)).toBe(false);
    expect(canViewGoogleCalendar({ ...owner, activeBranchId: "branch-b" }, connection, "branch-a")).toBe(true);
    expect(canViewGoogleCalendar({ ...owner, role: "manager", branches: [owner.branches[0]!] }, connection, null)).toBe(true);
    expect(canViewGoogleCalendar({ ...owner, tenantId: "another-tenant" }, connection, null)).toBe(false);
    expect(canViewGoogleCalendar({ ...owner, permissions: [] }, connection, null)).toBe(false);
  });

  it("uses read-only OAuth scope and binds the expiring state to the same session and branch", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const flow = startGoogleCalendarOAuth(config, owner, input)!;
    const state = flow.url.searchParams.get("state");
    expect(flow.url.origin).toBe("https://accounts.google.com");
    expect(flow.url.searchParams.get("scope")).toBe(scope);
    expect(flow.url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(flow.url.toString()).not.toContain(calendarId);
    expect(readGoogleCalendarOAuthState(owner, flow.cookieValue, state)).toMatchObject(input);
    expect(readGoogleCalendarOAuthState({ ...owner, sessionId: "other" }, flow.cookieValue, state)).toBeNull();
    expect(readGoogleCalendarOAuthState({ ...owner, branches: [] }, flow.cookieValue, state)).toBeNull();
    expect(readGoogleCalendarOAuthState(owner, flow.cookieValue, "a".repeat(43))).toBeNull();
    expect(readGoogleCalendarOAuthState(owner, encryptSecret("not JSON"), state)).toBeNull();
    expect(startGoogleCalendarOAuth(config, owner, { ...input, branchId: "not-ours" })).toBeNull();
    vi.setSystemTime(Date.now() + 601_000);
    expect(readGoogleCalendarOAuthState(owner, flow.cookieValue, state)).toBeNull();
  });

  it("stores only the verified owner connection, with encrypted credentials, and does not change appointments", async () => {
    const db = createTestDb();
    const tenant = db.select().from(tenants).get()!;
    const branch = db.select().from(branches).all().find((item) => item.tenantId === tenant.id)!;
    const actor = { ...owner, tenantId: tenant.id, branches: [branch] };
    const flow = startGoogleCalendarOAuth(config, actor, { calendarId, branchId: branch.id })!;
    const state = readGoogleCalendarOAuthState(actor, flow.cookieValue, flow.url.searchParams.get("state"))!;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ ...token, refresh_token: "mock-refresh", scope }))
      .mockResolvedValueOnce(Response.json({ accessRole: "reader" }))
      .mockResolvedValueOnce(Response.json({ ...token, refresh_token: "mock-refresh", scope }))
      .mockResolvedValueOnce(Response.json({ accessRole: "owner" }));
    vi.stubGlobal("fetch", fetchMock);
    const initialAppointments = db.select().from(appointments).all();
    await expect(completeGoogleCalendarOAuth(db, config, state, "code")).rejects.toThrow();
    expect(getGoogleCalendarConnection(db, tenant.id)).toBeUndefined();
    await completeGoogleCalendarOAuth(db, config, state, "code");
    const saved = getGoogleCalendarConnection(db, tenant.id)!;
    expect(saved).toMatchObject({ calendarId, branchId: branch.id });
    expect(saved.refreshTokenEncrypted).not.toContain("mock-refresh");
    expect(fetchMock.mock.calls[0]?.[1].body.get("code_verifier")).toBe(state.verifier);
    expect(getGoogleCalendarConnection(db, "another-tenant")).toBeUndefined();
    disconnectGoogleCalendar(db, tenant.id);
    expect(getGoogleCalendarConnection(db, tenant.id)).toBeUndefined();
    expect(db.select().from(appointments).all()).toEqual(initialAppointments);
  });

  it("reads all pages, groups multi-day events, and masks private titles", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(token))
      .mockResolvedValueOnce(Response.json({
        accessRole: "owner", nextPageToken: "second", items: [
          timed("evening", "Chụp ngoài trời"),
          { id: "all-day", summary: "Sự kiện 2 ngày", start: { date: "2026-11-24" }, end: { date: "2026-11-26" } },
          { ...timed("cancelled", "Đã hủy"), status: "cancelled" },
        ],
      }))
      .mockResolvedValueOnce(Response.json({
        accessRole: "owner", items: [
          { ...timed("private", "Tiêu đề riêng tư"), visibility: "private" },
          timed("evening", "Chụp ngoài trời"),
          { ...timed("midnight", "Qua ngày"), start: { dateTime: "2026-11-24T16:30:00Z" } },
        ],
      }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getGoogleCalendarSnapshot(config, mockConnection(), "2026-11-24", "2026-11-27");
    expect(result).toMatchObject({ status: "ok", count: 4 });
    expect(result.days.get("2026-11-24")).toEqual([
      expect.objectContaining({ id: "all-day", timeLabel: "Cả ngày" }),
      expect.objectContaining({ id: "midnight", timeLabel: "23:30–24:00" }),
    ]);
    expect(result.days.get("2026-11-25")).toEqual([
      expect.objectContaining({ id: "evening", timeLabel: "00:30–01:15" }),
      expect.objectContaining({ id: "all-day", timeLabel: "Cả ngày" }),
      expect.objectContaining({ id: "private", title: "Bận (sự kiện riêng tư)" }),
      expect.objectContaining({ id: "midnight", timeLabel: "00:00–01:15" }),
    ]);
    expect(result.days.has("2026-11-26")).toBe(false);
    const lastUrl = fetchMock.mock.calls[2]?.[0] as URL;
    expect(lastUrl.searchParams.get("pageToken")).toBe("second");
    expect(lastUrl.searchParams.get("singleEvents")).toBe("true");
  });

  it("refreshes added, edited and removed events and reuses a valid Google access token", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const connection = mockConnection();
    const page = (items: unknown[]) => Response.json({ accessRole: "owner", items });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(token))
      .mockResolvedValueOnce(page([timed("old", "Before")]))
      .mockResolvedValueOnce(page([timed("old", "Edited"), timed("new", "Added")]))
      .mockResolvedValueOnce(page([timed("new", "Added")]))
      .mockResolvedValueOnce(Response.json({ error: "unauthorized" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const refresh = () => getGoogleCalendarSnapshot(config, connection, "2026-11-25", "2026-11-26");
    expect(refresh()).toBe(refresh());
    expect((await refresh()).days.get("2026-11-25")?.map((e) => e.title)).toEqual(["Before"]);
    vi.setSystemTime(Date.now() + 15_000);
    expect((await refresh()).days.get("2026-11-25")?.map((e) => e.title)).toEqual(["Edited", "Added"]);
    vi.setSystemTime(Date.now() + 15_000);
    expect((await refresh()).days.get("2026-11-25")?.map((e) => e.title)).toEqual(["Added"]);
    vi.setSystemTime(Date.now() + 15_000);
    expect((await refresh()).status).toBe("reconnect");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
