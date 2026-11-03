"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { recordPaymentAction } from "@/lib/actions/order-actions";
import { initialActionState } from "@/lib/actions/action-state";
import { formatVnd } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/shared/submit-button";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-[var(--danger)]">
      {message}
    </p>
  );
}

export function PaymentSheet({
  orderId,
  remaining,
}: {
  orderId: string;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await recordPaymentAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã ghi nhận thanh toán.");
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
        <Button>
          <Landmark className="h-4 w-4" aria-hidden="true" />
          Thu tiền
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ghi nhận thanh toán</SheetTitle>
          <SheetDescription>
            Công nợ còn lại: <strong>{formatVnd(remaining)}</strong>. Số tiền được kiểm tra ở server.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="orderId" value={orderId} />
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div>
            <Label htmlFor="payment-amount">Số tiền (VND)</Label>
            <Input
              id="payment-amount"
              name="amount"
              type="number"
              min={1}
              max={remaining}
              step={1}
              defaultValue={remaining}
              className="mt-1.5"
              required
            />
            <FieldError id="payment-amount-error" message={state.fieldErrors?.amount} />
          </div>

          <div>
            <Label htmlFor="payment-method">Phương thức</Label>
            <Select
              id="payment-method"
              name="method"
              defaultValue={state.values?.method ?? "cash"}
              className="mt-1.5"
            >
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="card">Thẻ</option>
              <option value="ewallet">Ví điện tử</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="payment-reference">Mã giao dịch / ghi chú</Label>
            <Input
              id="payment-reference"
              name="reference"
              defaultValue={state.values?.reference ?? ""}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="payment-paid-at">Thời điểm thanh toán</Label>
            <Input
              id="payment-paid-at"
              name="paidAt"
              type="datetime-local"
              defaultValue={state.values?.paidAt ?? ""}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Để trống để dùng thời điểm hiện tại.
            </p>
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang lưu...">Ghi nhận thanh toán</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
