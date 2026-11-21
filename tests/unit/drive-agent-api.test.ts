import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AppDb } from "@/lib/db/client";
import type { ActorContext } from "@/lib/auth/types";
import { staff, tenants } from "@/lib/db/schema";
import { createDriveDevice } from "@/lib/services/drive-service";
import { createTestDb } from "../helpers/test-db";
import { POST as heartbeat } from "@/app/api/drive/agent/heartbeat/route";
import { GET as list, POST as create } from "@/app/api/drive/agent/shares/route";
import { PATCH, DELETE } from "@/app/api/drive/agent/shares/[id]/route";
import { GET as selection } from "@/app/api/drive/agent/shares/[id]/selection/route";
import { GET as mediaSecret } from "@/app/api/drive/agent/shares/[id]/media-secret/route";
import { POST as reopen } from "@/app/api/drive/agent/shares/[id]/reopen/route";

const state = vi.hoisted(() => ({ db: null as AppDb | null }));
vi.mock("@/lib/db/client", async (original) => ({
  ...(await original<typeof import("@/lib/db/client")>()),
  getDb: () => state.db!,
}));
let key: string;
const actor: ActorContext = {
  sessionId: "s",
  tenantId: "drive-api-tenant",
  tenantName: "Studio",
  tenantSlug: "drive-api",
  tenantPlan: "pro",
  staffId: "drive-api-staff",
  staffName: "Owner",
  staffCode: "O",
  staffEmail: null,
  role: "owner",
  permissions: ["albums.view", "albums.manage"],
  branches: [],
  activeBranchId: null,
  readOnly: false,
};
function request(path: string, method = "GET", body?: unknown, bearer = key) {
  return new Request(`http://localhost:10000/api/drive/agent/${path}`, {
    method,
    headers: { authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeEach(() => {
  state.db = createTestDb();
  state.db
    .insert(tenants)
    .values({ id: actor.tenantId, name: "Studio", slug: actor.tenantSlug })
    .run();
  state.db
    .insert(staff)
    .values({
      id: actor.staffId,
      tenantId: actor.tenantId,
      code: "API",
      name: "Owner",
      role: "owner",
    })
    .run();
  key = createDriveDevice(state.db, actor).key;
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("requires bearer keys, validates JSON and returns device heartbeat identity", async () => {
  expect((await list(request("shares", "GET", undefined, "invalid"))).status).toBe(401);
  expect((await heartbeat(request("heartbeat", "POST", {}))).status).toBe(400);
  const response = await heartbeat(
    request("heartbeat", "POST", {
      name: "PC",
      os: "linux",
      appVersion: "2",
      tunnelOrigin: "https://tunnel.example",
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).device.tenantName).toBe("Studio");
  expect(await (await list(request("shares"))).json()).toEqual({ shares: [] });
  const malformed = new Request("http://localhost/api/drive/agent/heartbeat", {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: "{",
  });
  expect((await heartbeat(malformed)).status).toBe(400);
});
it("creates absolute stable URLs, restricts all share routes to the device and revokes shares", async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studio.example");
  const response = await create(
    request("shares", "POST", {
      kind: "album",
      title: "Album",
      folderName: "Photos",
      allowOriginals: true,
      maxSelect: 10,
      expiresInDays: 0,
      files: [],
    }),
  );
  expect(response.status).toBe(200);
  const { share } = await response.json();
  expect(share.url).toMatch(/^https:\/\/studio\.example\/drive\//);
  expect(share.mediaSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const context = { params: Promise.resolve({ id: share.id }) };
  expect(await (await mediaSecret(request("shares/id/media-secret"), context)).json()).toEqual({
    mediaSecret: share.mediaSecret,
  });
  expect((await (await selection(request("shares/id/selection"), context)).json()).items).toEqual(
    [],
  );
  const stranger = createDriveDevice(state.db!, actor).key;
  for (const route of [selection, mediaSecret])
    expect((await route(request("shares/id", "GET", undefined, stranger), context)).status).toBe(
      404,
    );
  expect(
    (await reopen(request("shares/id/reopen", "POST", undefined, stranger), context)).status,
  ).toBe(404);
  expect(
    (await PATCH(request("shares/id", "PATCH", { status: "paused" }, stranger), context)).status,
  ).toBe(404);
  expect((await DELETE(request("shares/id", "DELETE", undefined, stranger), context)).status).toBe(
    404,
  );
  expect((await PATCH(request("shares/id", "PATCH", { status: "revoked" }), context)).status).toBe(
    400,
  );
  expect((await PATCH(request("shares/id", "PATCH", { status: "paused" }), context)).status).toBe(
    200,
  );
  expect((await reopen(request("shares/id/reopen", "POST"), context)).status).toBe(200);
  expect((await DELETE(request("shares/id", "DELETE"), context)).status).toBe(200);
  expect((await mediaSecret(request("shares/id/media-secret"), context)).status).toBe(404);
  expect(await (await list(request("shares"))).json()).toEqual({ shares: [] });
});
