import { ForbiddenState } from "@/components/shared/forbidden-state";
import { AiHubView } from "@/components/ai/ai-hub-view";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getAiHubData } from "@/lib/services/ai-hub-service";
import { listAiJobLogs } from "@/lib/services/ai-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trung tâm AI - Hub v2",
  description:
    "Quản lý Pool API Key dùng chung, tự động fallback và cấu hình định mức 6 tính năng AI của studio.",
};

export default async function AiSettingsPage() {
  const actor = await requireActor();
  const canManage =
    hasPermission(actor.permissions, "settings.manage") ||
    hasPermission(actor.permissions, "integrations.manage") ||
    hasPermission(actor.permissions, "settings.view");

  if (!canManage) {
    return (
      <ForbiddenState description="Chỉ chủ studio hoặc quản trị viên có quyền cấu hình Trung tâm AI." />
    );
  }

  const db = getDb();
  const aiHubData = getAiHubData(db, actor.tenantId);
  const jobs = listAiJobLogs(db, actor, 10);

  return <AiHubView initialData={aiHubData} recentJobs={jobs} />;
}
