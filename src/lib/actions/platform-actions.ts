"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { AuthorizationError } from "@/lib/errors";

export async function updateTenantPlanAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    throw new AuthorizationError("Chỉ platform admin mới có quyền đổi gói tenant.");
  }
  const tenantId = String(formData.get("tenantId") ?? "");
  const plan = String(formData.get("plan") ?? "");
  if (!tenantId || !plan) return;

  const db = getDb();
  db.update(tenants)
    .set({ plan, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .run();

  revalidatePath("/platform");
}

export async function updateTenantStatusAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    throw new AuthorizationError("Chỉ platform admin mới có quyền đổi trạng thái tenant.");
  }
  const tenantId = String(formData.get("tenantId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!tenantId || !status) return;

  const db = getDb();
  db.update(tenants)
    .set({ status, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .run();

  revalidatePath("/platform");
}
