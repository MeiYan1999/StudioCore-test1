"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Mail } from "lucide-react";
import { loginWithPasswordAction, loginWithPinAction } from "@/app/(auth)/login/actions";
import { initialActionState } from "@/lib/actions/action-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="mt-1 text-xs text-[var(--danger)]" id={id}>
      {message}
    </p>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function PasswordLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginWithPasswordAction,
    initialActionState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div>
        <Label htmlFor="email">Email chủ studio / quản lý</Label>
        <div className="relative mt-1.5">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="chu_studio@gmail.com"
            defaultValue={state.values?.email ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            className="pl-9"
            required
          />
        </div>
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>

      <div>
        <Label htmlFor="password">Mật khẩu</Label>
        <div className="relative mt-1.5">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            aria-invalid={Boolean(state.fieldErrors?.password)}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
            className="pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-10 w-10"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <FieldError id="password-error" message={state.fieldErrors?.password} />
      </div>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Đang đăng nhập..." : "Đăng nhập với Email"}
      </Button>
    </form>
  );
}

function PinLoginForm({ initialCode = "" }: { initialCode?: string }) {
  const [state, formAction, pending] = useActionState(
    loginWithPinAction,
    initialActionState,
  );
  const [showPin, setShowPin] = useState(false);

  return (
    <form action={formAction} className="mt-4 space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div>
        <Label htmlFor="code">Mã nhân viên</Label>
        <div className="relative mt-1.5">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="code"
            name="code"
            autoComplete="username"
            placeholder="NV01"
            defaultValue={state.values?.code ?? initialCode}
            aria-invalid={Boolean(state.fieldErrors?.code)}
            aria-describedby={state.fieldErrors?.code ? "code-error" : undefined}
            className="pl-9 uppercase"
            required
          />
        </div>
        <FieldError id="code-error" message={state.fieldErrors?.code} />
      </div>

      <div>
        <Label htmlFor="pin">Mã PIN (6 số)</Label>
        <div className="relative mt-1.5">
          <Input
            id="pin"
            name="pin"
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            pattern="\d{6}"
            placeholder="••••••"
            aria-invalid={Boolean(state.fieldErrors?.pin)}
            aria-describedby={state.fieldErrors?.pin ? "pin-error" : undefined}
            className="pr-10 tracking-[0.3em]"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-10 w-10"
            onClick={() => setShowPin((value) => !value)}
            aria-label={showPin ? "Ẩn PIN" : "Hiện PIN"}
          >
            {showPin ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <FieldError id="pin-error" message={state.fieldErrors?.pin} />
      </div>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Đang đăng nhập..." : "Đăng nhập bằng PIN"}
      </Button>
    </form>
  );
}

export function LoginForm({
  initialTab = "owner",
  initialCode = "",
}: {
  initialTab?: "owner" | "pin";
  initialCode?: string;
}) {
  return (
    <Tabs defaultValue={initialTab}>
      <TabsList className="w-full">
        <TabsTrigger value="owner" className="flex-1 font-medium">
          Chủ Studio &amp; Quản lý
        </TabsTrigger>
        <TabsTrigger value="pin" className="flex-1 font-medium">
          Nhân viên (Mã &amp; PIN)
        </TabsTrigger>
      </TabsList>

      <TabsContent value="owner" className="mt-4">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">
            Dành cho Chủ Studio &amp; Quản lý. Đăng nhập nhanh 1 chạm bằng tài khoản Google liên kết.
          </p>
        </div>

        <a
          href="/api/auth/google/login"
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/50 hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          <GoogleIcon />
          <span>Đăng nhập bằng Google</span>
        </a>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-muted-foreground">
              hoặc dùng Email &amp; Mật khẩu
            </span>
          </div>
        </div>

        <PasswordLoginForm />
      </TabsContent>

      <TabsContent value="pin" className="mt-4">
        <div className="mb-4">
          <p className="text-xs text-muted-foreground">
            Dành cho Thợ chụp, Trang điểm, Retoucher, Lễ tân &amp; Sale. Nhập mã nhân viên và PIN 6 số để vào ca làm.
          </p>
        </div>

        <PinLoginForm initialCode={initialCode} />
      </TabsContent>
    </Tabs>
  );
}
