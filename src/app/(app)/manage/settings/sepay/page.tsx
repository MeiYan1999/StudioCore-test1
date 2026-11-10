import { ForbiddenState } from "@/components/shared/forbidden-state";
import { SepaySettingsView } from "@/components/settings/sepay-settings-view";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getSepaySettings } from "@/lib/services/sepay-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kết nối SePay – Biến động số dư",
  description:
    "Kết nối SePay để hệ thống tự động nhận giao dịch tiền vào/ra của các tài khoản ngân hàng đã liên kết với ví cửa hàng.",
};

export default async function SepaySettingsPage() {
  const actor = await requireActor();
  const canManage =
    hasPermission(actor.permissions, "settings.manage") ||
    hasPermission(actor.permissions, "finance.manage") ||
    hasPermission(actor.permissions, "integrations.manage");

  if (!canManage) {
    return (
      <ForbiddenState description="Chỉ chủ studio hoặc quản trị tài chính mới có quyền quản lý kết nối SePay." />
    );
  }

  const db = getDb();
  const sepaySettings = getSepaySettings(db, actor.tenantId);

  return <SepaySettingsView initialSettings={sepaySettings} />;
}
