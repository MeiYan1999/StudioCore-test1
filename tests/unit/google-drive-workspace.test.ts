import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatDriveBytes,
  getGoogleDriveWorkspaceInfo,
  setupStudioDriveWorkspaceWithToken,
} from "@/lib/services/drive-connection-service";
import { createTestDb } from "../helpers/test-db";
import { driveConnections, settings, tenants } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

describe("Google Drive Workspace & Storage Quota", () => {
  const db = createTestDb();
  const testTenantId = "tenant-drive-test";

  beforeEach(() => {
    // Setup test tenant
    const existing = db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, testTenantId))
      .get();

    if (!existing) {
      db.insert(tenants)
        .values({
          id: testTenantId,
          name: "Studio Manh Nguyen",
          slug: "studio-manh-nguyen",
          status: "active",
        })
        .run();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formatDriveBytes định dạng đúng dung lượng từ B sang MB và GB", () => {
    expect(formatDriveBytes(0)).toBe("0 B");
    expect(formatDriveBytes(1024)).toBe("1 KB");
    expect(formatDriveBytes(9.44 * 1024 * 1024)).toBe("9.44 MB");
    expect(formatDriveBytes(15 * 1024 * 1024 * 1024)).toBe("15 GB");
  });

  it("getGoogleDriveWorkspaceInfo trả về thông tin cấu hình mặc định chuẩn khi chưa kết nối", () => {
    const info = getGoogleDriveWorkspaceInfo(db, testTenantId);
    expect(info.connected).toBe(false);
    expect(info.folderName).toBe("STUDIOCORE.IO.VN - Studio Manh Nguyen");
    expect(info.subfolders).toEqual([
      "Sao lưu tự động",
      "Đơn hàng & Chi phí",
      "Tệp tin & Tài liệu",
    ]);
  });

  it("setupStudioDriveWorkspaceWithToken tự động tạo thư mục và 3 thư mục con trên Google Drive", async () => {
    // Mock Google Drive API
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();

      // About API (Quota)
      if (urlStr.includes("/about")) {
        return new Response(
          JSON.stringify({
            user: { emailAddress: "meiying101199@gmail.com" },
            storageQuota: {
              usage: String(9.44 * 1024 * 1024),
              limit: String(15 * 1024 * 1024 * 1024),
            },
          }),
          { status: 200 },
        );
      }

      // Search root folder -> not found initially
      if (urlStr.includes("/files?q=") && !urlStr.includes("in%20parents")) {
        return new Response(JSON.stringify({ files: [] }), { status: 200 });
      }

      // Create root folder (POST /files)
      if (init?.method === "POST" && !init?.body?.toString().includes("parents")) {
        return new Response(
          JSON.stringify({
            id: "drive-folder-root-123",
            name: "STUDIOCORE.IO.VN - Studio Manh Nguyen",
            webViewLink: "https://drive.google.com/drive/folders/drive-folder-root-123",
          }),
          { status: 200 },
        );
      }

      // Search subfolder in parents -> not found
      if (urlStr.includes("in%20parents")) {
        return new Response(JSON.stringify({ files: [] }), { status: 200 });
      }

      // Create subfolder
      if (init?.method === "POST" && init?.body?.toString().includes("parents")) {
        return new Response(
          JSON.stringify({
            id: `subfolder-${Math.random()}`,
            name: "Subfolder",
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    vi.stubGlobal("fetch", fetchMock);

    // Also add a mock connection row in driveConnections
    db.insert(driveConnections)
      .values({
        id: "conn-123",
        tenantId: testTenantId,
        provider: "google",
        refreshTokenEncrypted: "encrypted-mock-token",
        status: "connected",
      })
      .run();

    const result = await setupStudioDriveWorkspaceWithToken(
      db,
      testTenantId,
      "mock-access-token-xyz",
    );

    expect(result.folderId).toBe("drive-folder-root-123");
    expect(result.folderName).toBe("STUDIOCORE.IO.VN - Studio Manh Nguyen");
    expect(result.folderUrl).toBe("https://drive.google.com/drive/folders/drive-folder-root-123");
    expect(result.email).toBe("meiying101199@gmail.com");

    // Verify metadata saved in database settings
    const storedFolderId = db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.tenantId, testTenantId), eq(settings.key, "drive.google.folder_id")))
      .get()?.value;

    expect(storedFolderId).toBe("drive-folder-root-123");

    // Verify workspace info now reports connected with folder and quota
    const info = getGoogleDriveWorkspaceInfo(db, testTenantId);
    expect(info.connected).toBe(true);
    expect(info.folderId).toBe("drive-folder-root-123");
    expect(info.accountEmail).toBe("meiying101199@gmail.com");
    expect(info.folderUrl).toContain("drive-folder-root-123");
  });
});