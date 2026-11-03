import { describe, expect, it } from "vitest";
import {
  createShareTokenRecord,
  generateShareToken,
  hashShareToken,
  revealShareToken,
} from "@/lib/share/token";
import { decryptSecret, encryptSecret } from "@/lib/security/secret-crypto";
import { formatPhotoCodes } from "@/lib/share/copy-formats";

describe("PhotoShare token", () => {
  it("sinh token khó đoán, hash ổn định và mã hóa round-trip", () => {
    const raw = generateShareToken();
    expect(raw.length).toBeGreaterThanOrEqual(30);
    const another = generateShareToken();
    expect(another).not.toBe(raw);

    const record = createShareTokenRecord(raw);
    expect(record.tokenHash).toBe(hashShareToken(raw));
    expect(record.tokenHash).not.toBe(raw);
    expect(revealShareToken(record.tokenEncrypted)).toBe(raw);

    const encrypted = encryptSecret("refresh-token-demo");
    expect(encrypted).not.toContain("refresh-token-demo");
    expect(decryptSecret(encrypted)).toBe("refresh-token-demo");
    expect(decryptSecret("v1.bad.bad.bad")).toBeNull();
  });

  it("format mã ảnh đúng 4 định dạng và tùy chọn ghi chú", () => {
    const items = [
      {
        code: "ANH-001",
        filename: "anh-001.jpg",
        note: "Xóa mụn",
      },
      {
        code: "ANH-002",
        filename: "anh-002.png",
        note: null,
      },
    ];
    expect(formatPhotoCodes(items, "newline", false)).toBe("ANH-001\nANH-002");
    expect(formatPhotoCodes(items, "comma", false)).toBe("ANH-001, ANH-002");
    expect(formatPhotoCodes(items, "space", false)).toBe("ANH-001 ANH-002");
    expect(formatPhotoCodes(items, "filename", false)).toBe(
      "ANH-001.jpg\nANH-002.png",
    );
    expect(formatPhotoCodes(items, "newline", true)).toBe(
      "ANH-001\tXóa mụn\nANH-002",
    );
    expect(formatPhotoCodes(items, "comma", true)).toBe(
      "ANH-001 [Xóa mụn], ANH-002",
    );
  });
});
