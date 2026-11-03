"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createStaffAction } from "@/lib/actions/staff-actions";
import { initialActionState } from "@/lib/actions/action-state";
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
type RoleOption = { value: string; label: string };

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

export function StaffCreateSheet({
  branches,
  roleOptions,
}: {
  branches: BranchOption[];
  roleOptions: RoleOption[];
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createStaffAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã thêm nhân sự.");
        setOpen(false);
        formRef.current?.reset();
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const selectedBranches =
    state.values?.branchIds !== undefined
      ? state.values.branchIds.split(",").filter(Boolean)
      : branches[0]
        ? [branches[0].id]
        : [];

  const active = state.values ? state.values.active === "on" : true;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Thêm nhân sự
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Thêm nhân sự</SheetTitle>
          <SheetDescription>
            Tạo tài khoản đăng nhập bằng mã nhân viên + PIN hoặc email + mật khẩu.
          </SheetDescription>
        </SheetHeader>

        <form ref={formRef} action={formAction} className="space-y-5" noValidate>
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="staff-name">Họ tên</Label>
              <Input
                id="staff-name"
                name="name"
                defaultValue={state.values?.name ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.name)}
                aria-describedby={state.fieldErrors?.name ? "staff-name-error" : undefined}
                className="mt-1.5"
                required
              />
              <FieldError id="staff-name-error" message={state.fieldErrors?.name} />
            </div>

            <div>
              <Label htmlFor="staff-code">Mã nhân viên</Label>
              <Input
                id="staff-code"
                name="code"
                placeholder="SC-LETAN-2"
                defaultValue={state.values?.code ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.code)}
                aria-describedby={state.fieldErrors?.code ? "staff-code-error" : undefined}
                className="mt-1.5 uppercase"
                required
              />
              <FieldError id="staff-code-error" message={state.fieldErrors?.code} />
            </div>

            <div>
              <Label htmlFor="staff-role">Vai trò</Label>
              <Select
                id="staff-role"
                name="role"
                defaultValue={state.values?.role ?? "receptionist"}
                aria-invalid={Boolean(state.fieldErrors?.role)}
                className="mt-1.5"
                required
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldError id="staff-role-error" message={state.fieldErrors?.role} />
            </div>

            <div>
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                name="email"
                type="email"
                placeholder="nhanvien@studiocore.demo"
                defaultValue={state.values?.email ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.email)}
                aria-describedby={state.fieldErrors?.email ? "staff-email-error" : undefined}
                className="mt-1.5"
              />
              <FieldError id="staff-email-error" message={state.fieldErrors?.email} />
            </div>

            <div>
              <Label htmlFor="staff-phone">Số điện thoại</Label>
              <Input
                id="staff-phone"
                name="phone"
                inputMode="tel"
                placeholder="0900 000 000"
                defaultValue={state.values?.phone ?? ""}
                aria-invalid={Boolean(state.fieldErrors?.phone)}
                aria-describedby={state.fieldErrors?.phone ? "staff-phone-error" : undefined}
                className="mt-1.5"
              />
              <FieldError id="staff-phone-error" message={state.fieldErrors?.phone} />
            </div>

            <div>
              <Label htmlFor="staff-pin">PIN 6 số</Label>
              <Input
                id="staff-pin"
                name="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                pattern="\d{6}"
                autoComplete="new-password"
                aria-invalid={Boolean(state.fieldErrors?.pin)}
                aria-describedby={state.fieldErrors?.pin ? "staff-pin-error" : undefined}
                className="mt-1.5 tracking-[0.2em]"
                required
              />
              <FieldError id="staff-pin-error" message={state.fieldErrors?.pin} />
            </div>

            <div>
              <Label htmlFor="staff-password">Mật khẩu (không bắt buộc)</Label>
              <Input
                id="staff-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                aria-invalid={Boolean(state.fieldErrors?.password)}
                aria-describedby={state.fieldErrors?.password ? "staff-password-error" : undefined}
                className="mt-1.5"
              />
              <FieldError id="staff-password-error" message={state.fieldErrors?.password} />
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">Chi nhánh</legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Nhân sự chỉ thấy dữ liệu của các chi nhánh được chọn.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="branchIds"
                    value={branch.id}
                    defaultChecked={selectedBranches.includes(branch.id)}
                    className="h-4 w-4 rounded border-[var(--input-border)]"
                  />
                  {branch.name}
                </label>
              ))}
            </div>
            <FieldError id="staff-branches-error" message={state.fieldErrors?.branchIds} />
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={active}
              className="h-4 w-4 rounded border-[var(--input-border)]"
            />
            Tài khoản đang hoạt động
          </label>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang thêm...">Thêm nhân sự</SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
