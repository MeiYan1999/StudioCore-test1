import { describe, expect, it } from "vitest";
import { getVietnamMonthRange } from "@/lib/scheduling/time";

describe("getVietnamMonthRange", () => {
  it("trả mốc tháng theo Asia/Ho_Chi_Minh, độc lập timezone runner", () => {
    const november = getVietnamMonthRange("2026-11");
    expect(november.start.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(november.end.toISOString()).toBe("2026-11-30T16:59:59.999Z");

    const leapFebruary = getVietnamMonthRange("2028-02");
    expect(leapFebruary.end.toISOString()).toBe("2028-02-29T16:59:59.999Z");
  });

  it("từ chối tháng không hợp lệ", () => {
    expect(() => getVietnamMonthRange("2026-13")).toThrow();
    expect(() => getVietnamMonthRange("2026-1")).toThrow();
  });
});
