import crypto from "node:crypto";
import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  albumFolders,
  albums,
  loginAttempts,
  orderStatusHistory,
  orders,
  paymentRequests,
  photoSelections,
  photos,
  tenants,
  type Album,
  type Photo,
} from "../db/schema";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { verifySecret } from "../auth/password";
import { publicUploadUrl } from "../storage/local-storage";
import { hashShareToken } from "../share/token";
import { canTransitionOrder } from "../orders/status";
import {
  SELECTION_STATUS_META,
  type SelectionStatus,
} from "../albums/constants";

const PASSWORD_WINDOW_MINUTES = 15;
const MAX_PASSWORD_FAILURES = 5;
const MAX_PASSWORD_IP_FAILURES = 20;

export type ShareAccessFailure =
  | "not_found"
  | "revoked"
  | "expired"
  | "archived"
  | "password_required";

export type ShareAccessResult =
  | { ok: true; album: Album; isDemo: boolean }
  | { ok: false; reason: ShareAccessFailure };

export type ShareTab = "all" | "selected" | "notes";

export type SharePhotoView = {
  id: string;
  code: string;
  filename: string;
  folderId: string | null;
  folderName: string | null;
  thumbnailUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  isRaw: boolean;
  selected: boolean;
  favorite: boolean;
  note: string | null;
};

