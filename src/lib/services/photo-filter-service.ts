import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  albums,
  customers,
  orders,
  photoFilterItems,
  photoFilterJobs,
  photoSelections,
  photos,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import {
  sanitizeFolderName,
  type CodeMatchMode,
  type FileTypeFilter,
} from "../photos/filter-codes";

export type AlbumFilterSource = {
  albumId: string;
  title: string;
  customerName: string | null;
  orderCode: string | null;
  selectedCodes: {
    code: string;
    filename: string;
    note: string | null;
    thumbnailKey?: string | null;
    previewKey?: string | null;
  }[];
  albumFiles: { code: string; filename: string }[];
};

export function getAlbumFilterSource(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
): AlbumFilterSource {
  assertPermission(actor, "albums.view");
  const row = db
    .select({
      album: albums,
      customerName: customers.name,
      orderCode: orders.code,
    })
    .from(albums)
    .leftJoin(customers, eq(albums.customerId, customers.id))
    .leftJoin(orders, eq(albums.orderId, orders.id))
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!row) {
    throw new NotFoundError("Không tìm thấy album.");
  }
  assertBranchAccess(actor, row.album.branchId);

  const fileRows = db
    .select({ code: photos.code, filename: photos.filename })
    .from(photos)
    .where(
      and(
        eq(photos.albumId, albumId),
        eq(photos.tenantId, actor.tenantId),
        eq(photos.status, "ready"),
      ),
    )
    .all();

  const selectedCodes = db
    .select({
      code: photos.code,
      filename: photos.filename,
      note: photoSelections.note,
      thumbnailKey: photos.thumbnailKey,
      previewKey: photos.previewKey,
    })
    .from(photoSelections)
    .innerJoin(photos, eq(photoSelections.photoId, photos.id))
    .where(
      and(
        eq(photoSelections.albumId, albumId),
        eq(photoSelections.tenantId, actor.tenantId),
        eq(photoSelections.selected, true),
        eq(photos.status, "ready"),
      ),
    )
    .orderBy(photos.sortOrder)
    .all();

  return {
    albumId: row.album.id,
    title: row.album.title,
    customerName: row.customerName,
    orderCode: row.orderCode,
    selectedCodes,
    albumFiles: fileRows,
  };
}

export type FilterJobItemInput = {
  inputCode: string;
  matchedFilename: string;
  status: string;
  message?: string;
};

export type SaveFilterJobInput = {
  albumId: string | null;
  mode: CodeMatchMode;
  inputCodesText: string;
  parsedCount: number;
  matchedCount: number;
  missingCount: number;
  ambiguousCount: number;
  duplicateCount: number;
  outputMode: "subfolder" | "separate";
  outputFolderName: string;
  fileType: FileTypeFilter;
  status: "completed" | "cancelled" | "failed";
  items: FilterJobItemInput[];
};

export function savePhotoFilterJob(
  db: AppDb,
  actor: ActorContext,
  input: SaveFilterJobInput,
): { jobId: string } {
  assertPermission(actor, "albums.view");
  if (input.albumId) {
    const album = db
      .select()
      .from(albums)
      .where(and(eq(albums.id, input.albumId), eq(albums.tenantId, actor.tenantId)))
      .get();
    if (!album) throw new NotFoundError("Không tìm thấy album.");
    assertBranchAccess(actor, album.branchId);
  }
  if (!["alphanumeric", "numeric"].includes(input.mode)) {
    throw new ValidationError("Chế độ lọc không hợp lệ.");
  }
  if (!["all", "raw", "standard"].includes(input.fileType)) {
    throw new ValidationError("Định dạng file không hợp lệ.");
  }
  if (!["subfolder", "separate"].includes(input.outputMode)) {
    throw new ValidationError("Cấu hình folder đầu ra không hợp lệ.");
  }
  if (input.inputCodesText.length > 50_000) {
    throw new ValidationError("Danh sách mã quá dài.");
  }
  if (input.items.length > 5000) {
    throw new ValidationError("Quá nhiều dòng kết quả để lưu.");
  }
  for (const item of input.items) {
    if (item.inputCode.length > 120 || item.matchedFilename.length > 300) {
      throw new ValidationError("Dữ liệu kết quả lọc không hợp lệ.");
    }
  }

  const jobId = crypto.randomUUID();
  const now = new Date();
  const folderName = sanitizeFolderName(input.outputFolderName);

  db.transaction((tx) => {
    tx.insert(photoFilterJobs)
      .values({
        id: jobId,
        tenantId: actor.tenantId,
        albumId: input.albumId,
        customerId: null,
        orderId: null,
        mode: input.mode,
        inputCodes: input.inputCodesText.slice(0, 50_000),
        parsedCount: input.parsedCount,
        matchedCount: input.matchedCount,
        missingCount: input.missingCount,
        ambiguousCount: input.ambiguousCount,
        duplicateCount: input.duplicateCount,
        outputMode: input.outputMode,
        outputFolderName: folderName,
        fileType: input.fileType,
        status: input.status,
        createdBy: actor.staffId,
        startedAt: now,
        finishedAt: now,
      })
      .run();

    if (input.items.length > 0) {
      tx.insert(photoFilterItems)
        .values(
          input.items.map((item) => ({
            id: crypto.randomUUID(),
            tenantId: actor.tenantId,
            jobId,
            inputCode: item.inputCode.slice(0, 120),
            matchedPhotoId: null,
            matchedFilename: item.matchedFilename.slice(0, 300),
            status: item.status.slice(0, 40),
            message: item.message ? item.message.slice(0, 500) : null,
            createdAt: now,
          })),
        )
        .run();
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "albums.filter.job",
    entity: "photo_filter_job",
    entityId: jobId,
    metadata: {
      albumId: input.albumId,
      matched: input.matchedCount,
      missing: input.missingCount,
      ambiguous: input.ambiguousCount,
      status: input.status,
    },
  });

  return { jobId };
}

export type FilterJobView = {
  id: string;
  albumId: string | null;
  mode: string;
  parsedCount: number;
  matchedCount: number;
  missingCount: number;
  ambiguousCount: number;
  duplicateCount: number;
  fileType: string;
  outputFolderName: string;
  status: string;
  createdAt: Date;
};

export function listRecentFilterJobs(
  db: AppDb,
  actor: ActorContext,
  limit = 5,
): FilterJobView[] {
  assertPermission(actor, "albums.view");
  return db
    .select({
      id: photoFilterJobs.id,
      albumId: photoFilterJobs.albumId,
      mode: photoFilterJobs.mode,
      parsedCount: photoFilterJobs.parsedCount,
      matchedCount: photoFilterJobs.matchedCount,
      missingCount: photoFilterJobs.missingCount,
      ambiguousCount: photoFilterJobs.ambiguousCount,
      duplicateCount: photoFilterJobs.duplicateCount,
      fileType: photoFilterJobs.fileType,
      outputFolderName: photoFilterJobs.outputFolderName,
      status: photoFilterJobs.status,
      createdAt: photoFilterJobs.createdAt,
    })
    .from(photoFilterJobs)
    .where(eq(photoFilterJobs.tenantId, actor.tenantId))
    .orderBy(desc(photoFilterJobs.createdAt))
    .limit(limit)
    .all();
}
