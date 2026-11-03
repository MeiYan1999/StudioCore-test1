"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createAddonAction,
  updateAddonAction,
} from "@/lib/actions/catalog-actions";
import { initialActionState } from "@/lib/actions/action-state";
import type { AddonItem, ServiceItem } from "@/lib/services/catalog-service";
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

export function AddonSheet({
  addon,
  services,
}: {
  addon?: AddonItem;
  services: ServiceItem[];
}) {
  const isEdit = Boolean(addon);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateAddonAction(previousState, formData)
        : await createAddonAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu add-on.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const values = state.values;
  const defaultServiceId = addon?.serviceId ?? services[0]?.id ?? "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={isEdit ? "outline" : "outline"} size="sm">
          {isEdit ? (
            "Sửa"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm add-on
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa add-on" : "Thêm add-on"}</SheetTitle>
          <SheetDescription>
            Add-on thuộc một dịch vụ và có thể chọn khi tạo đơn.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {addon ? <input type="hidden" name="addonId" value={addon.id} /> : null}
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div>
            <Label htmlFor="addon-service">Dịch vụ</Label>
            <Select
              id="addon-service"
              name="serviceId"
              defaultValue={values?.serviceId ?? defaultServiceId}
              className="mt-1.5"
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.branchName}
                </option>
              ))}
            </Select>
            <FieldError id="addon-service-error" message={state.fieldErrors?.serviceId} />
          </div>

          <div>
            <Label htmlFor="addon-name">Tên add-on</Label>
            <Input
              id="addon-name"
              name="name"
              defaultValue={values?.name ?? addon?.name ?? ""}
              className="mt-1.5"
              required
            />
            <FieldError id="addon-name-error" message={state.fieldErrors?.name} />
          </div>

          <div>
            <Label htmlFor="addon-price">Giá (VND)</Label>
            <Input
              id="addon-price"
              name="price"
              type="number"
              min={0}
              step={1}
              defaultValue={values?.price ?? addon?.price ?? 0}
              className="mt-1.5"
              required
            />
            <FieldError id="addon-price-error" message={state.fieldErrors?.price} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={values ? values.active === "on" : addon?.active ?? true}
              className="h-4 w-4 rounded border-[var(--input-border)]"
            />
            Đang bán
          </label>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang lưu...">
              {isEdit ? "Lưu thay đổi" : "Thêm add-on"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
