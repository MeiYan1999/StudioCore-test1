"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createWardrobeItemAction,
  updateWardrobeItemAction,
} from "@/lib/actions/wardrobe-actions";
import { initialActionState } from "@/lib/actions/action-state";
import { WARDROBE_STATUSES } from "@/lib/wardrobe/constants";
import type { WardrobeItemView } from "@/lib/services/wardrobe-service";
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

export function WardrobeItemSheet({
  item,
  branches,
}: {
  item?: WardrobeItemView & { notes?: string | null };
  branches: { id: string; name: string }[];
}) {
  const isEdit = Boolean(item);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateWardrobeItemAction(previousState, formData)
        : await createWardrobeItemAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu trang phục.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const values = state.values;
  const defaultBranchId = item?.branchId ?? branches[0]?.id ?? "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={isEdit ? "outline" : "primary"} size={isEdit ? "sm" : "default"}>
          {isEdit ? (
            "Sửa"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm trang phục
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa trang phục" : "Thêm trang phục"}</SheetTitle>
          <SheetDescription>
            Mã QR dùng để quét xuất kho và nhận lại. Để trống QR để hệ thống tự sinh từ SKU.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="wardrobe-sku">SKU</Label>
              <Input
                id="wardrobe-sku"
                name="sku"
                defaultValue={values?.sku ?? item?.sku ?? ""}
                className="mt-1.5 uppercase"
                required
              />
              <FieldError id="wardrobe-sku-error" message={state.fieldErrors?.sku} />
            </div>
            <div>
              <Label htmlFor="wardrobe-qr">Mã QR</Label>
              <Input
                id="wardrobe-qr"
                name="qrCode"
                defaultValue={values?.qrCode ?? item?.qrCode ?? ""}
                className="mt-1.5 uppercase"
              />
              <FieldError id="wardrobe-qr-error" message={state.fieldErrors?.qrCode} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="wardrobe-name">Tên trang phục</Label>
              <Input
                id="wardrobe-name"
                name="name"
                defaultValue={values?.name ?? item?.name ?? ""}
                className="mt-1.5"
                required
              />
              <FieldError id="wardrobe-name-error" message={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="wardrobe-branch">Chi nhánh</Label>
              <Select
                id="wardrobe-branch"
                name="branchId"
                defaultValue={values?.branchId ?? defaultBranchId}
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
              <Label htmlFor="wardrobe-status">Trạng thái</Label>
              <Select
                id="wardrobe-status"
                name="status"
                defaultValue={values?.status ?? item?.status ?? "available"}
                className="mt-1.5"
              >
                {WARDROBE_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="wardrobe-size">Size</Label>
              <Input
                id="wardrobe-size"
                name="size"
                defaultValue={values?.size ?? item?.size ?? ""}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="wardrobe-color">Màu</Label>
              <Input
                id="wardrobe-color"
                name="color"
                defaultValue={values?.color ?? item?.color ?? ""}
                className="mt-1.5"
                required
              />
            </div>
            <div>
              <Label htmlFor="wardrobe-rental-price">Giá thuê (VND)</Label>
              <Input
                id="wardrobe-rental-price"
                name="rentalPrice"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.rentalPrice ?? item?.rentalPrice ?? 0}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="wardrobe-deposit">Tiền cọc (VND)</Label>
              <Input
                id="wardrobe-deposit"
                name="depositPrice"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.depositPrice ?? item?.depositPrice ?? 0}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="wardrobe-image">Ảnh (URL, không bắt buộc)</Label>
              <Input
                id="wardrobe-image"
                name="image"
                defaultValue={values?.image ?? item?.image ?? ""}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="wardrobe-notes">Ghi chú</Label>
              <textarea
                id="wardrobe-notes"
                name="notes"
                rows={2}
                defaultValue={values?.notes ?? item?.notes ?? ""}
                className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              />
            </div>
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang lưu...">
              {isEdit ? "Lưu thay đổi" : "Thêm trang phục"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
