import { describe, expect, it } from "vitest";
import { looksLikeDerivativeKey, resolveFileAccess } from "@/lib/storage/file-access";

const staffA = { tenantId: "tenant-a", permissions: ["albums.view"] as never };
const staffB = { tenantId: "tenant-b", permissions: ["albums.view"] as never };
const platformAdmin = { tenantId: "platform", permissions: ["tenants.manage"] as never };
const original = "tenant-a/album-1/upload-1a2b3c4d-anh.webp";

describe("quyền đọc file qua /api/files", () => {
  it("thumbnail, preview và album demo là công khai", () => {
    expect(resolveFileAccess("tenant-a/album-1/upload-1a2b3c4d-anh-thumb.webp", null, true)).toBe("public");
    expect(resolveFileAccess("tenant-a/album-1/upload-1a2b3c4d-anh-preview.jpg", null, true)).toBe("public");
    expect(resolveFileAccess("tenant-demo/album-demo-01/duoi-ca/anh-001.jpg", null)).toBe("public");
  });

  it("ảnh gốc đặt tên giống thumbnail vẫn là riêng tư", () => {
    expect(looksLikeDerivativeKey("tenant-a/album-1/upload-1a2b3c4d-anh-thumb.webp")).toBe(true);
    expect(resolveFileAccess("tenant-a/album-1/upload-1a2b3c4d-anh-thumb.webp", null, false)).toBe("denied");
  });

  it("ảnh gốc không đọc được khi chưa đăng nhập hoặc khác tenant", () => {
    expect(resolveFileAccess(original, null)).toBe("denied");
    expect(resolveFileAccess(original, staffB)).toBe("denied");
  });

  it("ảnh gốc chỉ dành cho nhân sự có quyền album trong cùng tenant", () => {
    expect(resolveFileAccess(original, staffA)).toBe("private");
    expect(resolveFileAccess(original, platformAdmin)).toBe("denied");
    expect(resolveFileAccess("tenant-demo/album-demo-01/upload-private.jpg", null)).toBe("denied");
  });

  it("chặn backup, tài liệu và path traversal kể cả khi đã đăng nhập", () => {
    for (const key of ["db/backup.sqlite", "documents/hop-dong.pdf", "tenant-a/../db/x", "/etc/passwd", ""]) {
      expect(resolveFileAccess(key, platformAdmin)).toBe("denied");
    }
    expect(resolveFileAccess("db/backup-thumb.jpg", null, true)).toBe("denied");
  });
});
