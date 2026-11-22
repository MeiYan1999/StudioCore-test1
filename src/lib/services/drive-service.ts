import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  driveDevices,
  drivePairingCodes,
  driveShareFiles,
  driveShares,
  loginAttempts,
  tenants,
  type DriveDevice,
  type DriveShareFileRow,
  type DriveShareRow,
} from "../db/schema";
import { hashSecret, verifySecret } from "../auth/password";
import { assertPermission } from "../auth/permissions";
import type { ActorContext } from "../auth/types";
import { writeAudit } from "../audit";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";

export class DriveSuspendedError extends AuthorizationError {
  constructor(message = "Studio đang bị tạm khóa.") {
    super(message);
    this.name = "DriveSuspendedError";
  }
}

export const DRIVE_PAIRING_TTL_MS = 15 * 60 * 1000;
export const DRIVE_MAX_FILES_PER_SHARE = 20_000;
export const DRIVE_ONLINE_WINDOW_MS = 75_000;
const PIN_WINDOW_MS = 15 * 60 * 1000;
const PIN_MAX_FAILURES = 8;

export const DRIVE_SHARE_KINDS = ["select", "deliver"] as const;
export type DriveShareKind = (typeof DRIVE_SHARE_KINDS)[number];
export const DRIVE_FILE_KINDS = ["image", "raw", "video", "other"] as const;
export type DriveFileKind = (typeof DRIVE_FILE_KINDS)[number];

export type DriveFileInput = {
  key: string;
  name: string;
  kind: DriveFileKind;
  size: number;
};

export type DriveShareInput = {
  title: string;
  clientName?: string | null;
  kind: DriveShareKind;
  pin?: string | null;
  maxSelect?: number;
  allowOriginal?: boolean;
  expiresInDays?: number | null;
  files: DriveFileInput[];
};

export type DriveShareSummary = {
  id: string;
  slug: string;
  title: string;
  clientName: string | null;
  kind: DriveShareKind;
  status: "active" | "paused";
  hasPin: boolean;
  maxSelect: number;
  allowOriginal: boolean;
  expiresAt: number | null;
  expired: boolean;
  fileCount: number;
  totalBytes: number;
  viewCount: number;
  pickedCount: number;
  submittedAt: number | null;
  submissionNote: string | null;
  deviceId: string;
  deviceName: string;
  createdAt: number;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(prefix: string, bytes: number): string {
  return `${prefix}${randomBytes(bytes).toString("base64url")}`;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
}

// ---------------------------------------------------------------- pairing

export function createDrivePairingCode(db: AppDb, actor: ActorContext): { code: string; expiresAt: number } {
  assertPermission(actor, "albums.manage");
  const code = randomToken("scd-", 18);
  const expiresAt = Date.now() + DRIVE_PAIRING_TTL_MS;
  db.insert(drivePairingCodes)
    .values({
      id: randomUUID(),
      tenantId: actor.tenantId,
      codeHash: sha256(code),
      createdBy: actor.staffId,
      expiresAt: new Date(expiresAt),
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "drive.pairing_code.create",
    entity: "drive_device",
  });
  return { code, expiresAt };
}

export function pairDriveDevice(
  db: AppDb,
  input: { code: string; name: string; platform: string; appVersion: string; previousToken?: string },
): { deviceToken: string; deviceId: string; deviceName: string; studioName: string } {
  const code = cleanText(input.code, 120);
  if (!code) throw new ValidationError("Thiếu mã kết nối.");
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(drivePairingCodes)
      .where(eq(drivePairingCodes.codeHash, sha256(code)))
      .get();
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AuthorizationError("Mã kết nối không đúng hoặc đã hết hạn.");
    }
    const tenant = tx.select().from(tenants).where(eq(tenants.id, row.tenantId)).get();
    if (!tenant || tenant.status !== "active") {
      throw new AuthorizationError("Studio hiện không hoạt động.");
    }
    tx.update(drivePairingCodes)
      .set({ usedAt: new Date() })
      .where(eq(drivePairingCodes.id, row.id))
      .run();
    const deviceToken = randomToken("scdt-", 32);
    const deviceId = randomUUID();
    const deviceName = cleanText(input.name, 80) || "Máy studio";
    tx.insert(driveDevices)
      .values({
        id: deviceId,
        tenantId: row.tenantId,
        name: deviceName,
        platform: cleanText(input.platform, 20) || "unknown",
        appVersion: cleanText(input.appVersion, 20),
        tokenHash: sha256(deviceToken),
        pairedBy: row.createdBy,
        lastSeenAt: new Date(),
      })
      .run();
    const previousToken = input.previousToken;
    if (previousToken?.startsWith("scdt-")) {
      const previousDevice = tx
        .select()
        .from(driveDevices)
        .where(eq(driveDevices.tokenHash, sha256(previousToken)))
        .get();
      if (previousDevice && !previousDevice.revokedAt && previousDevice.tenantId === row.tenantId) {
        tx.update(driveShares).set({ deviceId }).where(eq(driveShares.deviceId, previousDevice.id)).run();
        tx.update(driveDevices)
          .set({ revokedAt: new Date() })
          .where(eq(driveDevices.id, previousDevice.id))
          .run();
      }
    }
    writeAudit(tx as unknown as AppDb, {
      tenantId: row.tenantId,
      actorId: row.createdBy,
      action: "drive.device.pair",
      entity: "drive_device",
      entityId: deviceId,
      metadata: { name: deviceName },
    });
    return { deviceToken, deviceId, deviceName, studioName: tenant.name };
  });
}