export type ShareGalleryPage = {
  album: {
    id: string;
    title: string;
    selectionLimit: number;
    extraPhotoEnabled: boolean;
    extraPhotoPrice: number;
    allowFavorites: boolean;
    allowNotes: boolean;
    allowDownloads: boolean;
    selectionStatus: string;
    downloadLimit: number | null;
    downloadCount: number;
    expiresAt: Date | null;
    hasPassword: boolean;
  };
  isDemo: boolean;
  photos: SharePhotoView[];
  folders: { id: string; name: string; photoCount: number }[];
  counts: {
    all: number;
    selected: number;
    notes: number;
    extraCount: number;
    extraFee: number;
  };
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type ShareCodeItem = {
  code: string;
  filename: string;
  note: string | null;
};

export function getShareSelectedCodes(
  db: AppDb,
  access: Extract<ShareAccessResult, { ok: true }>,
): ShareCodeItem[] {
  return db
    .select({
      code: photos.code,
      filename: photos.filename,
      note: photoSelections.note,
    })
    .from(photoSelections)
    .innerJoin(photos, eq(photoSelections.photoId, photos.id))
    .where(
      and(
        eq(photoSelections.albumId, access.album.id),
        eq(photoSelections.tenantId, access.album.tenantId),
        eq(photoSelections.selected, true),
        eq(photos.status, "ready"),
      ),
    )
    .orderBy(asc(photos.sortOrder), asc(photos.code))
    .all();
}

export type ShareSelectionSummary = {
  selectedCount: number;
  favoriteCount: number;
  noteCount: number;
  extraCount: number;
  extraFee: number;
};

function isDemoAlbum(album: Album): boolean {
  return album.tenantId === "tenant-demo" || album.id === "album-demo-01";
}

function assertShareWindow(album: Album, now: Date = new Date()): void {
  if (album.shareRevokedAt !== null || album.status === "archived") {
    throw new AuthorizationError("Link chia sẻ đã bị thu hồi.");
  }
  if (album.expiresAt && album.expiresAt.getTime() <= now.getTime()) {
    throw new AuthorizationError("Link chia sẻ đã hết hạn.");
  }
}

export function evaluateShareAccess(
  db: AppDb,
  rawToken: string,
  passwordVerified: boolean,
  now: Date = new Date(),
): ShareAccessResult {
  const token = rawToken.trim();
  if (token.length < 10 || token.length > 200) {
    return { ok: false, reason: "not_found" };
  }
  const row = db
    .select({ album: albums, tenantStatus: tenants.status })
    .from(albums)
    .innerJoin(tenants, eq(albums.tenantId, tenants.id))
    .where(eq(albums.token, hashShareToken(token)))
    .get();

  if (!row || row.tenantStatus !== "active") {
    return { ok: false, reason: "not_found" };
  }
  if (row.album.shareRevokedAt !== null) {
    return { ok: false, reason: "revoked" };
  }
  if (row.album.status === "archived") {
    return { ok: false, reason: "archived" };
  }
  if (row.album.expiresAt && row.album.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (row.album.passwordHash && !passwordVerified) {
    return { ok: false, reason: "password_required" };
  }
  return { ok: true, album: row.album, isDemo: isDemoAlbum(row.album) };
}

export function getShareAlbumByToken(
  db: AppDb,
  rawToken: string,
): Album | null {
  const token = rawToken.trim();
  if (!token) return null;
  return (
    db
      .select()
      .from(albums)
      .where(eq(albums.token, hashShareToken(token)))
      .get() ?? null
  );
}

function countsForAlbum(
  db: AppDb,
  album: Album,
): { all: number; selected: number; notes: number } {
  const all =
    db
      .select({ value: count() })
      .from(photos)
      .where(
        and(
          eq(photos.albumId, album.id),
          eq(photos.tenantId, album.tenantId),
          eq(photos.status, "ready"),
        ),
      )
      .get()?.value ?? 0;

  const selected =
    db
      .select({ value: count() })
      .from(photoSelections)
      .where(
        and(
          eq(photoSelections.albumId, album.id),
          eq(photoSelections.tenantId, album.tenantId),
          eq(photoSelections.selected, true),
        ),
      )
      .get()?.value ?? 0;

  const notes =
    db
      .select({ value: count() })
      .from(photoSelections)
      .where(
        and(
          eq(photoSelections.albumId, album.id),
          eq(photoSelections.tenantId, album.tenantId),
          sql`length(trim(coalesce(${photoSelections.note}, ''))) > 0`,
        ),
      )
      .get()?.value ?? 0;

  return { all, selected, notes };
}

export function getShareGalleryPage(
  db: AppDb,
  access: Extract<ShareAccessResult, { ok: true }>,
  input: {
    tab?: string;
    folderId?: string;
    page?: number;
    pageSize?: number;
  },
): ShareGalleryPage {
  const album = access.album;
  const tab: ShareTab =
    input.tab === "selected" || input.tab === "notes" ? input.tab : "all";
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(60, Math.max(6, Math.floor(input.pageSize ?? 24)));

  const conditions = [
    eq(photos.albumId, album.id),
    eq(photos.tenantId, album.tenantId),
    eq(photos.status, "ready"),
  ];
  if (input.folderId) {
    conditions.push(eq(photos.folderId, input.folderId));
  }
  if (tab === "selected") {
    conditions.push(eq(photoSelections.selected, true));
  } else if (tab === "notes") {
    conditions.push(
      sql`length(trim(coalesce(${photoSelections.note}, ''))) > 0`,
    );
  }

  const where = and(...conditions);
  const total =
    db
      .select({ value: count() })
      .from(photos)
      .leftJoin(
        photoSelections,
        and(
          eq(photoSelections.photoId, photos.id),
          eq(photoSelections.tenantId, photos.tenantId),
        ),
      )
      .where(where)
      .get()?.value ?? 0;

  const rows = db
    .select({ photo: photos, selection: photoSelections })
    .from(photos)
    .leftJoin(
      photoSelections,
      and(
        eq(photoSelections.photoId, photos.id),
        eq(photoSelections.tenantId, photos.tenantId),
      ),
    )
    .where(where)
    .orderBy(asc(photos.sortOrder), asc(photos.code))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  const folders = db
    .select()
    .from(albumFolders)
    .where(
      and(
        eq(albumFolders.albumId, album.id),
        eq(albumFolders.tenantId, album.tenantId),
      ),
    )
    .orderBy(asc(albumFolders.sortOrder))
    .all();

  const folderCounts = new Map<string, number>();
  const folderCountRows = db
    .select({ folderId: photos.folderId, value: count() })
    .from(photos)
    .where(
      and(
        eq(photos.albumId, album.id),
        eq(photos.tenantId, album.tenantId),
        eq(photos.status, "ready"),
      ),
    )
    .groupBy(photos.folderId)
    .all();
  for (const row of folderCountRows) {
    if (row.folderId) {
      folderCounts.set(row.folderId, row.value);
    }
  }

  const counts = countsForAlbum(db, album);
  const extraCount = album.extraPhotoEnabled
    ? Math.max(0, counts.selected - album.selectionLimit)
    : 0;

  return {
    album: {
      id: album.id,
      title: album.title,
      selectionLimit: album.selectionLimit,
      extraPhotoEnabled: album.extraPhotoEnabled,
      extraPhotoPrice: album.extraPhotoPrice,
      allowFavorites: album.allowFavorites,
      allowNotes: album.allowNotes,
      allowDownloads: album.allowDownloads,
      selectionStatus: album.selectionStatus,
      downloadLimit: album.downloadLimit,
      downloadCount: album.downloadCount,
      expiresAt: album.expiresAt,
      hasPassword: album.passwordHash !== null,
    },
    isDemo: access.isDemo,
    photos: rows.map((row) => ({
      id: row.photo.id,
      code: row.photo.code,
      filename: row.photo.filename,
      folderId: row.photo.folderId,
      folderName: row.photo.folderId
        ? folders.find((folder) => folder.id === row.photo.folderId)?.name ?? null
        : null,
      thumbnailUrl: publicUploadUrl(row.photo.thumbnailKey),
      previewUrl: publicUploadUrl(row.photo.previewKey),
      width: row.photo.width,
      height: row.photo.height,
      isRaw: row.photo.isRaw,
      selected: row.selection?.selected ?? false,
      favorite: row.selection?.favorite ?? false,
      note: row.selection?.note ?? null,
    })),
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      photoCount: folderCounts.get(folder.id) ?? 0,
    })),
    counts: {
      ...counts,
      extraCount,
      extraFee: extraCount * album.extraPhotoPrice,
    },
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

function currentSelectionSummary(
  db: AppDb,
  album: Album,
): ShareSelectionSummary {
  const rows = db
    .select()
    .from(photoSelections)
    .where(
      and(
        eq(photoSelections.albumId, album.id),
        eq(photoSelections.tenantId, album.tenantId),
      ),
    )
    .all();
  const selectedCount = rows.filter((row) => row.selected).length;
  const extraCount = album.extraPhotoEnabled
    ? Math.max(0, selectedCount - album.selectionLimit)
    : 0;
  return {
    selectedCount,
    favoriteCount: rows.filter((row) => row.favorite).length,
    noteCount: rows.filter((row) => Boolean(row.note?.trim())).length,
    extraCount,
    extraFee: extraCount * album.extraPhotoPrice,
  };
}

function lockForEditing(album: Album): void {
  assertShareWindow(album);
  if (album.selectionStatus === "locked") {
    throw new ValidationError(
      "Studio đã khóa lựa chọn. Vui lòng liên hệ studio nếu cần chỉnh sửa.",
    );
  }
}

export function updateSharePhotoSelection(
  db: AppDb,
  rawToken: string,
  passwordVerified: boolean,
  photoId: string,
  patch: { favorite?: boolean; selected?: boolean; note?: string },
): ShareSelectionSummary {
  const access = evaluateShareAccess(db, rawToken, passwordVerified);
  if (!access.ok) {
    throw new AuthorizationError("Không thể truy cập album chia sẻ này.");
  }

  const summary = db.transaction(
    (tx) => {
      const fresh = tx
        .select()
        .from(albums)
        .where(eq(albums.id, access.album.id))
        .get();
      if (!fresh) throw new NotFoundError("Không tìm thấy album.");
      lockForEditing(fresh);

      const photo = tx
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.id, photoId),
            eq(photos.albumId, fresh.id),
            eq(photos.tenantId, fresh.tenantId),
            eq(photos.status, "ready"),
          ),
        )
        .get();
      if (!photo) {
        throw new NotFoundError("Ảnh không còn trong album.");
      }

      const existing = tx
        .select()
        .from(photoSelections)
        .where(
          and(
            eq(photoSelections.albumId, fresh.id),
            eq(photoSelections.photoId, photoId),
          ),
        )
        .get();

      if (patch.favorite === true && !fresh.allowFavorites) {
        throw new ValidationError("Album này không bật tính năng thả tim.");
      }
      if (patch.note !== undefined && !fresh.allowNotes) {
        throw new ValidationError("Album này không bật ghi chú ảnh.");
      }
      if (patch.note !== undefined && patch.note.trim().length > 500) {
        throw new ValidationError("Ghi chú tối đa 500 ký tự.");
      }

      const nextSelected = patch.selected ?? existing?.selected ?? false;
      if (nextSelected && !(existing?.selected ?? false)) {
        if (!fresh.extraPhotoEnabled) {
          const selectedCount =
            tx
              .select({ value: count() })
              .from(photoSelections)
              .where(
                and(
                  eq(photoSelections.albumId, fresh.id),
                  eq(photoSelections.tenantId, fresh.tenantId),
                  eq(photoSelections.selected, true),
                ),
              )
              .get()?.value ?? 0;
          if (selectedCount >= fresh.selectionLimit) {
            throw new ValidationError(
              `Bạn đã chọn đủ ${fresh.selectionLimit} ảnh. Bỏ chọn một ảnh trước khi chọn ảnh mới.`,
            );
          }
        }
      }

      const nextFavorite = patch.favorite ?? existing?.favorite ?? false;
      const nextNote =
        patch.note !== undefined
          ? patch.note.trim() || null
          : existing?.note ?? null;

      if (!nextFavorite && !nextSelected && !nextNote) {
        if (existing) {
          tx.delete(photoSelections)
            .where(eq(photoSelections.id, existing.id))
            .run();
        }
      } else if (existing) {
        tx.update(photoSelections)
          .set({
            favorite: nextFavorite,
            selected: nextSelected,
            note: nextNote,
            codeSnapshot: photo.code,
            updatedAt: new Date(),
          })
          .where(eq(photoSelections.id, existing.id))
          .run();
      } else {
        tx.insert(photoSelections)
          .values({
            id: crypto.randomUUID(),
            tenantId: fresh.tenantId,
            albumId: fresh.id,
            photoId,
            favorite: nextFavorite,
            selected: nextSelected,
            note: nextNote,
            codeSnapshot: photo.code,
            extraFee: 0,
          })
          .run();
      }

      return currentSelectionSummary(tx, fresh);
    },
    { behavior: "immediate" },
  );

  writeAudit(db, {
    tenantId: access.album.tenantId,
    actorId: null,
    action: "albums.share.selection.update",
    entity: "album",
    entityId: access.album.id,
    metadata: {
      photoId,
      selected: patch.selected,
      favorite: patch.favorite,
      noteChanged: patch.note !== undefined,
    },
  });

  return summary;
}

