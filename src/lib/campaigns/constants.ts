export const CAMPAIGN_SOURCES = [
  "facebook",
  "tiktok",
  "google",
  "referral",
  "offline",
] as const;

export const CAMPAIGN_SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  tiktok: "TikTok",
  google: "Google",
  referral: "Giới thiệu",
  offline: "Offline",
};

export const CAMPAIGN_STATUSES = ["active", "paused", "ended"] as const;
export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  active: "Đang chạy",
  paused: "Tạm dừng",
  ended: "Đã kết thúc",
};

export function getCampaignAdapterStatus(): {
  configured: boolean;
  label: string;
  detail: string;
} {
  const label = "Chưa cấu hình Meta/TikTok Ads";
  return {
    configured: false,
    label,
    detail:
      "Không gọi API quảng cáo khi chưa có token. Số liệu trong trang là số nhập tay phục vụ demo.",
  };
}