export function authenticateDriveDevice(db: AppDb, token: string | null): DriveDevice {
  if (!token || !token.startsWith("scdt-")) {
    throw new AuthorizationError("Thiết bị chưa được kết nối.");
  }
  const device = db
    .select()
    .from(driveDevices)
    .where(eq(driveDevices.tokenHash, sha256(token)))
    .get();
  if (!device || device.revokedAt) {
    throw new AuthorizationError("Thiết bị đã bị gỡ kết nối.");
  }
  const tenantStatus = db
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, device.tenantId))
    .get()?.status;
  if (tenantStatus !== "active") {
    throw new DriveSuspendedError();
  }
  return device;
}

export function touchDriveDevice(db: AppDb, device: DriveDevice, appVersion?: string): void {
  const now = Date.now();
  if (device.lastSeenAt && now - device.lastSeenAt.getTime() < 20_000 && !appVersion) return;
  db.update(driveDevices)
    .set({ lastSeenAt: new Date(now), ...(appVersion ? { appVersion: cleanText(appVersion, 20) } : {}) })
    .where(eq(driveDevices.id, device.id))
    .run();
}

export function isDriveDeviceOnline(device: Pick<DriveDevice, "lastSeenAt" | "revokedAt">): boolean {
  return (
    !device.revokedAt &&
    !!device.lastSeenAt &&
    Date.now() - device.lastSeenAt.getTime() < DRIVE_ONLINE_WINDOW_MS
  );
}

export function getTenantName(db: AppDb, tenantId: string): string {
  return db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).get()?.name ?? "";
}

export type DriveDeviceView = {
  id: string;
  name: string;
  platform: string;
  appVersion: string;
  online: boolean;
  lastSeenAt: number | null;
  createdAt: number;
  shareCount: number;
};

export function listDriveDevices(db: AppDb, actor: ActorContext): DriveDeviceView[] {
  assertPermission(actor, "albums.view");
  const rows = db
    .select()
    .from(driveDevices)
    .where(and(eq(driveDevices.tenantId, actor.tenantId), isNull(driveDevices.revokedAt)))
    .orderBy(desc(driveDevices.createdAt))
    .all();
  const counts = new Map(
    db
      .select({ deviceId: driveShares.deviceId, n: count() })
      .from(driveShares)
      .where(eq(driveShares.tenantId, actor.tenantId))
      .groupBy(driveShares.deviceId)
      .all()
      .map((r) => [r.deviceId, r.n]),
  );
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    platform: d.platform,
    appVersion: d.appVersion,
    online: isDriveDeviceOnline(d),
    lastSeenAt: d.lastSeenAt?.getTime() ?? null,
    createdAt: d.createdAt.getTime(),
    shareCount: counts.get(d.id) ?? 0,
  }));
}

