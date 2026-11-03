"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/lib/actions/customer-actions";
import { initialActionState } from "@/lib/actions/action-state";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_STATUSES,
  CUSTOMER_TIERS,
} from "@/lib/crm/constants";
import type { CustomerDetail } from "@/lib/services/customer-service";
import type { StaffOption } from "@/lib/services/staff-options";
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

type BranchOption = { id: string; name: string };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1 text-xs text-[var(--danger)]">
      {message}
    </p>
  );
}

export function CustomerFormSheet({
  mode,
  customer,
  branches,
  staffOptions,
  defaultBranchId,
}: {
  mode: "create" | "edit";
  customer?: CustomerDetail;
  branches: BranchOption[];
  staffOptions: StaffOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result =
        mode === "create"
          ? await createCustomerAction(previousState, formData)
          : await updateCustomerAction(previousState, formData);

      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu khách hàng.");
        setOpen(false);
        if (mode === "create" && result.values?.id) {
          router.push(`/manage/customers/${result.values.id}`);
        } else {
          router.refresh();
        }
      }

      return result;
    },
    initialActionState,
  );

  const values = state.values;
  const name = values?.name ?? customer?.name ?? "";
  const phone = values?.phone ?? customer?.phone ?? "";
  const email = values?.email ?? customer?.email ?? "";
  const address = values?.address ?? customer?.address ?? "";
  const birthday = values?.birthday ?? customer?.birthday ?? "";
  const source = values?.source ?? customer?.source ?? "walk_in";
  const tier = values?.tier ?? customer?.tier ?? "standard";
  const status = values?.status ?? customer?.status ?? "lead";
  const ownerId = values?.ownerId ?? customer?.ownerId ?? "";
  const branchId = values?.branchId ?? customer?.branchId ?? defaultBranchId;
  const tags = values?.tags ?? customer?.tags.join(", ") ?? "";
  const heightCm = values?.heightCm ?? customer?.measurements.heightCm ?? "";
  const dressSize = values?.dressSize ?? customer?.measurements.dressSize ?? "";
  const shoeSize = values?.shoeSize ?? customer?.measurements.shoeSize ?? "";
  const measurementsNote =
    values?.measurementsNote ?? customer?.measurements.note ?? "";
  const followUpAt =
    values?.followUpAt ?? toDateTimeLocalValue(customer?.followUpAt ?? null);
  const notes = values?.notes ?? customer?.notes ?? "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={mode === "edit" ? "outline" : "primary"}>
          {mode === "create" ? (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm khách
            </>
          ) : (
            "Sửa hồ sơ"
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="max-w-2xl">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Thêm khách hàng" : "Sửa khách hàng"}</SheetTitle>
          <SheetDescription>
            Số điện thoại được chuẩn hóa và chống trùng trong cùng studio.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-5" noValidate>
          {mode === "edit" && customer ? (
            <input type="hidden" name="customerId" value={customer.id} />
          ) : null}

          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="customer-name">Họ tên</Label>
              <Input
                id="customer-name"
                name="name"
                defaultValue={name}
                aria-invalid={Boolean(state.fieldErrors?.name)}
                aria-describedby={state.fieldErrors?.name ? "customer-name-error" : undefined}
                className="mt-1.5"
                required
              />
              <FieldError id="customer-name-error" message={state.fieldErrors?.name} />
            </div>

            <div>
              <Label htmlFor="customer-phone">Số điện thoại</Label>
              <Input
                id="customer-phone"
                name="phone"
                inputMode="tel"
                defaultValue={phone}
                aria-invalid={Boolean(state.fieldErrors?.phone)}
                aria-describedby={state.fieldErrors?.phone ? "customer-phone-error" : undefined}
                className="mt-1.5"
                required
              />
              <FieldError id="customer-phone-error" message={state.fieldErrors?.phone} />
            </div>

            <div>
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                name="email"
                type="email"
                defaultValue={email}
                aria-invalid={Boolean(state.fieldErrors?.email)}
                aria-describedby={state.fieldErrors?.email ? "customer-email-error" : undefined}
                className="mt-1.5"
              />
              <FieldError id="customer-email-error" message={state.fieldErrors?.email} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="customer-address">Địa chỉ</Label>
              <Input
                id="customer-address"
                name="address"
                defaultValue={address}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="customer-birthday">Ngày sinh</Label>
              <Input
                id="customer-birthday"
                name="birthday"
                type="date"
                defaultValue={birthday}
                aria-invalid={Boolean(state.fieldErrors?.birthday)}
                className="mt-1.5"
              />
              <FieldError id="customer-birthday-error" message={state.fieldErrors?.birthday} />
            </div>

            <div>
              <Label htmlFor="customer-branch">Chi nhánh</Label>
              <Select
                id="customer-branch"
                name="branchId"
                defaultValue={branchId}
                className="mt-1.5"
                required
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <FieldError id="customer-branch-error" message={state.fieldErrors?.branchId} />
            </div>

            <div>
              <Label htmlFor="customer-source">Nguồn khách</Label>
              <Select id="customer-source" name="source" defaultValue={source} className="mt-1.5">
                {CUSTOMER_SOURCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="customer-tier">Hạng khách</Label>
              <Select id="customer-tier" name="tier" defaultValue={tier} className="mt-1.5">
                {CUSTOMER_TIERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="customer-status">Trạng thái</Label>
              <Select id="customer-status" name="status" defaultValue={status} className="mt-1.5">
                {CUSTOMER_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="customer-owner">Người phụ trách</Label>
              <Select id="customer-owner" name="ownerId" defaultValue={ownerId} className="mt-1.5">
                <option value="">Chưa phân công</option>
                {staffOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.roleLabel}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="customer-tags">Tags</Label>
              <Input
                id="customer-tags"
                name="tags"
                placeholder="cưới, khách VIP, follow-up"
                defaultValue={tags}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Phân tách bằng dấu phẩy.
              </p>
            </div>

            <div>
              <Label htmlFor="customer-follow-up">Follow-up tiếp theo</Label>
              <Input
                id="customer-follow-up"
                name="followUpAt"
                type="datetime-local"
                defaultValue={followUpAt}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="customer-height">Chiều cao (cm)</Label>
              <Input
                id="customer-height"
                name="heightCm"
                inputMode="numeric"
                defaultValue={heightCm}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="customer-dress">Size trang phục</Label>
              <Input
                id="customer-dress"
                name="dressSize"
                defaultValue={dressSize}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="customer-shoe">Size giày</Label>
              <Input
                id="customer-shoe"
                name="shoeSize"
                defaultValue={shoeSize}
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="customer-measurements-note">Ghi chú số đo / makeup</Label>
              <Input
                id="customer-measurements-note"
                name="measurementsNote"
                defaultValue={measurementsNote}
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="customer-notes">Ghi chú nội bộ</Label>
              <textarea
                id="customer-notes"
                name="notes"
                defaultValue={notes}
                rows={3}
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
              {mode === "create" ? "Thêm khách" : "Lưu thay đổi"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
