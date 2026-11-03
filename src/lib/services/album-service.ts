import crypto from "node:crypto";
import { and, asc, count, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  albumFolders,
  albums,
  albumSources,
  branches,
  customers,
  orders,
  paymentRequests,
  photoSelections,
  photos,
  staff,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import {
  assertBranchAccess,
  assertPermission,
  getBranchScope,
} from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { hashSecret } from "../auth/password";
import { getEnv } from "../env";
import {
  DEMO_DRIVE_ROOT,
  publicUploadUrl,
  resolveStoragePath,
  sanitizeSegment,
} from "../storage/local-storage";
import {
  ALBUM_STATUS_META,
  canTransitionAlbum,
  isAlbumStatus,
  type AlbumStatus,
  type AlbumSourceType,
} from "../albums/constants";
import { createShareTokenRecord, revealShareToken } from "../share/token";
import {
  demoDriveFilePath,
  demoPhotoPreviewKey,
  demoPhotoStorageKey,
  demoPhotoThumbnailKey,
  DEMO_ALBUM,
} from "../demo-album";
import {
  googleDriveConfigured,
  parseDriveFolderLink,
  scanLocalDemoDrive,
  type LocalDemoScan,
  type ParsedDriveLink,
} from "../adapters/drive";
import { getStorageAdapter } from "../adapters/storage";
import {
  downloadGoogleFile,
  getGoogleConnection,
  scanGoogleDriveFolder,
  type GoogleDriveScan,
} from "./drive-connection-service";

export type AlbumListFilters = {
  q?: string;
  status?: string;
  branchId?: string;
  customerId?: string;
  orderId?: string;
  page: number;
  pageSize: number;
};

export type AlbumListItem = {
  id: string;
  title: string;
  status: string;
  selectionStatus: string;
  branchName: string;
  customerName: string | null;
  orderCode: string | null;
  photoCount: number;
  selectedCount: number;
  selectionLimit: number;
  extraPhotoEnabled: boolean;
  extraPhotoPrice: number;
  createdAt: Date;
  expiresAt: Date | null;
  shareRevoked: boolean;
};

export type AlbumFolderView = {
  id: string;
  name: string;
  relativePath: string;
  photoCount: number;
};

export type AlbumSourceView = {
  id: string;
  provider: string;
  sourceUrl: string | null;
  externalFolderId: string | null;
  displayName: string | null;
  status: string;
  lastSyncedAt: Date | null;
  error: string | null;
};

export type AlbumPhotoView = {
  id: string;
  folderId: string | null;
  folderName: string | null;
  code: string;
  filename: string;
  relativePath: string;
  thumbnailUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  size: number;
  isRaw: boolean;
  status: string;
  sortOrder: number;
  selected: boolean;
  favorite: boolean;
  note: string | null;
  extraFee: number;
  selectedAt: Date | null;
};

export type AlbumPaymentRequestView = {
  id: string;
  code: string;
  amount: number;
  status: string;
  note: string | null;
  createdAt: Date;
};

export type AlbumDetail = {
  id: string;
  title: string;
  status: string;
  selectionStatus: string;
  branchId: string;
  branchName: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  orderId: string | null;
  orderCode: string | null;
  orderStatus: string | null;
  sourceType: string;
  sourceUrl: string | null;
  driveFolderId: string | null;
  recursiveScan: boolean;
  selectionLimit: number;
  extraPhotoEnabled: boolean;
  extraPhotoPrice: number;
  allowFavorites: boolean;
  allowNotes: boolean;
  allowDownloads: boolean;
  downloadLimit: number | null;
  downloadCount: number;
  expiresAt: Date | null;
  shareRevokedAt: Date | null;
  hasPassword: boolean;
  selectionSubmittedAt: Date | null;
  selectionLockedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  createdByName: string;
  shareLink: string | null;
  photos: AlbumPhotoView[];
  folders: AlbumFolderView[];
  sources: AlbumSourceView[];
  paymentRequests: AlbumPaymentRequestView[];
  stats: {
    photoCount: number;
    selectedCount: number;
    favoriteCount: number;
    noteCount: number;
    extraCount: number;
    extraFee: number;
    missingCount: number;
  };
};

export type CreateAlbumInput = {
  branchId: string;
  customerId: string;
  orderId: string;
  title: string;
  notes: string;
  sourceType: AlbumSourceType;
  sourceUrl: string;
  sourceUrls: string;
  selectionLimit: number;
  extraPhotoEnabled: boolean;
  extraPhotoPrice: number;
  allowFavorites: boolean;
  allowNotes: boolean;
  allowDownloads: boolean;
  downloadLimit: number | null;
  password: string;
  expiresAt: string;
};

export type UpdateAlbumInput = {
  title: string;
  customerId: string;
  orderId: string;
  notes: string;
  selectionLimit: number;
  extraPhotoEnabled: boolean;
  extraPhotoPrice: number;
  allowFavorites: boolean;
  allowNotes: boolean;
  allowDownloads: boolean;
  downloadLimit: number | null;
  expiresAt: string;
  password: string;
  clearPassword: boolean;
};

export type CreateAlbumResult = {
  albumId: string;
  rawToken: string;
  importedPhotos: number;
};

function uniqueCode(base: string, used: Set<string>): string {
  const normalized = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "ANH";
  let candidate = normalized;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${normalized}-${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function parseOptionalDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ValidationError("Ngày hết hạn phải có định dạng YYYY-MM-DD.");
  }
  const date = new Date(`${trimmed}T23:59:59+07:00`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Ngày hết hạn không hợp lệ.");
  }
  return date;
}

function validateCommon(input: {
  title: string;
  selectionLimit: number;
  extraPhotoEnabled: boolean;
  extraPhotoPrice: number;
  downloadLimit: number | null;
}): void {
  if (!input.title.trim()) {
    throw new ValidationError("Tiêu đề album là bắt buộc.");
  }
  if (input.title.trim().length > 160) {
    throw new ValidationError("Tiêu đề album tối đa 160 ký tự.");
  }
  if (!Number.isInteger(input.selectionLimit) || input.selectionLimit < 1 || input.selectionLimit > 1000) {
    throw new ValidationError("Số ảnh khách được chọn phải từ 1 đến 1000.");
  }
  if (input.extraPhotoEnabled && (!Number.isInteger(input.extraPhotoPrice) || input.extraPhotoPrice < 0)) {
    throw new ValidationError("Đơn giá ảnh thêm không hợp lệ.");
  }
  if (input.downloadLimit !== null && (!Number.isInteger(input.downloadLimit) || input.downloadLimit < 1)) {
    throw new ValidationError("Giới hạn tải phải là số nguyên dương.");
  }
}

function assertCustomerAndOrder(
  db: AppDb,
  actor: ActorContext,
  input: { customerId: string; orderId: string; branchId: string },
): void {
  if (input.customerId) {
    const customer = db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, input.customerId), eq(customers.tenantId, actor.tenantId)))
      .get();
    if (!customer) {
      throw new ValidationError("Khách hàng không thuộc studio hiện tại.");
    }
  }

  if (input.orderId) {
    const order = db
      .select({ id: orders.id, customerId: orders.customerId, branchId: orders.branchId })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)))
      .get();
    if (!order) {
      throw new ValidationError("Đơn hàng không thuộc studio hiện tại.");
    }
    if (order.branchId !== input.branchId) {
      throw new ValidationError("Đơn hàng không thuộc chi nhánh đã chọn.");
    }
    if (input.customerId && order.customerId !== input.customerId) {
      throw new ValidationError("Đơn hàng không thuộc khách hàng đã chọn.");
    }
  }
}

