"use server";

import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/auth/permissions";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  createSubscriptionInvoice,
  getSubscriptionById,
  savePlatformBillingConfig,
  simulateDevSubscriptionPayment,
  type BillingCycle,
  type SubscriptionPlanKey,
} from "@/lib/services/subscription-service";

export async function createSubscriptionInvoiceAction(
  planKey: SubscriptionPlanKey,
  billingCycle: BillingCycle = "monthly",
) {
  const actor = await getActorContext();
  if (!actor) {
    return {
      success: false,
      error: "Vui lòng đăng nhập tài khoản Studio để thanh toán mua gói.",
    };
  }

  try {
    const db = getDb();
    const result = createSubscriptionInvoice(
      db,
      actor.tenantId,
      planKey,
      billingCycle,
    );
    return { success: true, data: result };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Không thể khởi tạo hóa đơn thanh toán.",
    };
  }
}

export async function checkSubscriptionStatusAction(subscriptionId: string) {
  const db = getDb();
  const sub = getSubscriptionById(db, subscriptionId);
  if (!sub) {
    return { success: false, error: "Không tìm thấy giao dịch." };
  }

  return {
    success: true,
    status: sub.status,
    plan: sub.plan,
    isExpired: sub.isExpired,
    paidAt: sub.paidAt ? sub.paidAt.toISOString() : null,
    planExpiresAt: sub.tenant?.planExpiresAt
      ? sub.tenant.planExpiresAt.toISOString()
      : null,
  };
}

export async function simulateSubscriptionPaymentAction(subscriptionId: string) {
  const actor = await getActorContext();
  if (!actor || actor.role !== "platform_admin") {
    return {
      success: false,
      error: "Tính năng này chỉ dành cho Quản trị viên Nền tảng (Platform SuperAdmin).",
    };
  }
  const db = getDb();
  const result = simulateDevSubscriptionPayment(db, subscriptionId);
  revalidatePath("/manage");
  revalidatePath("/manage/settings");
  revalidatePath("/manage/settings/billing");
  revalidatePath("/pricing");
  return result;
}

export async function savePlatformBillingConfigAction(formData: FormData) {
  const actor = await getActorContext();
  if (
    !actor ||
    (!hasPermission(actor.permissions, "tenants.manage") &&
      actor.role !== "platform_admin")
  ) {
    return {
      success: false,
      error: "Chỉ Quản trị viên Nền tảng (Platform SuperAdmin) mới có quyền cấu hình thanh toán nền tảng.",
    };
  }

  const bankBin = String(formData.get("bankBin") || "").trim();
  const bankName = String(formData.get("bankName") || "").trim();
  const accountNumber = String(formData.get("accountNumber") || "").trim();
  const accountName = String(formData.get("accountName") || "").trim();
  const sepayApiKey = String(formData.get("sepayApiKey") || "").trim();

  if (!accountNumber) {
    return { success: false, error: "Vui lòng nhập Số tài khoản ngân hàng." };
  }

  const db = getDb();
  savePlatformBillingConfig(db, actor.tenantId, {
    bankBin,
    bankName,
    accountNumber,
    accountName,
    sepayApiKey,
  });

  revalidatePath("/platform");
  return {
    success: true,
    message: "Đã lưu thông tin tài khoản nhận tiền nền tảng thành công!",
  };
}
