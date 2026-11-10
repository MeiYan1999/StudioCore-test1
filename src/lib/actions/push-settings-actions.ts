"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  setPushEnabled,
  updatePushCategory,
  type PushCategoryKey,
} from "@/lib/services/push-settings-service";

export async function togglePushEnabledAction(
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };

  const db = getDb();
  setPushEnabled(db, actor.tenantId, actor.staffId, enabled);
  revalidatePath("/manage/settings/notifications");
  return {
    ok: true,
    message: enabled
      ? "Đã bật nhận thông báo đẩy."
      : "Đã tắt nhận thông báo đẩy.",
  };
}

export async function updatePushCategoryAction(
  category: PushCategoryKey,
  enabled: boolean,
): Promise<{ ok: boolean; message: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, message: "Bạn chưa đăng nhập." };

  const db = getDb();
  updatePushCategory(db, actor.tenantId, actor.staffId, category, enabled);
  revalidatePath("/manage/settings/notifications");
  return {
    ok: true,
    message: "Đã cập nhật tùy chọn thông báo.",
  };
}
