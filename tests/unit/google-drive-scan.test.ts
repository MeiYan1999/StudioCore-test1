import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createTestDb } from "../helpers/test-db";
import type { AppDb } from "@/lib/db/client";
import type { ActorContext } from "@/lib/auth/types";
import {
  resolveGoogleDriveAuth,
  scanGoogleDriveFolder,
} from "@/lib/services/drive-connection-service";
import { createAlbum, getAlbumDetail } from "@/lib/services/album-service";
import { driveConnections } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/security/secret-crypto";
import { ValidationError } from "@/lib/errors";

describe("Google Drive Public & Connected Folder Scan", () => {
  let db: AppDb;
  const originalEnv = { ...process.env };
  const actor: ActorContext = {
    sessionId: "sess-test",
    staffId: "staff-sc-owner",
    tenantId: "tenant-demo",
    tenantName: "Demo Studio",
    tenantSlug: "demo-studio",
    tenantPlan: "pro",
    staffName: "Chủ Studio",
    staffCode: "SC-OWNER",
    staffEmail: "owner@studiocore.test",
    role: "owner",
    branches: [{ id: "branch-demo-q1", name: "Chi nhánh Q1" }],
    activeBranchId: "branch-demo-q1",
    readOnly: false,
    permissions: ["albums.manage", "albums.view"],
  };

  beforeEach(() => {
    db = createTestDb();
    delete process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("ưu tiên sử dụng GOOGLE_API_KEY khi biến môi trường được cấu hình", async () => {
    process.env.GOOGLE_API_KEY = "AIzaSyMockKeyForPublicFolder";
    const auth = await resolveGoogleDriveAuth(db, actor.tenantId);
    expect(auth.type).toBe("api_key");
    if (auth.type === "api_key") {
      expect(auth.key).toBe("AIzaSyMockKeyForPublicFolder");
    }
  });

  it("báo lỗi hướng dẫn rõ ràng khi chưa có API key và chưa có tài khoản nào kết nối", async () => {
    await expect(resolveGoogleDriveAuth(db, actor.tenantId)).rejects.toThrow(
      /Chưa cấu hình GOOGLE_API_KEY hoặc chưa kết nối Google Drive/,
    );
  });

  it("phát hiện link là tập tin đơn lẻ thay vì thư mục và báo lỗi dễ hiểu", async () => {
    process.env.GOOGLE_API_KEY = "AIzaSyMockKey";

    // Mock fetch to simulate Google Drive API returning a single file
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/files/file-id-123")) {
        return new Response(
          JSON.stringify({
            id: "file-id-123",
            name: "HinhCuoi_001.jpg",
            mimeType: "image/jpeg",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    await expect(
      scanGoogleDriveFolder(db, actor, "file-id-123", { force: true }),
    ).rejects.toThrow(/Link vừa nhập là tập tin có tên "HinhCuoi_001.jpg"/);
  });

  it("báo lỗi nhắc bật quyền xem khi thư mục trả về 403 / 404", async () => {
    process.env.GOOGLE_API_KEY = "AIzaSyMockKey";

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: {
            errors: [{ domain: "global", reason: "notFound", message: "File not found" }],
            code: 404,
            message: "File not found",
          },
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    });

    await expect(
      scanGoogleDriveFolder(db, actor, "folder-private-999", { force: true }),
    ).rejects.toThrow(/Không tìm thấy thư mục trên Google Drive/);
  });

  it("quét thành công thư mục Google Drive công khai và trả về danh sách ảnh với CDN thumbnail", async () => {
    process.env.GOOGLE_API_KEY = "AIzaSyMockKey";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/files/folder-wedding-2026?")) {
        return new Response(
          JSON.stringify({
            id: "folder-wedding-2026",
            name: "Album Cưới Tuấn Lan",
            mimeType: "application/vnd.google-apps.folder",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (urlStr.includes("/files?")) {
        return new Response(
          JSON.stringify({
            files: [
              {
                id: "img-001",
                name: "IMG_0001.JPG",
                mimeType: "image/jpeg",
                size: "4500000",
                imageMediaMetadata: { width: 4000, height: 3000 },
              },
              {
                id: "img-002",
                name: "IMG_0002.CR3",
                mimeType: "image/x-canon-cr3",
                size: "28000000",
                imageMediaMetadata: { width: 6000, height: 4000 },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const scan = await scanGoogleDriveFolder(db, actor, "folder-wedding-2026", {
      force: true,
    });
    expect(scan.folderName).toBe("Album Cưới Tuấn Lan");
    expect(scan.files.length).toBe(2);
    expect(scan.files[0]?.id).toBe("img-001");
    expect(scan.files[0]?.thumbnailLink).toBe(
      "https://drive.google.com/thumbnail?id=img-001&sz=w800",
    );
    expect(scan.files[1]?.name).toBe("IMG_0002.CR3");
  });

  it("tạo album thành công từ link Google Drive thật mà không cần download về máy chủ", async () => {
    process.env.GOOGLE_API_KEY = "AIzaSyMockKey";

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const urlStr = url.toString();
      if (urlStr.includes("/files/folder-real-drive-1?")) {
        return new Response(
          JSON.stringify({
            id: "folder-real-drive-1",
            name: "Bộ Ảnh Cưới Sapa",
            mimeType: "application/vnd.google-apps.folder",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (urlStr.includes("/files?")) {
        return new Response(
          JSON.stringify({
            files: [
              {
                id: "drive-file-abc",
                name: "DSC01234.JPG",
                mimeType: "image/jpeg",
                size: "6000000",
                imageMediaMetadata: { width: 4000, height: 3000 },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const album = await createAlbum(db, actor, {
      branchId: "branch-demo-q1",
      customerId: "customer-demo-02",
      orderId: "order-demo-02",
      title: "Album Cưới Sapa Tuyệt Đẹp",
      notes: "Tạo từ link Google Drive bất kỳ",
      sourceType: "drive",
      sourceUrl: "https://drive.google.com/drive/folders/folder-real-drive-1",
      sourceUrls: "",
      selectionLimit: 10,
      extraPhotoEnabled: false,
      extraPhotoPrice: 0,
      allowFavorites: true,
      allowNotes: true,
      allowDownloads: true,
      downloadLimit: null,
      password: "",
      expiresAt: "",
    });

    expect(album.albumId).toBeDefined();
    const detail = await getAlbumDetail(db, actor, album.albumId);
    expect(detail.photos.length).toBe(1);
    expect(detail.photos[0]?.code).toBe("DSC01234");
    expect(detail.photos[0]?.thumbnailUrl).toBe(
      "https://drive.google.com/thumbnail?id=drive-file-abc&sz=w800",
    );
    expect(detail.photos[0]?.previewUrl).toBe(
      "https://drive.google.com/thumbnail?id=drive-file-abc&sz=w1600",
    );
  });
});
