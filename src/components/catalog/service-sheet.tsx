"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createServiceAction,
  updateServiceAction,
} from "@/lib/actions/catalog-actions";
import { initialActionState } from "@/lib/actions/action-state";
import { SERVICE_CATEGORIES } from "@/lib/catalog/constants";
import type { ServiceItem } from "@/lib/services/catalog-service";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

export function ServiceSheet({
  service,
  branches,
}: {
  service?: ServiceItem;
  branches: { id: string; name: string }[];
}) {
  const isEdit = Boolean(service);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateServiceAction(previousState, formData)
        : await createServiceAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu dịch vụ.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const values = state.values;
  const defaultBranchId = service?.branchId ?? branches[0]?.id ?? "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={isEdit ? "outline" : "primary"} size={isEdit ? "sm" : "default"}>
          {isEdit ? (
            "Sửa"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm dịch vụ
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa dịch vụ" : "Thêm dịch vụ"}</SheetTitle>
          <SheetDescription>
            Giá và thời lượng được dùng khi tạo đơn hàng.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {service ? <input type="hidden" name="serviceId" value={service.id} /> : null}
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div>
            <Label htmlFor="service-name">Tên dịch vụ</Label>
            <Input
              id="service-name"
              name="name"
              defaultValue={values?.name ?? service?.name ?? ""}
              className="mt-1.5"
              required
            />
            <FieldError id="service-name-error" message={state.fieldErrors?.name} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="service-category">Danh mục</Label>
              <Select
                id="service-category"
                name="category"
                defaultValue={values?.category ?? service?.category ?? "wedding"}
                className="mt-1.5"
              >
                {SERVICE_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="service-branch">Chi nhánh</Label>
              <Select
                id="service-branch"
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
              <Label htmlFor="service-price">Giá (VND)</Label>
              <Input
                id="service-price"
                name="price"
                type="number"
                min={0}
                step={1}
                defaultValue={values?.price ?? service?.price ?? 0}
                className="mt-1.5"
                required
              />
              <FieldError id="service-price-error" message={state.fieldErrors?.price} />
            </div>
            <div>
              <Label htmlFor="service-duration">Thời lượng (phút)</Label>
              <Input
                id="service-duration"
                name="durationMinutes"
                type="number"
                min={1}
                defaultValue={values?.durationMinutes ?? service?.durationMinutes ?? 60}
                className="mt-1.5"
                required
              />
              <FieldError
                id="service-duration-error"
                message={state.fieldErrors?.durationMinutes}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="service-description">Mô tả</Label>
            <Textarea
              id="service-description"
              name="description"
              defaultValue={values?.description ?? service?.description ?? ""}
              className="mt-1.5"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={
                values ? values.active === "on" : service?.active ?? true
              }
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
              {isEdit ? "Lưu thay đổi" : "Thêm dịch vụ"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
