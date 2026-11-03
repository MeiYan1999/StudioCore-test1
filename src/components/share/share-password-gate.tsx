"use client";

import { useActionState } from "react";
import { KeyRound, Images } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import { verifySharePasswordAction } from "@/lib/actions/share-actions";

export function SharePasswordGate({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    verifySharePasswordAction,
    initialActionState,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Images className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              StudioCore PhotoShare
            </p>
            <h1 className="text-lg font-semibold text-foreground">
              Album được bảo vệ
            </h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Nhập mật khẩu studio đã gửi để xem và chọn ảnh. Link không hiển thị
          thông tin của khách hàng khác.
        </p>

        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <Label htmlFor="share-password">Mật khẩu album</Label>
            <Input
              id="share-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
              className="mt-1.5"
              aria-describedby="share-password-error"
            />
          </div>
          {state.status === "error" ? (
            <Alert tone="danger" id="share-password-error">
              {state.message}
            </Alert>
          ) : null}
          <SubmitButton className="w-full" pendingLabel="Đang kiểm tra...">
            <KeyRound className="h-4 w-4" aria-hidden />
            Mở album
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