export function revokeDriveDevice(db: AppDb, actor: ActorContext, deviceId: string): void {
  assertPermission(actor, "albums.manage");
  const result = db
    .update(driveDevices)
    .set({ revokedAt: new Date() })
    .where(and(eq(driveDevices.id, deviceId), eq(driveDevices.tenantId, actor.tenantId)))
    .run();
  if (result.changes === 0) throw new NotFoundError("Không tìm thấy thiết bị.");
  db.update(driveShares)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(driveShares.deviceId, deviceId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "drive.device.revoke",
    entity: "drive_device",
    entityId: deviceId,
  });
}

// ---------------------------------------------------------------- shares

function normalizeFiles(files: unknown): DriveFileInput[] {
  if (!Array.isArray(files)) throw new ValidationError("Danh sách tệp không hợp lệ.");
  if (files.length === 0) throw new ValidationError("Thư mục không có ảnh hoặc video nào.");
  if (files.length > DRIVE_MAX_FILES_PER_SHARE) {
    throw new ValidationError(`Mỗi link tối đa ${DRIVE_MAX_FILES_PER_SHARE} tệp.`);
  }
  const seen = new Set<string>();
  const out: DriveFileInput[] = [];
  for (const raw of files) {
    const item = raw as Partial<DriveFileInput>;
    const key = typeof item.key === "string" ? item.key : "";
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(key) || seen.has(key)) {
      throw new ValidationError("Mã tệp không hợp lệ.");
    }
    seen.add(key);
    const name = cleanText(item.name, 255).replace(/[\\/]/g, "_");
    if (!name) throw new ValidationError("Tên tệp không hợp lệ.");
    const kind = DRIVE_FILE_KINDS.includes(item.kind as DriveFileKind) ? (item.kind as DriveFileKind) : "other";
    const size = Number.isFinite(item.size) && (item.size as number) >= 0 ? Math.floor(item.size as number) : 0;
    out.push({ key, name, kind, size });
  }
  return out;
}

function normalizePin(pin: unknown): string | null {
  if (pin === null || pin === undefined || pin === "") return null;
  if (typeof pin !== "string" || !/^[0-9A-Za-z]{4,12}$/.test(pin)) {
    throw new ValidationError("Mã PIN gồm 4-12 chữ số hoặc chữ cái.");
  }
  return pin;
}

function expiresFromDays(days: unknown): Date | null {
  if (days === null || days === undefined || days === 0 || days === "") return null;
  const n = Number(days);
  if (!Number.isFinite(n) || n < 0 || n > 3650) throw new ValidationError("Số ngày hết hạn không hợp lệ.");
  return n === 0 ? null : new Date(Date.now() + n * 86_400_000);
}

function insertFiles(tx: AppDb, shareId: string, files: DriveFileInput[], startIndex = 0): void {
  for (let i = 0; i < files.length; i += 200) {
    tx.insert(driveShareFiles)
      .values(
        files.slice(i, i + 200).map((f, j) => ({
          id: randomUUID(),
          shareId,
          fileKey: f.key,
          name: f.name,
          kind: f.kind,
          size: f.size,
          sortIndex: startIndex + i + j,
        })),
      )
      .run();
  }
}

