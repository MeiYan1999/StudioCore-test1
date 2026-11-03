"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  approveCommissionAction,
  payCommissionAction,
  saveCommissionRuleAction,
} from "@/lib/actions/payroll-hr-actions";

export function CommissionRuleSheet() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await saveCommissionRuleAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu rule.");
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
        <Button size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          Rule hoa hồng
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Thêm rule hoa hồng</SheetTitle>
          <SheetDescription>
            Rule snapshot tại thời điểm tính; đổi rule không tính lại commission cũ.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="commission-rule-name">Tên rule</Label>
            <Input id="commission-rule-name" name="name" required className="mt-1.5" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="commission-rule-role">Vai trò</Label>
              <Select id="commission-rule-role" name="role" defaultValue="photographer" className="mt-1.5">
                <option value="photographer">Photographer</option>
                <option value="makeup">Makeup</option>
                <option value="retoucher">Retoucher</option>
                <option value="sale">Sale</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="commission-rule-type">Loại</Label>
              <Select id="commission-rule-type" name="type" defaultValue="percent" className="mt-1.5">
                <option value="percent">% giá trị đơn</option>
                <option value="fixed">Cố định / buổi</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="commission-rule-value">Giá trị (VND hoặc %)</Label>
              <Input id="commission-rule-value" name="value" type="number" min={1} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="commission-rule-effective">Hiệu lực từ</Label>
              <Input id="commission-rule-effective" name="effectiveFrom" type="datetime-local" className="mt-1.5" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-border" />
            Đang hoạt động
          </label>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Lưu rule</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CommissionActionForm({
  commissionId,
  action,
  label,
  variant,
}: {
  commissionId: string;
  action: "approve" | "pay";
  label: string;
  variant: "outline" | "primary";
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result =
        action === "approve"
          ? await approveCommissionAction(previousState, formData)
          : await payCommissionAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật hoa hồng.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không cập nhật được hoa hồng.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="commissionId" value={commissionId} />
      <SubmitButton variant={variant} size="sm" pendingLabel="...">
        <Check className="h-3.5 w-3.5" aria-hidden />
        {label}
      </SubmitButton>
    </form>
  );
}

export function CommissionActions({
  commissionId,
  status,
  payrollId,
}: {
  commissionId: string;
  status: string;
  payrollId: string | null;
}) {
  if (status === "pending") {
    return (
      <CommissionActionForm
        commissionId={commissionId}
        action="approve"
        label="Duyệt"
        variant="outline"
      />
    );
  }
  if (status === "approved" && !payrollId) {
    return (
      <CommissionActionForm
        commissionId={commissionId}
        action="pay"
        label="Chi trả"
        variant="primary"
      />
    );
  }
  if (status === "approved" && payrollId) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Trong bảng lương
      </span>
    );
  }
  return null;
}
