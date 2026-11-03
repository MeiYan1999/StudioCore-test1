"use server";

import { revalidatePath } from "next/cache";
import {
  fieldErrorsFromZod,
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { runAlbumAiScan, saveAiSettings } from "@/lib/services/ai-service";
import { aiSettingsSchema } from "@/lib/validators/ai";

function booleanField(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

function errorMessage(error: unknown): string {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }
  return "Không thể thực hiện thao tác AI. Vui lòng thử lại.";
}

export async function saveAiSettingsAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const parsed = aiSettingsSchema.safeParse({
    provider: getFormString(formData, "provider"),
    model: getFormString(formData, "model"),
    apiKey: getFormString(formData, "apiKey"),
    clearApiKey: booleanField(formData, "clearApiKey"),
    consent: booleanField(formData, "consent"),
    budgetVnd: getFormString(formData, "budgetVnd") || "0",
    costPerImageVnd: getFormString(formData, "costPerImageVnd") || "0",
    features: {
      blur: booleanField(formData, "featureBlur"),
      exposure: booleanField(formData, "featureExposure"),
      duplicate: booleanField(formData, "featureDuplicate"),
      burst: booleanField(formData, "featureBurst"),
      eyeDetection: false,
    },
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra cấu hình AI.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  try {
    saveAiSettings(getDb(), actor, {
      provider: parsed.data.provider,
      model: parsed.data.model || "",
      apiKey: parsed.data.apiKey || "",
      clearApiKey: parsed.data.clearApiKey,
      consent: parsed.data.consent,
      budgetVnd: parsed.data.budgetVnd,
      costPerImageVnd: parsed.data.costPerImageVnd,
      features: parsed.data.features,
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }

  revalidatePath("/manage/settings/ai");
  return { status: "success", message: "Đã lưu cấu hình AI Hub." };
}

export async function runAlbumAiScanAction(input: { albumId: string }): Promise<
  | { ok: true; jobId: string; scanned: number; issueCount: number }
  | { ok: false; error: string }
> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  if (!input.albumId) return { ok: false, error: "Album không hợp lệ." };
  try {
    const result = await runAlbumAiScan(getDb(), actor, input.albumId);
    revalidatePath(`/manage/albums/${input.albumId}`);
    revalidatePath("/manage/settings/ai");
    return {
      ok: true,
      jobId: result.jobId,
      scanned: result.result.scanned,
      issueCount: result.result.insights.length,
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
