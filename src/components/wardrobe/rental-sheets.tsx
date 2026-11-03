"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import {
  createRentalAction,
  returnRentalAction,
} from "@/lib/actions/wardrobe-actions";
import { initialActionState } from "@/lib/actions/action-state";
import type { OrderOption } from "@/lib/services/order-service";
import type { RentalView, WardrobeItemView } from "@/lib/services/wardrobe-service";
import { RENTAL_CONDITIONS } from "@/lib/wardrobe/constants";
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

export function RentalSheet({
  item,
  orders,
  defaultDueAt,
}: {
  item: WardrobeItemView;
  orders: OrderOption[];
  defaultDueAt: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createRentalAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã tạo phiếu thuê.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const branchOrders = orders.filter((order) => order.branchId === item.branchId);
  const values = state.values;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <PackageCheck className="h-4 w-4" aria-hidden="true" />
          Cho thuê
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Cho thuê trang phục</SheetTitle>
          <SheetDescription>
            {item.name} · {item.sku}. Khoản cọc được ghi nhận trên phiếu thuê.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="wardrobeItemId" value={item.id} />
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div>
            <Label htmlFor="rental-order">Đơn hàng (không bắt buộc)</Label>
            <Select
              id="rental-order"
              name="orderId"
              defaultValue={values?.orderId ?? branchOrders[0]?.id ?? ""}
              className="mt-1.5"
            >
              <option value="">Không gắn đơn</option>
              {branchOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.code} · {order.customerName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rental-due">Hạn trả</Label>
            <Input
              id="rental-due"
              name="dueAt"
              type="datetime-local"
              defaultValue={values?.dueAt ?? defaultDueAt}
              className="mt-1.5"
              required
            />
            <FieldError id="rental-due-error" message={state.fieldErrors?.dueAt} />
          </div>
          <div>
            <Label htmlFor="rental-deposit">Tiền cọc (VND)</Label>
            <Input
              id="rental-deposit"
              name="deposit"
              type="number"
              min={0}
              step={1}
              defaultValue={values?.deposit ?? item.depositPrice}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Cọc gợi ý: {formatVnd(item.depositPrice)}.
            </p>
          </div>
          <div>
            <Label htmlFor="rental-condition-out">Tình trạng xuất kho</Label>
            <Select
              id="rental-condition-out"
              name="conditionOut"
              defaultValue={values?.conditionOut ?? "good"}
              className="mt-1.5"
            >
              {RENTAL_CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="rental-notes">Ghi chú</Label>
            <textarea
              id="rental-notes"
              name="notes"
              rows={2}
              defaultValue={values?.notes ?? ""}
              className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            />
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang tạo phiếu...">Tạo phiếu thuê</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ReturnRentalSheet({ rental }: { rental: RentalView }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await returnRentalAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã nhận lại trang phục.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const values = state.values;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Nhận lại
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nhận lại trang phục</SheetTitle>
          <SheetDescription>
            {rental.itemName} · {rental.itemQr}. Phí phát sinh sẽ được ghi vào đơn nếu có.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="rentalId" value={rental.id} />
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div>
            <Label htmlFor="return-condition">Tình trạng nhận lại</Label>
            <Select
              id="return-condition"
              name="conditionIn"
              defaultValue={values?.conditionIn ?? "good"}
              className="mt-1.5"
            >
              {RENTAL_CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="return-cleaning-fee">Phí giặt (VND)</Label>
              <Input
                id="return-cleaning-fee"
                name="cleaningFee"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.cleaningFee ?? 0}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="return-damage-fee">Phí đền bù (VND)</Label>
              <Input
                id="return-damage-fee"
                name="damageFee"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.damageFee ?? 0}
                className="mt-1.5"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tình trạng “Tốt” phải để phí bằng 0. “Cần giặt” không thu phí đền bù.
          </p>
          <div>
            <Label htmlFor="return-notes">Ghi chú</Label>
            <textarea
              id="return-notes"
              name="notes"
              rows={2}
              defaultValue={values?.notes ?? ""}
              className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            />
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang nhận lại...">Xác nhận nhận lại</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
