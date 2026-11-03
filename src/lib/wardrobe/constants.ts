export const WARDROBE_STATUSES = [
  { value: "available", label: "Sẵn sàng" },
  { value: "rented", label: "Đang cho thuê" },
  { value: "cleaning", label: "Đang giặt" },
  { value: "maintenance", label: "Bảo trì" },
  { value: "retired", label: "Ngừng dùng" },
] as const;

export const WARDROBE_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  WARDROBE_STATUSES.map((item) => [item.value, item.label]),
);

export const RENTAL_STATUSES = [
  { value: "active", label: "Đang thuê" },
  { value: "returned", label: "Đã trả" },
  { value: "cancelled", label: "Đã hủy" },
] as const;

export const RENTAL_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  RENTAL_STATUSES.map((item) => [item.value, item.label]),
);

export const RENTAL_CONDITIONS = [
  { value: "good", label: "Tốt" },
  { value: "cleaning", label: "Cần giặt" },
  { value: "damaged", label: "Hư hỏng" },
] as const;

export const RENTAL_CONDITION_LABELS: Record<string, string> = Object.fromEntries(
  RENTAL_CONDITIONS.map((item) => [item.value, item.label]),
);

export const EQUIPMENT_STATUSES = [
  { value: "available", label: "Sẵn sàng" },
  { value: "in_use", label: "Đang sử dụng" },
  { value: "maintenance", label: "Bảo trì" },
  { value: "retired", label: "Ngừng dùng" },
] as const;

export const EQUIPMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  EQUIPMENT_STATUSES.map((item) => [item.value, item.label]),
);

export const EQUIPMENT_CATEGORIES = [
  "camera",
  "lens",
  "light",
  "accessory",
  "other",
] as const;
