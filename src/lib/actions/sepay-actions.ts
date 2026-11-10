"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import {
  handleSepayWebhookCall,
  regenerateSepayApiKey,
  resetSepayConfig,
  setSepayWebhookEnabled,
  getSepaySettings,
} from "@/lib/services/sepay-service";

export async function regenerateSepayApiKeyAction(): Promise<{
  ok: boolean;
  message: string;
  newApiKey?: string;
}> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  const newApiKey = regenerateSepayApiKey(db, actor.tenantId);
  revalidatePath("/manage/settings/sepay");
  return {
    ok: true,
    message: "Đã làm mới API Key SePay thành công. Hãy cập nhật key mới này vào SePay.",
    newApiKey,
  };
}

export async function toggleSepayWebhookAction(
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  setSepayWebhookEnabled(db, actor.tenantId, enabled);
  revalidatePath("/manage/settings/sepay");
  return {
    ok: true,
    message: enabled
      ? "Đã bật nhận webhook SePay."
      : "Đã tạm dừng nhận webhook SePay.",
  };
}

export async function resetSepayConfigAction(): Promise<{
  ok: boolean;
  message: string;
}> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  resetSepayConfig(db, actor.tenantId);
  revalidatePath("/manage/settings/sepay");
  return {
    ok: true,
    message: "Đã thiết lập lại cấu hình SePay về mặc định ban đầu.",
  };
}

export async function sendTestSepayWebhookAction(): Promise<{
  ok: boolean;
  message: string;
}> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };
  assertPermission(actor, "settings.manage");

  const db = getDb();
  const settings = getSepaySettings(db, actor.tenantId);
  const testPayload = {
    id: `test-${Date.now()}`,
    gateway: "Vietcombank",
    transactionDate: new Date().toISOString().replace("T", " ").slice(0, 19),
    accountNumber: "0123456789",
    content: "TEST GIAO DICH SEPAY",
    transferType: "in" as const,
    transferAmount: 10000,
    referenceCode: `TEST.${Date.now()}`,
  };

  const res = await handleSepayWebhookCall(
    db,
    settings.apiKey,
    testPayload,
    JSON.stringify(testPayload),
  );

  revalidatePath("/manage/settings/sepay");
  return {
    ok: res.success,
    message: res.message || "Đã gửi thử giao dịch SePay 10.000đ thành công.",
  };
}
