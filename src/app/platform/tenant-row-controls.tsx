"use client";

import { updateTenantPlanAction, updateTenantStatusAction } from "@/lib/actions/platform-actions";

export function TenantPlanSelect({
  tenantId,
  currentPlan,
}: {
  tenantId: string;
  currentPlan: string;
}) {
  return (
    <form action={updateTenantPlanAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="tenantId" value={tenantId} />
      <select
        name="plan"
        defaultValue={currentPlan}
        onChange={(e) => e.target.form?.requestSubmit()}
        aria-label="Đổi gói cước"
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="trial">Dùng thử (Trial)</option>
        <option value="basic">Cơ bản (399k)</option>
        <option value="pro">Pro (499k)</option>
        <option value="business">Doanh nghiệp (699k)</option>
      </select>
    </form>
  );
}

export function TenantStatusSelect({
  tenantId,
  currentStatus,
}: {
  tenantId: string;
  currentStatus: string;
}) {
  return (
    <form action={updateTenantStatusAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="tenantId" value={tenantId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.target.form?.requestSubmit()}
        aria-label="Đổi trạng thái"
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="active">Hoạt động (Active)</option>
        <option value="trial">Dùng thử (Trial)</option>
        <option value="suspended">Tạm khóa (Suspended)</option>
      </select>
    </form>
  );
}
