"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/actions/action-state";
import { registerAction } from "@/lib/actions/marketing-actions";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialActionState,
  );
  const values = state.values;
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      <div>
        <Label htmlFor="register-studio">Tên studio</Label>
        <Input
          id="register-studio"
          name="studioName"
          defaultValue={values?.studioName ?? ""}
          placeholder="Studio Ánh Dương"
          required
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="register-owner">Tên chủ studio</Label>
        <Input
          id="register-owner"
          name="ownerName"
          defaultValue={values?.ownerName ?? ""}
          placeholder="Nguyễn Minh Anh"
          required
          className="mt-1.5"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values?.email ?? ""}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="register-phone">SĐT</Label>
          <Input
            id="register-phone"
            name="phone"
            defaultValue={values?.phone ?? ""}
            placeholder="0900000000"
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="register-password">Mật khẩu</Label>
          <Input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="register-confirm">Xác nhận mật khẩu</Label>
          <Input
            id="register-confirm"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1.5"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="register-branch">Tên chi nhánh đầu tiên</Label>
        <Input
          id="register-branch"
          name="branchName"
          defaultValue={values?.branchName ?? ""}
          placeholder="Chi nhánh chính"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="register-address">Địa chỉ chi nhánh</Label>
        <Input
          id="register-address"
          name="branchAddress"
          defaultValue={values?.branchAddress ?? ""}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="register-branch-phone">SĐT chi nhánh</Label>
        <Input
          id="register-branch-phone"
          name="branchPhone"
          defaultValue={values?.branchPhone ?? ""}
          className="mt-1.5"
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span>
          Tôi đồng ý{" "}
          <Link href="/terms" className="text-primary hover:underline">
            điều khoản
          </Link>{" "}
          và{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            chính sách bảo mật
          </Link>{" "}
          của bản demo.
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}
        {pending ? "Đang tạo studio..." : "Tạo tài khoản dùng thử"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
