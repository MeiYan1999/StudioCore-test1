"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import {
  saveBranchAction,
  saveStudioSettingsAction,
} from "@/lib/actions/settings-actions";

type Settings = Record<string, string>;

function parseHours(raw: string | undefined): Record<string, string> {
  try {
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function StudioSettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction] = useActionState(
    saveStudioSettingsAction,
    initialActionState,
  );
  const hours = parseHours(settings["studio.workingHours"]);
  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Thông tin studio</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="studio-name">Tên studio</Label>
            <Input id="studio-name" name="name" defaultValue={settings["studio.name"] ?? ""} className="mt-1.5" required />
          </div>
          <div>
            <Label htmlFor="studio-subdomain">Tên miền phụ (Subdomain của Studio)</Label>
            <div className="mt-1.5 flex rounded-lg">
              <Input
                id="studio-subdomain"
                name="subdomain"
                defaultValue={settings["studio.subdomain"] ?? ""}
                placeholder="manhnguyen"
                className="font-mono rounded-r-none"
              />
              <span className="inline-flex items-center rounded-r-lg border border-l-0 border-border bg-surface-muted px-3 text-xs text-muted-foreground whitespace-nowrap">
                .studiocore.io.vn
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Link PhotoShare sẽ tự đổi thành:{" "}
              <code className="text-primary font-mono font-medium">
                https://{settings["studio.subdomain"] || "manhnguyen"}.studiocore.io.vn/share/...
              </code>{" "}
              (để trống sẽ lấy domain gốc studiocore.io.vn).
            </p>
          </div>
          <div>
            <Label htmlFor="studio-logo">Logo URL</Label>
            <Input id="studio-logo" name="logoUrl" defaultValue={settings["studio.logoUrl"] ?? ""} className="mt-1.5" placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="studio-address">Địa chỉ</Label>
            <Input id="studio-address" name="address" defaultValue={settings["studio.address"] ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-phone">SĐT</Label>
            <Input id="studio-phone" name="phone" defaultValue={settings["studio.phone"] ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-email">Email</Label>
            <Input id="studio-email" name="email" type="email" defaultValue={settings["studio.email"] ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-website">Website</Label>
            <Input id="studio-website" name="website" defaultValue={settings["studio.website"] ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-tax">MST</Label>
            <Input id="studio-tax" name="taxCode" defaultValue={settings["studio.taxCode"] ?? ""} className="mt-1.5" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Tài khoản ngân hàng / VietQR</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="studio-bank-name">Ngân hàng</Label>
            <Input id="studio-bank-name" name="bankName" defaultValue={settings["payment.bankName"] ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-bank-bin">Bank BIN (6 số)</Label>
            <Input id="studio-bank-bin" name="bankBin" defaultValue={settings["payment.bankBin"] ?? ""} inputMode="numeric" maxLength={6} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-bank-account">Số tài khoản</Label>
            <Input id="studio-bank-account" name="bankAccountNumber" defaultValue={settings["payment.bankAccountNumber"] ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-bank-holder">Chủ tài khoản</Label>
            <Input id="studio-bank-holder" name="bankAccountName" defaultValue={settings["payment.bankAccountName"] ?? ""} className="mt-1.5" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Giờ làm việc</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="studio-weekday-hours">Thứ 2 – Thứ 6</Label>
            <Input id="studio-weekday-hours" name="weekdayHours" defaultValue={hours.monday ?? "08:00-18:00"} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-saturday-hours">Thứ 7</Label>
            <Input id="studio-saturday-hours" name="saturdayHours" defaultValue={hours.saturday ?? "08:00-17:00"} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="studio-sunday-hours">Chủ nhật</Label>
            <Input id="studio-sunday-hours" name="sundayHours" defaultValue={hours.sunday ?? "closed"} className="mt-1.5" />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Định dạng HH:MM-HH:MM hoặc “closed”.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Mẫu thông báo</h2>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="studio-review-template">Yêu cầu đánh giá</Label>
            <Textarea
              id="studio-review-template"
              name="reviewTemplate"
              rows={2}
              defaultValue={
                settings["notification.reviewTemplate"] ??
                "Cảm ơn bạn đã tin chọn studio. Vui lòng chia sẻ đánh giá để studio phục vụ tốt hơn."
              }
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="studio-reminder-template">Nhắc lịch</Label>
            <Textarea
              id="studio-reminder-template"
              name="reminderTemplate"
              rows={2}
              defaultValue={
                settings["notification.reminderTemplate"] ??
                "Studio nhắc bạn về lịch chụp sắp tới. Vui lòng liên hệ nếu cần đổi lịch."
              }
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Đang lưu...">
          <Save className="h-4 w-4" aria-hidden />
          Lưu cấu hình studio
        </SubmitButton>
      </div>
    </form>
  );
}

export function BranchSheet({
  branch,
}: {
  branch?: {
    id: string;
    name: string;
    address: string;
    phone: string;
    status: string;
  };
}) {
  const isEdit = Boolean(branch);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await saveBranchAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu chi nhánh.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={isEdit ? "ghost" : "primary"} size="sm">
          {isEdit ? "Sửa" : <><Building2 className="h-4 w-4" aria-hidden />Thêm chi nhánh</>}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa chi nhánh" : "Thêm chi nhánh"}</SheetTitle>
          <SheetDescription>
            Chi nhánh mới dùng giờ làm mặc định; giờ chi tiết có thể cấu hình sau.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          {branch ? <input type="hidden" name="branchId" value={branch.id} /> : null}
          <div>
            <Label htmlFor="branch-name">Tên chi nhánh</Label>
            <Input id="branch-name" name="name" defaultValue={branch?.name ?? ""} required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="branch-address">Địa chỉ</Label>
            <Input id="branch-address" name="address" defaultValue={branch?.address ?? ""} required className="mt-1.5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="branch-phone">SĐT</Label>
              <Input id="branch-phone" name="phone" defaultValue={branch?.phone ?? ""} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="branch-status">Trạng thái</Label>
              <Select id="branch-status" name="status" defaultValue={branch?.status ?? "active"} className="mt-1.5">
                <option value="active">Hoạt động</option>
                <option value="inactive">Tạm khóa</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Lưu chi nhánh</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
