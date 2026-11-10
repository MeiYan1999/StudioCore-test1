"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { contactRequests, platformSubscriptions, staff, tenants } from "@/lib/db/schema";
import { hashSecret } from "@/lib/auth/password";
import { AuthorizationError } from "@/lib/errors";
import { registerTenant } from "@/lib/services/onboarding-service";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanKey } from "@/lib/services/subscription-service";

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

export async function createTenantFromPlatformAction(formData: FormData): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    throw new AuthorizationError("Chỉ platform admin mới có quyền tạo studio mới.");
  }

  const studioName = String(formData.get("studioName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const plan = String(formData.get("plan") ?? "trial").trim();
  const password = String(formData.get("password") ?? "Studio@123456").trim();
  const months = Number(formData.get("months") ?? 1);

  if (!studioName || !ownerName || !email) {
    return { success: false, error: "Vui lòng điền đầy đủ tên Studio, tên Chủ studio và Email." };
  }

  try {
    const db = getDb();
    const result = registerTenant(db, {
      studioName,
      ownerName,
      email,
      phone,
      password: password || "Studio@123456",
      branchName: `${studioName} — Trụ sở chính`,
      branchAddress: "Hà Nội",
      branchPhone: phone,
    });

    if (plan !== "trial") {
      const expiresAt = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
      db.update(tenants)
        .set({
          plan,
          status: "active",
          planExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, result.tenantId))
        .run();
    }

    revalidatePath("/platform");
    return {
      success: true,
      message: `Đã tạo thành công Studio "${studioName}" với email ${email}!`,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Lỗi tạo studio." };
  }
}

export async function extendTenantPlanAction(formData: FormData): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    throw new AuthorizationError("Chỉ platform admin mới có quyền gia hạn gói.");
  }

  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const months = Number(formData.get("months") ?? 1);
  const plan = String(formData.get("plan") ?? "").trim();

  if (!tenantId) return { success: false, error: "Thiếu tenantId." };

  const db = getDb();
  const tenant = db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
  if (!tenant) return { success: false, error: "Không tìm thấy Studio." };

  const targetPlan = plan || tenant.plan || "pro";
  const now = Date.now();
  const currentExpiry =
    tenant.planExpiresAt && tenant.planExpiresAt.getTime() > now
      ? tenant.planExpiresAt.getTime()
      : now;

  const newExpiry = new Date(currentExpiry + months * 30 * 24 * 60 * 60 * 1000);

  db.update(tenants)
    .set({
      plan: targetPlan,
      status: "active",
      planExpiresAt: newExpiry,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .run();

  // Ghi nhật ký vào platform_subscriptions để thống kê
  const subId = `sub_manual_${crypto.randomUUID().slice(0, 12)}`;
  const code = `SC_MAN_${Math.floor(10000 + Math.random() * 90000)}`;
  const planInfo = SUBSCRIPTION_PLANS[targetPlan as SubscriptionPlanKey];
  const amount = planInfo ? planInfo.monthly * months : 0;

  db.insert(platformSubscriptions)
    .values({
      id: subId,
      tenantId,
      plan: targetPlan,
      billingCycle: months >= 12 ? "yearly" : "monthly",
      amount,
      code,
      status: "completed",
      gateway: "manual_admin",
      content: `SuperAdmin kích hoạt thủ công +${months} tháng`,
      expiresAt: newExpiry,
      paidAt: new Date(),
    })
    .run();

  revalidatePath("/platform");
  return {
    success: true,
    message: `Đã gia hạn thành công gói ${targetPlan.toUpperCase()} thêm ${months} tháng cho studio "${tenant.name}"!`,
  };
}
