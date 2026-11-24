"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/actions/action-state";
import { changePasswordAction } from "@/lib/auth/actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initialActionState);

  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Mật khẩu mới</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={72} aria-describedby="new-password-hint" />
        <p id="new-password-hint" className="text-xs text-muted-foreground">Từ 8 đến 72 ký tự.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmation">Xác nhận mật khẩu mới</Label>
        <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </div>
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
      </Button>
    </form>
  );
}
