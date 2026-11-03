import { describe, expect, it } from "vitest";
import { hashSecret, verifySecret } from "@/lib/auth/password";

describe("password/PIN hashing", () => {
  it("hash và verify đúng mật khẩu", () => {
    const stored = hashSecret("Demo@123");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifySecret("Demo@123", stored)).toBe(true);
  });

  it("từ chối mật khẩu sai", () => {
    const stored = hashSecret("Demo@123");
    expect(verifySecret("Demo@1234", stored)).toBe(false);
  });

  it("từ chối hash null hoặc sai định dạng", () => {
    expect(verifySecret("Demo@123", null)).toBe(false);
    expect(verifySecret("Demo@123", "not-a-valid-hash")).toBe(false);
    expect(verifySecret("Demo@123", "scrypt$salt$deadbeef")).toBe(false);
  });

  it("hai lần hash cùng mật khẩu tạo salt khác nhau", () => {
    const first = hashSecret("111111");
    const second = hashSecret("111111");
    expect(first).not.toBe(second);
    expect(verifySecret("111111", first)).toBe(true);
    expect(verifySecret("111111", second)).toBe(true);
  });
});
