"use client";

import { useState } from "react";
import { Building2, CalendarPlus, Check, KeyRound, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  updateTenantPlanAction,
  updateTenantStatusAction,
  updateContactRequestStatusAction,
  resetTenantOwnerPasswordAction,
  createTenantFromPlatformAction,
  extendTenantPlanAction,
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

export function ExtendTenantPlanModal({
  tenantId,
  tenantName,
  currentPlan,
}: {
  tenantId: string;
  tenantName: string;
  currentPlan: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="relative inline-block">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Gia hạn thời gian sử dụng gói cước"
          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50/70 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <CalendarPlus className="h-3 w-3" />
          + Gia hạn
        </button>
      ) : (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-surface p-3 shadow-xl">
          <p className="text-xs font-bold text-foreground">Gia hạn gói: {tenantName}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsPending(true);
              const fd = new FormData(e.currentTarget);
              const res = await extendTenantPlanAction(fd);
              setIsPending(false);
              if (res.success) {
                setMsg(res.message || "Thành công!");
                setTimeout(() => {
                  setOpen(false);
                  setMsg(null);
                }, 1800);
              }
            }}
            className="mt-2 space-y-2 text-xs"
          >
            <input type="hidden" name="tenantId" value={tenantId} />
            <div>
              <label className="block text-[11px] text-muted-foreground">Gói cước</label>
              <select
                name="plan"
                defaultValue={currentPlan === "trial" ? "basic" : currentPlan}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="basic">Gói Cơ bản (399k)</option>
                <option value="pro">Gói Pro (499k)</option>
                <option value="business">Gói Doanh nghiệp (699k)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground">Thời gian gia hạn</label>
              <select
                name="months"
                defaultValue="1"
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="1">+1 Tháng</option>
                <option value="3">+3 Tháng</option>
                <option value="6">+6 Tháng</option>
                <option value="12">+12 Tháng (1 Năm)</option>
              </select>
            </div>
            {msg && <p className="text-[11px] text-emerald-600 font-medium">{msg}</p>}
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => setOpen(false)}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                size="sm"
                variant="primary"
                className="h-6 px-2 text-[11px]"
              >
                {isPending ? "Đang lưu..." : "Xác nhận"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function CreateTenantModal() {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold gap-1.5 shadow-xs"
      >
        <Plus className="h-4 w-4" />
        Thêm Studio mới
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Khởi tạo Studio đối tác mới
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {success}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsPending(true);
                setError(null);
                setSuccess(null);
                const fd = new FormData(e.currentTarget);
                const res = await createTenantFromPlatformAction(fd);
                setIsPending(false);
                if (res.success) {
                  setSuccess(res.message || "Tạo studio thành công!");
                  setTimeout(() => {
                    setOpen(false);
                    setSuccess(null);
                  }, 1500);
                } else {
                  setError(res.error || "Không thể tạo studio.");
                }
              }}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Tên Studio *</label>
                  <input
                    name="studioName"
                    required
                    placeholder="VD: Mimosa Wedding..."
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">Tên Chủ Studio (Owner) *</label>
                  <input
                    name="ownerName"
                    required
                    placeholder="VD: Nguyễn Văn A..."
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Email đăng nhập *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="owner@studio.vn"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground">Số điện thoại</label>
                  <input
                    name="phone"
                    placeholder="0987654321"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground">Gói cước ban đầu</label>
                  <select
                    name="plan"
                    defaultValue="trial"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                  >
                    <option value="trial">Dùng thử (Trial 30 ngày)</option>
                    <option value="basic">Gói Cơ bản (399.000 đ/tháng)</option>
                    <option value="pro">Gói Pro (499.000 đ/tháng)</option>
                    <option value="business">Gói Doanh nghiệp (699.000 đ/tháng)</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-foreground">Thời hạn cấp ban đầu</label>
                  <select
                    name="months"
                    defaultValue="1"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground"
                  >
                    <option value="1">1 Tháng</option>
                    <option value="3">3 Tháng</option>
                    <option value="6">6 Tháng</option>
                    <option value="12">12 Tháng (1 Năm)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground">Mật khẩu khởi tạo</label>
                <input
                  name="password"
                  defaultValue="Studio@123456"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Mặc định: Studio@123456</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  size="sm"
                  className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold"
                >
                  {isPending ? "Đang khởi tạo..." : "Tạo Studio ngay"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
