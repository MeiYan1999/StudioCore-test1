import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import {
  activityLogs,
  driveDevices,
  driveShareFiles,
  driveShares,
  staff,
  tenants,
} from "@/lib/db/schema";
import * as drive from "@/lib/services/drive-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
const actor: ActorContext = {
  sessionId: "drive-session",
  tenantId: "drive-tenant",
  tenantName: "Drive Test",
  tenantSlug: "drive-test",
  tenantPlan: "pro",
  staffId: "drive-staff",
  staffName: "Owner",
  staffCode: "DR1",
  staffEmail: null,
  role: "owner",
  permissions: ["albums.view", "albums.manage"],
  branches: [],
  activeBranchId: null,
  readOnly: false,
};
const other: ActorContext = {
  ...actor,
  tenantId: "other-drive-tenant",
  staffId: "other-drive-staff",
};
const files: drive.DriveShareInput["files"] = [
  { fileKey: "image_01", name: "one.jpg", relPath: "group/one.jpg", kind: "image", sizeBytes: 20 },
  { fileKey: "image_02", name: "two.NEF", relPath: "two.NEF", kind: "raw", sizeBytes: 30 },
  { fileKey: "video_01", name: "clip.mp4", relPath: "clip.mp4", kind: "video", sizeBytes: 40 },
];
const input: drive.DriveShareInput = {
  kind: "album",
  title: "Test album",
  folderName: "Pictures",
  allowOriginals: true,
  maxSelect: 1,
  expiresInDays: 0,
  files,
};
function setup(data = input) {
  const { device, key } = drive.createDriveDevice(db, actor);
  const share = drive.createDriveShare(db, device.id, data);
  const token = share.url.split("/").pop()!;
  const storedFiles = db
    .select()
    .from(driveShareFiles)
    .where(eq(driveShareFiles.shareId, share.id))
    .all();
  return { device, key, share, token, storedFiles };
}
beforeEach(() => {
  db = createTestDb();
  for (const a of [actor, other]) {
    db.insert(tenants).values({ id: a.tenantId, name: a.tenantName, slug: a.tenantId }).run();
    db.insert(staff)
      .values({
        id: a.staffId,
        tenantId: a.tenantId,
        name: a.staffName,
        code: a.staffId,
        role: "owner",
      })
      .run();
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Drive database service", () => {
  it("exposes gallery media only when online and PIN access is granted", () => {
    const { device, share, token } = setup({ ...input, pin: "123456" });
    expect(drive.getDriveGallery(db, "missing")).toBeNull();
    const offline = drive.getDriveGallery(db, token, true)!;
    expect(offline.online).toBe(false);
    expect(offline.files[0].preview).toBeNull();
    expect(JSON.stringify(offline)).not.toContain(share.mediaSecret);
    drive.heartbeatDriveDevice(db, device.id, {
      name: "PC",
      os: "linux",
      appVersion: "2",
      tunnelOrigin: "https://media.example",
    });
    const locked = drive.getDriveGallery(db, token)!;
    expect(locked.pinRequired).toBe(true);
    expect(locked.files).toEqual([]);
    expect(locked.zip).toBeNull();
    expect(JSON.stringify(locked)).not.toContain(share.mediaSecret);
    const gallery = drive.getDriveGallery(db, token, true)!;
    expect(gallery.files[0].preview).toBe(
      `https://media.example/m/${share.id}/${share.mediaSecret}/image_01/preview`,
    );
    expect(gallery.zip).toBe(`https://media.example/z/${share.id}/${share.mediaSecret}`);
    expect(gallery).not.toHaveProperty("mediaSecret");
    drive.recordDriveView(db, token);
    expect(drive.getDriveShareByToken(db, token)?.viewCount).toBe(1);
    drive.updateDriveShareStatus(db, actor, share.id, "paused");
    expect(drive.getDriveGallery(db, token, true)?.files).toEqual([]);
    drive.updateDriveShareStatus(db, actor, share.id, "active");
    db.update(driveShares)
      .set({ expiresAt: new Date(0) })
      .where(eq(driveShares.id, share.id))
      .run();
    expect(drive.getDriveGallery(db, token, true)?.zip).toBeNull();
    drive.revokeDriveShare(db, actor, share.id);
    expect(drive.getDriveGallery(db, token, true)).toBeNull();
  });
  it("returns an empty gallery and omits downloads when disabled", () => {
    const { token } = setup({ ...input, files: [], allowOriginals: false });
    expect(drive.getDriveGallery(db, token)?.files).toEqual([]);
    expect(drive.getDriveGallery(db, token)?.zip).toBeNull();
  });
  it("creates random keys, only stores hashes and rejects invalid/revoked keys", () => {
    const first = drive.createDriveDevice(db, actor);
    const second = drive.createDriveDevice(db, actor);
    expect(first.key).toMatch(/^scd_[A-Za-z0-9_-]{43}$/);
    expect(first.key).not.toBe(second.key);
    expect(first.device).not.toHaveProperty("keyHash");
    expect(drive.authenticateDriveDevice(db, first.key)?.id).toBe(first.device.id);
    expect(drive.authenticateDriveDevice(db, first.key + "x")).toBeNull();
    expect(drive.authenticateDriveDevice(db, "")).toBeNull();
    expect(db.select().from(driveDevices).get()!.keyHash).not.toContain(first.key);
    drive.revokeDriveDevice(db, actor, first.device.id);
    expect(drive.authenticateDriveDevice(db, first.key)).toBeNull();
    expect(() =>
      drive.heartbeatDriveDevice(db, first.device.id, {
        name: "PC",
        os: "windows",
        appVersion: "1",
        tunnelOrigin: null,
      }),
    ).toThrow();
  });
  it("persists files, encrypted secrets and recoverable tokens; supports empty shares", () => {
    const { device, share, token } = setup();
    const stored = drive.getDriveShareByToken(db, token)!;
    expect(stored.fileCount).toBe(3);
    expect(stored.totalBytes).toBe(90);
    expect(stored.tokenEncrypted).not.toContain(token);
    expect(stored.mediaSecret).not.toBe(share.mediaSecret);
    expect(drive.getDriveMediaSecret(db, device.id, share.id)).toBe(share.mediaSecret);
    expect(drive.getDriveShareByToken(db, "missing")).toBeNull();
    expect(drive.getDriveSelection(db, actor, share.id).items).toEqual([]);
    expect(drive.createDriveShare(db, device.id, { ...input, files: [] }).fileCount).toBe(0);
    expect(drive.listDriveSharesForDevice(db, device.id)).toHaveLength(2);
    expect(drive.listDriveDevices(db, actor)).toHaveLength(1);
  });
  it.each(["../secret.jpg", "/secret.jpg", "a/../b.jpg", "C:/file.jpg", "a\\file.jpg", "./a.jpg"])(
    "rejects unsafe relPath %s",
    (relPath) => {
      const { device } = drive.createDriveDevice(db, actor);
      expect(() =>
        drive.createDriveShare(db, device.id, { ...input, files: [{ ...files[0], relPath }] }),
      ).toThrow();
      expect(drive.listDriveShares(db, actor)).toEqual([]);
    },
  );
  it("rejects file cap, duplicate keys, invalid names, PIN and selection limits", () => {
    const { device } = drive.createDriveDevice(db, actor);
    for (const invalid of [
      {
        ...input,
        files: Array.from({ length: 20001 }, (_, i) => ({
          ...files[0],
          fileKey: `image_${String(i).padStart(8, "0")}`,
        })),
      },
      { ...input, files: [files[0], files[0]] },
      { ...input, files: [{ ...files[0], name: "a/b.jpg" }] },
      { ...input, pin: "12345" },
      { ...input, maxSelect: 0 },
      { ...input, maxSelect: 5001 },
      { ...input, maxSelect: undefined },
      { ...input, expiresInDays: 3651 },
      { ...input, kind: "view" as const },
    ])
      expect(() => drive.createDriveShare(db, device.id, invalid)).toThrow();
  });
  it("scopes staff and agents by tenant/device and enforces permissions and read-only mode", () => {
    const { share, device } = setup();
    const otherDevice = drive.createDriveDevice(db, other).device;
    expect(drive.listDriveShares(db, other)).toEqual([]);
    expect(drive.listDriveDevices(db, other)).toHaveLength(1);
    for (const principal of [other, { deviceId: otherDevice.id }]) {
      expect(() => drive.getDriveSelection(db, principal, share.id)).toThrow();
      expect(() => drive.updateDriveShareStatus(db, principal, share.id, "paused")).toThrow();
      expect(() => drive.reopenDriveSelection(db, principal, share.id)).toThrow();
    }
    expect(() => drive.revokeDriveDevice(db, other, device.id)).toThrow();
    expect(() => drive.getDriveMediaSecret(db, otherDevice.id, share.id)).toThrow();
    expect(() => drive.listDriveShares(db, { ...actor, permissions: [] })).toThrow();
    expect(() => drive.createDriveDevice(db, { ...actor, permissions: ["albums.view"] })).toThrow();
    expect(() => drive.revokeDriveShare(db, { ...actor, readOnly: true }, share.id)).toThrow();
    expect(drive.getDriveShare(db, actor, share.id).id).toBe(share.id);
  });
  it("enforces maxSelect, image/raw only, preserves notes while toggling and locks finalized edits", () => {
    const { share, token, storedFiles } = setup();
    const [one, two, video] = storedFiles;
    expect(drive.toggleDriveLike(db, token, one.id)).toBe(true);
    expect(() => drive.toggleDriveLike(db, token, two.id)).toThrow();
    expect(() => drive.toggleDriveLike(db, token, video.id)).toThrow();
    drive.setDriveNote(db, token, one.id, "Edit lighting");
    expect(drive.toggleDriveLike(db, token, one.id)).toBe(false);
    expect(drive.getDriveSelection(db, actor, share.id).items[0].note).toBe("Edit lighting");
    drive.setDriveNote(db, token, one.id, "");
    expect(drive.getDriveSelection(db, actor, share.id).items).toEqual([]);
    expect(drive.toggleDriveLike(db, token, two.id)).toBe(true);
    expect(() => drive.setDriveNote(db, token, two.id, "x".repeat(1001))).toThrow();
    expect(() => drive.setDriveNote(db, token, "missing", "x")).toThrow();
    drive.finalizeDriveSelection(db, token);
    expect(drive.getDriveSelection(db, actor, share.id).selectionStatus).toBe("finalized");
    expect(() => drive.toggleDriveLike(db, token, two.id)).toThrow();
    expect(() => drive.setDriveNote(db, token, two.id, "x")).toThrow();
    expect(() => drive.finalizeDriveSelection(db, token)).toThrow();
    drive.reopenDriveSelection(db, actor, share.id);
    expect(drive.getDriveSelection(db, actor, share.id).finalizedAt).toBeNull();
    expect(drive.toggleDriveLike(db, token, two.id)).toBe(false);
    expect(
      db
        .select()
        .from(activityLogs)
        .all()
        .some((r) => r.action === "drive.selection.reopen" && r.actorId === actor.staffId),
    ).toBe(true);
  });
  it("blocks paused, expired, revoked and non-album selection mutations", () => {
    const { share, token, device, storedFiles } = setup();
    drive.updateDriveShareStatus(db, actor, share.id, "paused");
    expect(() => drive.toggleDriveLike(db, token, storedFiles[0].id)).toThrow();
    drive.updateDriveShareStatus(db, { deviceId: device.id }, share.id, "active");
    db.update(driveShares)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(driveShares.id, share.id))
      .run();
    expect(() => drive.finalizeDriveSelection(db, token)).toThrow();
    drive.revokeDriveShare(db, actor, share.id);
    expect(drive.getDriveShareByToken(db, token)).toBeNull();
    expect(drive.listDriveSharesForDevice(db, device.id)).toEqual([]);
    expect(() => drive.updateDriveShareStatus(db, actor, share.id, "active")).toThrow();
    expect(() => drive.getDriveMediaSecret(db, device.id, share.id)).toThrow();
    const view = setup({ ...input, kind: "view", maxSelect: undefined });
    expect(() => drive.toggleDriveLike(db, view.token, view.storedFiles[0].id)).toThrow();
  });
  it("locks PIN after five failures per share/IP for fifteen minutes and resets on success", () => {
    const { token } = setup({ ...input, pin: "123456" });
    const now = new Date();
    for (let i = 0; i < 5; i++)
      expect(drive.verifyDrivePin(db, token, "000000", "ip-a", now)).toBe(false);
    expect(drive.verifyDrivePin(db, token, "123456", "ip-a", now)).toBe(false);
    expect(drive.verifyDrivePin(db, token, "123456", "ip-b", now)).toBe(true);
    const another = setup({ ...input, pin: "123456" });
    expect(drive.verifyDrivePin(db, another.token, "123456", "ip-a", now)).toBe(true);
    expect(drive.verifyDrivePin(db, token, "123456", "ip-a", new Date(+now + 900001))).toBe(true);
    expect(drive.verifyDrivePin(db, token, "bad", "ip-a", new Date(+now + 900002))).toBe(false);
    expect(drive.verifyDrivePin(db, "unknown", "123456", "ip-a")).toBe(false);
  });
  it("computes online only for fresh, nonrevoked devices with a tunnel", () => {
    const now = new Date();
    const device = { revokedAt: null, lastSeenAt: now, tunnelOrigin: "https://example.com" };
    expect(drive.isDriveDeviceOnline(device, now)).toBe(true);
    expect(drive.isDriveDeviceOnline({ ...device, lastSeenAt: new Date(+now - 120001) }, now)).toBe(
      false,
    );
    expect(drive.isDriveDeviceOnline({ ...device, revokedAt: now }, now)).toBe(false);
    expect(drive.isDriveDeviceOnline({ ...device, tunnelOrigin: null }, now)).toBe(false);
    expect(drive.isDriveDeviceOnline({ ...device, lastSeenAt: null }, now)).toBe(false);
    const { device: saved } = drive.createDriveDevice(db, actor);
    expect(
      drive.heartbeatDriveDevice(db, saved.id, {
        name: "PC",
        os: "linux",
        appVersion: "2",
        tunnelOrigin: "https://example.com/",
      }).tenantName,
    ).toBe(actor.tenantName);
    expect(drive.listDriveDevices(db, actor)[0].online).toBe(true);
  });
  it("validates origins and allows only loopback HTTP outside production", () => {
    expect(drive.validateTunnelOrigin(null)).toBeNull();
    expect(drive.validateTunnelOrigin("https://named.example:443/")).toBe("https://named.example");
    for (const value of [
      "https://host/path",
      "https://user:pw@host",
      "https://host?x=1",
      "https://host/#x",
      "file:///x",
      "http://example.com",
      "bad",
    ])
      expect(() => drive.validateTunnelOrigin(value)).toThrow();
    expect(drive.validateTunnelOrigin("http://127.0.0.1:3888")).toBe("http://127.0.0.1:3888");
    expect(drive.validateTunnelOrigin("http://localhost:3888")).toBe("http://localhost:3888");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => drive.validateTunnelOrigin("http://localhost:3888")).toThrow();
  });
  it("stores video comments with bounds and file/share validation", () => {
    const { share, token, storedFiles } = setup({ ...input, kind: "video", maxSelect: undefined });
    const data = {
      fileId: storedFiles[2].id,
      seconds: 1.5,
      author: "Customer",
      content: "Please trim",
    };
    expect(drive.listDriveVideoComments(db, actor, share.id)).toEqual([]);
    expect(drive.addDriveVideoComment(db, token, data).seconds).toBe(1.5);
    expect(drive.listDriveVideoComments(db, actor, share.id)).toHaveLength(1);
    for (const invalid of [
      { ...data, seconds: -1 },
      { ...data, content: "" },
      { ...data, author: "a".repeat(81) },
      { ...data, content: "a".repeat(1001) },
      { ...data, fileId: storedFiles[0].id },
    ])
      expect(() => drive.addDriveVideoComment(db, token, invalid)).toThrow();
    expect(() => drive.listDriveVideoComments(db, other, share.id)).toThrow();
  });
});
