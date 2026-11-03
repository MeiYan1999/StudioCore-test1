export const TRANSACTION_TYPES = ["income", "expense", "refund"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Thu",
  expense: "Chi",
  refund: "Hoàn tiền",
};

export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "vietqr",
  "card",
  "ewallet",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  vietqr: "VietQR",
  card: "Thẻ",
  ewallet: "Ví điện tử",
};

export const TRANSACTION_CATEGORIES = [
  "order_payment",
  "deposit",
  "refund",
  "rent",
  "marketing",
  "equipment",
  "salary",
  "commission",
  "tax",
  "other",
] as const;

export const TRANSACTION_CATEGORY_LABELS: Record<string, string> = {
  order_payment: "Thanh toán đơn",
  deposit: "Thu cọc",
  refund: "Hoàn tiền",
  rent: "Thuê mặt bằng",
  marketing: "Marketing",
  equipment: "Thiết bị",
  salary: "Lương",
  commission: "Hoa hồng",
  tax: "Thuế",
  other: "Khác",
};

export const INVOICE_STATUSES = ["draft", "issued", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Nháp",
  issued: "Đã phát hành",
  paid: "Đã thu",
  cancelled: "Đã hủy",
};

export const EXPENSE_CATEGORIES = [
  "rent",
  "marketing",
  "equipment",
  "salary",
  "utility",
  "other",
] as const;

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: "Thuê mặt bằng",
  marketing: "Marketing",
  equipment: "Thiết bị",
  salary: "Lương",
  utility: "Điện nước",
  other: "Khác",
};

export const INVOICE_VAT_RATES = [0, 5, 8, 10] as const;
