import { beforeEach, expect, it, vi } from "vitest";
import { jwtVerify } from "jose";
import type { DriveShare } from "@/lib/services/drive-service";
import { driveCookieName, grantDriveAccess, hasDriveAccess } from "@/lib/share/drive-access";

const jar = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => (jar.values.has(key) ? { value: jar.values.get(key) } : undefined),
    set: jar.set,
  }),
}));
const share = {
  id: "share-1",
  tokenHash: "hash-1",
  pinHash: "protected",
  expiresAt: null,
} as DriveShare;

beforeEach(() => {
  jar.values.clear();
  jar.set.mockReset();
});

it("requires a signed cookie bound to the share and token", async () => {
  expect(await hasDriveAccess(share)).toBe(false);
  expect(await hasDriveAccess({ ...share, pinHash: null })).toBe(true);
  await grantDriveAccess(share);
  const [name, value, options] = jar.set.mock.calls[0];
  expect(name).toBe("studiocore_drive_share-1");
  expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 7200, path: "/drive" });
  jar.values.set(name, value);
  expect(await hasDriveAccess(share)).toBe(true);
  expect(await hasDriveAccess({ ...share, tokenHash: "rotated" })).toBe(false);
  jar.values.set(driveCookieName("other"), value);
  expect(await hasDriveAccess({ ...share, id: "other" })).toBe(false);
  jar.values.set(name, value + "tampered");
  expect(await hasDriveAccess(share)).toBe(false);
});

it("caps signed cookie expiry at the share expiry and never grants expired shares", async () => {
  await grantDriveAccess({ ...share, expiresAt: new Date(Date.now() + 60000) });
  const [, value, options] = jar.set.mock.calls[0];
  expect(options.maxAge).toBeGreaterThan(0);
  expect(options.maxAge).toBeLessThanOrEqual(60);
  const { payload } = await jwtVerify(value, new TextEncoder().encode(process.env.AUTH_SECRET), {
    audience: "studiocore-drive",
  });
  expect(payload.exp! - payload.iat!).toBe(options.maxAge);
  jar.set.mockClear();
  await grantDriveAccess({ ...share, expiresAt: new Date(0) });
  expect(jar.set).not.toHaveBeenCalled();
});
