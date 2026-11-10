"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  createSubscriptionInvoice,
  getSubscriptionById,
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
  const db = getDb();
  const result = simulateDevSubscriptionPayment(db, subscriptionId);
  revalidatePath("/manage");
  revalidatePath("/manage/settings");
  revalidatePath("/manage/settings/billing");
  revalidatePath("/pricing");
  return result;
}
