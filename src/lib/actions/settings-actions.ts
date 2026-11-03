"use server";

import { revalidatePath } from "next/cache";
import { getFormString, type ActionState } from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  saveBranch,
  saveStudioSettings,
} from "@/lib/services/settings-write-service";

function errorMessage(error: unknown): string {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }
  return "Không thể lưu cấu hình. Vui lòng thử lại.";
}

export async function saveStudioSettingsAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    saveStudioSettings(getDb(), actor, {
      name: getFormString(formData, "name"),
      logoUrl: getFormString(formData, "logoUrl"),
      address: getFormString(formData, "address"),
      phone: getFormString(formData, "phone"),
      email: getFormString(formData, "email"),
      website: getFormString(formData, "website"),
      taxCode: getFormString(formData, "taxCode"),
      bankName: getFormString(formData, "bankName"),
      bankBin: getFormString(formData, "bankBin"),
      bankAccountNumber: getFormString(formData, "bankAccountNumber"),
      bankAccountName: getFormString(formData, "bankAccountName"),
      weekdayHours: getFormString(formData, "weekdayHours"),
      saturdayHours: getFormString(formData, "saturdayHours"),
      sundayHours: getFormString(formData, "sundayHours"),
      reviewTemplate: getFormString(formData, "reviewTemplate"),
      reminderTemplate: getFormString(formData, "reminderTemplate"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/settings/studio");
  revalidatePath("/manage/settings/branches");
  return { status: "success", message: "Đã lưu cấu hình studio." };
}

export async function saveBranchAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    saveBranch(getDb(), actor, {
      id: getFormString(formData, "branchId") || undefined,
      name: getFormString(formData, "name"),
      address: getFormString(formData, "address"),
      phone: getFormString(formData, "phone"),
      status: getFormString(formData, "status"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/settings/branches");
  return { status: "success", message: "Đã lưu chi nhánh." };
}