export function createDriveShare(db: AppDb, device: DriveDevice, input: DriveShareInput): DriveShareRow {
  const title = cleanText(input.title, 160);
  if (!title) throw new ValidationError("Vui lòng nhập tên link.");
  if (!DRIVE_SHARE_KINDS.includes(input.kind)) throw new ValidationError("Loại link không hợp lệ.");
  const files = normalizeFiles(input.files);
  const pin = normalizePin(input.pin);
  const maxSelect = Math.max(0, Math.min(100_000, Math.floor(Number(input.maxSelect) || 0)));
  const id = randomUUID();
  return db.transaction((tx) => {
    tx.insert(driveShares)
      .values({
        id,
        tenantId: device.tenantId,
        deviceId: device.id,
        slug: randomBytes(12).toString("base64url"),
        title,
        clientName: cleanText(input.clientName, 120) || null,
        kind: input.kind,
        pinHash: pin ? hashSecret(pin) : null,
        maxSelect: input.kind === "select" ? maxSelect : 0,
        allowOriginal: input.kind === "deliver" ? true : !!input.allowOriginal,
        expiresAt: expiresFromDays(input.expiresInDays),
        fileCount: files.length,
        totalBytes: files.reduce((sum, f) => sum + f.size, 0),
      })
      .run();
    insertFiles(tx as unknown as AppDb, id, files);
    return tx.select().from(driveShares).where(eq(driveShares.id, id)).get()!;
  });
}

/** Cập nhật danh mục tệp sau khi máy studio quét lại thư mục; giữ nguyên lựa chọn của khách. */
export function replaceDriveShareFiles(db: AppDb, device: DriveDevice, shareId: string, rawFiles: unknown): void {
  const share = getDeviceShare(db, device, shareId);
  const files = normalizeFiles(rawFiles);
  db.transaction((tx) => {
    const existing = new Map(
      tx
        .select()
        .from(driveShareFiles)
        .where(eq(driveShareFiles.shareId, share.id))
        .all()
        .map((f) => [f.fileKey, f]),
    );
    const incoming = new Set(files.map((f) => f.key));
    const removed = [...existing.values()].filter((f) => !incoming.has(f.fileKey)).map((f) => f.id);
    for (let i = 0; i < removed.length; i += 400) {
      tx.delete(driveShareFiles).where(inArray(driveShareFiles.id, removed.slice(i, i + 400))).run();
    }
    files.forEach((f, index) => {
      const current = existing.get(f.key);
      if (current) {
        if (current.sortIndex !== index || current.size !== f.size || current.name !== f.name) {
          tx.update(driveShareFiles)
            .set({ sortIndex: index, size: f.size, name: f.name, kind: f.kind })
            .where(eq(driveShareFiles.id, current.id))
            .run();
        }
      } else {
        insertFiles(tx as unknown as AppDb, share.id, [f], index);
      }
    });
    tx.update(driveShares)
      .set({
        fileCount: files.length,
        totalBytes: files.reduce((sum, f) => sum + f.size, 0),
        updatedAt: new Date(),
      })
      .where(eq(driveShares.id, share.id))
      .run();
  });
}

function getDeviceShare(db: AppDb, device: DriveDevice, shareId: string): DriveShareRow {
  const share = db
    .select()
    .from(driveShares)
    .where(and(eq(driveShares.id, shareId), eq(driveShares.deviceId, device.id)))
    .get();
  if (!share) throw new NotFoundError("Không tìm thấy link chia sẻ.");
  return share;
}

export type DriveSharePatch = {
  status?: "active" | "paused";
  title?: string;
  clientName?: string | null;
  pin?: string | null;
  maxSelect?: number;
  allowOriginal?: boolean;
  expiresInDays?: number | null;
  reopen?: boolean;
};