export function parseSourceLinks(
  sourceType: AlbumSourceType,
  sourceUrl: string,
  sourceUrls: string,
): ParsedDriveLink[] {
  const rawLinks =
    sourceType === "multi_link"
      ? sourceUrls
          .split(/[\n,]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : sourceUrl.trim()
        ? [sourceUrl.trim()]
        : [];

  if (sourceType === "upload") {
    return [];
  }

  if (rawLinks.length === 0) {
    throw new ValidationError("Vui lòng nhập link thư mục Drive/NAS.");
  }

  const parsed: ParsedDriveLink[] = [];
  for (const raw of rawLinks) {
    const link = parseDriveFolderLink(raw);
    if (!link) {
      throw new ValidationError(
        `Link không hợp lệ hoặc không thuộc domain Google Drive được phép: ${raw}`,
      );
    }
    parsed.push(link);
  }
  return parsed;
}

export type AlbumSourcePreview = {
  sourceCount: number;
  photoCount: number;
  folders: { name: string; photoCount: number }[];
  files: { filename: string; folderName: string }[];
};

export async function previewAlbumSource(
  db: AppDb,
  actor: ActorContext,
  input: { sourceType: AlbumSourceType; sourceUrl: string; sourceUrls: string },
): Promise<AlbumSourcePreview> {
  assertPermission(actor, "albums.manage");
  const links = parseSourceLinks(input.sourceType, input.sourceUrl, input.sourceUrls);
  if (links.length === 0) {
    throw new ValidationError("Chưa có link Drive/NAS để quét.");
  }
  const folders: { name: string; photoCount: number }[] = [];
  const files: { filename: string; folderName: string }[] = [];
  for (const link of links) {
    if (link.provider === "google") {
      ensureGoogleDriveReady(db, actor);
      const scan = await scanGoogleDriveFolder(db, actor, link.folderId, {
        recursive: true,
      });
      folders.push(
        ...scan.folders.map((folder) => ({
          name: folder.name,
          photoCount: scan.files.filter(
            (file) => file.folderId === folder.id,
          ).length,
        })),
      );
      if (
        scan.files.some((file) => file.folderId === scan.folderId)
      ) {
        folders.push({
          name: scan.folderName,
          photoCount: scan.files.filter(
            (file) => file.folderId === scan.folderId,
          ).length,
        });
      }
      files.push(
        ...scan.files.slice(0, 6).map((file) => ({
          filename: file.name,
          folderName: file.folderName,
        })),
      );
      continue;
    }
    const scan = scanLocalDemoDrive(link.folderId);
    folders.push(
      ...scan.folders.map((folder) => ({
        name: folder.name,
        photoCount: folder.photoCount,
      })),
    );
    files.push(
      ...scan.files.slice(0, 6).map((file) => ({
        filename: file.filename,
        folderName: file.folderName,
      })),
    );
  }
  return {
    sourceCount: links.length,
    photoCount: folders.reduce((total, folder) => total + folder.photoCount, 0),
    folders,
    files: files.slice(0, 12),
  };
}

function ensureGoogleDriveReady(db: AppDb, actor: ActorContext): void {
  if (!googleDriveConfigured()) {
    throw new ValidationError(
      "Google Drive OAuth chưa được cấu hình. Dùng link demo-folder-1 hoặc đặt GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.",
    );
  }
  if (!getGoogleConnection(db, actor.tenantId)) {
    throw new ValidationError(
      "Chưa kết nối Google Drive. Vào Tích hợp Drive/NAS để cấp quyền OAuth.",
    );
  }
}

type PreparedPhoto = {
  folderKey: string;
  folderExternalId: string;
  code: string;
  filename: string;
  relativePath: string;
  storageKey: string;
  thumbnailKey: string;
  previewKey: string;
  sourceFileId: string;
  width: number;
  height: number;
  size: number;
  isRaw: boolean;
  checksum: string;
  sortOrder: number;
};

type LocalScanEntry = {
  kind: "local";
  link: ParsedDriveLink;
  scan: LocalDemoScan;
};

type GoogleScanEntry = {
  kind: "google";
  link: ParsedDriveLink;
  scan: GoogleDriveScan;
};

type PreparedScan = LocalScanEntry | GoogleScanEntry;

type PreparedImport = {
  scans: PreparedScan[];
  photos: PreparedPhoto[];
  folders: {
    sourceIndex: number;
    externalId: string;
    key: string;
    name: string;
    relativePath: string;
    photoCount: number;
  }[];
};

async function prepareDemoImport(
  scans: LocalScanEntry[],
  tenantId: string,
  albumId: string,
): Promise<PreparedImport> {
  const usedCodes = new Set<string>();
  const seenSourceIds = new Set<string>();
  const seenChecksums = new Set<string>();
  const preparedPhotos: PreparedPhoto[] = [];
  const folders: PreparedImport["folders"] = [];

  for (const [sourceIndex, item] of scans.entries()) {
    for (const folder of item.scan.folders) {
      folders.push({
        sourceIndex,
        externalId: folder.externalId,
        key: folder.key,
        name: folder.name,
        relativePath: folder.relativePath,
        photoCount: folder.photoCount,
      });
    }

    for (const file of item.scan.files) {
      if (seenSourceIds.has(file.sourceFileId) || seenChecksums.has(file.checksum)) {
        continue;
      }
      seenSourceIds.add(file.sourceFileId);
      seenChecksums.add(file.checksum);

      const demoPhoto = DEMO_ALBUM.photos.find(
        (photo) => photo.filename === file.filename,
      );
      const folderKey = demoPhoto?.folder ?? file.folderKey;
      let storageKey: string;
      let thumbnailKey: string;
      let previewKey: string;
      let width = 1200;
      let height = 800;

      if (demoPhoto) {
        storageKey = demoPhotoStorageKey(demoPhoto.folder, file.filename);
        thumbnailKey = demoPhotoThumbnailKey(demoPhoto.folder, file.filename);
        previewKey = demoPhotoPreviewKey(demoPhoto.folder, file.filename);
      } else {
        const sourcePath = resolveStoragePath(
          demoDriveFilePath(folderKey, file.filename),
          DEMO_DRIVE_ROOT,
        );
        const { readFileSync } = await import("node:fs");
        const processed = await getStorageAdapter().processImage(
          readFileSync(sourcePath),
          `${tenantId}/${albumId}/import-${file.checksum.slice(0, 8)}`,
        );
        storageKey = processed.storageKey;
        thumbnailKey = processed.thumbnailKey;
        previewKey = processed.previewKey;
        width = processed.width;
        height = processed.height;
      }

      const baseCode = file.filename.replace(/\.[^.]+$/, "");
      preparedPhotos.push({
        folderKey,
        folderExternalId: file.folderExternalId,
        code: uniqueCode(baseCode, usedCodes),
        filename: file.filename,
        relativePath: file.relativePath,
        storageKey,
        thumbnailKey,
        previewKey,
        sourceFileId: file.sourceFileId,
        width,
        height,
        size: file.size,
        isRaw: demoPhoto?.isRaw ?? file.isRaw,
        checksum: file.checksum,
        sortOrder: preparedPhotos.length,
      });
    }
  }

  return { scans, photos: preparedPhotos, folders };
}

async function prepareGoogleImport(
  db: AppDb,
  scans: GoogleScanEntry[],
  tenantId: string,
  albumId: string,
): Promise<PreparedImport> {
  const usedCodes = new Set<string>();
  const seenSourceIds = new Set<string>();
  const seenChecksums = new Set<string>();
  const preparedPhotos: PreparedPhoto[] = [];
  const folders: PreparedImport["folders"] = [];
  const storage = getStorageAdapter();

  for (const [sourceIndex, item] of scans.entries()) {
    const countedFolders = new Map<string, number>();
    for (const file of item.scan.files) {
      if (seenSourceIds.has(file.sourceFileId)) continue;
      if (file.checksum && seenChecksums.has(file.checksum)) continue;
      countedFolders.set(
        file.folderId,
        (countedFolders.get(file.folderId) ?? 0) + 1,
      );
    }

    for (const folder of item.scan.folders) {
      folders.push({
        sourceIndex,
        externalId: folder.id,
        key: folder.id,
        name: folder.name,
        relativePath: folder.relativePath,
        photoCount: countedFolders.get(folder.id) ?? 0,
      });
    }
    const rootCount = countedFolders.get(item.scan.folderId) ?? 0;
    if (rootCount > 0) {
      folders.push({
        sourceIndex,
        externalId: item.scan.folderId,
        key: item.scan.folderId,
        name: item.scan.folderName,
        relativePath: "",
        photoCount: rootCount,
      });
    }

    for (const file of item.scan.files) {
      if (seenSourceIds.has(file.sourceFileId)) continue;
      if (file.checksum && seenChecksums.has(file.checksum)) continue;
      seenSourceIds.add(file.sourceFileId);
      if (file.checksum) seenChecksums.add(file.checksum);

      let buffer: Buffer;
      try {
        buffer = await downloadGoogleFile(db, tenantId, file.id);
      } catch (error) {
        throw new ValidationError(
          `Không tải được "${file.name}" từ Google Drive: ${
            error instanceof Error ? error.message : "lỗi không xác định"
          }`,
        );
      }
      let processed;
      try {
        processed = await storage.processImage(
          buffer,
          `${tenantId}/${albumId}/google-${file.id}`,
        );
      } catch (error) {
        throw new ValidationError(
          `Ảnh "${file.name}" không hợp lệ hoặc quá lớn: ${
            error instanceof Error ? error.message : "không xử lý được"
          }`,
        );
      }

      preparedPhotos.push({
        folderKey: file.folderId,
        folderExternalId: file.folderId,
        code: uniqueCode(file.name.replace(/\.[^.]+$/, ""), usedCodes),
        filename: file.name,
        relativePath: file.relativePath,
        storageKey: processed.storageKey,
        thumbnailKey: processed.thumbnailKey,
        previewKey: processed.previewKey,
        sourceFileId: file.sourceFileId,
        width: processed.width || file.width,
        height: processed.height || file.height,
        size: processed.size,
        isRaw: false,
        checksum: file.checksum || processed.checksum,
        sortOrder: preparedPhotos.length,
      });
    }
  }

  return { scans, photos: preparedPhotos, folders };
}

export function listAlbums(
  db: AppDb,
  actor: ActorContext,
  filters: AlbumListFilters,
): { items: AlbumListItem[]; total: number; page: number; pageSize: number } {
  assertPermission(actor, "albums.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") {
    return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }

  const conditions: SQL[] = [eq(albums.tenantId, actor.tenantId)];
  if (scope.mode === "branch") {
    conditions.push(eq(albums.branchId, scope.branchId));
  } else if (filters.branchId) {
    conditions.push(eq(albums.branchId, filters.branchId));
  }
  if (filters.status && isAlbumStatus(filters.status)) {
    conditions.push(eq(albums.status, filters.status));
  }
  if (filters.customerId) {
    conditions.push(eq(albums.customerId, filters.customerId));
  }
  if (filters.orderId) {
    conditions.push(eq(albums.orderId, filters.orderId));
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().toLowerCase()}%`;
    const search = or(
      sql`lower(${albums.title}) like ${term}`,
      sql`lower(coalesce(${customers.name}, '')) like ${term}`,
      sql`lower(coalesce(${orders.code}, '')) like ${term}`,
    );
    if (search) conditions.push(search);
  }

  const where = and(...conditions);
  const total =
    db
      .select({ value: count() })
      .from(albums)
      .leftJoin(customers, eq(albums.customerId, customers.id))
      .leftJoin(orders, eq(albums.orderId, orders.id))
      .where(where)
      .get()?.value ?? 0;

  const rows = db
    .select({
      id: albums.id,
      title: albums.title,
      status: albums.status,
      selectionStatus: albums.selectionStatus,
      branchName: branches.name,
      customerName: customers.name,
      orderCode: orders.code,
      selectionLimit: albums.selectionLimit,
      extraPhotoEnabled: albums.extraPhotoEnabled,
      extraPhotoPrice: albums.extraPhotoPrice,
      createdAt: albums.createdAt,
      expiresAt: albums.expiresAt,
      shareRevoked: albums.shareRevokedAt,
    })
    .from(albums)
    .innerJoin(branches, eq(albums.branchId, branches.id))
    .leftJoin(customers, eq(albums.customerId, customers.id))
    .leftJoin(orders, eq(albums.orderId, orders.id))
    .where(where)
    .orderBy(desc(albums.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .all();

  const ids = rows.map((row) => row.id);
  const photoCounts = new Map<string, number>();
  const selectedCounts = new Map<string, number>();
  if (ids.length > 0) {
    const photoRows = db
      .select({ albumId: photos.albumId, value: count() })
      .from(photos)
      .where(and(inArray(photos.albumId, ids), ne(photos.status, "missing")))
      .groupBy(photos.albumId)
      .all();
    for (const row of photoRows) {
      photoCounts.set(row.albumId, row.value);
    }

    const selectionRows = db
      .select({ albumId: photoSelections.albumId, value: count() })
      .from(photoSelections)
      .where(
        and(inArray(photoSelections.albumId, ids), eq(photoSelections.selected, true)),
      )
      .groupBy(photoSelections.albumId)
      .all();
    for (const row of selectionRows) {
      selectedCounts.set(row.albumId, row.value);
    }
  }

  return {
    items: rows.map((row) => ({
      ...row,
      photoCount: photoCounts.get(row.id) ?? 0,
      selectedCount: selectedCounts.get(row.id) ?? 0,
      shareRevoked: row.shareRevoked !== null,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function getAlbumDetail(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
): AlbumDetail {
  assertPermission(actor, "albums.view");
  const row = db
    .select({
      album: albums,
      branchName: branches.name,
      customerName: customers.name,
      customerPhone: customers.phone,
      orderCode: orders.code,
      orderStatus: orders.status,
    })
    .from(albums)
    .innerJoin(branches, eq(albums.branchId, branches.id))
    .leftJoin(customers, eq(albums.customerId, customers.id))
    .leftJoin(orders, eq(albums.orderId, orders.id))
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();

  if (!row) {
    throw new NotFoundError("Không tìm thấy album.");
  }
  assertBranchAccess(actor, row.album.branchId);

  const creator = db
    .select({ name: staff.name })
    .from(staff)
    .where(eq(staff.id, row.album.createdBy))
    .get();

  const folderRows = db
    .select()
    .from(albumFolders)
    .where(
      and(
        eq(albumFolders.albumId, albumId),
        eq(albumFolders.tenantId, actor.tenantId),
      ),
    )
    .orderBy(asc(albumFolders.sortOrder))
    .all();

  const folderNames = new Map(folderRows.map((folder) => [folder.id, folder.name]));

  const photoRows = db
    .select()
    .from(photos)
    .where(and(eq(photos.albumId, albumId), eq(photos.tenantId, actor.tenantId)))
    .orderBy(asc(photos.sortOrder), asc(photos.code))
    .all();

  const selectionRows = db
    .select()
    .from(photoSelections)
    .where(
      and(
        eq(photoSelections.albumId, albumId),
        eq(photoSelections.tenantId, actor.tenantId),
      ),
    )
    .all();
  const selectionByPhoto = new Map(
    selectionRows.map((selection) => [selection.photoId, selection]),
  );

  const sourceRows = db
    .select()
    .from(albumSources)
    .where(
      and(
        eq(albumSources.albumId, albumId),
        eq(albumSources.tenantId, actor.tenantId),
      ),
    )
    .orderBy(asc(albumSources.createdAt))
    .all();

  const requestRows = db
    .select()
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.albumId, albumId),
        eq(paymentRequests.tenantId, actor.tenantId),
      ),
    )
    .orderBy(desc(paymentRequests.createdAt))
    .all();

  const photoViews: AlbumPhotoView[] = photoRows.map((photo) => {
    const selection = selectionByPhoto.get(photo.id);
    return {
      id: photo.id,
      folderId: photo.folderId,
      folderName: photo.folderId ? folderNames.get(photo.folderId) ?? null : null,
      code: photo.code,
      filename: photo.filename,
      relativePath: photo.relativePath,
      thumbnailUrl: publicUploadUrl(photo.thumbnailKey),
      previewUrl: publicUploadUrl(photo.previewKey),
      width: photo.width,
      height: photo.height,
      size: photo.size,
      isRaw: photo.isRaw,
      status: photo.status,
      sortOrder: photo.sortOrder,
      selected: selection?.selected ?? false,
      favorite: selection?.favorite ?? false,
      note: selection?.note ?? null,
      extraFee: selection?.extraFee ?? 0,
      selectedAt:
        selection?.selected === true ? selection.updatedAt : null,
    };
  });

  const selected = photoViews.filter((photo) => photo.selected);
  const extraCount = Math.max(0, selected.length - row.album.selectionLimit);
  const rawToken = revealShareToken(row.album.tokenEncrypted);
  const shareLink = rawToken
    ? `${getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/share/${rawToken}`
    : null;

  return {
    id: row.album.id,
    title: row.album.title,
    status: row.album.status,
    selectionStatus: row.album.selectionStatus,
    branchId: row.album.branchId,
    branchName: row.branchName,
    customerId: row.album.customerId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    orderId: row.album.orderId,
    orderCode: row.orderCode,
    orderStatus: row.orderStatus,
    sourceType: row.album.sourceType,
    sourceUrl: row.album.sourceUrl,
    driveFolderId: row.album.driveFolderId,
    recursiveScan: row.album.recursiveScan,
    selectionLimit: row.album.selectionLimit,
    extraPhotoEnabled: row.album.extraPhotoEnabled,
    extraPhotoPrice: row.album.extraPhotoPrice,
    allowFavorites: row.album.allowFavorites,
    allowNotes: row.album.allowNotes,
    allowDownloads: row.album.allowDownloads,
    downloadLimit: row.album.downloadLimit,
    downloadCount: row.album.downloadCount,
    expiresAt: row.album.expiresAt,
    shareRevokedAt: row.album.shareRevokedAt,
    hasPassword: row.album.passwordHash !== null,
    selectionSubmittedAt: row.album.selectionSubmittedAt,
    selectionLockedAt: row.album.selectionLockedAt,
    notes: row.album.notes,
    createdAt: row.album.createdAt,
    createdByName: creator?.name ?? "Không xác định",
    shareLink,
    photos: photoViews,
    folders: folderRows.map((folder) => ({
      id: folder.id,
      name: folder.name,
      relativePath: folder.relativePath,
      photoCount: folder.photoCount,
    })),
    sources: sourceRows.map((source) => ({
      id: source.id,
      provider: source.provider,
      sourceUrl: source.sourceUrl,
      externalFolderId: source.externalFolderId,
      displayName: source.displayName,
      status: source.status,
      lastSyncedAt: source.lastSyncedAt,
      error: source.error,
    })),
    paymentRequests: requestRows.map((request) => ({
      id: request.id,
      code: request.code,
      amount: request.amount,
      status: request.status,
      note: request.note,
      createdAt: request.createdAt,
    })),
    stats: {
      photoCount: photoViews.filter((photo) => photo.status !== "missing").length,
      selectedCount: selected.length,
      favoriteCount: photoViews.filter((photo) => photo.favorite).length,
      noteCount: photoViews.filter((photo) => Boolean(photo.note?.trim())).length,
      extraCount: row.album.extraPhotoEnabled ? extraCount : 0,
      extraFee: row.album.extraPhotoEnabled
        ? extraCount * row.album.extraPhotoPrice
        : 0,
      missingCount: photoViews.filter((photo) => photo.status === "missing").length,
    },
  };
}

export async function createAlbum(
  db: AppDb,
  actor: ActorContext,
  input: CreateAlbumInput,
): Promise<CreateAlbumResult> {
  assertPermission(actor, "albums.manage");
  assertBranchAccess(actor, input.branchId);
  validateCommon(input);
  assertCustomerAndOrder(db, actor, input);

  const albumId = crypto.randomUUID();
  const tokenRecord = createShareTokenRecord();
  const links = parseSourceLinks(input.sourceType, input.sourceUrl, input.sourceUrls);

  const localScans: LocalScanEntry[] = [];
  const googleScans: GoogleScanEntry[] = [];
  for (const link of links) {
    if (link.provider === "google") {
      ensureGoogleDriveReady(db, actor);
      try {
        googleScans.push({
          kind: "google",
          link,
          scan: await scanGoogleDriveFolder(db, actor, link.folderId, {
            recursive: true,
            force: true,
          }),
        });
      } catch (error) {
        throw new ValidationError(
          error instanceof Error ? error.message : "Không quét được Google Drive.",
        );
      }
      continue;
    }
    try {
      localScans.push({
        kind: "local",
        link,
        scan: scanLocalDemoDrive(link.folderId),
      });
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : "Không quét được thư mục Drive.",
      );
    }
  }
  if (localScans.length > 0 && googleScans.length > 0) {
    throw new ValidationError(
      "Một album không trộn nguồn Drive demo local và Google Drive live. Tạo hai album riêng.",
    );
  }
  const scans: PreparedScan[] =
    googleScans.length > 0 ? googleScans : localScans;
  const prepared =
    googleScans.length > 0
      ? await prepareGoogleImport(db, googleScans, actor.tenantId, albumId)
      : await prepareDemoImport(localScans, actor.tenantId, albumId);
  const passwordHash = input.password.trim()
    ? hashSecret(input.password.trim())
    : null;
  const expiresAt = parseOptionalDate(input.expiresAt);

  db.transaction((tx) => {
    tx.insert(albums)
      .values({
        id: albumId,
        tenantId: actor.tenantId,
        branchId: input.branchId,
        orderId: input.orderId || null,
        customerId: input.customerId || null,
        title: input.title.trim(),
        sourceType: input.sourceType,
        sourceUrl:
          input.sourceType === "multi_link"
            ? input.sourceUrls.trim() || null
            : input.sourceUrl.trim() || null,
        driveFolderId: links[0]?.folderId ?? null,
        recursiveScan: true,
        selectionLimit: input.selectionLimit,
        extraPhotoEnabled: input.extraPhotoEnabled,
        extraPhotoPrice: input.extraPhotoEnabled ? input.extraPhotoPrice : 0,
        allowFavorites: input.allowFavorites,
        allowNotes: input.allowNotes,
        selectionStatus: "draft",
        token: tokenRecord.tokenHash,
        tokenEncrypted: tokenRecord.tokenEncrypted,
        passwordHash,
        expiresAt,
        downloadLimit: input.downloadLimit,
        allowDownloads: input.allowDownloads,
        status: prepared.photos.length > 0 ? "ready" : "draft",
        notes: input.notes.trim() || null,
        createdBy: actor.staffId,
      })
      .run();

    const sourceIds: string[] = [];
    for (const item of scans) {
      const sourceId = crypto.randomUUID();
      sourceIds.push(sourceId);
      tx.insert(albumSources)
        .values({
          id: sourceId,
          tenantId: actor.tenantId,
          albumId,
          provider: item.link.provider,
          sourceUrl: item.link.normalizedUrl,
          externalFolderId: item.link.folderId,
          displayName: item.scan.folderName,
          recursive: true,
          status: "synced",
          lastSyncedAt: new Date(),
          error: null,
        })
        .run();
    }

    const folderIds = new Map<string, string>();
    for (const folder of prepared.folders) {
      const sourceId = sourceIds[folder.sourceIndex];
      if (!sourceId) continue;
      const folderId = crypto.randomUUID();
      folderIds.set(`${sourceId}:${folder.key}`, folderId);
      folderIds.set(`${folder.sourceIndex}:${folder.key}`, folderId);
      tx.insert(albumFolders)
        .values({
          id: folderId,
          tenantId: actor.tenantId,
          albumId,
          sourceId,
          externalId: folder.externalId,
          name: folder.name,
          relativePath: folder.relativePath,
          photoCount: folder.photoCount,
          sortOrder: prepared.folders.findIndex(
            (item) =>
              item.sourceIndex === folder.sourceIndex && item.key === folder.key,
          ),
        })
        .run();
    }

    for (const photo of prepared.photos) {
      const scanIndex = prepared.scans.findIndex((item) =>
        item.scan.files.some(
          (file) =>
            file.sourceFileId === photo.sourceFileId ||
            file.checksum === photo.checksum,
        ),
      );
      const folderId =
        folderIds.get(`${scanIndex}:${photo.folderKey}`) ??
        folderIds.get(`${photo.folderExternalId}`) ??
        null;
      tx.insert(photos)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          albumId,
          folderId,
          code: photo.code,
          filename: photo.filename,
          relativePath: photo.relativePath,
          storageKey: photo.storageKey,
          thumbnailKey: photo.thumbnailKey,
          previewKey: photo.previewKey,
          sourceFileId: photo.sourceFileId,
          width: photo.width,
          height: photo.height,
          size: photo.size,
          isRaw: photo.isRaw,
          checksum: photo.checksum,
          watermarked: true,
          status: "ready",
          sortOrder: photo.sortOrder,
        })
        .run();
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "albums.create",
    entity: "album",
    entityId: albumId,
    metadata: {
      title: input.title.trim(),
      sourceType: input.sourceType,
      importedPhotos: prepared.photos.length,
    },
  });

  return {
    albumId,
    rawToken: tokenRecord.rawToken,
    importedPhotos: prepared.photos.length,
  };
}

export function updateAlbum(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
  input: UpdateAlbumInput,
): void {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);
  validateCommon(input);
  assertCustomerAndOrder(db, actor, {
    customerId: input.customerId,
    orderId: input.orderId,
    branchId: album.branchId,
  });

  const expiresAt = parseOptionalDate(input.expiresAt);
  const passwordHash = input.clearPassword
    ? null
    : input.password.trim()
      ? hashSecret(input.password.trim())
      : album.passwordHash;

  db.update(albums)
    .set({
      title: input.title.trim(),
      customerId: input.customerId || null,
      orderId: input.orderId || null,
      notes: input.notes.trim() || null,
      selectionLimit: input.selectionLimit,
      extraPhotoEnabled: input.extraPhotoEnabled,
      extraPhotoPrice: input.extraPhotoEnabled ? input.extraPhotoPrice : 0,
      allowFavorites: input.allowFavorites,
      allowNotes: input.allowNotes,
      allowDownloads: input.allowDownloads,
      downloadLimit: input.downloadLimit,
      expiresAt,
      passwordHash,
      updatedAt: new Date(),
    })
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "albums.update",
    entity: "album",
    entityId: albumId,
    metadata: {
      passwordChanged: input.clearPassword || input.password.trim().length > 0,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });
}

export function updateAlbumStatus(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
  status: string,
): void {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);
  if (!isAlbumStatus(status)) {
    throw new ValidationError("Trạng thái album không hợp lệ.");
  }
  if (!canTransitionAlbum(album.status as AlbumStatus, status)) {
    throw new ValidationError(
      `Không thể chuyển album từ "${ALBUM_STATUS_META[album.status as AlbumStatus]?.label ?? album.status}" sang trạng thái mới.`,
    );
  }

  db.update(albums)
    .set({
      status,
      updatedAt: new Date(),
      archivedAt: status === "archived" ? new Date() : null,
    })
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "albums.status.change",
    entity: "album",
    entityId: albumId,
    metadata: { from: album.status, to: status },
  });
}

export function rotateAlbumShareToken(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
): { rawToken: string; shareLink: string } {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  const tokenRecord = createShareTokenRecord();
  db.update(albums)
    .set({
      token: tokenRecord.tokenHash,
      tokenEncrypted: tokenRecord.tokenEncrypted,
      shareRevokedAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "albums.share.rotate",
    entity: "album",
    entityId: albumId,
  });

  return {
    rawToken: tokenRecord.rawToken,
    shareLink: `${getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/share/${tokenRecord.rawToken}`,
  };
}

export function setAlbumShareRevoked(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
  revoked: boolean,
): void {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  db.update(albums)
    .set({ shareRevokedAt: revoked ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: revoked ? "albums.share.revoke" : "albums.share.restore",
    entity: "album",
    entityId: albumId,
  });
}

export function setAlbumSelectionLock(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
  locked: boolean,
): void {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  if (locked && album.selectionStatus !== "submitted" && album.selectionStatus !== "locked") {
    throw new ValidationError(
      "Chỉ khóa được selection sau khi khách đã gửi lựa chọn.",
    );
  }

  db.update(albums)
    .set({
      selectionStatus: locked
        ? "locked"
        : album.selectionSubmittedAt
          ? "submitted"
          : "draft",
      selectionLockedAt: locked ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: locked ? "albums.selection.lock" : "albums.selection.unlock",
    entity: "album",
    entityId: albumId,
  });
}

export async function rescanAlbum(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
): Promise<{ added: number; updated: number; missing: number }> {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  const sources = db
    .select()
    .from(albumSources)
    .where(and(eq(albumSources.albumId, albumId), eq(albumSources.tenantId, actor.tenantId)))
    .all();
  const localSources = sources.filter((source) => source.provider === "local_demo");
  const googleSources = sources.filter((source) => source.provider === "google");
  if (localSources.length > 0 && googleSources.length > 0) {
    throw new ValidationError(
      "Album trộn nguồn local và Google chưa hỗ trợ quét lại. Tách nguồn trước.",
    );
  }
  if (localSources.length === 0 && googleSources.length === 0) {
    throw new ValidationError(
      "Album không có nguồn Drive/NAS có thể quét lại.",
    );
  }

  let prepared: PreparedImport;
  let sourcesToSync: typeof sources;
  if (googleSources.length > 0) {
    ensureGoogleDriveReady(db, actor);
    const googleScans: GoogleScanEntry[] = [];
    const scannedSources: typeof sources = [];
    for (const source of googleSources) {
      const folderId = source.externalFolderId;
      if (!folderId) continue;
      try {
        const scan = await scanGoogleDriveFolder(db, actor, folderId, {
          recursive: source.recursive,
          force: true,
        });
        googleScans.push({
          kind: "google",
          link: {
            provider: "google",
            folderId,
            normalizedUrl: `https://drive.google.com/drive/folders/${folderId}`,
            demo: false,
          },
          scan,
        });
        scannedSources.push(source);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Không quét được Google Drive.";
        db.update(albumSources)
          .set({ status: "error", error: message, updatedAt: new Date() })
          .where(
            and(
              eq(albumSources.id, source.id),
              eq(albumSources.tenantId, actor.tenantId),
            ),
          )
          .run();
        throw new ValidationError(message);
      }
    }
    try {
      prepared = await prepareGoogleImport(
        db,
        googleScans,
        actor.tenantId,
        albumId,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không đồng bộ Google Drive.";
      for (const source of scannedSources) {
        db.update(albumSources)
          .set({ status: "error", error: message, updatedAt: new Date() })
          .where(
            and(
              eq(albumSources.id, source.id),
              eq(albumSources.tenantId, actor.tenantId),
            ),
          )
          .run();
      }
      throw error;
    }
    sourcesToSync = scannedSources;
  } else {
    const localScans: LocalScanEntry[] = [];
    const scannedSources: typeof sources = [];
    for (const source of localSources) {
      const folderId = source.externalFolderId;
      if (!folderId) continue;
      const link = parseDriveFolderLink(folderId);
      if (!link) continue;
      localScans.push({ kind: "local", link, scan: scanLocalDemoDrive(folderId) });
      scannedSources.push(source);
    }
    prepared = await prepareDemoImport(localScans, actor.tenantId, albumId);
    sourcesToSync = scannedSources;
  }
  const sourceIds = sourcesToSync.map((source) => source.id);

  const existingPhotos = db
    .select()
    .from(photos)
    .where(and(eq(photos.albumId, albumId), eq(photos.tenantId, actor.tenantId)))
    .all();
  const bySourceId = new Map(
    existingPhotos
      .filter((photo) => photo.sourceFileId)
      .map((photo) => [photo.sourceFileId as string, photo]),
  );
  const byChecksum = new Map(
    existingPhotos
      .filter((photo) => photo.checksum)
      .map((photo) => [photo.checksum as string, photo]),
  );
  const scannedIds = new Set(prepared.photos.map((photo) => photo.sourceFileId));
  const scannedChecksums = new Set(prepared.photos.map((photo) => photo.checksum));
  const folders = db
    .select()
    .from(albumFolders)
    .where(and(eq(albumFolders.albumId, albumId), eq(albumFolders.tenantId, actor.tenantId)))
    .all();
  const folderByExternalId = new Map(
    folders
      .filter((folder) => folder.externalId)
      .map((folder) => [folder.externalId as string, folder.id]),
  );
  const newFolderIds = new Map<string, string>();
  for (const folder of prepared.folders) {
    if (!folderByExternalId.has(folder.externalId)) {
      const folderId = crypto.randomUUID();
      folderByExternalId.set(folder.externalId, folderId);
      newFolderIds.set(folder.externalId, folderId);
    }
  }
  const usedCodes = new Set(existingPhotos.map((photo) => photo.code));

  let added = 0;
  let updated = 0;
  let missing = 0;

  db.transaction((tx) => {
    for (const folder of prepared.folders) {
      const folderId = newFolderIds.get(folder.externalId);
      const sourceId = sourceIds[folder.sourceIndex];
      if (!folderId || !sourceId) continue;
      tx.insert(albumFolders)
        .values({
          id: folderId,
          tenantId: actor.tenantId,
          albumId,
          sourceId,
          externalId: folder.externalId,
          name: folder.name,
          relativePath: folder.relativePath,
          photoCount: folder.photoCount,
          sortOrder: prepared.folders.findIndex(
            (item) =>
              item.sourceIndex === folder.sourceIndex &&
              item.externalId === folder.externalId,
          ),
        })
        .run();
    }

    for (const photo of prepared.photos) {
      const existing =
        bySourceId.get(photo.sourceFileId) ??
        byChecksum.get(photo.checksum) ??
        null;
      if (existing) {
        tx.update(photos)
          .set({
            filename: photo.filename,
            relativePath: photo.relativePath,
            folderId: folderByExternalId.get(photo.folderExternalId) ?? null,
            sourceFileId: photo.sourceFileId,
            size: photo.size,
            checksum: photo.checksum,
            status: "ready",
            updatedAt: new Date(),
          })
          .where(and(eq(photos.id, existing.id), eq(photos.tenantId, actor.tenantId)))
          .run();
        updated += 1;
        continue;
      }

      const folderId = folderByExternalId.get(photo.folderExternalId) ?? null;
      tx.insert(photos)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          albumId,
          folderId,
          code: uniqueCode(photo.code, usedCodes),
          filename: photo.filename,
          relativePath: photo.relativePath,
          storageKey: photo.storageKey,
          thumbnailKey: photo.thumbnailKey,
          previewKey: photo.previewKey,
          sourceFileId: photo.sourceFileId,
          width: photo.width,
          height: photo.height,
          size: photo.size,
          isRaw: photo.isRaw,
          checksum: photo.checksum,
          watermarked: true,
          status: "ready",
          sortOrder: photo.sortOrder,
        })
        .run();
      added += 1;
    }

    for (const existing of existingPhotos) {
      if (
        existing.sourceFileId &&
        !scannedIds.has(existing.sourceFileId) &&
        !scannedChecksums.has(existing.checksum ?? "")
      ) {
        if (existing.status !== "missing") {
          tx.update(photos)
            .set({ status: "missing", updatedAt: new Date() })
            .where(and(eq(photos.id, existing.id), eq(photos.tenantId, actor.tenantId)))
            .run();
          missing += 1;
        }
      }
    }

    for (const source of sourcesToSync) {
      tx.update(albumSources)
        .set({ status: "synced", lastSyncedAt: new Date(), error: null, updatedAt: new Date() })
        .where(and(eq(albumSources.id, source.id), eq(albumSources.tenantId, actor.tenantId)))
        .run();
    }

    for (const folder of prepared.folders) {
      const folderId = folderByExternalId.get(folder.externalId);
      if (folderId) {
        tx.update(albumFolders)
          .set({ photoCount: folder.photoCount })
          .where(and(eq(albumFolders.id, folderId), eq(albumFolders.tenantId, actor.tenantId)))
          .run();
      }
    }

    tx.update(albums)
      .set({
        status: album.status === "draft" ? "ready" : album.status,
        updatedAt: new Date(),
      })
      .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
      .run();
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "albums.rescan",
    entity: "album",
    entityId: albumId,
    metadata: { added, updated, missing },
  });

  return { added, updated, missing };
}

