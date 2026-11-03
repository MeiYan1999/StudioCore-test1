import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { paymentRequests, photos } from "@/lib/db/schema";
import {
  addUploadedPhotos,
  createAlbum,
  getAlbumDetail,
  getAlbumSelectionExport,
  rescanAlbum,
  rotateAlbumShareToken,
  setAlbumSelectionLock,
  setAlbumShareRevoked,
  updateAlbum,
  type CreateAlbumInput,
} from "@/lib/services/album-service";
import {
  authorizeShareDownload,
  evaluateShareAccess,
  getShareGalleryPage,
  submitShareSelection,
  updateSharePhotoSelection,
  verifySharePassword,
} from "@/lib/services/share-service";
import { DEMO_ALBUM } from "@/lib/demo-album";
import {
  generateDemoAlbumAssets,
  processImageBuffer,
  readStorageBuffer,
  resolveStoragePath,
} from "@/lib/storage/local-storage";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let photographer: ActorContext;
let secondaryOwner: ActorContext;

async function actorFromPassword(
  email: string,
  ip: string,
): Promise<ActorContext> {
  const login = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip, userAgent: "vitest-phase4" },
  );
  if (!login.ok) throw new Error(`Không login ${email}: ${login.error}`);
  const actor = await getActorFromToken(db, login.token);
  if (!actor) throw new Error(`Không dựng actor ${email}`);
  return actor;
}

function baseInput(overrides: Partial<CreateAlbumInput> = {}): CreateAlbumInput {
  return {
    branchId: "branch-demo-q1",
    customerId: "customer-demo-02",
    orderId: "order-demo-02",
    title: `Album test ${crypto.randomUUID().slice(0, 8)}`,
    notes: "Album kiểm thử Phase 4.",
    sourceType: "drive",
    sourceUrl: `https://drive.google.com/drive/folders/${DEMO_ALBUM.driveFolderId}`,
    sourceUrls: "",
    selectionLimit: 5,
    extraPhotoEnabled: false,
    extraPhotoPrice: 0,
    allowFavorites: true,
    allowNotes: true,
    allowDownloads: true,
    downloadLimit: null,
    password: "",
    expiresAt: "",
    ...overrides,
  };
}

function updateInputFrom(
  detail: Awaited<ReturnType<typeof getAlbumDetail>>,
  overrides: Record<string, unknown> = {},
) {
  return {
    title: detail.title,
    customerId: detail.customerId ?? "",
    orderId: detail.orderId ?? "",
    notes: detail.notes ?? "",
    selectionLimit: detail.selectionLimit,
    extraPhotoEnabled: detail.extraPhotoEnabled,
    extraPhotoPrice: detail.extraPhotoPrice,
    allowFavorites: detail.allowFavorites,
    allowNotes: detail.allowNotes,
    allowDownloads: detail.allowDownloads,
    downloadLimit: detail.downloadLimit,
    expiresAt: "",
    password: "",
    clearPassword: false,
    ...overrides,
  };
}

beforeAll(async () => {
  db = createTestDb();
  await generateDemoAlbumAssets();
  owner = await actorFromPassword("owner@studiocore.demo", "192.0.2.60");
  photographer = await actorFromPassword("photo@studiocore.demo", "192.0.2.61");
  secondaryOwner = await actorFromPassword(
    "owner@studiobinhminh.demo",
    "192.0.2.62",
  );
});

