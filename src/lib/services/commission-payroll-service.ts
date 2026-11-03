import crypto from "node:crypto";
import { and, count, desc, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  attendance,
  branches,
  commissionRules,
  commissions,
  orders,
  payrolls,
  staff,
  staffBranches,
  transactions,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";

export type CommissionRuleView = {
  id: string;
  name: string;
  role: string;
  type: string;
  value: number;
  effectiveFrom: Date;
  active: boolean;
};

export type CommissionView = {
  id: string;
  orderId: string;
  orderCode: string;
  staffId: string;
  staffName: string;
  role: string;
  ruleType: string;
  ruleValue: number;
  baseAmount: number;
  amount: number;
  status: string;
  approvedAt: Date | null;
  paidAt: Date | null;
  payrollId: string | null;
  createdAt: Date;
};

export function listCommissionRules(
  db: AppDb,
  actor: ActorContext,
): CommissionRuleView[] {
  assertPermission(actor, "finance.view");
  return db
    .select({
      id: commissionRules.id,
      name: commissionRules.name,
      role: commissionRules.role,
      type: commissionRules.type,
      value: commissionRules.value,
      effectiveFrom: commissionRules.effectiveFrom,
      active: commissionRules.active,
    })
    .from(commissionRules)
    .where(eq(commissionRules.tenantId, actor.tenantId))
    .orderBy(desc(commissionRules.effectiveFrom))
    .all();
}

export function saveCommissionRule(
  db: AppDb,
  actor: ActorContext,
  input: {
    id?: string;
    name: string;
    role: string;
    type: "fixed" | "percent";
    value: number;
    effectiveFrom: string;
    active: boolean;
  },
): string {
  assertPermission(actor, "finance.manage");
  if (!input.name.trim()) throw new ValidationError("Tên rule là bắt buộc.");
  if (!["photographer", "makeup", "retoucher", "sale"].includes(input.role)) {
    throw new ValidationError("Vai trò commission không hợp lệ.");
  }
  if (!["fixed", "percent"].includes(input.type)) {
    throw new ValidationError("Loại commission không hợp lệ.");
  }
  if (!Number.isInteger(input.value) || input.value <= 0) {
    throw new ValidationError("Giá trị commission phải là số nguyên dương.");
  }
  if (input.type === "percent" && input.value > 100) {
    throw new ValidationError("Phần trăm commission không được vượt 100.");
  }
  const effectiveFrom = parseVietnamDateTimeLocal(input.effectiveFrom);
  if (!effectiveFrom) throw new ValidationError("Ngày hiệu lực không hợp lệ.");

  if (input.id) {
    const existing = db
      .select()
      .from(commissionRules)
      .where(
        and(
          eq(commissionRules.id, input.id),
          eq(commissionRules.tenantId, actor.tenantId),
        ),
      )
      .get();
    if (!existing) throw new NotFoundError("Không tìm thấy rule.");
    db.update(commissionRules)
      .set({
        name: input.name.trim(),
        role: input.role,
        type: input.type,
        value: input.value,
        effectiveFrom,
        active: input.active,
        updatedAt: new Date(),
      })
      .where(eq(commissionRules.id, input.id))
      .run();
    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "finance.commission_rule.update",
      entity: "commission_rule",
      entityId: input.id,
    });
    return input.id;
  }
  const id = crypto.randomUUID();
  db.insert(commissionRules)
    .values({
      id,
      tenantId: actor.tenantId,
      name: input.name.trim(),
      role: input.role,
      type: input.type,
      value: input.value,
      effectiveFrom,
      active: input.active,
      createdBy: actor.staffId,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.commission_rule.create",
    entity: "commission_rule",
    entityId: id,
  });
  return id;
}

function latestRuleForRole(
  db: AppDb,
  tenantId: string,
  role: string,
  at: Date,
) {
  return db
    .select()
    .from(commissionRules)
    .where(
      and(
        eq(commissionRules.tenantId, tenantId),
        eq(commissionRules.role, role),
        eq(commissionRules.active, true),
        lte(commissionRules.effectiveFrom, at),
      ),
    )
    .orderBy(desc(commissionRules.effectiveFrom))
    .get();
}

