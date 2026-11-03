"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateStaffAction } from "@/lib/actions/staff-actions";
import { initialActionState } from "@/lib/actions/action-state";
import type { StaffDetail } from "@/lib/services/staff-service";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

export function StaffEditForm({
  staff,
  branches,
  roleOptions,
  isSelf,
}: {
  staff: StaffDetail;
  branches: BranchOption[];
  roleOptions: RoleOption[];
  isSelf: boolean;
}) {
  const [state, formAction] = useActionState(updateStaffAction, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message ?? "Đã cập nhật nhân sự.");
      router.refresh();
    }
  }, [state.status, state.message, router]);

  const values = state.values;
  const name = values?.name ?? staff.name;
  const code = values?.code ?? staff.code;
  const email = values?.email ?? staff.email ?? "";
  const phone = values?.phone ?? staff.phone ?? "";
  const role = values?.role ?? staff.role;
  const selectedBranches = values
    ? values.branchIds.split(",").filter(Boolean)
    : staff.branchIds;
  const active = values ? values.active === "on" : staff.active;
  const lockedRoleAndStatus = isSelf || staff.role === "owner";

  return (
    <form ref={formRef} action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="staffId" value={staff.id} />

      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}
      {state.status === "success" && state.message ? (
        <Alert tone="success">{state.message}</Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin cơ bản</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="edit-name">Họ tên</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={name}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              aria-describedby={state.fieldErrors?.name ? "edit-name-error" : undefined}
              className="mt-1.5"
              required
            />
            <FieldError id="edit-name-error" message={state.fieldErrors?.name} />
          </div>

          <div>
            <Label htmlFor="edit-code">Mã nhân viên</Label>
            <Input
              id="edit-code"
              name="code"
              defaultValue={code}
              aria-invalid={Boolean(state.fieldErrors?.code)}
              aria-describedby={state.fieldErrors?.code ? "edit-code-error" : undefined}
              className="mt-1.5 uppercase"
              required
            />
            <FieldError id="edit-code-error" message={state.fieldErrors?.code} />
          </div>

          <div>
            <Label htmlFor="edit-role">Vai trò</Label>
            <Select
              id="edit-role"
              name={lockedRoleAndStatus ? undefined : "role"}
              defaultValue={role}
              disabled={lockedRoleAndStatus}
              className="mt-1.5"
              required={!lockedRoleAndStatus}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {lockedRoleAndStatus ? (
              <>
                <input type="hidden" name="role" value={role} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Không thể đổi vai trò của chính mình hoặc tài khoản chủ studio.
                </p>
              </>
            ) : (
              <FieldError id="edit-role-error" message={state.fieldErrors?.role} />
            )}
          </div>

          <div>
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              name="email"
              type="email"
              defaultValue={email}
              aria-invalid={Boolean(state.fieldErrors?.email)}
              aria-describedby={state.fieldErrors?.email ? "edit-email-error" : undefined}
              className="mt-1.5"
            />
            <FieldError id="edit-email-error" message={state.fieldErrors?.email} />
          </div>

          <div>
            <Label htmlFor="edit-phone">Số điện thoại</Label>
            <Input
              id="edit-phone"
              name="phone"
              defaultValue={phone}
              aria-invalid={Boolean(state.fieldErrors?.phone)}
              aria-describedby={state.fieldErrors?.phone ? "edit-phone-error" : undefined}
              className="mt-1.5"
            />
            <FieldError id="edit-phone-error" message={state.fieldErrors?.phone} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phân quyền &amp; chi nhánh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Chi nhánh</legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Danh sách chi nhánh nhân sự được phép truy cập.
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
            <FieldError id="edit-branches-error" message={state.fieldErrors?.branchIds} />
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={lockedRoleAndStatus ? undefined : "active"}
              defaultChecked={active}
              disabled={lockedRoleAndStatus}
              className="h-4 w-4 rounded border-[var(--input-border)]"
            />
            Tài khoản đang hoạt động
          </label>
          {lockedRoleAndStatus ? <input type="hidden" name="active" value="on" /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin đăng nhập</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit-pin">PIN mới</Label>
            <Input
              id="edit-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              pattern="\d{6}"
              autoComplete="new-password"
              placeholder="Để trống nếu không đổi"
              aria-invalid={Boolean(state.fieldErrors?.pin)}
              aria-describedby={state.fieldErrors?.pin ? "edit-pin-error" : undefined}
              className="mt-1.5 tracking-[0.2em]"
            />
            <FieldError id="edit-pin-error" message={state.fieldErrors?.pin} />
          </div>
          <div>
            <Label htmlFor="edit-password">Mật khẩu mới</Label>
            <Input
              id="edit-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Để trống nếu không đổi"
              aria-invalid={Boolean(state.fieldErrors?.password)}
              aria-describedby={state.fieldErrors?.password ? "edit-password-error" : undefined}
              className="mt-1.5"
            />
            <FieldError id="edit-password-error" message={state.fieldErrors?.password} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Đổi PIN/mật khẩu sẽ có hiệu lực ở lần đăng nhập tiếp theo. Hệ thống
            không hiển thị lại giá trị đã lưu.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-3">
        <Button asChild variant="ghost">
          <Link href="/manage/settings/users">Hủy</Link>
        </Button>
        <SubmitButton pendingLabel="Đang lưu...">Lưu thay đổi</SubmitButton>
      </div>
    </form>
  );
}
