import { beforeAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import {
  expenses,
  invoices,
  payments,
  paymentWebhookEvents,
  transactions,
} from "@/lib/db/schema";
import {
  createInvoiceForOrder,
  getFinanceSummary,
  listDebtors,
  processPaymentWebhook,
  recordRefund,
  updateInvoiceStatus,
} from "@/lib/services/finance-service";
import {
  getRevenueReport,
  getTaxReport,
  reportCsv,
} from "@/lib/services/report-service";
import { recordOrderPayment, getOrderDetail } from "@/lib/services/order-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;

async function login(email: string, ip: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip, userAgent: "vitest-finance" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

beforeAll(async () => {
  db = createTestDb();
  owner = await login("owner@studiocore.demo", "192.0.2.100");
});

describe("tài chính, hóa đơn và webhook", () => {
  it("seed transactions đối soát payments, ghi thanh toán sinh transaction", () => {
    const seededSummary = getFinanceSummary(db, owner, {
      from: "2026-09-01",
      to: "2026-10-31",
    });
    expect(seededSummary.income).toBe(22_500_000);
    expect(seededSummary.expense).toBe(15_500_000);
    expect(seededSummary.refund).toBe(0);
    expect(seededSummary.net).toBe(7_000_000);

    const paymentId = recordOrderPayment(db, owner, "order-demo-04", {
      amount: 1_000_000,
      method: "cash",
      reference: "TEST-FIN-001",
      paidAt: "",
    });
    const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
    expect(payment?.amount).toBe(1_000_000);
    const tx = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.tenantId, owner.tenantId),
          eq(transactions.idempotencyKey, `payment:${paymentId}`),
        ),
      )
      .get();
    expect(tx?.amount).toBe(1_000_000);
    expect(tx?.orderId).toBe("order-demo-04");
  });

  it("webhook xử lý một lần, gửi lặp trả duplicate và không tạo payment", () => {
    const beforePayments =
      db.select({ value: count() }).from(payments).where(eq(payments.tenantId, owner.tenantId)).get()?.value ?? 0;
    const beforeTransactions =
      db.select({ value: count() }).from(transactions).where(eq(transactions.tenantId, owner.tenantId)).get()?.value ?? 0;
    const payload = JSON.stringify({
      eventId: "test-webhook-001",
      orderId: "order-demo-04",
      amount: 500_000,
      provider: "mock",
    });
    const first = processPaymentWebhook(
      db,
      {
        provider: "mock",
        eventId: "test-webhook-001",
        eventType: "payment.succeeded",
        orderId: "order-demo-04",
        amount: 500_000,
      },
      payload,
    );
    expect(first.status).toBe("processed");
    const second = processPaymentWebhook(
      db,
      {
        provider: "mock",
        eventId: "test-webhook-001",
        eventType: "payment.succeeded",
        orderId: "order-demo-04",
        amount: 500_000,
      },
      payload,
    );
    expect(second.status).toBe("duplicate");
    const afterPayments =
      db.select({ value: count() }).from(payments).where(eq(payments.tenantId, owner.tenantId)).get()?.value ?? 0;
    const afterTransactions =
      db.select({ value: count() }).from(transactions).where(eq(transactions.tenantId, owner.tenantId)).get()?.value ?? 0;
    expect(afterPayments).toBe(beforePayments + 1);
    expect(afterTransactions).toBe(beforeTransactions + 1);
    const events = db
      .select()
      .from(paymentWebhookEvents)
      .where(eq(paymentWebhookEvents.externalEventId, "test-webhook-001"))
      .all();
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("processed");
  });

  it("webhook vượt công nợ bị chặn, không để lại event/payment dở dang", () => {
    const beforeEvents =
      db
        .select({ value: count() })
        .from(paymentWebhookEvents)
        .where(eq(paymentWebhookEvents.tenantId, owner.tenantId))
        .get()?.value ?? 0;
    const beforePayments =
      db
        .select({ value: count() })
        .from(payments)
        .where(eq(payments.tenantId, owner.tenantId))
        .get()?.value ?? 0;
    expect(() =>
      processPaymentWebhook(
        db,
        {
          provider: "mock",
          eventId: "test-webhook-over",
          eventType: "payment.succeeded",
          orderId: "order-demo-04",
          amount: 999_000_000,
        },
        '{"eventId":"test-webhook-over"}',
      ),
    ).toThrow(/vượt quá công nợ/);
    expect(
      db
        .select({ value: count() })
        .from(paymentWebhookEvents)
        .where(eq(paymentWebhookEvents.tenantId, owner.tenantId))
        .get()?.value,
    ).toBe(beforeEvents);
    expect(
      db
        .select({ value: count() })
        .from(payments)
        .where(eq(payments.tenantId, owner.tenantId))
        .get()?.value,
    ).toBe(beforePayments);
  });

  it("hóa đơn VAT khớp tổng, unique và cập nhật trạng thái", () => {
    const invoiceId = createInvoiceForOrder(db, owner, {
      orderId: "order-demo-04",
      vatRate: 8,
      notes: "Test VAT",
    });
    const invoice = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
    if (!invoice) throw new Error("Không tạo được hóa đơn");
    expect(invoice.subtotal + invoice.vatAmount).toBe(invoice.total);
    expect(invoice.total).toBe(7_000_000);
    expect(invoice.invoiceNo).toMatch(/^HD-\d{6}-\d{4}$/);
    expect(() =>
      createInvoiceForOrder(db, owner, {
        orderId: "order-demo-04",
        vatRate: 8,
        notes: "",
      }),
    ).toThrow(/đã có hóa đơn/);
    updateInvoiceStatus(db, owner, invoiceId, "paid");
    expect(
      db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).get()?.status,
    ).toBe("paid");
  });

  it("hoàn tiền giảm paid/tăng công nợ và báo cáo thuế/doanh thu khớp", () => {
    const before = getOrderDetail(db, owner, "order-demo-01");
    if (!before) throw new Error("Thiếu order-demo-01");
    recordRefund(db, owner, {
      orderId: "order-demo-01",
      amount: 500_000,
      reason: "Test refund",
      method: "bank_transfer",
    });
    const after = getOrderDetail(db, owner, "order-demo-01");
    expect(after?.paid).toBe(before.paid - 500_000);
    expect(after?.remaining).toBe(before.remaining + 500_000);
    const refunds = db
      .select()
      .from(transactions)
      .where(and(eq(transactions.tenantId, owner.tenantId), eq(transactions.type, "refund")))
      .all();
    expect(refunds.some((row) => row.amount === 500_000)).toBe(true);

    const revenue = getRevenueReport(db, owner, {
      from: "2026-09-01",
      to: "2026-12-31",
    });
    expect(revenue.collected).toBe(24_000_000);
    expect(revenue.refunded).toBe(500_000);
    expect(revenue.expenses).toBe(15_500_000);
    expect(revenue.profit).toBe(8_000_000);

    const tax = getTaxReport(db, owner, { from: "2026-01-01", to: "2026-12-31" });
    expect(tax.invoiceCount).toBe(3);
    expect(tax.total).toBe(13_500_000 + 4_700_000 + 7_000_000);
    const csv = reportCsv(db, owner, "tax", { from: "2026-01-01", to: "2026-12-31" });
    expect(csv.content).toContain("invoice_no");
    expect(csv.content).toContain("HD-");

    const debts = listDebtors(db, owner);
    expect(debts.total).toBeGreaterThan(0);
  });

  it("tổng chi phí expenses khớp transaction expense", () => {
    const rows = db.select().from(expenses).where(eq(expenses.tenantId, owner.tenantId)).all();
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(15_500_000);
  });
});
