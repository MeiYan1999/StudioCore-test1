import { beforeAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { payments, transactions } from "@/lib/db/schema";
import { recordRefund } from "@/lib/services/finance-service";
import { getOrderDetail, recordOrderPayment } from "@/lib/services/order-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;

beforeAll(async () => {
  db = createTestDb();
  const result = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "10.9.0.1", userAgent: "vitest-idempotency" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không tạo được actor");
  owner = actor;
});

function countRows(table: typeof payments | typeof transactions, orderId: string): number {
  return (
    db
      .select({ value: count() })
      .from(table)
      .where(and(eq(table.tenantId, owner.tenantId), eq(table.orderId, orderId)))
      .get()?.value ?? 0
  );
}

describe("chống ghi trùng thu tiền và hoàn tiền", () => {
  it("gửi lại cùng mã yêu cầu chỉ ghi một khoản thu", () => {
    const orderId = "order-demo-04";
    const before = getOrderDetail(db, owner, orderId);
    if (!before) throw new Error("Thiếu order-demo-04");
    const input = {
      amount: 100_000,
      method: "cash",
      reference: "",
      paidAt: "",
      idempotencyKey: "req-payment-0001",
    };
    const paymentsBefore = countRows(payments, orderId);
    const transactionsBefore = countRows(transactions, orderId);

    const first = recordOrderPayment(db, owner, orderId, input);
    const second = recordOrderPayment(db, owner, orderId, input);

    expect(second).toBe(first);
    expect(countRows(payments, orderId)).toBe(paymentsBefore + 1);
    expect(countRows(transactions, orderId)).toBe(transactionsBefore + 1);
    const after = getOrderDetail(db, owner, orderId);
    expect(after?.paid).toBe(before.paid + 100_000);
    expect(after?.remaining).toBe(before.remaining - 100_000);

    recordOrderPayment(db, owner, orderId, { ...input, idempotencyKey: "req-payment-0002" });
    expect(getOrderDetail(db, owner, orderId)?.paid).toBe(before.paid + 200_000);
  });

  it("mã yêu cầu của đơn khác hoặc sai định dạng bị từ chối", () => {
    expect(() =>
      recordOrderPayment(db, owner, "order-demo-01", {
        amount: 1,
        method: "cash",
        reference: "",
        paidAt: "",
        idempotencyKey: "req-payment-0001",
      }),
    ).toThrow();
    expect(() =>
      recordOrderPayment(db, owner, "order-demo-04", {
        amount: 1,
        method: "cash",
        reference: "",
        paidAt: "",
        idempotencyKey: "x y",
      }),
    ).toThrow(/Mã yêu cầu/);
  });

  it("gửi lại cùng mã yêu cầu chỉ hoàn tiền một lần", () => {
    const orderId = "order-demo-01";
    const before = getOrderDetail(db, owner, orderId);
    if (!before) throw new Error("Thiếu order-demo-01");
    const input = {
      orderId,
      amount: 200_000,
      reason: "Hoàn thử",
      method: "bank_transfer" as const,
      idempotencyKey: "req-refund-0001",
    };
    const first = recordRefund(db, owner, input);
    const second = recordRefund(db, owner, input);
    expect(second).toBe(first);
    const after = getOrderDetail(db, owner, orderId);
    expect(after?.paid).toBe(before.paid - 200_000);
    expect(after?.remaining).toBe(before.remaining + 200_000);
  });
});
