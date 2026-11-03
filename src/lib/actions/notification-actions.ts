"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/services/notification-service";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const actor = await getActorContext();
  if (!actor || actor.readOnly) return;
  const id = formData.get("notificationId");
  if (typeof id === "string" && id) {
    markNotificationRead(getDb(), actor, id);
    revalidatePath("/manage");
  }
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const actor = await getActorContext();
  if (!actor || actor.readOnly) return;
  markAllNotificationsRead(getDb(), actor);
  revalidatePath("/manage");
}
