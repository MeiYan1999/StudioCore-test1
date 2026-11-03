"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  fieldErrorsFromZod,
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import { setSessionCookie } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { passwordLoginSchema, pinLoginSchema } from "@/lib/validators/staff";

async function getRequestMeta(): Promise<{ ip: string; userAgent: string }> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "127.0.0.1";

  return {
    ip,
    userAgent: headerStore.get("user-agent") ?? "",
  };
}

export async function loginWithPasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = getFormString(formData, "email");
  const values = { email };

  const parsed = passwordLoginSchema.safeParse({
    email,
    password: getFormString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin đăng nhập.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  const meta = await getRequestMeta();
  const result = await authenticate(
    getDb(),
    {
      mode: "password",
      identifier: parsed.data.email,
      secret: parsed.data.password,
    },
    meta,
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.error,
      values,
    };
  }

  await setSessionCookie(result.token, result.expiresAt);
  const actor = await getActorFromToken(getDb(), result.token);
  redirect(actor?.role === "platform_admin" ? "/platform" : "/manage/dashboard");
}

export async function loginWithPinAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = getFormString(formData, "code");
  const values = { code };

  const parsed = pinLoginSchema.safeParse({
    code,
    pin: getFormString(formData, "pin"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin đăng nhập.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  const meta = await getRequestMeta();
  const result = await authenticate(
    getDb(),
    {
      mode: "pin",
      identifier: parsed.data.code,
      secret: parsed.data.pin,
    },
    meta,
  );

  if (!result.ok) {
    return {
      status: "error",
      message: result.error,
      values,
    };
  }

  await setSessionCookie(result.token, result.expiresAt);
  const actor = await getActorFromToken(getDb(), result.token);
  redirect(actor?.role === "platform_admin" ? "/platform" : "/manage/dashboard");
}
