import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import {
  createInvoiceForOrder,
  listInvoices,
  processPaymentWebhook,
  recordRefund,
  updateInvoiceStatus,
} from "@/lib/services/finance-service";
import { recordOrderPayment } from "@/lib/services/order-service";
import { createTestDb } from "../helpers/test-db";

const ORDER_ID = "order-demo-04"; // tổng 7.000.000đ, chưa thu

let db: AppDb;
let owner: ActorContext;
let invoiceId: string;

function invoiceStatus(): string | undefined {
  return db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, invoiceId)).get()
    ?.status;
}

function paidAmount(): number | undefined {
  return listInvoices(db, owner, {}).find((row) => row.id === invoiceId)?.paidAmount;
}

function pay(amount: number): void {
  recordOrderPayment(db, owner, ORDER_ID, {
    amount,
    method: "cash",
    reference: "",
    paidAt: "2026-11-20T10:00",
  });
}

beforeAll(async () => {
  db = createTestDb();
  const result = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.110", userAgent: "vitest-invoice" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  owner = actor;
});

describe("trạng thái hóa đơn suy ra từ khoản thu của đơn", () => {
  it("hóa đơn của đơn chưa thu ở trạng thái đã phát hành, đã thu 0", () => {
    invoiceId = createInvoiceForOrder(db, owner, { orderId: ORDER_ID, vatRate: 8, notes: "" });
    expect(invoiceStatus()).toBe("issued");
    expect(paidAmount()).toBe(0);
    expect(() => updateInvoiceStatus(db, owner, invoiceId, "paid")).toThrow(/còn nợ 7\.000\.000/);
  });

  it("thu một phần: hóa đơn vẫn đã phát hành, hiện số đã thu", () => {
    pay(3_000_000);
    expect(invoiceStatus()).toBe("issued");
    expect(paidAmount()).toBe(3_000_000);
  });

  it("webhook thu nốt phần còn lại: hóa đơn tự chuyển đã thanh toán", () => {
    const result = processPaymentWebhook(
      db,
      {
        provider: "mock",
        eventId: "invoice-allocation-001",
        eventType: "payment.succeeded",
        orderId: ORDER_ID,
        amount: 4_000_000,
      },
      JSON.stringify({ id: "invoice-allocation-001" }),
    );
    expect(result.status).toBe("processed");
    expect(invoiceStatus()).toBe("paid");
    expect(paidAmount()).toBe(7_000_000);
  });

  it("hoàn tiền làm đơn thiếu tiền: hóa đơn trở lại đã phát hành", () => {
    recordRefund(db, owner, { orderId: ORDER_ID, amount: 1_000_000, reason: "Test", method: "cash" });
    expect(invoiceStatus()).toBe("issued");
    expect(paidAmount()).toBe(6_000_000);
  });

  it("thu tay phần còn thiếu: hóa đơn lại đã thanh toán", () => {
    pay(1_000_000);
    expect(invoiceStatus()).toBe("paid");
  });

  it("hóa đơn đã hủy không bị khoản thu làm thay đổi; hóa đơn mới của đơn đã thu đủ là đã thanh toán", () => {
    db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, invoiceId)).run();
    recordRefund(db, owner, { orderId: ORDER_ID, amount: 500_000, reason: "Test", method: "cash" });
    pay(500_000);
    expect(invoiceStatus()).toBe("cancelled");
    expect(paidAmount()).toBe(0);
    const reissued = createInvoiceForOrder(db, owner, { orderId: ORDER_ID, vatRate: 8, notes: "" });
    expect(
      db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, reissued)).get()?.status,
    ).toBe("paid");
  });
});
