import crypto from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  branches,
  orders,
  paymentWebhookEvents,
  settings,
  transactions,
} from "../db/schema";
import { setTenantSetting } from "./settings-write-service";
import { processPaymentWebhook } from "./finance-service";

export type SepayStats = {
  totalCalls: number;
  recordedCount: number;
  lastCallAt: string | null;
  lastTransactionText: string;
  hasSignals: boolean;
};

export type SepaySettings = {
  apiKey: string;
  enabled: boolean;
  webhookUrl: string;
  stats: SepayStats;
};

export type SepayWebhookPayload = {
  id?: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  code?: string | null;
  content?: string;
  transferType?: "in" | "out";
  description?: string;
  transferAmount?: number;
  referenceCode?: string;
  accumulated?: number;
};

export function generateSepayApiKey(): string {
  return `sepay_${crypto.randomBytes(16).toString("hex")}`;
}

export function getSepaySettings(db: AppDb, tenantId: string): SepaySettings {
  // 1. Retrieve or generate API Key
  const apiKeyRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "sepay.api_key")))
    .get();

  let apiKey = apiKeyRow?.value?.trim() || "";
  if (!apiKey) {
    apiKey = generateSepayApiKey();
    setTenantSetting(db, tenantId, "sepay.api_key", apiKey);
  }

  // 2. Retrieve enabled status (default true)
  const enabledRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "sepay.enabled")))
    .get();

  const enabled = enabledRow?.value !== "false";

  // 3. Webhook URL
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.studiocore.io.vn"
  ).replace(/\/$/, "");
  const webhookUrl = `${siteUrl}/api/webhooks/sepay`;

  // 4. Calculate connection stats from paymentWebhookEvents
  const events = db
    .select({
      id: paymentWebhookEvents.id,
      status: paymentWebhookEvents.status,
      createdAt: paymentWebhookEvents.createdAt,
    })
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.tenantId, tenantId),
        eq(paymentWebhookEvents.provider, "sepay"),
      ),
    )
    .orderBy(desc(paymentWebhookEvents.createdAt))
    .all();

  const totalCalls = events.length;
  const recordedCount = events.filter((e) => e.status === "processed").length;
  const lastCallAt = events[0]?.createdAt
    ? events[0].createdAt.toISOString()
    : null;

  // Retrieve last recorded transaction text
  const lastTx = db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      description: transactions.description,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.tenantId, tenantId),
        sql`(${transactions.idempotencyKey} LIKE '%sepay%' OR ${transactions.reference} = 'sepay' OR ${transactions.description} LIKE '%SePay%' OR ${transactions.description} LIKE '%sepay%')`,
      ),
    )
    .orderBy(desc(transactions.occurredAt))
    .limit(1)
    .get();

  let lastTransactionText = "-";
  if (lastTx) {
    const sign = lastTx.type === "income" ? "+" : "-";
    lastTransactionText = `${sign}${Number(lastTx.amount).toLocaleString("vi-VN")}đ`;
  }

  return {
    apiKey,
    enabled,
    webhookUrl,
    stats: {
      totalCalls,
      recordedCount,
      lastCallAt,
      lastTransactionText,
      hasSignals: totalCalls > 0,
    },
  };
}

export function regenerateSepayApiKey(db: AppDb, tenantId: string): string {
  const newKey = generateSepayApiKey();
  setTenantSetting(db, tenantId, "sepay.api_key", newKey);
  return newKey;
}

export function setSepayWebhookEnabled(
  db: AppDb,
  tenantId: string,
  enabled: boolean,
): void {
  setTenantSetting(db, tenantId, "sepay.enabled", enabled ? "true" : "false");
}

export function resetSepayConfig(db: AppDb, tenantId: string): SepaySettings {
  const newKey = generateSepayApiKey();
  setTenantSetting(db, tenantId, "sepay.api_key", newKey);
  setTenantSetting(db, tenantId, "sepay.enabled", "true");
  return getSepaySettings(db, tenantId);
}

export function findTenantBySepayApiKey(
  db: AppDb,
  apiKey: string,
): string | null {
  if (!apiKey || typeof apiKey !== "string") return null;
  const cleanKey = apiKey.trim().replace(/^(Apikey|Bearer)\s+/i, "");
  const row = db
    .select({ tenantId: settings.tenantId })
    .from(settings)
    .where(and(eq(settings.key, "sepay.api_key"), eq(settings.value, cleanKey)))
    .get();

  return row?.tenantId ?? null;
}