export type SubmitShareResult = {
  summary: ShareSelectionSummary;
  paymentRequestCode: string | null;
};

export function submitShareSelection(
  db: AppDb,
  rawToken: string,
  passwordVerified: boolean,
): SubmitShareResult {
  const access = evaluateShareAccess(db, rawToken, passwordVerified);
  if (!access.ok) {
    throw new AuthorizationError("Không thể truy cập album chia sẻ này.");
  }

  const result = db.transaction(
    (tx) => {
      const fresh = tx
        .select()
        .from(albums)
        .where(eq(albums.id, access.album.id))
        .get();
      if (!fresh) throw new NotFoundError("Không tìm thấy album.");
      lockForEditing(fresh);

      const selectedRows = tx
        .select({ selection: photoSelections, photo: photos })
        .from(photoSelections)
        .innerJoin(photos, eq(photoSelections.photoId, photos.id))
        .where(
          and(
            eq(photoSelections.albumId, fresh.id),
            eq(photoSelections.tenantId, fresh.tenantId),
            eq(photoSelections.selected, true),
            eq(photos.status, "ready"),
          ),
        )
        .orderBy(asc(photoSelections.createdAt), asc(photos.sortOrder))
        .all();

      if (selectedRows.length === 0) {
        throw new ValidationError("Bạn chưa chọn ảnh nào để gửi studio.");
      }

      const extraCount = fresh.extraPhotoEnabled
        ? Math.max(0, selectedRows.length - fresh.selectionLimit)
        : 0;
      const extraFee = extraCount * fresh.extraPhotoPrice;

      for (const [index, row] of selectedRows.entries()) {
        const fee =
          fresh.extraPhotoEnabled && index >= fresh.selectionLimit
            ? fresh.extraPhotoPrice
            : 0;
        tx.update(photoSelections)
          .set({ extraFee: fee, codeSnapshot: row.photo.code, updatedAt: new Date() })
          .where(eq(photoSelections.id, row.selection.id))
          .run();
      }

      let paymentRequestCode: string | null = null;
      if (extraFee > 0) {
        paymentRequestCode = `PR-EXTRA-${fresh.id.slice(0, 8).toUpperCase()}`;
        const existingRequest = tx
          .select()
          .from(paymentRequests)
          .where(
            and(
              eq(paymentRequests.tenantId, fresh.tenantId),
              eq(paymentRequests.code, paymentRequestCode),
            ),
          )
          .get();
        if (existingRequest) {
          tx.update(paymentRequests)
            .set({
              amount: extraFee,
              status: "pending",
              note: `${extraCount} ảnh vượt quota ${fresh.selectionLimit} ảnh · ${fresh.extraPhotoPrice.toLocaleString("vi-VN")}đ/ảnh`,
              customerId: fresh.customerId,
              orderId: fresh.orderId,
              updatedAt: new Date(),
            })
            .where(eq(paymentRequests.id, existingRequest.id))
            .run();
        } else {
          tx.insert(paymentRequests)
            .values({
              id: crypto.randomUUID(),
              tenantId: fresh.tenantId,
              albumId: fresh.id,
              orderId: fresh.orderId,
              customerId: fresh.customerId,
              code: paymentRequestCode,
              amount: extraFee,
              status: "pending",
              note: `${extraCount} ảnh vượt quota ${fresh.selectionLimit} ảnh · ${fresh.extraPhotoPrice.toLocaleString("vi-VN")}đ/ảnh`,
            })
            .run();
        }
      }

      const now = new Date();
      tx.update(albums)
        .set({
          selectionStatus: "submitted",
          selectionSubmittedAt: now,
          updatedAt: now,
        })
        .where(eq(albums.id, fresh.id))
        .run();

      if (fresh.orderId) {
        const order = tx
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.id, fresh.orderId),
              eq(orders.tenantId, fresh.tenantId),
            ),
          )
          .get();
        if (
          order &&
          order.status === "awaiting_selection" &&
          canTransitionOrder(order.status, "awaiting_approval")
        ) {
          tx.update(orders)
            .set({ status: "awaiting_approval", updatedAt: now })
            .where(eq(orders.id, order.id))
            .run();
          tx.insert(orderStatusHistory)
            .values({
              id: crypto.randomUUID(),
              tenantId: fresh.tenantId,
              orderId: order.id,
              fromStatus: order.status,
              toStatus: "awaiting_approval",
              note: "Khách đã gửi lựa chọn ảnh qua PhotoShare.",
              changedBy: null,
              createdAt: now,
            })
            .run();
        }
      }

      const summary = currentSelectionSummary(tx, fresh);
      return {
        summary: {
          ...summary,
          selectedCount: selectedRows.length,
          extraCount,
          extraFee,
        },
        paymentRequestCode,
      };
    },
    { behavior: "immediate" },
  );

  writeAudit(db, {
    tenantId: access.album.tenantId,
    actorId: null,
    action: "albums.selection.submit",
    entity: "album",
    entityId: access.album.id,
    metadata: {
      selectedCount: result.summary.selectedCount,
      extraCount: result.summary.extraCount,
      extraFee: result.summary.extraFee,
      paymentRequestCode: result.paymentRequestCode,
    },
  });

  return result;
}

