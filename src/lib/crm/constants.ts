export const CUSTOMER_SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google" },
  { value: "referral", label: "Giới thiệu" },
  { value: "walk_in", label: "Walk-in" },
  { value: "other", label: "Khác" },
] as const;

export const CUSTOMER_TIERS = [
  { value: "standard", label: "Standard" },
  { value: "vip", label: "VIP" },
  { value: "vvip", label: "VVIP" },
] as const;

export const CUSTOMER_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Đang hoạt động" },
  { value: "inactive", label: "Tạm ngưng" },
  { value: "churned", label: "Đã rời bỏ" },
] as const;

export const CUSTOMER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CUSTOMER_STATUSES.map((item) => [item.value, item.label]),
);

export const CUSTOMER_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  CUSTOMER_SOURCES.map((item) => [item.value, item.label]),
);

export const CUSTOMER_TIER_LABELS: Record<string, string> = Object.fromEntries(
  CUSTOMER_TIERS.map((item) => [item.value, item.label]),
);

export const INTERACTION_TYPES = [
  { value: "call", label: "Gọi điện" },
  { value: "message", label: "Tin nhắn" },
  { value: "meeting", label: "Gặp mặt" },
  { value: "note", label: "Ghi chú" },
  { value: "follow_up", label: "Follow-up" },
  { value: "review", label: "Đánh giá" },
] as const;

export const INTERACTION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  INTERACTION_TYPES.map((item) => [item.value, item.label]),
);

export const CUSTOMER_SEGMENTS = [
  { value: "vip", label: "Khách VIP" },
  { value: "new_30d", label: "Khách mới 30 ngày" },
  { value: "at_risk", label: "Nguy cơ rời bỏ" },
  { value: "birthday_month", label: "Sinh nhật tháng này" },
  { value: "debt", label: "Còn công nợ" },
  { value: "lead", label: "Lead chưa xử lý" },
] as const;
