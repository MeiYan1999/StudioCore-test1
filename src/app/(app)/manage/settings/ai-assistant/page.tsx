import { ForbiddenState } from "@/components/shared/forbidden-state";
import { AiAssistantSettingsView } from "@/components/settings/ai-assistant-settings-view";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getAiAssistantSettings } from "@/lib/services/ai-assistant-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trợ lý AI soạn tin",
  description:
    "Agent bên ngoài soạn bản nháp trong khung chat. Nhân viên bấm Gửi, Sửa hoặc Bỏ. StudioCore không tự gửi và không gọi LLM.",
};

export default async function AiAssistantSettingsPage() {
  const actor = await requireActor();
  const canManage =
    hasPermission(actor.permissions, "settings.manage") ||
    hasPermission(actor.permissions, "integrations.manage") ||
    hasPermission(actor.permissions, "settings.view");

  if (!canManage) {
    return (
      <ForbiddenState description="Chỉ chủ studio hoặc quản trị viên có quyền cấu hình Trợ lý AI soạn tin." />
    );
  }

  const db = getDb();
  const aiSettings = getAiAssistantSettings(db, actor.tenantId);

  return <AiAssistantSettingsView initialSettings={aiSettings} />;
}
