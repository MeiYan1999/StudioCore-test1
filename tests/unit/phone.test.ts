import { describe, expect, it } from "vitest";
import { normalizeVietnamesePhone } from "@/lib/utils/phone";

describe("chuẩn hóa số điện thoại Việt Nam", () => {
  it("giữ số 10 chữ số hợp lệ", () => {
    expect(normalizeVietnamesePhone("0900000001")).toBe("0900000001");
  });

  it("bỏ khoảng trắng, dấu chấm, gạch ngang", () => {
    expect(normalizeVietnamesePhone("090 000 0001")).toBe("0900000001");
    expect(normalizeVietnamesePhone("090.000.0001")).toBe("0900000001");
    expect(normalizeVietnamesePhone("090-000-0001")).toBe("0900000001");
  });

  it("chuyển +84 và 84 về 0", () => {
    expect(normalizeVietnamesePhone("+84 90 000 0001")).toBe("0900000001");
    expect(normalizeVietnamesePhone("84900000001")).toBe("0900000001");
  });

  it("từ chối số không hợp lệ", () => {
    expect(normalizeVietnamesePhone("12345")).toBeNull();
    expect(normalizeVietnamesePhone("090000000")).toBeNull();
    expect(normalizeVietnamesePhone("09000000011")).toBeNull();
    expect(normalizeVietnamesePhone("abc")).toBeNull();
    expect(normalizeVietnamesePhone("")).toBeNull();
  });
});