function passwordAttemptCount(
  db: AppDb,
  identifier: string,
  ip: string,
  since: Date,
): { identifier: number; ip: number } {
  return {
    identifier:
      db
        .select({ value: count() })
        .from(loginAttempts)
        .where(
          and(
            eq(loginAttempts.identifier, identifier),
            eq(loginAttempts.ip, ip),
            eq(loginAttempts.success, false),
            gte(loginAttempts.createdAt, since),
          ),
        )
        .get()?.value ?? 0,
    ip:
      db
        .select({ value: count() })
        .from(loginAttempts)
        .where(
          and(
            eq(loginAttempts.ip, ip),
            eq(loginAttempts.success, false),
            gte(loginAttempts.createdAt, since),
          ),
        )
        .get()?.value ?? 0,
  };
}

export type SharePasswordResult =
  | {
      ok: true;
      albumId: string;
      tenantId: string;
      tokenHash: string;
      expiresAt: Date | null;
    }
  | { ok: false; error: string };

export function verifySharePassword(
  db: AppDb,
  rawToken: string,
  password: string,
  ip: string,
  now: Date = new Date(),
): SharePasswordResult {
  const album = getShareAlbumByToken(db, rawToken);
  if (!album || !album.passwordHash) {
    return { ok: false, error: "Link hoặc mật khẩu không hợp lệ." };
  }
  if (album.shareRevokedAt || album.status === "archived") {
    return { ok: false, error: "Link chia sẻ đã bị thu hồi." };
  }
  if (album.expiresAt && album.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: "Link chia sẻ đã hết hạn." };
  }

  const identifier = `share:${album.id}`;
  const since = new Date(now.getTime() - PASSWORD_WINDOW_MINUTES * 60 * 1000);
  const attempts = passwordAttemptCount(db, identifier, ip, since);
  if (
    attempts.identifier >= MAX_PASSWORD_FAILURES ||
    attempts.ip >= MAX_PASSWORD_IP_FAILURES
  ) {
    return {
      ok: false,
      error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.",
    };
  }

  const valid = verifySecret(password, album.passwordHash);

  db.insert(loginAttempts)
    .values({
      id: crypto.randomUUID(),
      identifier,
      ip,
      success: valid,
      createdAt: now,
    })
    .run();

  writeAudit(db, {
    tenantId: album.tenantId,
    actorId: null,
    action: valid ? "albums.share.password.success" : "albums.share.password.failed",
    entity: "album",
    entityId: album.id,
    metadata: { ip },
  });

  if (!valid) {
    return { ok: false, error: "Mật khẩu không đúng." };
  }

  return {
    ok: true,
    albumId: album.id,
    tenantId: album.tenantId,
    tokenHash: album.token,
    expiresAt: album.expiresAt,
  };
}

