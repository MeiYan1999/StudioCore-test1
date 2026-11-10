import { desc, eq } from "drizzle-orm";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { BillingManagementView } from "@/components/subscription/billing-management-view";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { platformSubscriptions } from "@/lib/db/schema";
import { getTenantCurrentSubscription } from "@/lib/services/subscription-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản lý gói cước & Đăng ký dịch vụ",
  description: "Nâng cấp và gia hạn gói cước StudioCore tự động qua VietQR NAPAS247.",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const actor = await requireActor();
  const canView =
    hasPermission(actor.permissions, "settings.view") ||
    hasPermission(actor.permissions, "settings.manage");

  if (!canView) {
    return (
      <ForbiddenState description="Bạn không có quyền truy cập trang Quản lý gói cước." />
    );
  }

  const params = searchParams ? await searchParams : {};
  const initialPlan = params.plan;

  const db = getDb();
  const currentPlanData = getTenantCurrentSubscription(db, actor.tenantId);

  if (!currentPlanData) {
    return (
      <ForbiddenState description="Không tìm thấy thông tin gói cước của Studio." />
    );
  }

  const history = db
    .select()
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.tenantId, actor.tenantId))
    .orderBy(desc(platformSubscriptions.createdAt))
    .all();

  return (
    <BillingManagementView
      currentPlanData={currentPlanData}
      subscriptionHistory={history}
      initialPlan={initialPlan}
    />
  );
}
