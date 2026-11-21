import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, count, eq, gte, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { AppDb } from "../db/client";
import {
  driveDevices,
  driveShares,
  driveShareFiles,
  driveSelections,
  driveVideoComments,
  loginAttempts,
  tenants,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission } from "../auth/permissions";
import { hashSecret, verifySecret } from "../auth/password";
import { createShareTokenRecord, hashShareToken, revealShareToken } from "../share/token";
import { decryptSecret, encryptSecret } from "../security/secret-crypto";
import { writeAudit } from "../audit";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";

export type DriveDevice = typeof driveDevices.$inferSelect;
export type DriveShare = typeof driveShares.$inferSelect;
export type DrivePrincipal = ActorContext | { deviceId: string };
const digest = (key: string) => createHash("sha256").update(key).digest("hex");
const label = z.string().trim().min(1).max(255);
const basename = label.refine((s) => !/[\\/\x00]/.test(s) && s !== "." && s !== "..");
const relPath = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (s) =>
      !s.startsWith("/") &&
      !/[\\:\x00]/.test(s) &&
      s.split("/").every((p) => p && p !== "." && p !== ".."),
  );
export const driveShareInputSchema = z
  .object({
    kind: z.enum(["album", "view", "video", "folder"]),
    title: label,
    customerName: z.string().trim().max(255).optional(),
    folderName: basename,
    pin: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    allowOriginals: z.boolean(),
    maxSelect: z.number().int().min(1).max(5000).optional(),
    expiresInDays: z.number().int().min(0).max(3650),
    files: z
      .array(
        z.object({
          fileKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
          name: basename,
          relPath,
          kind: z.enum(["image", "raw", "video", "other"]),
          sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        }),
      )
      .max(20000),
  })
  .superRefine((s, ctx) => {
    if ((s.kind === "album") !== (s.maxSelect !== undefined))
      ctx.addIssue({ code: "custom", message: "maxSelect chỉ bắt buộc cho album." });
    if (new Set(s.files.map((f) => f.fileKey)).size !== s.files.length)
      ctx.addIssue({ code: "custom", message: "Mã file bị trùng." });
    if (!Number.isSafeInteger(s.files.reduce((n, f) => n + f.sizeBytes, 0)))
      ctx.addIssue({ code: "custom", message: "Dung lượng quá lớn." });
  });
export type DriveShareInput = z.infer<typeof driveShareInputSchema>;
export const driveHeartbeatSchema = z.object({
  name: label,
  os: label,
  appVersion: label,
  tunnelOrigin: z.string().nullable(),
});
export const driveVideoCommentSchema = z.object({
  fileId: z.string().min(1),
  seconds: z.number().finite().nonnegative(),
  author: z.string().trim().min(1).max(80),
  content: z.string().trim().min(1).max(1000),
});