export function accrueCommissionsForOrderSystem(
  db: AppDb,
  orderId: string,
  at: Date = new Date(),
): number {
  const order = db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .get();
  if (!order) return 0;
  const assignments = [
    { staffId: order.photographerId, role: "photographer" },
    { staffId: order.makeupId, role: "makeup" },
    { staffId: order.editorId, role: "retoucher" },
  ].filter(
    (item): item is { staffId: string; role: string } => Boolean(item.staffId),
  );
  let created = 0;
  for (const assignment of assignments) {
    const existing = db
      .select({ id: commissions.id })
      .from(commissions)
      .where(
        and(
          eq(commissions.tenantId, order.tenantId),
          eq(commissions.orderId, order.id),
          eq(commissions.staffId, assignment.staffId),
          eq(commissions.role, assignment.role),
        ),
      )
      .get();
    if (existing) continue;
    const rule = latestRuleForRole(db, order.tenantId, assignment.role, at);
    if (!rule) continue;
    const amount =
      rule.type === "fixed"
        ? rule.value
        : Math.round((order.total * rule.value) / 100);
    db.insert(commissions)
      .values({
        id: crypto.randomUUID(),
        tenantId: order.tenantId,
        orderId: order.id,
        staffId: assignment.staffId,
        ruleId: rule.id,
        role: assignment.role,
        ruleType: rule.type,
        ruleValue: rule.value,
        baseAmount: order.total,
        amount,
        status: "pending",
        note: `Tính tự động từ rule "${rule.name}".`,
      })
      .run();
    created += 1;
  }
  return created;
}

export function accrueCommissionsForOrder(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
): number {
  assertPermission(actor, "finance.manage");
  const order = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.tenantId)))
    .get();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng.");
  assertBranchAccess(actor, order.branchId);
  if (order.status !== "completed") {
    throw new ValidationError("Chỉ tính hoa hồng cho đơn đã hoàn tất.");
  }
  const created = accrueCommissionsForOrderSystem(db, orderId, new Date());
  if (created > 0) {
    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "finance.commission.accrue",
      entity: "order",
      entityId: orderId,
      metadata: { created },
    });
  }
  return created;
}

export function listCommissions(
  db: AppDb,
  actor: ActorContext,
  filters: { status?: string; staffId?: string; period?: string } = {},
): CommissionView[] {
  assertPermission(actor, "finance.view");
  const conditions = [eq(commissions.tenantId, actor.tenantId)];
  if (filters.status) conditions.push(eq(commissions.status, filters.status));
  if (filters.staffId) conditions.push(eq(commissions.staffId, filters.staffId));
  if (filters.period && /^\d{4}-\d{2}$/.test(filters.period)) {
    const start = new Date(`${filters.period}-01T00:00:00+07:00`);
    const end = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    conditions.push(
      gte(commissions.createdAt, start),
      lte(commissions.createdAt, end),
    );
  }
  return db
    .select({
      id: commissions.id,
      orderId: commissions.orderId,
      orderCode: orders.code,
      staffId: commissions.staffId,
      staffName: staff.name,
      role: commissions.role,
      ruleType: commissions.ruleType,
      ruleValue: commissions.ruleValue,
      baseAmount: commissions.baseAmount,
      amount: commissions.amount,
      status: commissions.status,
      approvedAt: commissions.approvedAt,
      paidAt: commissions.paidAt,
      payrollId: commissions.payrollId,
      createdAt: commissions.createdAt,
    })
    .from(commissions)
    .innerJoin(orders, eq(commissions.orderId, orders.id))
    .innerJoin(staff, eq(commissions.staffId, staff.id))
    .where(and(...conditions))
    .orderBy(desc(commissions.createdAt))
    .limit(200)
    .all();
}