function applySharePatch(db: AppDb, share: DriveShareRow, patch: DriveSharePatch): void {
  const set: Partial<typeof driveShares.$inferInsert> = { updatedAt: new Date() };
  if (patch.status !== undefined) {
    if (patch.status !== "active" && patch.status !== "paused") throw new ValidationError("Trạng thái không hợp lệ.");
    set.status = patch.status;
  }
  if (patch.title !== undefined) {
    const title = cleanText(patch.title, 160);
    if (!title) throw new ValidationError("Vui lòng nhập tên link.");
    set.title = title;
  }
  if (patch.clientName !== undefined) set.clientName = cleanText(patch.clientName, 120) || null;
  if (patch.pin !== undefined) {
    const pin = normalizePin(patch.pin);
    set.pinHash = pin ? hashSecret(pin) : null;
  }
  if (patch.maxSelect !== undefined) {
    set.maxSelect = Math.max(0, Math.min(100_000, Math.floor(Number(patch.maxSelect) || 0)));
  }
  if (patch.allowOriginal !== undefined && share.kind === "select") set.allowOriginal = !!patch.allowOriginal;
  if (patch.expiresInDays !== undefined) set.expiresAt = expiresFromDays(patch.expiresInDays);
  if (patch.reopen) {
    set.submittedAt = null;
    set.submissionNote = null;
  }
  db.update(driveShares).set(set).where(eq(driveShares.id, share.id)).run();
}

export function updateDriveShareFromDevice(db: AppDb, device: DriveDevice, shareId: string, patch: DriveSharePatch): void {
  applySharePatch(db, getDeviceShare(db, device, shareId), patch);
}

export function deleteDriveShareFromDevice(db: AppDb, device: DriveDevice, shareId: string): void {
  const share = getDeviceShare(db, device, shareId);
  db.delete(driveShares).where(eq(driveShares.id, share.id)).run();
}

function getTenantShare(db: AppDb, actor: ActorContext, shareId: string): DriveShareRow {
  const share = db
    .select()
    .from(driveShares)
    .where(and(eq(driveShares.id, shareId), eq(driveShares.tenantId, actor.tenantId)))
    .get();
  if (!share) throw new NotFoundError("Không tìm thấy link chia sẻ.");
  return share;
}

export function updateDriveShareByActor(db: AppDb, actor: ActorContext, shareId: string, patch: DriveSharePatch): void {
  assertPermission(actor, "albums.manage");
  applySharePatch(db, getTenantShare(db, actor, shareId), patch);
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "drive.share.update",
    entity: "drive_share",
    entityId: shareId,
    metadata: { fields: Object.keys(patch) },
  });
}

export function deleteDriveShareByActor(db: AppDb, actor: ActorContext, shareId: string): void {
  assertPermission(actor, "albums.manage");
  const share = getTenantShare(db, actor, shareId);
  db.delete(driveShares).where(eq(driveShares.id, share.id)).run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "drive.share.delete",
    entity: "drive_share",
    entityId: shareId,
    metadata: { title: share.title },
  });
}

function summarize(db: AppDb, rows: DriveShareRow[]): DriveShareSummary[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const picked = new Map(
    db
      .select({ shareId: driveShareFiles.shareId, n: count() })
      .from(driveShareFiles)
      .where(and(inArray(driveShareFiles.shareId, ids), eq(driveShareFiles.picked, true)))
      .groupBy(driveShareFiles.shareId)
      .all()
      .map((r) => [r.shareId, r.n]),
  );
  const deviceNames = new Map(
    db
      .select({ id: driveDevices.id, name: driveDevices.name })
      .from(driveDevices)
      .where(inArray(driveDevices.id, [...new Set(rows.map((r) => r.deviceId))]))
      .all()
      .map((d) => [d.id, d.name]),
  );
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    clientName: r.clientName,
    kind: r.kind as DriveShareKind,
    status: r.status === "paused" ? "paused" : "active",
    hasPin: !!r.pinHash,
    maxSelect: r.maxSelect,
    allowOriginal: r.allowOriginal,
    expiresAt: r.expiresAt?.getTime() ?? null,
    expired: !!r.expiresAt && r.expiresAt.getTime() < Date.now(),
    fileCount: r.fileCount,
    totalBytes: r.totalBytes,
    viewCount: r.viewCount,
    pickedCount: picked.get(r.id) ?? 0,
    submittedAt: r.submittedAt?.getTime() ?? null,
    submissionNote: r.submissionNote,
    deviceId: r.deviceId,
    deviceName: deviceNames.get(r.deviceId) ?? "",
    createdAt: r.createdAt.getTime(),
  }));
}

