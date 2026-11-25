import { describe, expect, it } from "vitest";
import { signedFileUrl, signedFileUrlRemainingMs } from "@/lib/storage/signed-url";

const key = "tenant-a/album-1/upload-1a2b3c4d-anh-thumb.webp";
const now = new Date("2026-06-01T10:20:00+07:00");

function parts(url: string) {
  const query = new URL(url, "https://studiocore.test").searchParams;
  return { exp: query.get("exp"), sig: query.get("sig") };
}

describe("URL ký cho thumbnail/preview của link share", () => {
  it("chữ ký hợp lệ trong tối đa 2 giờ rồi hết hạn", () => {
    const { exp, sig } = parts(signedFileUrl(key, { now }));
    const remaining = signedFileUrlRemainingMs(key, exp, sig, now);
    expect(remaining).toBeGreaterThan(60 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    expect(signedFileUrlRemainingMs(key, exp, sig, later)).toBe(0);
  });

  it("không vượt quá hạn của link share", () => {
    const notAfter = new Date(now.getTime() + 5 * 60 * 1000);
    const { exp, sig } = parts(signedFileUrl(key, { now, notAfter }));
    expect(Number(exp)).toBe(notAfter.getTime());
    expect(signedFileUrlRemainingMs(key, exp, sig, new Date(notAfter.getTime() + 1))).toBe(0);
  });

  it("từ chối chữ ký thiếu, sai, của file khác hoặc bị đổi hạn", () => {
    const { exp, sig } = parts(signedFileUrl(key, { now }));
    expect(signedFileUrlRemainingMs(key, null, null, now)).toBe(0);
    expect(signedFileUrlRemainingMs(key, exp, "sai", now)).toBe(0);
    expect(
      signedFileUrlRemainingMs(key.replace("-thumb", "-preview"), exp, sig, now),
    ).toBe(0);
    expect(signedFileUrlRemainingMs(key, String(Number(exp) + 1), sig, now)).toBe(0);
  });
});
