"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
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
  createInvoiceAction,
  updateInvoiceStatusAction,
} from "@/lib/actions/finance-actions";
import { INVOICE_VAT_RATES } from "@/lib/finance/constants";
import { formatVnd } from "@/lib/utils";

type OrderOption = {
  id: string;
  code: string;
  total: number;
  remaining: number;
  customerName: string;
};

export function InvoiceCreateSheet({ orders }: { orders: OrderOption[] }) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [vatRate, setVatRate] = useState("8");
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createInvoiceAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã tạo hóa đơn.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );
  const selected = orders.find((order) => order.id === orderId);
  const subtotal = selected
    ? Math.round((selected.total * 100) / (100 + Number(vatRate || 0)))
    : 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <FilePlus2 className="h-4 w-4" aria-hidden />
          Tạo hóa đơn
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tạo hóa đơn</SheetTitle>
          <SheetDescription>
            Hóa đơn demo có VAT; không thay thế hóa đơn điện tử của cơ quan thuế.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="invoice-order">Đơn hàng</Label>
            <Select
              id="invoice-order"
              name="orderId"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              className="mt-1.5"
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.code} · {order.customerName} · {formatVnd(order.total)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="invoice-vat">VAT (%)</Label>
            <Select
              id="invoice-vat"
              name="vatRate"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
              className="mt-1.5"
            >
              {INVOICE_VAT_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-lg bg-surface-muted p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trước VAT</span>
              <span>{formatVnd(subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">VAT</span>
              <span>{formatVnd((selected?.total ?? 0) - subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold">
              <span>Tổng</span>
              <span>{formatVnd(selected?.total ?? 0)}</span>
            </div>
          </div>
          <div>
            <Label htmlFor="invoice-notes">Ghi chú</Label>
            <Input id="invoice-notes" name="notes" className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang tạo...">Phát hành hóa đơn</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function InvoiceStatusActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await updateInvoiceStatusAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật hóa đơn.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không cập nhật được hóa đơn.");
      }
      return result;
    },
    initialActionState,
  );
  if (status === "paid" || status === "cancelled") {
    return null;
  }
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {status === "issued" ? (
        <form action={formAction}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="status" value="paid" />
          <SubmitButton variant="outline" size="sm" pendingLabel="...">
            Đánh dấu đã thu
          </SubmitButton>
        </form>
      ) : null}
      <form action={formAction}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <input type="hidden" name="status" value="cancelled" />
        <SubmitButton variant="ghost" size="sm" pendingLabel="...">
          Hủy
        </SubmitButton>
      </form>
    </div>
  );
}
