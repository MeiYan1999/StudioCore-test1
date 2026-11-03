"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createVoucherAction,
  updateVoucherAction,
} from "@/lib/actions/catalog-actions";
import { initialActionState } from "@/lib/actions/action-state";
import { VOUCHER_DISCOUNT_TYPES } from "@/lib/catalog/constants";
import type { VoucherItem } from "@/lib/services/catalog-service";
import { toDateTimeLocalValue } from "@/lib/utils";
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

export function VoucherSheet({
  voucher,
  branches,
}: {
  voucher?: VoucherItem;
  branches: { id: string; name: string }[];
}) {
  const isEdit = Boolean(voucher);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateVoucherAction(previousState, formData)
        : await createVoucherAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu voucher.");
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
        <Button variant={isEdit ? "outline" : "primary"} size={isEdit ? "sm" : "default"}>
          {isEdit ? (
            "Sửa"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm voucher
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa voucher" : "Thêm voucher"}</SheetTitle>
          <SheetDescription>
            Voucher được kiểm tra thời gian, giá trị đơn và giới hạn sử dụng ở server.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {voucher ? <input type="hidden" name="voucherId" value={voucher.id} /> : null}
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="voucher-code">Mã voucher</Label>
              <Input
                id="voucher-code"
                name="code"
                defaultValue={values?.code ?? voucher?.code ?? ""}
                className="mt-1.5 uppercase"
                required
              />
              <FieldError id="voucher-code-error" message={state.fieldErrors?.code} />
            </div>
            <div>
              <Label htmlFor="voucher-name">Tên voucher</Label>
              <Input
                id="voucher-name"
                name="name"
                defaultValue={values?.name ?? voucher?.name ?? ""}
                className="mt-1.5"
                required
              />
              <FieldError id="voucher-name-error" message={state.fieldErrors?.name} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="voucher-branch">Phạm vi chi nhánh</Label>
              <Select
                id="voucher-branch"
                name="branchId"
                defaultValue={values?.branchId ?? voucher?.branchId ?? ""}
                className="mt-1.5"
              >
                <option value="">Toàn studio</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="voucher-type">Loại giảm</Label>
              <Select
                id="voucher-type"
                name="discountType"
                defaultValue={values?.discountType ?? voucher?.discountType ?? "percent"}
                className="mt-1.5"
              >
                {VOUCHER_DISCOUNT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="voucher-value">Giá trị</Label>
              <Input
                id="voucher-value"
                name="value"
                type="number"
                min={1}
                defaultValue={values?.value ?? voucher?.value ?? 10}
                className="mt-1.5"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Phần trăm (1–100) hoặc số tiền VND.
              </p>
              <FieldError id="voucher-value-error" message={state.fieldErrors?.value} />
            </div>
            <div>
              <Label htmlFor="voucher-min-order">Đơn tối thiểu (VND)</Label>
              <Input
                id="voucher-min-order"
                name="minOrder"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.minOrder ?? voucher?.minOrder ?? 0}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="voucher-max-discount">Giảm tối đa (VND)</Label>
              <Input
                id="voucher-max-discount"
                name="maxDiscount"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.maxDiscount ?? voucher?.maxDiscount ?? ""}
                placeholder="Không giới hạn"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="voucher-usage">Giới hạn sử dụng</Label>
              <Input
                id="voucher-usage"
                name="usageLimit"
                type="number"
                min={1}
                defaultValue={values?.usageLimit ?? voucher?.usageLimit ?? ""}
                placeholder="Không giới hạn"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="voucher-starts">Bắt đầu</Label>
              <Input
                id="voucher-starts"
                name="startsAt"
                type="datetime-local"
                defaultValue={
                  values?.startsAt ?? toDateTimeLocalValue(voucher?.startsAt ?? null)
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="voucher-ends">Kết thúc</Label>
              <Input
                id="voucher-ends"
                name="endsAt"
                type="datetime-local"
                defaultValue={values?.endsAt ?? toDateTimeLocalValue(voucher?.endsAt ?? null)}
                className="mt-1.5"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={values ? values.active === "on" : voucher?.active ?? true}
              className="h-4 w-4 rounded border-[var(--input-border)]"
            />
            Đang áp dụng
          </label>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang lưu...">
              {isEdit ? "Lưu thay đổi" : "Thêm voucher"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
