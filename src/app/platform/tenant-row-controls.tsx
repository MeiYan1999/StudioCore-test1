"use client";

import { useState } from "react";
import { KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateTenantPlanAction,
  updateTenantStatusAction,
  updateContactRequestStatusAction,
  resetTenantOwnerPasswordAction,
} from "@/lib/actions/platform-actions";

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

export function ContactRequestStatusSelect({
  requestId,
  currentStatus,
}: {
  requestId: string;
  currentStatus: string;
}) {
  return (
    <form action={updateContactRequestStatusAction} className="inline-flex items-center gap-1">
      <input type="hidden" name="requestId" value={requestId} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.target.form?.requestSubmit()}
        aria-label="Đổi trạng thái liên hệ"
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="new">Mới (New)</option>
        <option value="contacted">Đã liên hệ</option>
        <option value="converted">Đã chốt (Active)</option>
        <option value="closed">Đóng / Hủy</option>
      </select>
    </form>
  );
}

export function ResetOwnerPasswordModal({
  tenantId,
  ownerName,
}: {
  tenantId: string;
  ownerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div className="relative inline-block">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Đặt lại mật khẩu cho chủ studio"
          className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <KeyRound className="h-3 w-3" aria-hidden />
          Reset Pass
        </button>
      ) : (
        <div className="mt-1 rounded-lg border border-border bg-surface p-2.5 shadow-lg">
          <p className="text-xs font-medium text-foreground">Reset pass: {ownerName}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Mật khẩu mới sẽ là: <strong className="font-mono text-primary">Studio@123456</strong>
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <form
              action={async (formData) => {
                await resetTenantOwnerPasswordAction(formData);
                setDone(true);
                setTimeout(() => {
                  setOpen(false);
                  setDone(false);
                }, 2000);
              }}
            >
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="newPassword" value="Studio@123456" />
              <Button type="submit" size="sm" variant="primary" className="h-6 px-2 text-[11px]">
                {done ? (
                  <>
                    <Check className="mr-1 h-3 w-3" /> Đã reset!
                  </>
                ) : (
                  "Xác nhận"
                )}
              </Button>
            </form>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