function audit(
  db: AppDb,
  tenantId: string,
  action: string,
  id: string,
  actorId: string | null = null,
) {
  writeAudit(db, { tenantId, actorId, action: `drive.${action}`, entity: "drive", entityId: id });
}
function staffAccess(actor: ActorContext, mutate = false) {
  assertPermission(actor, mutate ? "albums.manage" : "albums.view");
  if (mutate && actor.readOnly) throw new AuthorizationError();
}
function activeDevice(db: AppDb, id: string) {
  const row = db
    .select()
    .from(driveDevices)
    .where(and(eq(driveDevices.id, id), isNull(driveDevices.revokedAt)))
    .get();
  if (!row) throw new AuthorizationError();
  return row;
}
function scopedShare(db: AppDb, principal: DrivePrincipal, id: string, mutate = false) {
  const scope =
    "deviceId" in principal
      ? eq(driveShares.deviceId, activeDevice(db, principal.deviceId).id)
      : (staffAccess(principal, mutate), eq(driveShares.tenantId, principal.tenantId));
  const row = db
    .select()
    .from(driveShares)
    .where(and(eq(driveShares.id, id), scope))
    .get();
  if (!row) throw new NotFoundError();
  return row;
}
const actorId = (p: DrivePrincipal) => ("staffId" in p ? p.staffId : null);
export function isDriveDeviceOnline(
  device: Pick<DriveDevice, "revokedAt" | "lastSeenAt" | "tunnelOrigin">,
  now = new Date(),
): boolean {
  const age = device.lastSeenAt ? now.getTime() - device.lastSeenAt.getTime() : Infinity;
  return !device.revokedAt && !!device.tunnelOrigin && age >= 0 && age <= 120000;
}
function publicDevice(row: DriveDevice) {
  const { keyHash, ...device } = row;
  void keyHash;
  return { ...device, online: isDriveDeviceOnline(row) };
}
export function createDriveDevice(db: AppDb, actor: ActorContext, name = "Máy mới") {
  staffAccess(actor, true);
  const key = `scd_${randomBytes(32).toString("base64url")}`;
  return db.transaction((tx) => {
    const row = tx
      .insert(driveDevices)
      .values({
        id: randomUUID(),
        tenantId: actor.tenantId,
        name: label.parse(name),
        keyHash: digest(key),
        keyPrefix: key.slice(0, 12),
        createdByStaffId: actor.staffId,
      })
      .returning()
      .get();
    audit(tx, actor.tenantId, "device.create", row.id, actor.staffId);
    return { device: publicDevice(row), key };
  });
}
export function listDriveDevices(db: AppDb, actor: ActorContext) {
  staffAccess(actor);
  return db
    .select()
    .from(driveDevices)
    .where(eq(driveDevices.tenantId, actor.tenantId))
    .all()
    .map(publicDevice);
}
export function revokeDriveDevice(db: AppDb, actor: ActorContext, id: string) {
  staffAccess(actor, true);
  db.transaction((tx) => {
    const row = tx
      .update(driveDevices)
      .set({ revokedAt: new Date(), tunnelOrigin: null })
      .where(and(eq(driveDevices.id, id), eq(driveDevices.tenantId, actor.tenantId)))
      .returning()
      .get();
    if (!row) throw new NotFoundError();
    audit(tx, actor.tenantId, "device.revoke", id, actor.staffId);
  });
}
export function authenticateDriveDevice(db: AppDb, key: string): DriveDevice | null {
  if (!/^scd_[A-Za-z0-9_-]{43}$/.test(key)) return null;
  return (
    db
      .select()
      .from(driveDevices)
      .where(and(eq(driveDevices.keyHash, digest(key)), isNull(driveDevices.revokedAt)))
      .get() ?? null
  );
}
export function validateTunnelOrigin(value: string | null): string | null {
  if (value === null) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("Địa chỉ đường truyền không hợp lệ.");
  }
  const local =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    (!local && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new ValidationError("Chỉ chấp nhận origin HTTPS.");
  return url.origin;
}
export function heartbeatDriveDevice(
  db: AppDb,
  deviceId: string,
  input: z.infer<typeof driveHeartbeatSchema>,
) {
  const data = driveHeartbeatSchema.parse(input);
  const tunnelOrigin = validateTunnelOrigin(data.tunnelOrigin);
  return db.transaction((tx) => {
    const device = activeDevice(tx, deviceId);
    tx.update(driveDevices)
      .set({ ...data, tunnelOrigin, lastSeenAt: new Date() })
      .where(eq(driveDevices.id, deviceId))
      .run();
    const tenant = tx.select().from(tenants).where(eq(tenants.id, device.tenantId)).get()!;
    return { id: deviceId, name: data.name, tenantName: tenant.name };
  });
}
function summary(db: AppDb, share: DriveShare) {
  const token = revealShareToken(share.tokenEncrypted);
  if (!token) throw new Error("Không đọc được token.");
  const likedCount = db
    .select({ n: count() })
    .from(driveSelections)
    .where(and(eq(driveSelections.shareId, share.id), eq(driveSelections.liked, true)))
    .get()!.n;
  return {
    id: share.id,
    deviceId: share.deviceId,
    kind: share.kind,
    title: share.title,
    customerName: share.customerName,
    folderName: share.folderName,
    status: share.status,
    selectionStatus: share.selectionStatus,
    finalizedAt: share.finalizedAt,
    expiresAt: share.expiresAt,
    allowOriginals: share.allowOriginals,
    maxSelect: share.maxSelect,
    createdAt: share.createdAt,
    fileCount: share.fileCount,
    totalBytes: share.totalBytes,
    likedCount,
    pinProtected: !!share.pinHash,
    expired: !!share.expiresAt && +share.expiresAt <= Date.now(),
    url: `/drive/${token}`,
  };
}
export function createDriveShare(db: AppDb, deviceId: string, input: DriveShareInput) {
  const data = driveShareInputSchema.parse(input);
  const token = createShareTokenRecord();
  const mediaSecret = randomBytes(32).toString("base64url");
  return db.transaction((tx) => {
    const device = activeDevice(tx, deviceId);
    const share = tx
      .insert(driveShares)
      .values({
        id: randomUUID(),
        tenantId: device.tenantId,
        deviceId,
        tokenHash: token.tokenHash,
        tokenEncrypted: token.tokenEncrypted,
        kind: data.kind,
        title: data.title,
        customerName: data.customerName || null,
        folderName: data.folderName,
        mediaSecret: encryptSecret(mediaSecret),
        pinHash: data.pin ? hashSecret(data.pin) : null,
        allowOriginals: data.allowOriginals,
        maxSelect: data.maxSelect ?? null,
        expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86400000) : null,
        fileCount: data.files.length,
        totalBytes: data.files.reduce((n, f) => n + f.sizeBytes, 0),
      })
      .returning()
      .get();
    for (const [sortOrder, file] of data.files.entries())
      tx.insert(driveShareFiles)
        .values({
          ...file,
          id: randomUUID(),
          shareId: share.id,
          sortOrder,
          code: file.name.replace(/\.[^.]+$/, ""),
        })
        .run();
    audit(tx, device.tenantId, "share.create", share.id);
    return { ...summary(tx, share), mediaSecret };
  });
}
export function listDriveShares(db: AppDb, actor: ActorContext) {
  staffAccess(actor);
  return db
    .select()
    .from(driveShares)
    .where(eq(driveShares.tenantId, actor.tenantId))
    .all()
    .map((s) => summary(db, s));
}
export function listDriveSharesForDevice(db: AppDb, deviceId: string) {
  activeDevice(db, deviceId);
  return db
    .select()
    .from(driveShares)
    .where(and(eq(driveShares.deviceId, deviceId), ne(driveShares.status, "revoked")))
    .all()
    .map((s) => summary(db, s));
}
export function getDriveShare(db: AppDb, principal: DrivePrincipal, id: string) {
  return summary(db, scopedShare(db, principal, id));
}
export function getDriveShareByToken(db: AppDb, token: string): DriveShare | null {
  return (
    db
      .select()
      .from(driveShares)
      .where(
        and(eq(driveShares.tokenHash, hashShareToken(token)), ne(driveShares.status, "revoked")),
      )
      .get() ?? null
  );
}
export function updateDriveShareStatus(
  db: AppDb,
  principal: DrivePrincipal,
  id: string,
  status: "active" | "paused" | "revoked",
) {
  z.enum(["active", "paused", "revoked"]).parse(status);
  db.transaction((tx) => {
    const share = scopedShare(tx, principal, id, true);
    if (share.status === "revoked") throw new ValidationError("Link đã bị thu hồi.");
    tx.update(driveShares)
      .set({ status, updatedAt: new Date() })
      .where(eq(driveShares.id, id))
      .run();
    audit(tx, share.tenantId, `share.${status}`, id, actorId(principal));
  });
}
export function revokeDriveShare(db: AppDb, principal: DrivePrincipal, id: string) {
  updateDriveShareStatus(db, principal, id, "revoked");
}
export function getDriveMediaSecret(db: AppDb, deviceId: string, id: string): string {
  const share = scopedShare(db, { deviceId }, id);
  if (share.status === "revoked") throw new NotFoundError();
  const secret = decryptSecret(share.mediaSecret);
  if (!secret) throw new Error("Không đọc được khóa media.");
  return secret;
}
export function getDriveSelection(db: AppDb, principal: DrivePrincipal, id: string) {
  const share = scopedShare(db, principal, id);
  const items = db
    .select({
      fileId: driveShareFiles.id,
      fileKey: driveShareFiles.fileKey,
      name: driveShareFiles.name,
      relPath: driveShareFiles.relPath,
      code: driveShareFiles.code,
      liked: driveSelections.liked,
      note: driveSelections.note,
    })
    .from(driveShareFiles)
    .innerJoin(
      driveSelections,
      and(
        eq(driveSelections.fileId, driveShareFiles.id),
        eq(driveSelections.shareId, driveShareFiles.shareId),
      ),
    )
    .where(
      and(
        eq(driveShareFiles.shareId, id),
        or(eq(driveSelections.liked, true), ne(driveSelections.note, "")),
      ),
    )
    .orderBy(asc(driveShareFiles.sortOrder))
    .all();
  return {
    selectionStatus: share.selectionStatus,
    finalizedAt: share.finalizedAt,
    customerName: share.customerName,
    items,
  };
}
function editableShare(db: AppDb, token: string, album = true) {
  const share = getDriveShareByToken(db, token);
  if (!share) throw new NotFoundError();
  if (
    share.status !== "active" ||
    (share.expiresAt && share.expiresAt.getTime() <= Date.now()) ||
    share.selectionStatus !== "open" ||
    (album && share.kind !== "album")
  )
    throw new ValidationError("Link không cho phép chỉnh sửa.");
  activeDevice(db, share.deviceId);
  return share;
}
function selectionFile(db: AppDb, shareId: string, fileId: string) {
  const file = db
    .select()
    .from(driveShareFiles)
    .where(and(eq(driveShareFiles.id, fileId), eq(driveShareFiles.shareId, shareId)))
    .get();
  if (!file) throw new NotFoundError();
  if (!["image", "raw"].includes(file.kind)) throw new ValidationError("Chỉ chọn được ảnh.");
}
export function toggleDriveLike(db: AppDb, token: string, fileId: string): boolean {
  return db.transaction(
    (tx) => {
      const share = editableShare(tx, token);
      selectionFile(tx, share.id, fileId);
      const existing = tx
        .select()
        .from(driveSelections)
        .where(and(eq(driveSelections.shareId, share.id), eq(driveSelections.fileId, fileId)))
        .get();
      const liked = !existing?.liked;
      if (liked && summary(tx, share).likedCount >= share.maxSelect!)
        throw new ValidationError("Đã đủ số ảnh được chọn.");
      tx.insert(driveSelections)
        .values({ id: randomUUID(), shareId: share.id, fileId, liked })
        .onConflictDoUpdate({
          target: [driveSelections.shareId, driveSelections.fileId],
          set: { liked, updatedAt: new Date() },
        })
        .run();
      audit(tx, share.tenantId, "selection.like", share.id);
      return liked;
    },
    { behavior: "immediate" },
  );
}
export function setDriveNote(db: AppDb, token: string, fileId: string, note: string) {
  z.string().max(1000).parse(note);
  db.transaction((tx) => {
    const share = editableShare(tx, token);
    selectionFile(tx, share.id, fileId);
    tx.insert(driveSelections)
      .values({ id: randomUUID(), shareId: share.id, fileId, note })
      .onConflictDoUpdate({
        target: [driveSelections.shareId, driveSelections.fileId],
        set: { note, updatedAt: new Date() },
      })
      .run();
    audit(tx, share.tenantId, "selection.note", share.id);
  });
}
export function finalizeDriveSelection(db: AppDb, token: string) {
  db.transaction((tx) => {
    const share = editableShare(tx, token);
    tx.update(driveShares)
      .set({ selectionStatus: "finalized", finalizedAt: new Date(), updatedAt: new Date() })
      .where(eq(driveShares.id, share.id))
      .run();
    audit(tx, share.tenantId, "selection.finalize", share.id);
  });
}
export function reopenDriveSelection(db: AppDb, principal: DrivePrincipal, id: string) {
  db.transaction((tx) => {
    const share = scopedShare(tx, principal, id, true);
    if (share.status === "revoked") throw new NotFoundError();
    tx.update(driveShares)
      .set({ selectionStatus: "open", finalizedAt: null, updatedAt: new Date() })
      .where(eq(driveShares.id, id))
      .run();
    audit(tx, share.tenantId, "selection.reopen", id, actorId(principal));
  });
}
export function addDriveVideoComment(
  db: AppDb,
  token: string,
  input: z.infer<typeof driveVideoCommentSchema>,
) {
  const data = driveVideoCommentSchema.parse(input);
  return db.transaction((tx) => {
    const share = editableShare(tx, token, false);
    const file = tx
      .select()
      .from(driveShareFiles)
      .where(and(eq(driveShareFiles.id, data.fileId), eq(driveShareFiles.shareId, share.id)))
      .get();
    if (share.kind !== "video" || file?.kind !== "video")
      throw new ValidationError("Video không hợp lệ.");
    const comment = tx
      .insert(driveVideoComments)
      .values({ ...data, id: randomUUID(), shareId: share.id })
      .returning()
      .get();
    audit(tx, share.tenantId, "comment.create", share.id);
    return comment;
  });
}
export function listDriveVideoComments(db: AppDb, principal: DrivePrincipal, id: string) {
  scopedShare(db, principal, id);
  return db
    .select()
    .from(driveVideoComments)
    .where(eq(driveVideoComments.shareId, id))
    .orderBy(asc(driveVideoComments.createdAt))
    .all();
}
export function verifyDrivePin(
  db: AppDb,
  token: string,
  pin: string,
  ip: string,
  now = new Date(),
): boolean {
  const share = getDriveShareByToken(db, token);
  if (!share || share.status !== "active" || (share.expiresAt && share.expiresAt <= now))
    return false;
  if (!share.pinHash) return true;
  return db.transaction(
    (tx) => {
      const identifier = `drive:${share.id}`;
      const filter = and(eq(loginAttempts.identifier, identifier), eq(loginAttempts.ip, ip));
      const failures = tx
        .select({ n: count() })
        .from(loginAttempts)
        .where(
          and(
            filter,
            eq(loginAttempts.success, false),
            gte(loginAttempts.createdAt, new Date(now.getTime() - 900000)),
          ),
        )
        .get()!.n;
      if (failures >= 5) return false;
      const valid = /^\d{6}$/.test(pin) && verifySecret(pin, share.pinHash);
      if (valid) tx.delete(loginAttempts).where(filter).run();
      else
        tx.insert(loginAttempts)
          .values({ id: randomUUID(), identifier, ip, success: false, createdAt: now })
          .run();
      return valid;
    },
    { behavior: "immediate" },
  );
}

