"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw, Wallet } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import {
  createExpenseAction,
  createTransactionAction,
  recordRefundAction,
  saveBudgetAction,
} from "@/lib/actions/finance-actions";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_LABELS,
} from "@/lib/finance/constants";
import { formatVnd } from "@/lib/utils";

type BranchOption = { id: string; name: string };
type OrderOption = {
  id: string;
  code: string;
  customerName: string;
  paid: number;
  remaining: number;
};

export function TransactionSheet({
  branches,
  defaultBranchId,
}: {
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createTransactionAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã ghi giao dịch.");
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
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          Ghi giao dịch
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ghi giao dịch sổ quỹ</SheetTitle>
          <SheetDescription>
            Giao dịch thủ công có audit; thanh toán đơn tự sinh giao dịch thu.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tx-type">Loại</Label>
              <Select id="tx-type" name="type" defaultValue="income" className="mt-1.5">
                <option value="income">Thu</option>
                <option value="expense">Chi</option>
                <option value="refund">Hoàn tiền</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="tx-branch">Chi nhánh</Label>
              <Select
                id="tx-branch"
                name="branchId"
                defaultValue={defaultBranchId}
                className="mt-1.5"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tx-category">Danh mục</Label>
              <Select id="tx-category" name="category" defaultValue="other" className="mt-1.5">
                {TRANSACTION_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {TRANSACTION_CATEGORY_LABELS[category] ?? category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tx-method">Phương thức</Label>
              <Select id="tx-method" name="method" defaultValue="cash" className="mt-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tx-amount">Số tiền (VND)</Label>
              <Input
                id="tx-amount"
                name="amount"
                type="number"
                min={1}
                step={1}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="tx-occurred">Thời điểm</Label>
              <Input
                id="tx-occurred"
                name="occurredAt"
                type="datetime-local"
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tx-description">Diễn giải</Label>
            <Textarea id="tx-description" name="description" rows={3} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="tx-reference">Mã tham chiếu</Label>
            <Input id="tx-reference" name="reference" className="mt-1.5" maxLength={200} />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Lưu giao dịch</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ExpenseSheet({
  branches,
  defaultBranchId,
}: {
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createExpenseAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã ghi khoản chi.");
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
        <Button variant="outline" size="sm">
          <Wallet className="h-4 w-4" aria-hidden />
          Ghi khoản chi
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Ghi khoản chi</SheetTitle>
          <SheetDescription>
            Khoản chi được lưu vào expenses và sinh giao dịch chi tương ứng.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="expense-branch">Chi nhánh</Label>
              <Select
                id="expense-branch"
                name="branchId"
                defaultValue={defaultBranchId}
                className="mt-1.5"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-category">Danh mục</Label>
              <Select id="expense-category" name="category" defaultValue="other" className="mt-1.5">
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {EXPENSE_CATEGORY_LABELS[category] ?? category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-amount">Số tiền (VND)</Label>
              <Input
                id="expense-amount"
                name="amount"
                type="number"
                min={1}
                step={1}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="expense-method">Phương thức</Label>
              <Select id="expense-method" name="method" defaultValue="cash" className="mt-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="expense-vendor">Nhà cung cấp</Label>
              <Input id="expense-vendor" name="vendor" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="expense-occurred">Thời điểm</Label>
              <Input id="expense-occurred" name="occurredAt" type="datetime-local" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="expense-description">Diễn giải</Label>
            <Textarea id="expense-description" name="description" rows={3} className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Lưu khoản chi</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function BudgetSheet({
  branches,
  defaultBranchId,
  period,
}: {
  branches: BranchOption[];
  defaultBranchId: string;
  period: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await saveBudgetAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu ngân sách.");
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
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          Ngân sách
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Thiết lập ngân sách</SheetTitle>
          <SheetDescription>
            Ngân sách theo danh mục/kỳ; so sánh với giao dịch chi thực tế.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="budget-branch">Chi nhánh</Label>
            <Select id="budget-branch" name="branchId" defaultValue={defaultBranchId} className="mt-1.5">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="budget-category">Danh mục</Label>
              <Select id="budget-category" name="category" defaultValue="marketing" className="mt-1.5">
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {EXPENSE_CATEGORY_LABELS[category] ?? category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="budget-period">Kỳ</Label>
              <Input id="budget-period" name="period" type="month" defaultValue={period} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="budget-amount">Ngân sách (VND)</Label>
            <Input id="budget-amount" name="amount" type="number" min={0} step={1} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="budget-notes">Ghi chú</Label>
            <Textarea id="budget-notes" name="notes" rows={2} className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Lưu ngân sách</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function RefundSheet({
  orders,
}: {
  orders: OrderOption[];
}) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [amount, setAmount] = useState(
    String(orders[0]?.paid && orders[0].paid > 0 ? orders[0].paid : 0),
  );
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await recordRefundAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã hoàn tiền.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );
  const selected = orders.find((order) => order.id === orderId);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Hoàn tiền
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Hoàn tiền đơn hàng</SheetTitle>
          <SheetDescription>
            Ghi transaction refund, payment trạng thái refunded và giảm số đã thu.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="refund-order">Đơn hàng</Label>
            <Select
              id="refund-order"
              name="orderId"
              value={orderId}
              onChange={(event) => {
                setOrderId(event.target.value);
                const next = orders.find((order) => order.id === event.target.value);
                setAmount(String(next?.paid ?? 0));
              }}
              className="mt-1.5"
            >
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.code} · {order.customerName} · đã thu {formatVnd(order.paid)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="refund-amount">Số tiền hoàn</Label>
            <Input
              id="refund-amount"
              name="amount"
              type="number"
              min={1}
              max={selected?.paid}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tối đa {formatVnd(selected?.paid ?? 0)}.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="refund-method">Phương thức</Label>
              <Select id="refund-method" name="method" defaultValue="bank_transfer" className="mt-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="refund-reason">Lý do</Label>
              <Input id="refund-reason" name="reason" required className="mt-1.5" />
            </div>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Xác nhận hoàn tiền</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
