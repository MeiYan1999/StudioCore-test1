"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getFormString, type ActionState } from "@/lib/actions/action-state";
import { getDb } from "@/lib/db/client";
import { setSessionCookie } from "@/lib/auth/session";
import { createSession } from "@/lib/auth/session-core";
import { AuthorizationError, ValidationError } from "@/lib/errors";
import { registerTenant } from "@/lib/services/onboarding-service";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/services/password-reset-service";
import { createContactRequest } from "@/lib/services/contact-service";

async function requestMeta(): Promise<{ ip: string; userAgent: string }> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  return {
    ip:
      forwardedFor?.split(",")[0]?.trim() ||
      headerStore.get("x-real-ip") ||
      "127.0.0.1",
    userAgent: headerStore.get("user-agent") ?? "",
  };
}

function errorMessage(error: unknown): string {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError
  ) {
    return error.message;
  }
  return "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

export async function registerAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    studioName: getFormString(formData, "studioName"),
    ownerName: getFormString(formData, "ownerName"),
    email: getFormString(formData, "email"),
    phone: getFormString(formData, "phone"),
    branchName: getFormString(formData, "branchName"),
    branchAddress: getFormString(formData, "branchAddress"),
    branchPhone: getFormString(formData, "branchPhone"),
  };
  const password = getFormString(formData, "password");
  const confirm = getFormString(formData, "confirmPassword");
  if (password !== confirm) {
    return {
      status: "error",
      message: "Mật khẩu xác nhận không khớp.",
      values,
    };
  }
  if (getFormString(formData, "terms") !== "on") {
    return {
      status: "error",
      message: "Bạn cần đồng ý điều khoản và chính sách bảo mật.",
      values,
    };
  }
  let result;
  try {
    result = registerTenant(getDb(), {
      studioName: values.studioName,
      ownerName: values.ownerName,
      email: values.email,
      phone: values.phone,
      password,
      branchName: values.branchName,
      branchAddress: values.branchAddress,
      branchPhone: values.branchPhone,
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
  const meta = await requestMeta();
  const session = await createSession(getDb(), {
    tenantId: result.tenantId,
    staffId: result.staffId,
    activeBranchId: null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await setSessionCookie(session.token, session.expiresAt);
  redirect("/manage/dashboard?welcome=1");
}

export async function requestPasswordResetAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = getFormString(formData, "email");
  try {
    const result = requestPasswordReset(getDb(), email);
    return {
      status: "success",
      message: result.message,
      values: result.link ? { resetLink: result.link } : {},
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values: { email } };
  }
}

export async function resetPasswordAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = getFormString(formData, "token");
  const password = getFormString(formData, "password");
  const confirm = getFormString(formData, "confirmPassword");
  if (password !== confirm) {
    return { status: "error", message: "Mật khẩu xác nhận không khớp." };
  }
  try {
    resetPasswordWithToken(getDb(), token, password);
    return {
      status: "success",
      message: "Đã đặt lại mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới.",
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function submitContactAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const honeypot = getFormString(formData, "website");
  if (honeypot) {
    return {
      status: "success",
      message: "Yêu cầu đã được ghi nhận. Chúng tôi sẽ phản hồi qua thông tin bạn cung cấp.",
    };
  }
  const values = {
    name: getFormString(formData, "name"),
    email: getFormString(formData, "email"),
    phone: getFormString(formData, "phone"),
    studioName: getFormString(formData, "studioName"),
    message: getFormString(formData, "message"),
  };
  const meta = await requestMeta();
  try {
    createContactRequest(
      getDb(),
      {
        ...values,
        source: getFormString(formData, "source") || "landing",
      },
      meta.ip,
    );
    return {
      status: "success",
      message:
        "Yêu cầu tư vấn đã được ghi nhận trong hệ thống demo. Đội ngũ hỗ trợ sẽ liên hệ qua thông tin bạn cung cấp.",
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}
