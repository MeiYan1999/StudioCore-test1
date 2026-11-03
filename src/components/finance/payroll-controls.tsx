"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCog, Check, Lock, Play } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  generatePayrollsAction,
  setPayrollStatusAction,
  updatePayrollAction,
} from "@/lib/actions/payroll-hr-actions";

export function GeneratePayrollButton({ period }: { period: string }) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await generatePayrollsAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã tạo bảng lương.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không tạo được bảng lương.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="period" value={period} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Đang tạo...">
        <CalendarCog className="h-4 w-4" aria-hidden />
        Tạo bảng lương
      </SubmitButton>
    </form>
  );
}

export function PayrollEditSheet({
  payroll,
}: {
  payroll: {
    id: string;
    staffName: string;
    period: string;
    baseSalary: number;
    commissionAmount: number;
    bonus: number;
    deduction: number;
    net: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await updatePayrollAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật lương.");
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
        <Button variant="ghost" size="sm">
          Sửa
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Sửa bảng lương — {payroll.staffName}</SheetTitle>
          <SheetDescription>
            Kỳ {payroll.period}; thưởng/khấu trừ được audit và chỉ sửa khi nháp.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <input type="hidden" name="payrollId" value={payroll.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="payroll-bonus">Thưởng</Label>
              <Input id="payroll-bonus" name="bonus" type="number" min={0} defaultValue={payroll.bonus} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="payroll-deduction">Khấu trừ</Label>
              <Input id="payroll-deduction" name="deduction" type="number" min={0} defaultValue={payroll.deduction} className="mt-1.5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Net hiện tại dựa trên lương cơ bản + hoa hồng + thưởng − khấu trừ.
          </p>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Lưu bảng lương</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function PayrollStatusAction({
  payrollId,
  status,
}: {
  payrollId: string;
  status: string;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await setPayrollStatusAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật lương.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không cập nhật được lương.");
      }
      return result;
    },
    initialActionState,
  );
  const next =
    status === "draft" ? { value: "pending", label: "Gửi duyệt" } : status === "pending" ? { value: "approved", label: "Duyệt" } : status === "approved" ? { value: "paid", label: "Chi trả & khóa" } : null;
  if (!next) return null;
  return (
    <form action={formAction}>
      <input type="hidden" name="payrollId" value={payrollId} />
      <input type="hidden" name="status" value={next.value} />
      <SubmitButton
        variant={next.value === "paid" ? "primary" : "outline"}
        size="sm"
        pendingLabel="..."
      >
        {next.value === "paid" ? (
          <Lock className="h-3.5 w-3.5" aria-hidden />
        ) : next.value === "approved" ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5" aria-hidden />
        )}
        {next.label}
      </SubmitButton>
    </form>
  );
}
