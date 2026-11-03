export const SERVICE_CATEGORIES = [
  { value: "wedding", label: "Cưới" },
  { value: "baby", label: "Baby" },
  { value: "family", label: "Gia đình" },
  { value: "lookbook", label: "Lookbook" },
  { value: "event", label: "Sự kiện" },
  { value: "concept", label: "Concept" },
  { value: "other", label: "Khác" },
] as const;

export const SERVICE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((item) => [item.value, item.label]),
);

export const PRODUCT_CATEGORIES = [
  "album",
  "print",
  "frame",
  "delivery",
  "service",
  "other",
] as const;

export const PRODUCT_STATUSES = [
  { value: "active", label: "Đang bán" },
  { value: "inactive", label: "Tạm ngưng" },
  { value: "discontinued", label: "Ngừng kinh doanh" },
] as const;

export const PRODUCT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_STATUSES.map((item) => [item.value, item.label]),
);

export const VOUCHER_DISCOUNT_TYPES = [
  { value: "percent", label: "Phần trăm" },
  { value: "fixed", label: "Số tiền cố định" },
] as const;

export const VOUCHER_DISCOUNT_TYPE_LABELS: Record<string, string> =
  Object.fromEntries(VOUCHER_DISCOUNT_TYPES.map((item) => [item.value, item.label]));
