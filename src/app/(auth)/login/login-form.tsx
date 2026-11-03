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

function PasswordLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginWithPasswordAction,
    initialActionState,
  );
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {state.status === "error" && state.message ? (
        <Alert tone="danger">{state.message}</Alert>
      ) : null}

      <div>
        <Label htmlFor="email">Email</Label>
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
            placeholder="owner@studiocore.demo"
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
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}

function PinLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginWithPinAction,
    initialActionState,
  );
  const [showPin, setShowPin] = useState(false);

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
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
            placeholder="SC-OWNER"
            defaultValue={state.values?.code ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.code)}
            aria-describedby={state.fieldErrors?.code ? "code-error" : undefined}
            className="pl-9 uppercase"
            required
          />
        </div>
        <FieldError id="code-error" message={state.fieldErrors?.code} />
      </div>

      <div>
        <Label htmlFor="pin">PIN 6 số</Label>
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

export function LoginForm() {
  return (
    <Tabs defaultValue="password">
      <TabsList className="w-full">
        <TabsTrigger value="password" className="flex-1">
          Email &amp; mật khẩu
        </TabsTrigger>
        <TabsTrigger value="pin" className="flex-1">
          Mã nhân viên &amp; PIN
        </TabsTrigger>
      </TabsList>
      <TabsContent value="password">
        <PasswordLoginForm />
      </TabsContent>
      <TabsContent value="pin">
        <PinLoginForm />
      </TabsContent>
    </Tabs>
  );
}
