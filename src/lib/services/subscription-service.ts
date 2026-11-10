import crypto from "node:crypto";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  activityLogs,
  notifications,
  platformSubscriptions,
  settings,
  staff,
  tenants,
} from "../db/schema";
import { buildVietQrPayload, sanitizeTransferContent } from "../finance/vietqr";
import { getEnv } from "../env";

export type SubscriptionPlanKey = "trial" | "basic" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "yearly";

export interface PlanPricing {
  key: SubscriptionPlanKey;
  name: string;
  monthly: number;
  yearly: number;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanKey, PlanPricing> = {
  trial: {
    key: "trial",
    name: "Dùng thử 30 ngày",
    monthly: 0,
    yearly: 0,
  },
  basic: {
    key: "basic",
    name: "Vận hành cơ bản",
    monthly: 399_000,
    yearly: 3_990_000,
  },
  pro: {
    key: "pro",
    name: "Chuyên nghiệp (Pro)",
    monthly: 499_000,
    yearly: 4_990_000,
  },
  enterprise: {
    key: "enterprise",
    name: "Doanh nghiệp",
    monthly: 699_000,
    yearly: 6_990_000,
  },
};

export interface PlatformBillingConfig {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  sepayApiKey: string;
  webhookUrl: string;
}

export function getPlatformBillingConfig(db: AppDb): PlatformBillingConfig {
  const getSetting = (k: string) => {
    const row = db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.key, k), eq(settings.tenantId, "platform_admin")))
      .get();
    return row?.value || "";
  };

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.studiocore.io.vn"
  ).replace(/\/$/, "");

  return {
    bankBin: getSetting("platform.bank_bin") || process.env.PLATFORM_BANK_BIN || "970422", // MBBank
    bankName:
      getSetting("platform.bank_name") ||
      process.env.PLATFORM_BANK_NAME ||
      "MBBank (Ngân hàng Quân Đội)",
    accountNumber:
      getSetting("platform.bank_account") ||
      process.env.PLATFORM_BANK_ACCOUNT ||
      "0987654321",
    accountName:
      getSetting("platform.account_name") ||
      process.env.PLATFORM_ACCOUNT_NAME ||
      "CONG TY STUDIOCORE",
    sepayApiKey:
      getSetting("platform.sepay_api_key") ||
      process.env.PLATFORM_SEPAY_API_KEY ||
      "studiocore_platform_secret",
    webhookUrl: `${siteUrl}/api/webhooks/platform-billing`,
  };
}

