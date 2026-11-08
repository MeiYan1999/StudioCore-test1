"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { contactRequests, staff, tenants } from "@/lib/db/schema";
import { hashSecret } from "@/lib/auth/password";
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

export async function updateContactRequestStatusAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    throw new AuthorizationError("Chỉ platform admin mới có quyền quản lý yêu cầu liên hệ.");
  }
  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!requestId || !status) return;

  const db = getDb();
  db.update(contactRequests)
    .set({ status, updatedAt: new Date() })
    .where(eq(contactRequests.id, requestId))
    .run();

  revalidatePath("/platform");
}

export async function resetTenantOwnerPasswordAction(formData: FormData): Promise<void> {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    throw new AuthorizationError("Chỉ platform admin mới có quyền đặt lại mật khẩu owner.");
  }
  const tenantId = String(formData.get("tenantId") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "Studio@123456");
  if (!tenantId) return;

  const db = getDb();
  const passwordHash = hashSecret(newPassword);

  db.update(staff)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(staff.tenantId, tenantId), eq(staff.role, "owner")))
    .run();

  revalidatePath("/platform");
}
