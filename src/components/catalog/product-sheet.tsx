"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createProductAction,
  updateProductAction,
} from "@/lib/actions/catalog-actions";
import { initialActionState } from "@/lib/actions/action-state";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
} from "@/lib/catalog/constants";
import type { ProductItem } from "@/lib/services/catalog-service";
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

export function ProductSheet({ product }: { product?: ProductItem }) {
  const isEdit = Boolean(product);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateProductAction(previousState, formData)
        : await createProductAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu sản phẩm.");
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
              Thêm sản phẩm
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm"}</SheetTitle>
          <SheetDescription>
            Sản phẩm dùng cho album, ảnh in, khung và vật phẩm bàn giao.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {product ? <input type="hidden" name="productId" value={product.id} /> : null}
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                name="sku"
                defaultValue={values?.sku ?? product?.sku ?? ""}
                className="mt-1.5 uppercase"
                required
              />
              <FieldError id="product-sku-error" message={state.fieldErrors?.sku} />
            </div>
            <div>
              <Label htmlFor="product-category">Danh mục</Label>
              <Select
                id="product-category"
                name="category"
                defaultValue={values?.category ?? product?.category ?? "album"}
                className="mt-1.5"
              >
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="product-name">Tên sản phẩm</Label>
              <Input
                id="product-name"
                name="name"
                defaultValue={values?.name ?? product?.name ?? ""}
                className="mt-1.5"
                required
              />
              <FieldError id="product-name-error" message={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="product-price">Giá (VND)</Label>
              <Input
                id="product-price"
                name="price"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.price ?? product?.price ?? 0}
                className="mt-1.5"
                required
              />
              <FieldError id="product-price-error" message={state.fieldErrors?.price} />
            </div>
            <div>
              <Label htmlFor="product-stock">Tồn kho</Label>
              <Input
                id="product-stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={values?.stock ?? product?.stock ?? 0}
                className="mt-1.5"
                required
              />
              <FieldError id="product-stock-error" message={state.fieldErrors?.stock} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="product-status">Trạng thái</Label>
              <Select
                id="product-status"
                name="status"
                defaultValue={values?.status ?? product?.status ?? "active"}
                className="mt-1.5"
              >
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang lưu...">
              {isEdit ? "Lưu thay đổi" : "Thêm sản phẩm"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
