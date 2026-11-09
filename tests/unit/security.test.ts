import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { assertSameOrigin } from "@/lib/http/security";
import { parseDriveFolderLink } from "@/lib/adapters/drive";
import { publicUploadUrl, resolveStoragePath } from "@/lib/storage/local-storage";

describe("security Phase 7", () => {
  it("CSRF origin guard chặn origin lạ, cho same-origin", () => {
    const same = new Request("http://localhost:3000/api/uploads/photos", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(same)).not.toThrow();
    const evil = new Request("http://localhost:3000/api/uploads/photos", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSameOrigin(evil)).toThrow(/Origin|ứng dụng/);
  });

  it("SSRF: chỉ nhận Google Drive HTTPS và folder demo local", () => {
    expect(parseDriveFolderLink("https://evil.example/drive/folders/demo-folder-1")).toBeNull();
    expect(parseDriveFolderLink("http://drive.google.com/drive/folders/abc123")).toBeNull();
    expect(parseDriveFolderLink("https://drive.google.com.evil.example/drive/folders/abc123")).toBeNull();
    expect(parseDriveFolderLink("https://drive.google.com/drive/folders/demo-folder-1")?.provider).toBe(
      "local_demo",
    );
    expect(parseDriveFolderLink("https://drive.google.com/drive/folders/real-folder-123")?.provider).toBe(
      "google",
    );
    expect(
      parseDriveFolderLink(
        "https://drive.google.com/drive/folders/1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ?usp=sharing",
      )?.folderId,
    ).toBe("1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ");
    expect(
      parseDriveFolderLink(
        "https://drive.google.com/drive/u/1/folders/1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ",
      )?.folderId,
    ).toBe("1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ");
    expect(
      parseDriveFolderLink(
        "https://drive.google.com/folderview?id=1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ",
      )?.folderId,
    ).toBe("1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ");
    expect(
      parseDriveFolderLink("1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ")?.folderId,
    ).toBe("1Y_iq_9JTzaQOIZ_1LxTOnd6aVJWcVjQQ");
  });

  it("path traversal bị chặn", () => {
    expect(() => resolveStoragePath("../outside.jpg")).toThrow(/không hợp lệ/);
    expect(() => resolveStoragePath("tenant/../../outside.jpg")).toThrow(/không hợp lệ/);
    expect(() => resolveStoragePath("/etc/passwd")).toThrow(/không hợp lệ/);
  });

  it("React escape nội dung người dùng (XSS)", () => {
    const markup = renderToStaticMarkup(
      createElement("div", null, '<script>alert("xss")</script>'),
    );
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;script&gt;");
  });

  it("publicUploadUrl giữ nguyên HTTP/HTTPS URL trực tiếp của Google CDN", () => {
    const cdnUrl = "https://drive.google.com/thumbnail?id=123&sz=w800";
    expect(publicUploadUrl(cdnUrl)).toBe(cdnUrl);
    expect(publicUploadUrl("tenant/album/photo-thumb.jpg")).toBe(
      "/api/files/tenant/album/photo-thumb.jpg",
    );
  });
});
