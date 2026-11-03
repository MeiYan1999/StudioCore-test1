export type NotificationChannel = "in_app" | "email" | "zalo" | "sms";

export function getNotificationAdapterStatus(): {
  channels: Record<NotificationChannel, boolean>;
  liveConfigured: boolean;
  note: string;
} {
  const email = Boolean(process.env.SMTP_URL?.trim() || process.env.EMAIL_API_KEY?.trim());
  const zalo = Boolean(process.env.ZALO_ZNS_TOKEN?.trim());
  const sms = Boolean(process.env.SMS_API_KEY?.trim());
  return {
    channels: { in_app: true, email, zalo, sms },
    liveConfigured: email || zalo || sms,
    note:
      "Local adapter ghi notification DB và log server. Email/Zalo/SMS live chưa cấu hình sẽ báo lỗi, không giả vờ gửi thành công.",
  };
}

export function sendExternalNotification(
  channel: Exclude<NotificationChannel, "in_app">,
): { ok: false; error: string } {
  const status = getNotificationAdapterStatus();
  if (!status.channels[channel]) {
    return {
      ok: false,
      error: `Kênh ${channel} chưa được cấu hình. Notification chỉ được lưu local.`,
    };
  }
  return {
    ok: false,
    error: `Adapter ${channel} chưa được triển khai trong bản demo; không giả lập gửi thành công.`,
  };
}