export type UploadedPhotoFile = {
  filename: string;
  relativePath: string;
  buffer: Buffer;
};

export async function addUploadedPhotos(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
  files: UploadedPhotoFile[],
): Promise<{ added: number; skipped: { filename: string; reason: string }[] }> {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  if (files.length === 0) {
    throw new ValidationError("Chưa chọn file ảnh để tải lên.");
  }
  if (files.length > 100) {
    throw new ValidationError("Mỗi lần chỉ tải tối đa 100 ảnh.");
  }

  const usedCodes = new Set(
    db
      .select({ code: photos.code })
      .from(photos)
      .where(eq(photos.albumId, albumId))
      .all()
      .map((row) => row.code),
  );
  const storage = getStorageAdapter();
  if (!storage.configured) {
    throw new ValidationError(storage.label + " chưa được cấu hình.");
  }

  const prepared: {
    code: string;
    filename: string;
    relativePath: string;
    storageKey: string;
    thumbnailKey: string;
    previewKey: string;
    width: number;
    height: number;
    size: number;
    checksum: string;
    isRaw: boolean;
    sortOrder: number;
  }[] = [];
  const skipped: { filename: string; reason: string }[] = [];

  for (const [index, file] of files.entries()) {
    const filename = file.filename.replace(/\\/g, "/").split("/").pop() ?? file.filename;
    try {
      const rawStem = filename.replace(/\.[^.]+$/, "").slice(0, 80) || "photo";
      const stem = sanitizeSegment(rawStem);
      const keyBase = `${actor.tenantId}/${albumId}/upload-${crypto.randomUUID().slice(0, 8)}-${stem}`;
      const processed = await storage.processImage(file.buffer, keyBase);
      prepared.push({
        code: uniqueCode(stem, usedCodes),
        filename,
        relativePath: file.relativePath || filename,
        storageKey: processed.storageKey,
        thumbnailKey: processed.thumbnailKey,
        previewKey: processed.previewKey,
        width: processed.width,
        height: processed.height,
        size: processed.size,
        checksum: processed.checksum,
        isRaw: /\.(raw|cr2|nef|arw|dng|raf)$/i.test(filename),
        sortOrder: 1000 + index,
      });
    } catch (error) {
      skipped.push({
        filename,
        reason: error instanceof Error ? error.message : "Không xử lý được ảnh.",
      });
    }
  }

  if (prepared.length > 0) {
    db.transaction((tx) => {
      for (const photo of prepared) {
        tx.insert(photos)
          .values({
            id: crypto.randomUUID(),
            tenantId: actor.tenantId,
            albumId,
            folderId: null,
            code: photo.code,
            filename: photo.filename,
            relativePath: photo.relativePath,
            storageKey: photo.storageKey,
            thumbnailKey: photo.thumbnailKey,
            previewKey: photo.previewKey,
            sourceFileId: null,
            width: photo.width,
            height: photo.height,
            size: photo.size,
            isRaw: photo.isRaw,
            checksum: photo.checksum,
            watermarked: true,
            status: "ready",
            sortOrder: photo.sortOrder,
          })
          .run();
      }
      tx.update(albums)
        .set({
          status: album.status === "draft" ? "ready" : album.status,
          sourceType: album.sourceType === "upload" ? "upload" : album.sourceType,
          updatedAt: new Date(),
        })
        .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
        .run();
    });
  }

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "albums.photos.upload",
    entity: "album",
    entityId: albumId,
    metadata: { added: prepared.length, skipped: skipped.length },
  });

  return { added: prepared.length, skipped };
}