export function listDriveSharesForDevice(db: AppDb, device: DriveDevice): DriveShareSummary[] {
  return summarize(
    db,
    db.select().from(driveShares).where(eq(driveShares.deviceId, device.id)).orderBy(desc(driveShares.createdAt)).all(),
  );
}

export function listDriveSharesForTenant(db: AppDb, actor: ActorContext): DriveShareSummary[] {
  assertPermission(actor, "albums.view");
  return summarize(
    db,
    db
      .select()
      .from(driveShares)
      .where(eq(driveShares.tenantId, actor.tenantId))
      .orderBy(desc(driveShares.createdAt))
      .limit(500)
      .all(),
  );
}

export type DrivePick = { key: string; name: string; note: string | null };

function picksOf(db: AppDb, shareId: string): DrivePick[] {
  return db
    .select({ key: driveShareFiles.fileKey, name: driveShareFiles.name, note: driveShareFiles.note })
    .from(driveShareFiles)
    .where(and(eq(driveShareFiles.shareId, shareId), eq(driveShareFiles.picked, true)))
    .orderBy(asc(driveShareFiles.sortIndex))
    .all();
}

export function getDrivePicksForDevice(db: AppDb, device: DriveDevice, shareId: string): DrivePick[] {
  return picksOf(db, getDeviceShare(db, device, shareId).id);
}

export function getDrivePicksForActor(db: AppDb, actor: ActorContext, shareId: string): DrivePick[] {
  assertPermission(actor, "albums.view");
  return picksOf(db, getTenantShare(db, actor, shareId).id);
}

/** Các link khách đã gửi lựa chọn sau mốc `since` (để máy studio thông báo). */
export function listDriveSubmissionsSince(db: AppDb, device: DriveDevice, since: number): DriveShareSummary[] {
  return summarize(
    db,
    db
      .select()
      .from(driveShares)
      .where(and(eq(driveShares.deviceId, device.id), gt(driveShares.submittedAt, new Date(since))))
      .orderBy(asc(driveShares.submittedAt))
      .all(),
  );
}

// ---------------------------------------------------------------- public (khách)

export type DrivePublicState = "ok" | "not_found" | "paused" | "expired";

export function getDriveShareBySlug(db: AppDb, slug: string): { state: DrivePublicState; share: DriveShareRow | null; device: DriveDevice | null } {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(slug)) return { state: "not_found", share: null, device: null };
  const share = db.select().from(driveShares).where(eq(driveShares.slug, slug)).get();
  if (!share) return { state: "not_found", share: null, device: null };
  const device = db.select().from(driveDevices).where(eq(driveDevices.id, share.deviceId)).get() ?? null;
  if (!device || device.revokedAt || share.status !== "active") return { state: "paused", share, device };
  const tenantStatus = db
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, device.tenantId))
    .get()?.status;
  if (tenantStatus !== "active") return { state: "paused", share, device };
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return { state: "expired", share, device };
  return { state: "ok", share, device };
}

export function verifyDriveSharePin(db: AppDb, share: DriveShareRow, pin: string, ip: string): { ok: boolean; locked: boolean } {
  const identifier = `drive:${share.id}`;
  const since = new Date(Date.now() - PIN_WINDOW_MS);
  const failures =
    db
      .select({ n: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.identifier, identifier),
          eq(loginAttempts.success, false),
          gt(loginAttempts.createdAt, since),
        ),
      )
      .get()?.n ?? 0;
  if (failures >= PIN_MAX_FAILURES) return { ok: false, locked: true };
  const ok = typeof pin === "string" && pin.length <= 12 && verifySecret(pin, share.pinHash);
  db.insert(loginAttempts)
    .values({ id: randomUUID(), identifier, ip: ip.slice(0, 64), success: ok, createdAt: new Date() })
    .run();
  return { ok, locked: false };
}