export function approveCommission(
  db: AppDb,
  actor: ActorContext,
  commissionId: string,
): void {
  assertPermission(actor, "finance.manage");
  const row = db
    .select()
    .from(commissions)
    .where(
      and(
        eq(commissions.id, commissionId),
        eq(commissions.tenantId, actor.tenantId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy hoa hồng.");
  if (row.status !== "pending") {
    throw new ValidationError("Chỉ duyệt hoa hồng đang chờ.");
  }
  db.update(commissions)
    .set({
      status: "approved",
      approvedBy: actor.staffId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(commissions.id, commissionId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.commission.approve",
    entity: "commission",
    entityId: commissionId,
    metadata: { amount: row.amount },
  });
}

export function markCommissionPaid(
  db: AppDb,
  actor: ActorContext,
  commissionId: string,
): void {
  assertPermission(actor, "finance.manage");
  const row = db
    .select({ commission: commissions, order: orders })
    .from(commissions)
    .innerJoin(orders, eq(commissions.orderId, orders.id))
    .where(
      and(
        eq(commissions.id, commissionId),
        eq(commissions.tenantId, actor.tenantId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy hoa hồng.");
  if (row.commission.status !== "approved") {
    throw new ValidationError("Chỉ chi trả hoa hồng đã duyệt.");
  }
  const now = new Date();
  db.transaction((tx) => {
    tx.update(commissions)
      .set({ status: "paid", paidAt: now, updatedAt: now })
      .where(eq(commissions.id, commissionId))
      .run();
    if (!row.commission.payrollId) {
      tx.insert(transactions)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          branchId: row.order.branchId,
          type: "expense",
          category: "commission",
          amount: row.commission.amount,
          staffId: row.commission.staffId,
          method: "bank_transfer",
          description: `Chi hoa hồng ${row.commission.role} đơn ${row.order.code}`,
          idempotencyKey: `commission:${commissionId}`,
          occurredAt: now,
          createdBy: actor.staffId,
        })
        .run();
    }
  });
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.commission.pay",
    entity: "commission",
    entityId: commissionId,
    metadata: { amount: row.commission.amount },
  });
}

export type PayrollView = {
  id: string;
  period: string;
  staffId: string;
  staffName: string;
  staffCode: string;
  role: string;
  baseSalary: number;
  workDays: number;
  commissionAmount: number;
  bonus: number;
  deduction: number;
  net: number;
  status: string;
  approvedAt: Date | null;
  paidAt: Date | null;
  lockedAt: Date | null;
};

export function listPayrolls(
  db: AppDb,
  actor: ActorContext,
  period: string,
): PayrollView[] {
  assertPermission(actor, "payroll.view");
  return db
    .select({
      id: payrolls.id,
      period: payrolls.period,
      staffId: payrolls.staffId,
      staffName: staff.name,
      staffCode: staff.code,
      role: staff.role,
      baseSalary: payrolls.baseSalary,
      workDays: payrolls.workDays,
      commissionAmount: payrolls.commissionAmount,
      bonus: payrolls.bonus,
      deduction: payrolls.deduction,
      net: payrolls.net,
      status: payrolls.status,
      approvedAt: payrolls.approvedAt,
      paidAt: payrolls.paidAt,
      lockedAt: payrolls.lockedAt,
    })
    .from(payrolls)
    .innerJoin(staff, eq(payrolls.staffId, staff.id))
    .where(
      and(eq(payrolls.tenantId, actor.tenantId), eq(payrolls.period, period)),
    )
    .orderBy(staff.name)
    .all();
}

function payrollPeriodRange(period: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new ValidationError("Kỳ lương phải có dạng YYYY-MM.");
  }
  const start = new Date(`${period}-01T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) {
    throw new ValidationError("Kỳ lương không hợp lệ.");
  }
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function generatePayrolls(
  db: AppDb,
  actor: ActorContext,
  period: string,
): { created: number; skipped: number } {
  assertPermission(actor, "payroll.manage");
  const range = payrollPeriodRange(period);
  const locked = db
    .select({ value: count() })
    .from(payrolls)
    .where(
      and(
        eq(payrolls.tenantId, actor.tenantId),
        eq(payrolls.period, period),
        or(eq(payrolls.status, "approved"), eq(payrolls.status, "paid")) ?? sql`1=0`,
      ),
    )
    .get()?.value ?? 0;
  if (locked > 0) {
    throw new ValidationError("Kỳ lương đã duyệt/khóa, không thể tạo lại.");
  }
  const staffRows = db
    .select()
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        isNull(staff.archivedAt),
        ne(staff.role, "platform_admin"),
      ),
    )
    .all();
  const existing = new Set(
    db
      .select({ staffId: payrolls.staffId })
      .from(payrolls)
      .where(
        and(eq(payrolls.tenantId, actor.tenantId), eq(payrolls.period, period)),
      )
      .all()
      .map((row) => row.staffId),
  );
  let created = 0;
  let skipped = 0;
  for (const staffRow of staffRows) {
    if (existing.has(staffRow.id)) {
      skipped += 1;
      continue;
    }
    const attendanceRows = db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, actor.tenantId),
          eq(attendance.staffId, staffRow.id),
          gte(attendance.checkInAt, range.start),
          lte(attendance.checkInAt, range.end),
        ),
      )
      .all();
    const workDays = new Set(
      attendanceRows.map((row) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Ho_Chi_Minh",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(row.checkInAt),
      ),
    ).size;
    const commissionRows = db
      .select()
      .from(commissions)
      .where(
        and(
          eq(commissions.tenantId, actor.tenantId),
          eq(commissions.staffId, staffRow.id),
          eq(commissions.status, "approved"),
          isNull(commissions.payrollId),
          gte(commissions.createdAt, range.start),
          lte(commissions.createdAt, range.end),
        ),
      )
      .all();
    const commissionAmount = commissionRows.reduce(
      (sum, row) => sum + row.amount,
      0,
    );
    const payrollId = crypto.randomUUID();
    db.transaction((tx) => {
      tx.insert(payrolls)
        .values({
          id: payrollId,
          tenantId: actor.tenantId,
          period,
          staffId: staffRow.id,
          baseSalary: staffRow.baseSalary,
          workDays,
          commissionAmount,
          bonus: 0,
          deduction: 0,
          net: staffRow.baseSalary + commissionAmount,
          status: "draft",
          createdBy: actor.staffId,
        })
        .run();
      for (const commission of commissionRows) {
        tx.update(commissions)
          .set({ payrollId, updatedAt: new Date() })
          .where(eq(commissions.id, commission.id))
          .run();
      }
    });
    created += 1;
  }
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.payroll.generate",
    entity: "payroll",
    entityId: period,
    metadata: { created, skipped },
  });
  return { created, skipped };
}

export function updatePayroll(
  db: AppDb,
  actor: ActorContext,
  payrollId: string,
  input: { bonus: number; deduction: number },
): void {
  assertPermission(actor, "payroll.manage");
  const row = db
    .select()
    .from(payrolls)
    .where(and(eq(payrolls.id, payrollId), eq(payrolls.tenantId, actor.tenantId)))
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy bảng lương.");
  if (row.status !== "draft") {
    throw new ValidationError("Chỉ sửa bảng lương ở trạng thái nháp.");
  }
  if (
    !Number.isInteger(input.bonus) ||
    input.bonus < 0 ||
    !Number.isInteger(input.deduction) ||
    input.deduction < 0
  ) {
    throw new ValidationError("Thưởng/khấu trừ không hợp lệ.");
  }
  const net = row.baseSalary + row.commissionAmount + input.bonus - input.deduction;
  db.update(payrolls)
    .set({
      bonus: input.bonus,
      deduction: input.deduction,
      net,
      updatedAt: new Date(),
    })
    .where(eq(payrolls.id, payrollId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.payroll.update",
    entity: "payroll",
    entityId: payrollId,
    metadata: { bonus: input.bonus, deduction: input.deduction, net },
  });
}

export function setPayrollStatus(
  db: AppDb,
  actor: ActorContext,
  payrollId: string,
  status: "pending" | "approved" | "paid",
): void {
  assertPermission(actor, "payroll.manage");
  const row = db
    .select()
    .from(payrolls)
    .where(and(eq(payrolls.id, payrollId), eq(payrolls.tenantId, actor.tenantId)))
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy bảng lương.");
  const allowed: Record<string, string[]> = {
    draft: ["pending"],
    pending: ["approved"],
    approved: ["paid"],
    paid: [],
  };
  if (!(allowed[row.status] ?? []).includes(status)) {
    throw new ValidationError("Không thể chuyển trạng thái bảng lương.");
  }
  const now = new Date();
  db.transaction((tx) => {
    tx.update(payrolls)
      .set({
        status,
        approvedBy: status === "approved" || status === "paid" ? actor.staffId : row.approvedBy,
        approvedAt:
          status === "approved" || status === "paid" ? row.approvedAt ?? now : row.approvedAt,
        paidAt: status === "paid" ? now : row.paidAt,
        lockedAt: status === "paid" ? now : row.lockedAt,
        updatedAt: now,
      })
      .where(eq(payrolls.id, payrollId))
      .run();
    if (status === "paid") {
      tx.update(commissions)
        .set({ status: "paid", paidAt: now, updatedAt: now })
        .where(
          and(
            eq(commissions.tenantId, actor.tenantId),
            eq(commissions.payrollId, payrollId),
          ),
        )
        .run();
      const branchRow = tx
        .select({ branchId: orders.branchId })
        .from(orders)
        .innerJoin(commissions, eq(commissions.orderId, orders.id))
        .where(
          and(
            eq(commissions.payrollId, payrollId),
            eq(commissions.tenantId, actor.tenantId),
          ),
        )
        .get();
      const fallbackBranch = tx
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.tenantId, actor.tenantId))
        .get();
      const branchId = branchRow?.branchId ?? fallbackBranch?.id;
      if (branchId) {
        tx.insert(transactions)
          .values({
            id: crypto.randomUUID(),
            tenantId: actor.tenantId,
            branchId,
            type: "expense",
            category: "salary",
            amount: row.net,
            staffId: row.staffId,
            method: "bank_transfer",
            description: `Chi lương kỳ ${row.period}`,
            idempotencyKey: `payroll:${payrollId}`,
            occurredAt: now,
            createdBy: actor.staffId,
          })
          .run();
      }
    }
  });
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.payroll.status",
    entity: "payroll",
    entityId: payrollId,
    metadata: { from: row.status, to: status },
  });
}

export type HrStaffView = {
  id: string;
  code: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  baseSalary: number;
  active: boolean;
  branches: string[];
};

export function listHrStaff(db: AppDb, actor: ActorContext): HrStaffView[] {
  assertPermission(actor, "staff.view");
  const staffRows = db
    .select({
      id: staff.id,
      code: staff.code,
      name: staff.name,
      role: staff.role,
      email: staff.email,
      phone: staff.phone,
      baseSalary: staff.baseSalary,
      active: staff.active,
    })
    .from(staff)
    .where(and(eq(staff.tenantId, actor.tenantId), ne(staff.role, "platform_admin")))
    .orderBy(staff.name)
    .all();
  const branchRows = db
    .select({ staffId: staffBranches.staffId, name: branches.name })
    .from(staffBranches)
    .innerJoin(branches, eq(staffBranches.branchId, branches.id))
    .where(eq(staffBranches.tenantId, actor.tenantId))
    .all();
  const branchMap = new Map<string, string[]>();
  for (const row of branchRows) {
    const list = branchMap.get(row.staffId) ?? [];
    list.push(row.name);
    branchMap.set(row.staffId, list);
  }
  return staffRows.map((row) => ({
    ...row,
    branches: branchMap.get(row.id) ?? [],
  }));
}
