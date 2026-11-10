import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getPushSettings } from "@/lib/services/push-settings-service";
import { WebPushSettingsView } from "@/components/settings/web-push-settings-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Thông báo đẩy (Web Push)",
  description:
    "Bật thông báo để nhận tin nhắn, đơn mới, lịch chụp... trực tiếp lên thiết bị, ngay cả khi không mở app.",
};

export default async function NotificationsSettingsPage() {
  const actor = await requireActor();
  const db = getDb();
  const pushSettings = getPushSettings(db, actor.tenantId, actor.staffId);

  return (
    <WebPushSettingsView
      initialSettings={pushSettings}
      tenantName={actor.tenantName || "StudioCore"}
    />
  );
}