export function getDriveGallery(db: AppDb, token: string, pinVerified = false) {
  const share = getDriveShareByToken(db, token);
  if (!share) return null;
  const device = db.select().from(driveDevices).where(eq(driveDevices.id, share.deviceId)).get();
  const online = !!device && isDriveDeviceOnline(device);
  const expired = !!share.expiresAt && share.expiresAt.getTime() <= Date.now();
  const accessGranted = share.status === "active" && !expired && (!share.pinHash || pinVerified);
  const secret = online && accessGranted ? decryptSecret(share.mediaSecret) : null;
  const base = secret ? `${device!.tunnelOrigin}/m/${share.id}/${secret}` : null;
  const selections = accessGranted
    ? db.select().from(driveSelections).where(eq(driveSelections.shareId, share.id)).all()
    : [];
  const selected = new Map(selections.map((item) => [item.fileId, item]));
  const files = accessGranted
    ? db
        .select()
        .from(driveShareFiles)
        .where(eq(driveShareFiles.shareId, share.id))
        .orderBy(asc(driveShareFiles.sortOrder))
        .all()
        .map((file) => ({
          id: file.id,
          name: file.name,
          relPath: file.relPath,
          code: file.code,
          kind: file.kind,
          sizeBytes: file.sizeBytes,
          liked: selected.get(file.id)?.liked ?? false,
          note: selected.get(file.id)?.note ?? "",
          thumb: base ? `${base}/${file.fileKey}/thumb` : null,
          preview: base ? `${base}/${file.fileKey}/preview` : null,
          original: base && share.allowOriginals ? `${base}/${file.fileKey}/original` : null,
          stream: base ? `${base}/${file.fileKey}/stream` : null,
        }))
    : [];
  return {
    id: share.id,
    title: share.title,
    kind: share.kind,
    customerName: share.customerName,
    status: share.status,
    expired,
    pinRequired: !!share.pinHash && !pinVerified,
    accessGranted,
    online,
    allowOriginals: share.allowOriginals,
    maxSelect: share.maxSelect,
    selectionStatus: share.selectionStatus,
    files,
    comments: accessGranted
      ? db
          .select({
            id: driveVideoComments.id,
            fileId: driveVideoComments.fileId,
            seconds: driveVideoComments.seconds,
            author: driveVideoComments.author,
            content: driveVideoComments.content,
          })
          .from(driveVideoComments)
          .where(eq(driveVideoComments.shareId, share.id))
          .orderBy(asc(driveVideoComments.createdAt))
          .all()
      : [],
    zip: secret && share.allowOriginals ? `${device!.tunnelOrigin}/z/${share.id}/${secret}` : null,
  };
}

export type DriveGallery = NonNullable<ReturnType<typeof getDriveGallery>>;

export function recordDriveView(db: AppDb, token: string) {
  const share = getDriveShareByToken(db, token);
  if (share)
    db.update(driveShares)
      .set({ viewCount: sql`${driveShares.viewCount} + 1` })
      .where(eq(driveShares.id, share.id))
      .run();
}