export function generateTransferCode(): string {
  // Sinh mã chuyển khoản duy nhất định dạng SC + 5 số ngẫu nhiên (VD: SC73829)
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `SC${randomNum}`;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  tenantId: string;
  plan: SubscriptionPlanKey;
  billingCycle: BillingCycle;
  amount: number;
  code: string;
  expiresAt: string;
  status: string;
  vietQr: {
    payload: string;
    content: string;
    imageUrl: string;
  };
  bank: {
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export function createSubscriptionInvoice(
  db: AppDb,
  tenantId: string,
  planKey: SubscriptionPlanKey,
  billingCycle: BillingCycle = "monthly",
): CreateSubscriptionResult {
  const planInfo = SUBSCRIPTION_PLANS[planKey];
  if (!planInfo || planInfo.monthly === 0) {
    throw new Error("Gói cước không hợp lệ để tạo hóa đơn thanh toán.");
  }

  const amount = billingCycle === "yearly" ? planInfo.yearly : planInfo.monthly;
  const config = getPlatformBillingConfig(db);

  // Sinh mã nạp duy nhất, kiểm tra không trùng
  let code = generateTransferCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = db
      .select({ id: platformSubscriptions.id })
      .from(platformSubscriptions)
      .where(eq(platformSubscriptions.code, code))
      .get();
    if (!existing) break;
    code = generateTransferCode();
    attempts++;
  }

  const id = `sub_${crypto.randomUUID().slice(0, 16)}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 phút

  db.insert(platformSubscriptions)
    .values({
      id,
      tenantId,
      plan: planKey,
      billingCycle,
      amount,
      code,
      status: "pending",
      expiresAt,
    })
    .run();

  const vietQr = buildVietQrPayload({
    bankBin: config.bankBin,
    accountNumber: config.accountNumber,
    accountName: config.accountName,
    amount,
    content: code,
  });

  return {
    subscriptionId: id,
    tenantId,
    plan: planKey,
    billingCycle,
    amount,
    code,
    expiresAt: expiresAt.toISOString(),
    status: "pending",
    vietQr,
    bank: {
      bankBin: config.bankBin,
      bankName: config.bankName,
      accountNumber: config.accountNumber,
      accountName: config.accountName,
    },
  };
}

export function getSubscriptionById(db: AppDb, subscriptionId: string) {
  const sub = db
    .select()
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.id, subscriptionId))
    .get();

  if (!sub) return null;

  const tenant = db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      planExpiresAt: tenants.planExpiresAt,
    })
    .from(tenants)
    .where(eq(tenants.id, sub.tenantId))
    .get();

  return {
    ...sub,
    tenant,
    isExpired: sub.status === "pending" && sub.expiresAt.getTime() < Date.now(),
  };
}

export function getTenantCurrentSubscription(db: AppDb, tenantId: string) {
  const tenant = db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      planExpiresAt: tenants.planExpiresAt,
      status: tenants.status,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();

  if (!tenant) return null;

  const latestSub = db
    .select()
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.tenantId, tenantId))
    .orderBy(desc(platformSubscriptions.createdAt))
    .limit(1)
    .get();

  const planInfo =
    SUBSCRIPTION_PLANS[tenant.plan as SubscriptionPlanKey] ||
    SUBSCRIPTION_PLANS.trial;

  return {
    tenant,
    planInfo,
    latestSub,
    isTrial: tenant.plan === "trial",
  };
}

export interface ProcessWebhookResult {
  success: boolean;
  message: string;
  subscriptionId?: string;
  plan?: string;
  tenantId?: string;
}

export function activateSubscription(
  db: AppDb,
  subscription: typeof platformSubscriptions.$inferSelect,
  paymentDetails: {
    gateway?: string;
    transactionRef?: string;
    accountNumber?: string;
    content?: string;
  },
): { success: boolean; newExpiryDate: Date } {
  const tenant = db
    .select()
    .from(tenants)
    .where(eq(tenants.id, subscription.tenantId))
    .get();

  if (!tenant) {
    throw new Error(`Không tìm thấy Studio (tenantId: ${subscription.tenantId})`);
  }

  // Tính ngày hết hạn mới
  const daysToAdd = subscription.billingCycle === "yearly" ? 365 : 30;
  const currentExpiry =
    tenant.planExpiresAt && tenant.planExpiresAt.getTime() > Date.now()
      ? tenant.planExpiresAt.getTime()
      : Date.now();

  const newExpiryDate = new Date(currentExpiry + daysToAdd * 24 * 60 * 60 * 1000);

  // 1. Cập nhật subscription
  db.update(platformSubscriptions)
    .set({
      status: "completed",
      paidAt: new Date(),
      gateway: paymentDetails.gateway || "SePay",
      transactionRef: paymentDetails.transactionRef,
      accountNumber: paymentDetails.accountNumber,
      content: paymentDetails.content,
      updatedAt: new Date(),
    })
    .where(eq(platformSubscriptions.id, subscription.id))
    .run();

  // 2. Cập nhật tenant plan & planExpiresAt
  db.update(tenants)
    .set({
      plan: subscription.plan,
      planExpiresAt: newExpiryDate,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id))
    .run();

  // 3. Ghi thông báo cho chủ studio
  const ownerStaff = db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.tenantId, tenant.id), eq(staff.role, "owner")))
    .get();

  if (ownerStaff) {
    db.insert(notifications)
      .values({
        id: `notif_${crypto.randomUUID().slice(0, 16)}`,
        tenantId: tenant.id,
        userId: ownerStaff.id,
        type: "subscription_activated",
        title: "Kích hoạt gói cước thành công! 🎉",
        content: `Gói ${SUBSCRIPTION_PLANS[subscription.plan as SubscriptionPlanKey]?.name || subscription.plan} của bạn đã được kích hoạt tới ${newExpiryDate.toLocaleDateString("vi-VN")}. Cảm ơn bạn đã đồng hành cùng StudioCore!`,
        link: "/manage/settings/billing",
      })
      .run();
  }

  return { success: true, newExpiryDate };
}

export function processPlatformBillingWebhook(
  db: AppDb,
  payload: {
    id?: number | string;
    gateway?: string;
    transactionDate?: string;
    accountNumber?: string;
    content?: string;
    transferType?: "in" | "out";
    transferAmount?: number;
    referenceCode?: string;
  },
  apiKeyHeader?: string,
): ProcessWebhookResult {
  // 1. Kiểm tra API Key nền tảng (nếu có cấu hình)
  const config = getPlatformBillingConfig(db);
  if (config.sepayApiKey && apiKeyHeader) {
    const cleanHeader = apiKeyHeader.replace(/^(Apikey|Bearer)\s+/i, "").trim();
    if (cleanHeader !== config.sepayApiKey) {
      return {
        success: false,
        message: "API Key xác thực Webhook không hợp lệ.",
      };
    }
  }

  // Chỉ xử lý giao dịch tiền vào (tiền nạp mua gói)
  if (payload.transferType && payload.transferType !== "in") {
    return {
      success: true,
      message: "Bỏ qua giao dịch tiền ra (transferType: out).",
    };
  }

  const rawContent = (payload.content || "").toUpperCase();
  const transferAmount = Number(payload.transferAmount || 0);

  // 2. Tìm mã nạp dạng SCxxxxx trong nội dung
  const codeMatch = rawContent.match(/SC[0-9]{4,6}/i) || rawContent.match(/SC[A-Z0-9]{4,8}/i);
  if (!codeMatch) {
    return {
      success: false,
      message: "Không tìm thấy mã thanh toán hợp lệ (dạng SCxxxxx) trong nội dung chuyển khoản.",
    };
  }

  const transferCode = codeMatch[0].toUpperCase();

  // 3. Tìm đơn hàng thanh toán gói đang pending
  const subscription = db
    .select()
    .from(platformSubscriptions)
    .where(
      and(
        eq(platformSubscriptions.code, transferCode),
        eq(platformSubscriptions.status, "pending"),
      ),
    )
    .get();

  if (!subscription) {
    return {
      success: false,
      message: `Không tìm thấy đơn nạp gói đang chờ với mã ${transferCode} (hoặc đơn đã được xử lý trước đó).`,
    };
  }

  // 4. Kiểm tra số tiền chuyển vào
  if (transferAmount < subscription.amount) {
    return {
      success: false,
      message: `Số tiền chuyển khoản (${transferAmount.toLocaleString("vi-VN")} đ) chưa đủ giá trị gói cước (${subscription.amount.toLocaleString("vi-VN")} đ).`,
    };
  }

  // 5. Kích hoạt gói cước ngay lập tức
  const result = activateSubscription(db, subscription, {
    gateway: payload.gateway,
    transactionRef: payload.referenceCode || String(payload.id || ""),
    accountNumber: payload.accountNumber,
    content: payload.content,
  });

  return {
    success: true,
    message: `Thanh toán thành công! Đã kích hoạt gói ${subscription.plan} cho studio tới ngày ${result.newExpiryDate.toLocaleDateString("vi-VN")}.`,
    subscriptionId: subscription.id,
    plan: subscription.plan,
    tenantId: subscription.tenantId,
  };
}

export function simulateDevSubscriptionPayment(
  db: AppDb,
  subscriptionId: string,
): ProcessWebhookResult {
  const subscription = db
    .select()
    .from(platformSubscriptions)
    .where(eq(platformSubscriptions.id, subscriptionId))
    .get();

  if (!subscription) {
    return { success: false, message: "Không tìm thấy đơn nạp." };
  }

  if (subscription.status === "completed") {
    return { success: true, message: "Đơn nạp này đã được duyệt trước đó." };
  }

  const result = activateSubscription(db, subscription, {
    gateway: "MBBank Test",
    transactionRef: `TEST_${Date.now()}`,
    accountNumber: "0987654321",
    content: `${subscription.code} test payment`,
  });

  return {
    success: true,
    message: `[Giả lập thanh toán thành công] Đã kích hoạt gói ${subscription.plan} tới ngày ${result.newExpiryDate.toLocaleDateString("vi-VN")}.`,
    subscriptionId: subscription.id,
    plan: subscription.plan,
    tenantId: subscription.tenantId,
  };
}