export function shareSelectionLabel(status: string): string {
  return (
    SELECTION_STATUS_META[status as SelectionStatus]?.label ?? "Không xác định"
  );
}

export function authorizeShareDownload(
  db: AppDb,
  rawToken: string,
  passwordVerified: boolean,
  photoId: string,
): { album: Album; photo: Photo } {
  const access = evaluateShareAccess(db, rawToken, passwordVerified);
  if (!access.ok) {
    throw new AuthorizationError("Không thể tải ảnh từ album này.");
  }
  if (!access.album.allowDownloads) {
    throw new AuthorizationError("Album không cho phép tải ảnh gốc.");
  }

  const result = db.transaction(
    (tx) => {
      const fresh = tx
        .select()
        .from(albums)
        .where(eq(albums.id, access.album.id))
        .get();
      if (!fresh) throw new NotFoundError("Không tìm thấy album.");
      assertShareWindow(fresh);

      const photo = tx
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.id, photoId),
            eq(photos.albumId, fresh.id),
            eq(photos.tenantId, fresh.tenantId),
            eq(photos.status, "ready"),
          ),
        )
        .get();
      if (!photo) {
        throw new NotFoundError("Ảnh không còn trong album.");
      }

      if (
        fresh.downloadLimit !== null &&
        fresh.downloadCount >= fresh.downloadLimit
      ) {
        throw new ValidationError(
          `Album đã đạt giới hạn ${fresh.downloadLimit} lượt tải.`,
        );
      }

      tx.update(albums)
        .set({
          downloadCount: fresh.downloadCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(albums.id, fresh.id))
        .run();

      return { album: fresh, photo };
    },
    { behavior: "immediate" },
  );

  writeAudit(db, {
    tenantId: result.album.tenantId,
    actorId: null,
    action: "albums.share.download",
    entity: "album",
    entityId: result.album.id,
    metadata: { photoId, code: result.photo.code },
  });

  return result;
}
