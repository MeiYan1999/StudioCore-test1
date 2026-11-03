"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createEquipmentAction,
  updateEquipmentAction,
} from "@/lib/actions/wardrobe-actions";
import { initialActionState } from "@/lib/actions/action-state";
import { EQUIPMENT_CATEGORIES, EQUIPMENT_STATUSES } from "@/lib/wardrobe/constants";
import type { EquipmentItem } from "@/lib/services/equipment-service";
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

export function EquipmentSheet({
  equipment,
  branches,
}: {
  equipment?: EquipmentItem;
  branches: { id: string; name: string }[];
}) {
  const isEdit = Boolean(equipment);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateEquipmentAction(previousState, formData)
        : await createEquipmentAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu thiết bị.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const values = state.values;
  const defaultBranchId = equipment?.branchId ?? branches[0]?.id ?? "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={isEdit ? "outline" : "primary"} size={isEdit ? "sm" : "default"}>
          {isEdit ? (
            "Sửa"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm thiết bị
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa thiết bị" : "Thêm thiết bị"}</SheetTitle>
          <SheetDescription>
            Quản lý máy ảnh, ống kính, đèn và phụ kiện theo chi nhánh.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {equipment ? <input type="hidden" name="equipmentId" value={equipment.id} /> : null}
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="equipment-name">Tên thiết bị</Label>
              <Input
                id="equipment-name"
                name="name"
                defaultValue={values?.name ?? equipment?.name ?? ""}
                className="mt-1.5"
                required
              />
              <FieldError id="equipment-name-error" message={state.fieldErrors?.name} />
            </div>
            <div>
              <Label htmlFor="equipment-serial">Serial</Label>
              <Input
                id="equipment-serial"
                name="serialNumber"
                defaultValue={values?.serialNumber ?? equipment?.serialNumber ?? ""}
                className="mt-1.5 uppercase"
                required
              />
              <FieldError id="equipment-serial-error" message={state.fieldErrors?.serialNumber} />
            </div>
            <div>
              <Label htmlFor="equipment-category">Danh mục</Label>
              <Select
                id="equipment-category"
                name="category"
                defaultValue={values?.category ?? equipment?.category ?? "camera"}
                className="mt-1.5"
              >
                {EQUIPMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="equipment-branch">Chi nhánh</Label>
              <Select
                id="equipment-branch"
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
              <Label htmlFor="equipment-status">Trạng thái</Label>
              <Select
                id="equipment-status"
                name="status"
                defaultValue={values?.status ?? equipment?.status ?? "available"}
                className="mt-1.5"
              >
                {EQUIPMENT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="equipment-notes">Ghi chú</Label>
              <textarea
                id="equipment-notes"
                name="notes"
                rows={2}
                defaultValue={values?.notes ?? equipment?.notes ?? ""}
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
              {isEdit ? "Lưu thay đổi" : "Thêm thiết bị"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
