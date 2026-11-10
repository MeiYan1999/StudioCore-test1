"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import {
  generateDraftWriterKey,
  generateHmacSecret,
  saveAiAssistantWebhook,
  setAiAssistantEnabled,
  setAiAssistantPaused,
  toggleBranchAiAssistant,
} from "@/lib/services/ai-assistant-service";

export async function toggleAiAssistantAction(
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  setAiAssistantEnabled(db, actor.tenantId, enabled);
  revalidatePath("/manage/settings/ai-assistant");
  return {
    ok: true,
    message: enabled
      ? "Đã bật trợ lý AI soạn tin."
      : "Đã tắt trợ lý AI soạn tin.",
  };
}

export async function toggleAiAssistantPauseAction(
  paused: boolean,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  setAiAssistantPaused(db, actor.tenantId, paused);
  revalidatePath("/manage/settings/ai-assistant");
  return {
    ok: true,
    message: paused
      ? "Đã tạm dừng trợ lý AI soạn tin."
      : "Đã tiếp tục chạy trợ lý AI soạn tin.",
  };
}

export async function toggleBranchAiAssistantAction(
  branchId: string,
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  toggleBranchAiAssistant(db, actor.tenantId, branchId, enabled);
  revalidatePath("/manage/settings/ai-assistant");
  return {
    ok: true,
    message: "Đã cập nhật trạng thái chi nhánh.",
  };
}

export async function saveAiAssistantWebhookAction(
  webhookUrl: string,
  hmacSecret: string,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  saveAiAssistantWebhook(db, actor.tenantId, webhookUrl, hmacSecret);
  revalidatePath("/manage/settings/ai-assistant");
  return {
    ok: true,
    message: "Đã lưu cấu hình webhook thành công.",
  };
}

export async function generateHmacSecretAction(): Promise<{
  ok: boolean;
  secret: string;
}> {
  return {
    ok: true,
    secret: generateHmacSecret(),
  };
}

export async function generateDraftWriterKeyAction(): Promise<{
  ok: boolean;
  message: string;
  key: string;
}> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập.", key: "" };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  const key = generateDraftWriterKey(db, actor.tenantId);
  revalidatePath("/manage/settings/ai-assistant");
  return {
    ok: true,
    message: "Đã tạo khóa draft_writer thành công.",
    key,
  };
}
