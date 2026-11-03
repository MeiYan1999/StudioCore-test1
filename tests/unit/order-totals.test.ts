import { describe, expect, it } from "vitest";
import {
  calculateOrderTotals,
  calculateRemaining,
  calculateSubtotal,
  calculateVoucherDiscount,
} from "@/lib/orders/totals";

describe("tính tiền đơn hàng", () => {
  it("tính subtotal từ quantity và unitPrice", () => {
    expect(
      calculateSubtotal([
        { quantity: 2, unitPrice: 1_000_000 },
        { quantity: 1, unitPrice: 500_000 },
      ]),
    ).toBe(2_500_000);
  });

  it("voucher cố định", () => {
    expect(
      calculateVoucherDiscount(5_000_000, {
        discountType: "fixed",
        value: 300_000,
        minOrder: 3_000_000,
        maxDiscount: null,
      }),
    ).toBe(300_000);
  });

  it("voucher phần trăm bị giới hạn maxDiscount", () => {
    expect(
      calculateVoucherDiscount(14_700_000, {
        discountType: "percent",
        value: 10,
        minOrder: 3_000_000,
        maxDiscount: 1_000_000,
      }),
    ).toBe(1_000_000);
  });

  it("không áp voucher khi chưa đạt đơn tối thiểu", () => {
    expect(
      calculateVoucherDiscount(1_000_000, {
        discountType: "fixed",
        value: 300_000,
        minOrder: 3_000_000,
        maxDiscount: null,
      }),
    ).toBe(0);
  });

  it("tính tổng sau phụ thu, giảm giá và voucher", () => {
    const totals = calculateOrderTotals({
      items: [{ quantity: 1, unitPrice: 10_000_000 }],
      surcharge: 500_000,
      discount: 200_000,
      voucher: {
        discountType: "percent",
        value: 10,
        minOrder: 0,
        maxDiscount: null,
      },
    });
    expect(totals.subtotal).toBe(10_000_000);
    expect(totals.voucherDiscount).toBe(1_000_000);
    expect(totals.total).toBe(9_300_000);
  });

  it("công nợ còn lại không âm", () => {
    expect(calculateRemaining(10_000_000, 4_000_000)).toBe(6_000_000);
    expect(calculateRemaining(10_000_000, 12_000_000)).toBe(0);
  });
});