export type AlbumSelectionExportRow = {
  photoId: string;
  code: string;
  filename: string;
  folderName: string | null;
  note: string | null;
  selectedAt: Date | null;
  extraFee: number;
  status: string;
  storageKey: string;
};

export function getAlbumSelectionExport(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
): {
  albumId: string;
  title: string;
  rows: AlbumSelectionExportRow[];
  missingCount: number;
} {
  assertPermission(actor, "albums.view");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  const rows = db
    .select({
      photoId: photos.id,
      code: photos.code,
      filename: photos.filename,
      folderName: albumFolders.name,
      note: photoSelections.note,
      selectedAt: photoSelections.updatedAt,
      extraFee: photoSelections.extraFee,
      status: photos.status,
      storageKey: photos.storageKey,
    })
    .from(photoSelections)
    .innerJoin(photos, eq(photoSelections.photoId, photos.id))
    .leftJoin(albumFolders, eq(photos.folderId, albumFolders.id))
    .where(
      and(
        eq(photoSelections.albumId, albumId),
        eq(photoSelections.tenantId, actor.tenantId),
        eq(photoSelections.selected, true),
        eq(photos.tenantId, actor.tenantId),
      ),
    )
    .orderBy(asc(photos.sortOrder), asc(photos.code))
    .all();

  return {
    albumId: album.id,
    title: album.title,
    rows,
    missingCount: rows.filter((row) => row.status !== "ready").length,
  };
}

