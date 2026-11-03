export const CONVERSATION_STATUSES = [
  "unanswered",
  "processing",
  "replied",
] as const;

export const CONVERSATION_STATUS_LABELS: Record<string, string> = {
  unanswered: "Chưa trả lời",
  processing: "Đang xử lý",
  replied: "Đã trả lời",
};

export const CONVERSATION_CHANNELS = ["local", "facebook", "zalo"] as const;

export const CONVERSATION_CHANNEL_LABELS: Record<string, string> = {
  local: "Local inbox",
  facebook: "Fanpage",
  zalo: "Zalo",
};

export function messagingAdapterStatus(): {
  local: boolean;
  facebook: boolean;
  zalo: boolean;
  note: string;
} {
  return {
    local: true,
    facebook: false,
    zalo: false,
    note:
      "Chưa cấu hình Fanpage/Zalo connector. Tin nhắn được lưu trong local inbox; không giả vờ gửi ra kênh ngoài.",
  };
}