export async function handleSepayWebhookCall(
  db: AppDb,
  apiKey: string,
  payload: SepayWebhookPayload,
  rawBody: string,
): Promise<{ success: boolean; status: number; message: string; paymentId?: string }> {
  const tenantId = findTenantBySepayApiKey(db, apiKey);
  if (!tenantId) {
    return {
      success: false,
      status: 401,
      message: "API Key SePay không hợp lệ hoặc chưa được liên kết.",
    };
  }

  // Check if webhook is enabled
  const enabledRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "sepay.enabled")))
    .get();

  if (enabledRow?.value === "false") {
    return {
      success: false,
      status: 200,
      message: "Webhook SePay đang tạm tắt cho studio này.",
    };
  }

  const eventId = String(
    payload.id || payload.referenceCode || `sepay-${Date.now()}-${Math.random()}`,
  );
  const transferAmount = Number(payload.transferAmount || 0);
  const transferType = payload.transferType === "out" ? "out" : "in";
  const eventType =
    transferType === "in" ? "payment.received" : "payment.sent";
  const content = payload.content || payload.description || "";
  const payloadHash = crypto
    .createHash("sha256")
    .update(rawBody || JSON.stringify(payload))
    .digest("hex");

  // Check if already processed
  const existingEvent = db
    .select()
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.tenantId, tenantId),
        eq(paymentWebhookEvents.provider, "sepay"),
        eq(paymentWebhookEvents.externalEventId, eventId),
      ),
    )
    .get();

  if (existingEvent) {
    return {
      success: true,
      status: 200,
      message: "Giao dịch đã được ghi nhận trước đó (Duplicate).",
    };
  }

  // If money is in (transferType === "in"), try to match an order
  let matchedOrder: typeof orders.$inferSelect | null = null;
  if (transferType === "in" && content) {
    // 1. Try finding order by exact code match in content
    const allTenantOrders = db
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantId), sql`${orders.status} != 'cancelled'`))
      .all();

    for (const ord of allTenantOrders) {
      const cleanOrderCode = ord.code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const cleanContent = content.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      if (cleanOrderCode && cleanContent.includes(cleanOrderCode)) {
        matchedOrder = ord;
        break;
      }
    }
  }

  // If order matched and amount valid, use processPaymentWebhook
  if (matchedOrder && transferAmount > 0) {
    try {
      const res = processPaymentWebhook(
        db,
        {
          provider: "sepay",
          eventId,
          eventType,
          orderId: matchedOrder.id,
          amount: transferAmount,
          reference: payload.referenceCode || payload.accountNumber || "SePay",
          occurredAt: payload.transactionDate,
        },
        rawBody,
      );
      return {
        success: true,
        status: 200,
        message: `Đã tự động ghi nhận thanh toán ${transferAmount.toLocaleString("vi-VN")}đ cho đơn ${matchedOrder.code}.`,
        paymentId: res.paymentId,
      };
    } catch (orderErr) {
      console.warn("Failed to attach SePay webhook directly to order:", orderErr);
      // Fall through to record general transaction
    }
  }

  // Otherwise, record as general studio transaction and log event
  const branch = db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.tenantId, tenantId))
    .limit(1)
    .get();

  const branchId = branch?.id || "branch-default";
  const eventRowId = crypto.randomUUID();
  const txId = crypto.randomUUID();

  db.transaction((tx) => {
    tx.insert(paymentWebhookEvents)
      .values({
        id: eventRowId,
        tenantId,
        provider: "sepay",
        externalEventId: eventId,
        eventType,
        payloadHash,
        status: "processed",
        processedAt: new Date(),
      })
      .run();

    if (transferAmount > 0) {
      tx.insert(transactions)
        .values({
          id: txId,
          tenantId,
          branchId,
          type: transferType === "in" ? "income" : "expense",
          category: transferType === "in" ? "other_income" : "other_expense",
          amount: transferAmount,
          method: "bank_transfer",
          description: content || `Biến động số dư SePay (${payload.gateway || "Ngân hàng"})`,
          reference: payload.referenceCode || payload.accountNumber || "sepay",
          idempotencyKey: `sepay:${eventId}`,
          occurredAt: payload.transactionDate
            ? new Date(payload.transactionDate)
            : new Date(),
        })
        .run();
    }
  });

  return {
    success: true,
    status: 200,
    message: "Đã ghi nhận biến động số dư SePay thành công.",
  };
}
