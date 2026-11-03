export type OrderLine = {
  quantity: number;
  unitPrice: number;
};

export type VoucherRule = {
  discountType: "percent" | "fixed";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
};

export type OrderTotalsInput = {
  items: OrderLine[];
  surcharge: number;
  discount: number;
  voucher?: VoucherRule | null;
};

export type OrderTotals = {
  subtotal: number;
  voucherDiscount: number;
  total: number;
};

export function calculateSubtotal(items: OrderLine[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function calculateVoucherDiscount(
  subtotal: number,
  voucher?: VoucherRule | null,
): number {
  if (!voucher || subtotal < voucher.minOrder) {
    return 0;
  }

  const raw =
    voucher.discountType === "percent"
      ? Math.floor((subtotal * voucher.value) / 100)
      : voucher.value;

  const capped =
    voucher.maxDiscount !== null ? Math.min(raw, voucher.maxDiscount) : raw;

  return Math.max(0, Math.min(capped, subtotal));
}

export function calculateOrderTotals(input: OrderTotalsInput): OrderTotals {
  const subtotal = calculateSubtotal(input.items);
  const voucherDiscount = calculateVoucherDiscount(subtotal, input.voucher);
  const total = Math.max(
    0,
    subtotal + input.surcharge - input.discount - voucherDiscount,
  );

  return { subtotal, voucherDiscount, total };
}

export function calculateRemaining(total: number, paid: number): number {
  return Math.max(0, total - paid);
}
