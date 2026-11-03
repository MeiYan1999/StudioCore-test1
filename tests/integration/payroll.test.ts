import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { commissions, payrolls, transactions } from "@/lib/db/schema";
import {
  approveCommission,
  generatePayrolls,
  listPayrolls,
  markCommissionPaid,
  saveCommissionRule,
  setPayrollStatus,
  updatePayroll,
} from "@/lib/services/commission-payroll-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let manager: ActorContext;
let accountant: ActorContext;

async function login(email: string, ip: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip, userAgent: "vitest-payroll" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

beforeAll(async () => {
  db = createTestDb();
  owner = await login("owner@studiocore.demo", "192.0.2.110");
  manager = await login("manager@studiocore.demo", "192.0.2.111");
  accountant = await login("ketoan@studiocore.demo", "192.0.2.112");
});

describe("commission và payroll", () => {
  it("phân quyền lương: manager bị chặn, kế toán xem được", () => {
    expect(() => listPayrolls(db, manager, "2026-10")).toThrow(/quyền/);
    expect(listPayrolls(db, accountant, "2026-10").length).toBeGreaterThan(0);
  });

  it("rule snapshot không làm đổi commission cũ", () => {
    const before = db
      .select()
      .from(commissions)
      .where(eq(commissions.id, "commission-demo-makeup-01"))
      .get();
    saveCommissionRule(db, owner, {
      id: "commission-rule-demo-makeup",
      name: "Makeup 250.000đ/buổi",
      role: "makeup",
      type: "fixed",
      value: 250_000,
      effectiveFrom: "2026-01-01T00:00",
      active: true,
    });
    const after = db
      .select()
      .from(commissions)
      .where(eq(commissions.id, "commission-demo-makeup-01"))
      .get();
    expect(after?.amount).toBe(before?.amount);
    expect(after?.ruleValue).toBe(200_000);
  });

  it("tạo payroll kỳ 11, cộng commission đã duyệt, sửa/thưởng/khóa kỳ", () => {
    const result = generatePayrolls(db, owner, "2026-11");
    expect(result.created).toBeGreaterThan(0);
    const rows = listPayrolls(db, owner, "2026-11");
    const makeup = rows.find((row) => row.staffId === "staff-sc-makeup");
    expect(makeup?.commissionAmount).toBe(200_000);
    expect(makeup?.baseSalary).toBe(9_000_000);
    expect(makeup?.net).toBe(9_200_000);
    if (!makeup) return;
    const linked = db
      .select()
      .from(commissions)
      .where(
        and(
          eq(commissions.staffId, "staff-sc-makeup"),
          eq(commissions.status, "approved"),
        ),
      )
      .get();
    expect(linked?.payrollId).toBe(makeup.id);

    updatePayroll(db, owner, makeup.id, { bonus: 100_000, deduction: 50_000 });
    const updated = listPayrolls(db, owner, "2026-11").find((row) => row.id === makeup.id);
    expect(updated?.net).toBe(9_250_000);

    setPayrollStatus(db, owner, makeup.id, "pending");
    setPayrollStatus(db, owner, makeup.id, "approved");
    expect(() =>
      updatePayroll(db, owner, makeup.id, { bonus: 1, deduction: 0 }),
    ).toThrow(/nháp/);
    setPayrollStatus(db, owner, makeup.id, "paid");
    const paid = db.select().from(payrolls).where(eq(payrolls.id, makeup.id)).get();
    expect(paid?.status).toBe("paid");
    expect(paid?.lockedAt).not.toBeNull();
    const salaryTx = db
      .select()
      .from(transactions)
      .where(eq(transactions.idempotencyKey, `payroll:${makeup.id}`))
      .get();
    expect(salaryTx?.amount).toBe(9_250_000);
    expect(salaryTx?.category).toBe("salary");
    expect(() => generatePayrolls(db, owner, "2026-11")).toThrow(/đã duyệt|khóa/);
  });

  it("duyệt và chi trả commission ngoài payroll sinh transaction", () => {
    approveCommission(db, owner, "commission-demo-retouch-01");
    markCommissionPaid(db, owner, "commission-demo-retouch-01");
    const row = db
      .select()
      .from(commissions)
      .where(eq(commissions.id, "commission-demo-retouch-01"))
      .get();
    expect(row?.status).toBe("paid");
    const tx = db
      .select()
      .from(transactions)
      .where(eq(transactions.idempotencyKey, "commission:commission-demo-retouch-01"))
      .get();
    expect(tx?.amount).toBe(405_000);
    expect(tx?.category).toBe("commission");
  });
});
