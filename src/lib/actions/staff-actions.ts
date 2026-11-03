"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fieldErrorsFromZod,
  getFormString,
  getFormStrings,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createStaff,
  revokeSession,
  updateRolePermissions,
  updateStaff,
} from "@/lib/services/staff-service";
import { getDb } from "@/lib/db/client";
import { staffCreateSchema, staffUpdateSchema } from "@/lib/validators/staff";

function actionErrorMessage(error: unknown): string {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }

  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

function staffFormValues(formData: FormData): Record<string, string> {
  return {
    name: getFormString(formData, "name"),
    code: getFormString(formData, "code"),
    email: getFormString(formData, "email"),
    phone: getFormString(formData, "phone"),
    role: getFormString(formData, "role"),
    branchIds: getFormStrings(formData, "branchIds").join(","),
    active: formData.get("active") === "on" ? "on" : "",
  };
}

export async function createStaffAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) {
    return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  }

  const values = staffFormValues(formData);
  const parsed = staffCreateSchema.safeParse({
    name: values.name,
    code: values.code,
    email: values.email,
    phone: values.phone,
    role: values.role,
    pin: getFormString(formData, "pin"),
    password: getFormString(formData, "password"),
    branchIds: getFormStrings(formData, "branchIds"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin nhân sự.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createStaff(getDb(), actor, {
      ...parsed.data,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      password: parsed.data.password || null,
    });
    revalidatePath("/manage/settings/users");
    return { status: "success", message: "Đã thêm nhân sự." };
  } catch (error) {
    return {
      status: "error",
      message: actionErrorMessage(error),
      values,
    };
  }
}

export async function updateStaffAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) {
    return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  }

  const staffId = getFormString(formData, "staffId");
  const values = staffFormValues(formData);
  const parsed = staffUpdateSchema.safeParse({
    name: values.name,
    code: values.code,
    email: values.email,
    phone: values.phone,
    role: values.role,
    pin: getFormString(formData, "pin"),
    password: getFormString(formData, "password"),
    branchIds: getFormStrings(formData, "branchIds"),
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin nhân sự.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateStaff(getDb(), actor, staffId, {
      ...parsed.data,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      pin: parsed.data.pin || null,
      password: parsed.data.password || null,
    });
    revalidatePath("/manage/settings/users");
    revalidatePath(`/manage/settings/users/${staffId}`);
    return { status: "success", message: "Đã cập nhật nhân sự." };
  } catch (error) {
    return {
      status: "error",
      message: actionErrorMessage(error),
      values,
    };
  }
}

export async function updateRolePermissionsAction(formData: FormData): Promise<void> {
  const actor = await getActorContext();
  if (!actor) {
    redirect("/login");
  }

  const role = getFormString(formData, "role");
  const permissions = getFormStrings(formData, "permissions");
  let errorMessage: string | null = null;

  try {
    updateRolePermissions(getDb(), actor, role, permissions);
  } catch (error) {
    errorMessage = actionErrorMessage(error);
  }

  if (errorMessage) {
    redirect(`/manage/settings/roles?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/manage/settings/roles");
  redirect(`/manage/settings/roles?saved=${encodeURIComponent(role)}`);
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const actor = await getActorContext();
  if (!actor) {
    redirect("/login");
  }

  const sessionId = getFormString(formData, "sessionId");
  let errorMessage: string | null = null;

  try {
    revokeSession(getDb(), actor, sessionId);
  } catch (error) {
    errorMessage = actionErrorMessage(error);
  }

  if (errorMessage) {
    redirect(`/manage/settings/sessions?error=${encodeURIComponent(errorMessage)}`);
  }

  revalidatePath("/manage/settings/sessions");
  redirect("/manage/settings/sessions?revoked=1");
}