export function listAlbumCustomerOptions(db: AppDb, actor: ActorContext) {
  assertPermission(actor, "albums.view");
  const scope = getBranchScope(actor);
  const conditions: SQL[] = [
    eq(customers.tenantId, actor.tenantId),
    ne(customers.status, "inactive"),
  ];
  if (scope.mode === "branch") {
    conditions.push(eq(customers.branchId, scope.branchId));
  } else if (scope.mode === "none") {
    return [];
  }
  return db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(and(...conditions))
    .orderBy(asc(customers.name))
    .limit(200)
    .all();
}

export function listAlbumOrderOptions(
  db: AppDb,
  actor: ActorContext,
  customerId: string,
) {
  assertPermission(actor, "albums.view");
  const conditions: SQL[] = [eq(orders.tenantId, actor.tenantId)];
  if (customerId) {
    conditions.push(eq(orders.customerId, customerId));
  }
  const scope = getBranchScope(actor);
  if (scope.mode === "branch") {
    conditions.push(eq(orders.branchId, scope.branchId));
  } else if (scope.mode === "none") {
    return [];
  }
  return db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      customerId: orders.customerId,
      branchId: orders.branchId,
    })
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(50)
    .all();
}

export function albumFilterOptions(db: AppDb, actor: ActorContext) {
  assertPermission(actor, "albums.view");
  const scope = getBranchScope(actor);
  const albumConditions: SQL[] = [eq(albums.tenantId, actor.tenantId)];
  if (scope.mode === "branch") {
    albumConditions.push(eq(albums.branchId, scope.branchId));
  } else if (scope.mode === "none") {
    return { albums: [], customers: [] };
  }
  return {
    albums: db
      .select({
        id: albums.id,
        title: albums.title,
        customerName: customers.name,
        orderCode: orders.code,
      })
      .from(albums)
      .leftJoin(customers, eq(albums.customerId, customers.id))
      .leftJoin(orders, eq(albums.orderId, orders.id))
      .where(and(...albumConditions))
      .orderBy(desc(albums.createdAt))
      .limit(100)
      .all(),
    customers: listAlbumCustomerOptions(db, actor),
  };
}