describe("album và PhotoShare", () => {
  it("seed album có 12 ảnh, token công khai và tenant isolation", () => {
    const detail = getAlbumDetail(db, owner, DEMO_ALBUM.id);
    expect(detail.photos).toHaveLength(12);
    expect(detail.folders).toHaveLength(3);
    expect(detail.sources).toHaveLength(1);
    expect(detail.shareLink).toContain(DEMO_ALBUM.token);

    const access = evaluateShareAccess(db, DEMO_ALBUM.token, true);
    expect(access.ok).toBe(true);
    if (!access.ok) return;
    const page = getShareGalleryPage(db, access, { page: 1, pageSize: 6 });
    expect(page.photos).toHaveLength(6);
    expect(page.hasMore).toBe(true);
    expect(page.counts.all).toBe(12);
    expect(page.folders.reduce((total, folder) => total + folder.photoCount, 0)).toBe(12);

    expect(() => getAlbumDetail(db, secondaryOwner, DEMO_ALBUM.id)).toThrow(
      /Không tìm thấy album/,
    );
  });

  it("tạo album từ Drive demo, đổi token làm link cũ mất hiệu lực", async () => {
    const created = await createAlbum(db, photographer, baseInput());
    expect(created.importedPhotos).toBe(12);
    const detail = getAlbumDetail(db, owner, created.albumId);
    expect(detail.photos).toHaveLength(12);
    expect(detail.shareLink).toContain(created.rawToken);
    expect(evaluateShareAccess(db, created.rawToken, false).ok).toBe(true);

    const rotated = rotateAlbumShareToken(db, owner, created.albumId);
    expect(evaluateShareAccess(db, created.rawToken, false).ok).toBe(false);
    expect(evaluateShareAccess(db, rotated.rawToken, false).ok).toBe(true);

    const selection = updateSharePhotoSelection(
      db,
      rotated.rawToken,
      false,
      detail.photos[0]?.id ?? "",
      { selected: true, note: "Giữ ảnh này" },
    );
    expect(selection.selectedCount).toBe(1);

    const rescanned = await rescanAlbum(db, owner, created.albumId);
    expect(rescanned.added).toBe(0);
    expect(rescanned.updated).toBe(12);
    const afterRescan = getAlbumDetail(db, owner, created.albumId);
    expect(afterRescan.stats.selectedCount).toBe(1);
    expect(afterRescan.photos.find((photo) => photo.selected)?.note).toBe(
      "Giữ ảnh này",
    );
  });

  it("quota, phí ảnh thêm, payment request, khóa/mở selection", async () => {
    const created = await createAlbum(
      db,
      owner,
      baseInput({
        selectionLimit: 2,
        extraPhotoEnabled: true,
        extraPhotoPrice: 150_000,
      }),
    );
    const detail = getAlbumDetail(db, owner, created.albumId);
    const ids = detail.photos.slice(0, 3).map((photo) => photo.id);
    for (const id of ids) {
      updateSharePhotoSelection(db, created.rawToken, false, id, {
        selected: true,
      });
    }

    const submitted = submitShareSelection(db, created.rawToken, false);
    expect(submitted.summary.selectedCount).toBe(3);
    expect(submitted.summary.extraCount).toBe(1);
    expect(submitted.summary.extraFee).toBe(150_000);
    expect(submitted.paymentRequestCode).toBeTruthy();

    const request = db
      .select()
      .from(paymentRequests)
      .where(
        and(
          eq(paymentRequests.tenantId, owner.tenantId),
          eq(paymentRequests.code, submitted.paymentRequestCode as string),
        ),
      )
      .get();
    expect(request?.amount).toBe(150_000);
    expect(request?.status).toBe("pending");

    const exportData = getAlbumSelectionExport(db, owner, created.albumId);
    expect(exportData.rows).toHaveLength(3);
    expect(
      exportData.rows.reduce((total, row) => total + row.extraFee, 0),
    ).toBe(150_000);

    const after = getAlbumDetail(db, owner, created.albumId);
    expect(after.selectionStatus).toBe("submitted");
    setAlbumSelectionLock(db, owner, created.albumId, true);
    expect(() =>
      updateSharePhotoSelection(db, created.rawToken, false, ids[0] as string, {
        favorite: true,
      }),
    ).toThrow(/khóa/);
    setAlbumSelectionLock(db, owner, created.albumId, false);
    expect(() =>
      updateSharePhotoSelection(db, created.rawToken, false, ids[0] as string, {
        favorite: true,
      }),
    ).not.toThrow();
  });

  it("password, thu hồi, hết hạn và xóa mật khẩu", async () => {
    const created = await createAlbum(
      db,
      owner,
      baseInput({ password: "Album@123" }),
    );
    expect(evaluateShareAccess(db, created.rawToken, false)).toEqual({
      ok: false,
      reason: "password_required",
    });
    const wrong = verifySharePassword(
      db,
      created.rawToken,
      "sai-mat-khau",
      "192.0.2.70",
    );
    expect(wrong.ok).toBe(false);
    const right = verifySharePassword(
      db,
      created.rawToken,
      "Album@123",
      "192.0.2.70",
    );
    expect(right.ok).toBe(true);
    expect(evaluateShareAccess(db, created.rawToken, true).ok).toBe(true);

    setAlbumShareRevoked(db, owner, created.albumId, true);
    expect(evaluateShareAccess(db, created.rawToken, true)).toEqual({
      ok: false,
      reason: "revoked",
    });
    setAlbumShareRevoked(db, owner, created.albumId, false);
    expect(evaluateShareAccess(db, created.rawToken, true).ok).toBe(true);

    const detail = getAlbumDetail(db, owner, created.albumId);
    updateAlbum(db, owner, created.albumId, {
      ...updateInputFrom(detail),
      expiresAt: "2020-01-01",
    });
    expect(evaluateShareAccess(db, created.rawToken, true)).toEqual({
      ok: false,
      reason: "expired",
    });
    updateAlbum(db, owner, created.albumId, {
      ...updateInputFrom(detail),
      expiresAt: "",
      clearPassword: true,
    });
    expect(evaluateShareAccess(db, created.rawToken, false).ok).toBe(true);
  });

  it("giới hạn tải ảnh gốc được kiểm tra phía server", async () => {
    const created = await createAlbum(
      db,
      owner,
      baseInput({ downloadLimit: 1, allowDownloads: true }),
    );
    const detail = getAlbumDetail(db, owner, created.albumId);
    const photoId = detail.photos[0]?.id ?? "";
    const first = authorizeShareDownload(db, created.rawToken, false, photoId);
    expect(first.photo.id).toBe(photoId);
    const after = getAlbumDetail(db, owner, created.albumId);
    expect(after.downloadCount).toBe(1);
    expect(() =>
      authorizeShareDownload(db, created.rawToken, false, photoId),
    ).toThrow(/giới hạn/);

    const blocked = await createAlbum(
      db,
      owner,
      baseInput({ allowDownloads: false }),
    );
    expect(() =>
      authorizeShareDownload(
        db,
        blocked.rawToken,
        false,
        getAlbumDetail(db, owner, blocked.albumId).photos[0]?.id ?? "",
      ),
    ).toThrow(/không cho phép/);
  });

  it("rescan đánh dấu ảnh biến mất là missing, không xóa lựa chọn", async () => {
    const created = await createAlbum(db, owner, baseInput());
    const detail = getAlbumDetail(db, owner, created.albumId);
    const target = detail.photos[0];
    if (!target) throw new Error("Thiếu ảnh seed");
    updateSharePhotoSelection(db, created.rawToken, false, target.id, {
      selected: true,
    });

    db.insert(photos)
      .values({
        id: crypto.randomUUID(),
        tenantId: owner.tenantId,
        albumId: created.albumId,
        folderId: null,
        code: "MISSING-001",
        filename: "missing-file.jpg",
        relativePath: "missing-file.jpg",
        storageKey: target.thumbnailUrl.length ? "tenant-demo/missing.jpg" : "x",
        thumbnailKey: "tenant-demo/missing-thumb.jpg",
        previewKey: "tenant-demo/missing-preview.jpg",
        sourceFileId: "demo-folder-duoi-ca:missing-file.jpg",
        width: 100,
        height: 100,
        size: 1,
        isRaw: false,
        checksum: "missing-checksum",
        watermarked: true,
        status: "ready",
        sortOrder: 999,
      })
      .run();

    const result = await rescanAlbum(db, owner, created.albumId);
    expect(result.missing).toBe(1);
    const after = getAlbumDetail(db, owner, created.albumId);
    expect(after.stats.missingCount).toBe(1);
    expect(after.photos.find((photo) => photo.id === target.id)?.selected).toBe(
      true,
    );
    expect(
      after.photos.find((photo) => photo.code === "MISSING-001")?.status,
    ).toBe("missing");
  });

  it("upload kiểm tra magic/size/path traversal và tenant scope", async () => {
    await expect(
      processImageBuffer(Buffer.from("không phải ảnh"), "tenant-test/phase4/bad"),
    ).rejects.toThrow(/JPEG|ảnh/i);
    expect(() => resolveStoragePath("../outside.jpg")).toThrow(/không hợp lệ/);

    const folder = `tenant-test/phase4-${crypto.randomUUID().slice(0, 8)}`;
    const jpeg = await sharp({
      create: { width: 64, height: 48, channels: 3, background: "#336699" },
    })
      .jpeg()
      .toBuffer();
    const processed = await processImageBuffer(jpeg, `${folder}/sample`);
    expect(processed.thumbnailKey).not.toBe(processed.storageKey);
    expect(processed.previewKey).not.toBe(processed.storageKey);
    expect(fs.existsSync(resolveStoragePath(processed.storageKey))).toBe(true);
    expect(fs.existsSync(resolveStoragePath(processed.thumbnailKey))).toBe(true);
    const thumbnail = await sharp(
      readStorageBuffer(processed.thumbnailKey),
    ).metadata();
    const preview = await sharp(
      readStorageBuffer(processed.previewKey),
    ).metadata();
    expect(thumbnail.width).toBe(480);
    expect(thumbnail.height).toBe(320);
    expect(preview.width).toBe(1440);
    expect(preview.height).toBe(960);

    const created = await createAlbum(db, owner, baseInput({ sourceType: "upload" }));
    await expect(
      addUploadedPhotos(db, secondaryOwner, created.albumId, [
        { filename: "evil.jpg", relativePath: "evil.jpg", buffer: jpeg },
      ]),
    ).rejects.toThrow(/Không tìm thấy album/);
    const uploaded = await addUploadedPhotos(db, owner, created.albumId, [
      { filename: "safe-photo.jpg", relativePath: "safe-photo.jpg", buffer: jpeg },
    ]);
    expect(uploaded.added).toBe(1);
    expect(uploaded.skipped).toHaveLength(0);
    expect(getAlbumDetail(db, owner, created.albumId).photos).toHaveLength(1);
    const uploadedKey = getAlbumDetail(db, owner, created.albumId).photos[0];
    if (uploadedKey) {
      const key = uploadedKey.thumbnailUrl.split("/api/files/")[1] ?? "";
      const segments = key.split("/").map(decodeURIComponent);
      const albumFolder = segments.slice(0, -1).join("/");
      fs.rmSync(
        path.join(process.cwd(), "public", "uploads", ...albumFolder.split("/")),
        { recursive: true, force: true },
      );
    }

    fs.rmSync(path.join(process.cwd(), "public", "uploads", folder), {
      recursive: true,
      force: true,
    });
  });
});
