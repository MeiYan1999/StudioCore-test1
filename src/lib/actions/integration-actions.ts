"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  disconnectGoogleConnection,
  setupStudioDriveWorkspace,
} from "@/lib/services/drive-connection-service";

export async function disconnectGoogleAction(): Promise<void> {
  const actor = await getActorContext();
  if (!actor) {
    redirect("/login");
  }
  disconnectGoogleConnection(getDb(), actor);
  revalidatePath("/manage/settings/integrations");
  redirect("/manage/settings/integrations?google=disconnected");
}

export async function refreshGoogleDriveTokenAction(): Promise<{
  ok: boolean;
  message: string;
}> {
  const actor = await getActorContext();
  if (!actor) {
    return { ok: false, message: "Bạn chưa đăng nhập." };
  }
  try {
    const db = getDb();
    await setupStudioDriveWorkspace(db, actor.tenantId);
    revalidatePath("/manage/settings/integrations");
    return {
      ok: true,
      message: "Làm mới token và cập nhật dung lượng Google Drive thành công.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Không thể làm mới token Google Drive. Vui lòng kết nối lại.",
    };
  }
}