export function driveSharePinVersion(share: DriveShareRow): string {
  return sha256(`${share.id}:${share.pinHash ?? ""}`).slice(0, 24);
}

export type DrivePublicFile = {
  id: string;
  name: string;
  kind: DriveFileKind;
  size: number;
  picked: boolean;
  note: string | null;
};

export function listDrivePublicFiles(db: AppDb, shareId: string): DrivePublicFile[] {
  return db
    .select()
    .from(driveShareFiles)
    .where(eq(driveShareFiles.shareId, shareId))
    .orderBy(asc(driveShareFiles.sortIndex))
    .all()
    .map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind as DriveFileKind,
      size: f.size,
      picked: f.picked,
      note: f.note,
    }));
}

export function getDriveShareFile(db: AppDb, shareId: string, fileId: string): DriveShareFileRow | null {
  return (
    db
      .select()
      .from(driveShareFiles)
      .where(and(eq(driveShareFiles.id, fileId), eq(driveShareFiles.shareId, shareId)))
      .get() ?? null
  );
}

export function incrementDriveShareViews(db: AppDb, shareId: string): void {
  db.update(driveShares)
    .set({ viewCount: sql`${driveShares.viewCount} + 1` })
    .where(eq(driveShares.id, shareId))
    .run();
}

export function setDrivePick(
  db: AppDb,
  share: DriveShareRow,
  fileId: string,
  input: { picked?: boolean; note?: string | null },
): { picked: boolean; note: string | null; pickedCount: number } {
  if (share.kind !== "select") throw new ValidationError("Link này không dùng để chọn ảnh.");
  if (share.submittedAt) throw new ValidationError("Bạn đã gửi lựa chọn. Hãy liên hệ studio nếu muốn chọn lại.");
  return db.transaction((tx) => {
    const file = tx
      .select()
      .from(driveShareFiles)
      .where(and(eq(driveShareFiles.id, fileId), eq(driveShareFiles.shareId, share.id)))
      .get();
    if (!file) throw new NotFoundError("Không tìm thấy ảnh.");
    const picked = input.picked ?? file.picked;
    const countPicked = () =>
      tx
        .select({ n: count() })
        .from(driveShareFiles)
        .where(and(eq(driveShareFiles.shareId, share.id), eq(driveShareFiles.picked, true)))
        .get()?.n ?? 0;
    if (picked && !file.picked && share.maxSelect > 0 && countPicked() >= share.maxSelect) {
      throw new ValidationError(`Bạn chỉ được chọn tối đa ${share.maxSelect} ảnh.`);
    }
    const note = input.note === undefined ? file.note : cleanText(input.note, 500) || null;
    tx.update(driveShareFiles)
      .set({ picked, note: picked ? note : null })
      .where(eq(driveShareFiles.id, file.id))
      .run();
    return { picked, note: picked ? note : null, pickedCount: countPicked() };
  });
}

export function submitDriveSelection(db: AppDb, share: DriveShareRow, note: string | null): { pickedCount: number } {
  if (share.kind !== "select") throw new ValidationError("Link này không dùng để chọn ảnh.");
  if (share.submittedAt) throw new ValidationError("Bạn đã gửi lựa chọn rồi.");
  const pickedCount = picksOf(db, share.id).length;
  if (pickedCount === 0) throw new ValidationError("Hãy chọn ít nhất 1 ảnh trước khi gửi.");
  db.update(driveShares)
    .set({ submittedAt: new Date(), submissionNote: cleanText(note, 1000) || null, updatedAt: new Date() })
    .where(eq(driveShares.id, share.id))
    .run();
  return { pickedCount };
}

/** Mã ảnh = tên tệp bỏ phần mở rộng, dùng để dán vào bộ lọc Lightroom/Capture One. */
export function drivePickCodes(picks: DrivePick[]): string[] {
  return picks.map((p) => p.name.replace(/\.[^.]+$/, ""));
}
