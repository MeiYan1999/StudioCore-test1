"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/actions/action-state";
import {
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/lib/actions/marketing-actions";

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initialActionState,
  );
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {state.status === "success" ? (
        <Alert tone="success">
          {state.message}{" "}
          <Link href="/contact" className="font-semibold underline">
            Liên hệ hỗ trợ
          </Link>
        </Alert>
      ) : null}
      <div>
        <Label htmlFor="reset-email">Email tài khoản</Label>
        <div className="relative mt-1.5">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email ?? ""}
            required
            className="pl-9"
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="h-4 w-4" aria-hidden />}
        {pending ? "Đang xử lý..." : "Xem hướng dẫn khôi phục"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Về đăng nhập
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialActionState,
  );
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
      {state.status === "success" ? (
        <Alert tone="success">
          {state.message}{" "}
          <Link href="/login" className="font-semibold underline">
            Đăng nhập
          </Link>
        </Alert>
      ) : null}
      <div>
        <Label htmlFor="reset-password">Mật khẩu mới</Label>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="reset-confirm">Xác nhận mật khẩu</Label>
        <Input
          id="reset-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1.5"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || state.status === "success"}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {pending ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/reset-password" className="text-primary hover:underline">
          Hướng dẫn khôi phục
        </Link>
      </p>
    </form>
  );
}
