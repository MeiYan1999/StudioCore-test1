"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { disconnectGoogleConnection } from "@/lib/services/drive-connection-service";

export async function disconnectGoogleAction(): Promise<void> {
  const actor = await getActorContext();
  if (!actor) {
    redirect("/login");
  }
  disconnectGoogleConnection(getDb(), actor);
  revalidatePath("/manage/settings/integrations");
  redirect("/manage/settings/integrations?google=disconnected");
}
