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

/**
 * Matches the order whose code appears in the transfer content. A shorter code
 * that is only a prefix of a longer number (DH1 inside DH10) is not a match,
 * and two different candidates of equal length are ambiguous: no match.
 */
export function matchOrderByTransferContent<T extends { code: string }>(
  candidates: T[],
  content: string,
): T | null {
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const cleanContent = clean(content);
  let best: T | null = null;
  let bestLength = 0;
  let ambiguous = false;
  for (const candidate of candidates) {
    const code = clean(candidate.code);
    if (!code) continue;
    let index = cleanContent.indexOf(code);
    let found = false;
    while (index !== -1) {
      const next = cleanContent[index + code.length] ?? "";
      if (!(/[0-9]/.test(code.at(-1) ?? "") && /[0-9]/.test(next))) {
        found = true;
        break;
      }
      index = cleanContent.indexOf(code, index + 1);
    }
    if (!found) continue;
    if (code.length > bestLength) {
      best = candidate;
      bestLength = code.length;
      ambiguous = false;
    } else if (code.length === bestLength) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}

export async function handleSepayWebhookCall(
  db: AppDb,
  apiKey: string,
  payload: SepayWebhookPayload,
  rawBody: string,
  options: { test?: boolean } = {},
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

  if (options.test) {
    // Connectivity check only: never touches payments or the cashbook.
    return {
      success: true,
      status: 200,
      message: "Webhook SePay hoạt động. Giao dịch thử không được ghi vào sổ quỹ.",
    };
  }

  const payloadHash = crypto
    .createHash("sha256")
    .update(rawBody || JSON.stringify(payload))
    .digest("hex");
  // Without a provider id, a retry of the same body must map to the same event.
  const eventId = String(
    payload.id || payload.referenceCode || `sepay-hash-${payloadHash.slice(0, 32)}`,
  );
  const rawAmount = Number(payload.transferAmount || 0);
  const transferAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.round(rawAmount) : 0;
  const transferType = payload.transferType === "out" ? "out" : "in";
  const eventType =
    transferType === "in" ? "payment.received" : "payment.sent";
  const content = payload.content || payload.description || "";
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
    matchedOrder = matchOrderByTransferContent(
      db
        .select()
        .from(orders)
        .where(and(eq(orders.tenantId, tenantId), sql`${orders.status} != 'cancelled'`))
        .all(),
      content,
    );
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
