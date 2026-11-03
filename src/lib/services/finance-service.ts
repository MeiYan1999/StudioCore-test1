import crypto from "node:crypto";
import { and, asc, count, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  branches,
  budgets,
  customerInteractions,
  customers,
  expenses,
  invoices,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  paymentWebhookEvents,
  staff,
  transactions,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";
import { getTodayKey, getVietnamMonthRange } from "../scheduling/time";
import { getTenantSettings } from "./settings-service";
import { createNotification } from "./notification-service";
import {
  INVOICE_VAT_RATES,
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  type InvoiceStatus,
  type PaymentMethod,
  type TransactionType,
} from "../finance/constants";
import { buildVietQrPayload, sanitizeTransferContent } from "../finance/vietqr";

export type FinanceFilters = {
  q?: string;
  type?: string;
  branchId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type TransactionView = {
  id: string;
  type: string;
  category: string;
  amount: number;
  method: string;
  branchName: string;
  orderCode: string | null;
  customerName: string | null;
  description: string | null;
  reference: string | null;
  occurredAt: Date;
  createdByName: string | null;
};

export type ExpenseView = {
  id: string;
  category: string;
  amount: number;
  vendor: string | null;
  description: string | null;
  occurredAt: Date;
  branchName: string;
};

export type InvoiceView = {
  id: string;
  invoiceNo: string;
  orderId: string;
  orderCode: string;
  customerName: string | null;
  branchName: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: string;
  issuedAt: Date | null;
  createdAt: Date;
};

export type DebtRow = {
  orderId: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  branchId: string;
  branchName: string;
  total: number;
  paid: number;
  remaining: number;
  ageDays: number;
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  scheduledAt: Date | null;
};

export type FinanceSummary = {
  income: number;
  expense: number;
  refund: number;
  net: number;
  orderPayments: number;
  transactionCount: number;
};

function dateRange(from?: string, to?: string): { start: Date; end: Date } {
  const currentMonth = getVietnamMonthRange(getTodayKey().slice(0, 7));
  const start = from
    ? new Date(`${from}T00:00:00+07:00`)
    : currentMonth.start;
  const end = to
    ? new Date(`${to}T23:59:59.999+07:00`)
    : currentMonth.end;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new ValidationError("Khoảng ngày không hợp lệ.");
  }
  return { start, end };
}

function scopedConditions(
  actor: ActorContext,
  branchId?: string,
): { conditions: SQL[]; none: boolean } {
  const scope = getBranchScope(actor);
  const conditions: SQL[] = [eq(transactions.tenantId, actor.tenantId)];
  if (scope.mode === "none") {
    return { conditions, none: true };
  }
  if (scope.mode === "branch") {
    conditions.push(eq(transactions.branchId, scope.branchId));
  } else if (branchId) {
    conditions.push(eq(transactions.branchId, branchId));
  }
  return { conditions, none: false };
}

export function listTransactions(
  db: AppDb,
  actor: ActorContext,
  filters: FinanceFilters,
): { items: TransactionView[]; total: number; page: number; pageSize: number } {
  assertPermission(actor, "finance.view");
  const scoped = scopedConditions(actor, filters.branchId);
  if (scoped.none) {
    return { items: [], total: 0, page: filters.page, pageSize: filters.pageSize };
  }
  const conditions = [...scoped.conditions];
  if (filters.type && (TRANSACTION_TYPES as readonly string[]).includes(filters.type)) {
    conditions.push(eq(transactions.type, filters.type));
  }
  if (filters.from || filters.to) {
    const range = dateRange(filters.from, filters.to);
    conditions.push(
      gte(transactions.occurredAt, range.start),
      lte(transactions.occurredAt, range.end),
    );
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().toLowerCase()}%`;
    const search = or(
      sql`lower(coalesce(${transactions.description}, '')) like ${term}`,
      sql`lower(coalesce(${transactions.reference}, '')) like ${term}`,
      sql`lower(coalesce(${orders.code}, '')) like ${term}`,
      sql`lower(coalesce(${customers.name}, '')) like ${term}`,
    );
    if (search) conditions.push(search);
  }
  const where = and(...conditions);
  const total =
    db
      .select({ value: count() })
      .from(transactions)
      .leftJoin(orders, eq(transactions.orderId, orders.id))
      .leftJoin(customers, eq(transactions.customerId, customers.id))
      .where(where)
      .get()?.value ?? 0;

  const items = db
    .select({
      id: transactions.id,
      type: transactions.type,
      category: transactions.category,
      amount: transactions.amount,
      method: transactions.method,
      branchName: branches.name,
      orderCode: orders.code,
      customerName: customers.name,
      description: transactions.description,
      reference: transactions.reference,
      occurredAt: transactions.occurredAt,
      createdByName: staff.name,
    })
    .from(transactions)
    .innerJoin(branches, eq(transactions.branchId, branches.id))
    .leftJoin(orders, eq(transactions.orderId, orders.id))
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .leftJoin(staff, eq(transactions.createdBy, staff.id))
    .where(where)
    .orderBy(desc(transactions.occurredAt), desc(transactions.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .all();

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export function getFinanceSummary(
  db: AppDb,
  actor: ActorContext,
  filters: { branchId?: string; from?: string; to?: string },
): FinanceSummary {
  assertPermission(actor, "finance.view");
  const scoped = scopedConditions(actor, filters.branchId);
  if (scoped.none) {
    return { income: 0, expense: 0, refund: 0, net: 0, orderPayments: 0, transactionCount: 0 };
  }
  const range = dateRange(filters.from, filters.to);
  const rows = db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        ...scoped.conditions,
        gte(transactions.occurredAt, range.start),
        lte(transactions.occurredAt, range.end),
      ),
    )
    .all();
  let income = 0;
  let expense = 0;
  let refund = 0;
  let orderPayments = 0;
  for (const row of rows) {
    if (row.type === "income") income += row.amount;
    if (row.type === "expense") expense += row.amount;
    if (row.type === "refund") refund += row.amount;
    if (row.category === "order_payment" || row.category === "deposit") {
      orderPayments += row.amount;
    }
  }
  return {
    income,
    expense,
    refund,
    net: income - refund - expense,
    orderPayments,
    transactionCount: rows.length,
  };
}

export type ManualTransactionInput = {
  type: TransactionType;
  branchId: string;
  category: string;
  amount: number;
  method: PaymentMethod;
  description: string;
  reference: string;
  occurredAt: string;
  orderId: string;
  customerId: string;
};

export function createManualTransaction(
  db: AppDb,
  actor: ActorContext,
  input: ManualTransactionInput,
): string {
  assertPermission(actor, "finance.manage");
  assertBranchAccess(actor, input.branchId);
  if (!TRANSACTION_TYPES.includes(input.type)) {
    throw new ValidationError("Loại giao dịch không hợp lệ.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Số tiền giao dịch phải là số nguyên dương.");
  }
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new ValidationError("Phương thức thanh toán không hợp lệ.");
  }
  const occurredAt = input.occurredAt
    ? parseVietnamDateTimeLocal(input.occurredAt)
    : new Date();
  if (!occurredAt) {
    throw new ValidationError("Thời điểm giao dịch không hợp lệ.");
  }
  if (input.orderId) {
    const order = db
      .select({ id: orders.id, branchId: orders.branchId })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)))
      .get();
    if (!order || order.branchId !== input.branchId) {
      throw new ValidationError("Đơn hàng không thuộc chi nhánh đã chọn.");
    }
  }
  const id = crypto.randomUUID();
  db.insert(transactions)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      type: input.type,
      category: input.category || "other",
      amount: input.amount,
      orderId: input.orderId || null,
      customerId: input.customerId || null,
      staffId: actor.staffId,
      method: input.method,
      description: input.description.trim() || null,
      reference: input.reference.trim() || null,
      idempotencyKey: null,
      occurredAt,
      createdBy: actor.staffId,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.transaction.create",
    entity: "transaction",
    entityId: id,
    metadata: { type: input.type, amount: input.amount, method: input.method },
  });
  return id;
}

export function listExpenses(
  db: AppDb,
  actor: ActorContext,
  filters: { branchId?: string; from?: string; to?: string },
): ExpenseView[] {
  assertPermission(actor, "finance.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(expenses.tenantId, actor.tenantId)];
  if (scope.mode === "branch") conditions.push(eq(expenses.branchId, scope.branchId));
  else if (filters.branchId) conditions.push(eq(expenses.branchId, filters.branchId));
  if (filters.from || filters.to) {
    const range = dateRange(filters.from, filters.to);
    conditions.push(gte(expenses.occurredAt, range.start), lte(expenses.occurredAt, range.end));
  }
  return db
    .select({
      id: expenses.id,
      category: expenses.category,
      amount: expenses.amount,
      vendor: expenses.vendor,
      description: expenses.description,
      occurredAt: expenses.occurredAt,
      branchName: branches.name,
    })
    .from(expenses)
    .innerJoin(branches, eq(expenses.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.occurredAt))
    .limit(100)
    .all();
}

export function createExpense(
  db: AppDb,
  actor: ActorContext,
  input: {
    branchId: string;
    category: string;
    amount: number;
    vendor: string;
    description: string;
    occurredAt: string;
    method: PaymentMethod;
  },
): string {
  assertPermission(actor, "finance.manage");
  assertBranchAccess(actor, input.branchId);
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Số tiền chi phải là số nguyên dương.");
  }
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new ValidationError("Phương thức chi không hợp lệ.");
  }
  const occurredAt = input.occurredAt
    ? parseVietnamDateTimeLocal(input.occurredAt)
    : new Date();
  if (!occurredAt) throw new ValidationError("Ngày chi không hợp lệ.");
  const transactionId = crypto.randomUUID();
  const expenseId = crypto.randomUUID();
  db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: transactionId,
        tenantId: actor.tenantId,
        branchId: input.branchId,
        type: "expense",
        category: input.category || "other",
        amount: input.amount,
        method: input.method,
        description: input.description.trim() || null,
        occurredAt,
        createdBy: actor.staffId,
      })
      .run();
    tx.insert(expenses)
      .values({
        id: expenseId,
        tenantId: actor.tenantId,
        branchId: input.branchId,
        category: input.category || "other",
        amount: input.amount,
        vendor: input.vendor.trim() || null,
        description: input.description.trim() || null,
        occurredAt,
        transactionId,
        createdBy: actor.staffId,
      })
      .run();
  });
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.expense.create",
    entity: "expense",
    entityId: expenseId,
    metadata: { amount: input.amount, category: input.category },
  });
  return expenseId;
}

export function listBudgets(
  db: AppDb,
  actor: ActorContext,
  period: string,
): {
  id: string;
  category: string;
  amount: number;
  spent: number;
  branchName: string | null;
  period: string;
}[] {
  assertPermission(actor, "finance.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(budgets.tenantId, actor.tenantId), eq(budgets.period, period)];
  if (scope.mode === "branch") {
    conditions.push(
      or(eq(budgets.branchId, scope.branchId), sql`${budgets.branchId} is null`) ?? sql`1=0`,
    );
  }
  const rows = db
    .select({
      id: budgets.id,
      category: budgets.category,
      amount: budgets.amount,
      branchId: budgets.branchId,
      branchName: branches.name,
      period: budgets.period,
    })
    .from(budgets)
    .leftJoin(branches, eq(budgets.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(asc(budgets.category))
    .all();
  const { start: rangeStart, end: rangeEnd } = getVietnamMonthRange(period);
  return rows.map((row) => {
    const spentConditions: SQL[] = [
      eq(transactions.tenantId, actor.tenantId),
      eq(transactions.type, "expense"),
      eq(transactions.category, row.category),
      gte(transactions.occurredAt, rangeStart),
      lte(transactions.occurredAt, rangeEnd),
    ];
    if (row.branchId) spentConditions.push(eq(transactions.branchId, row.branchId));
    const spent =
      db
        .select({ total: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
        .from(transactions)
        .where(and(...spentConditions))
        .get()?.total ?? 0;
    return {
      id: row.id,
      category: row.category,
      amount: row.amount,
      spent: Number(spent),
      branchName: row.branchName,
      period: row.period,
    };
  });
}

export function saveBudget(
  db: AppDb,
  actor: ActorContext,
  input: { branchId: string; category: string; period: string; amount: number; notes: string },
): string {
  assertPermission(actor, "finance.manage");
  if (input.branchId) assertBranchAccess(actor, input.branchId);
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new ValidationError("Ngân sách không hợp lệ.");
  }
  if (!/^\d{4}-\d{2}$/.test(input.period)) {
    throw new ValidationError("Kỳ ngân sách phải có dạng YYYY-MM.");
  }
  const existing = db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.tenantId, actor.tenantId),
        eq(budgets.period, input.period),
        eq(budgets.category, input.category),
        input.branchId ? eq(budgets.branchId, input.branchId) : sql`${budgets.branchId} is null`,
      ),
    )
    .get();
  if (existing) {
    db.update(budgets)
      .set({ amount: input.amount, notes: input.notes.trim() || null, updatedAt: new Date() })
      .where(eq(budgets.id, existing.id))
      .run();
    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "finance.budget.update",
      entity: "budget",
      entityId: existing.id,
      metadata: { amount: input.amount },
    });
    return existing.id;
  }
  const id = crypto.randomUUID();
  db.insert(budgets)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId || null,
      category: input.category,
      period: input.period,
      amount: input.amount,
      notes: input.notes.trim() || null,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.budget.create",
    entity: "budget",
    entityId: id,
    metadata: { amount: input.amount },
  });
  return id;
}

export function listInvoices(
  db: AppDb,
  actor: ActorContext,
  filters: { q?: string; status?: string; branchId?: string },
): InvoiceView[] {
  assertPermission(actor, "finance.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(invoices.tenantId, actor.tenantId)];
  if (scope.mode === "branch") conditions.push(eq(invoices.branchId, scope.branchId));
  else if (filters.branchId) conditions.push(eq(invoices.branchId, filters.branchId));
  if (filters.status) conditions.push(eq(invoices.status, filters.status));
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().toLowerCase()}%`;
    const search = or(
      sql`lower(${invoices.invoiceNo}) like ${term}`,
      sql`lower(${orders.code}) like ${term}`,
      sql`lower(coalesce(${customers.name}, '')) like ${term}`,
    );
    if (search) conditions.push(search);
  }
  return db
    .select({
      id: invoices.id,
      invoiceNo: invoices.invoiceNo,
      orderId: invoices.orderId,
      orderCode: orders.code,
      customerName: customers.name,
      branchName: branches.name,
      subtotal: invoices.subtotal,
      vatRate: invoices.vatRate,
      vatAmount: invoices.vatAmount,
      total: invoices.total,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(orders, eq(invoices.orderId, orders.id))
    .innerJoin(branches, eq(invoices.branchId, branches.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))
    .limit(200)
    .all();
}

export function createInvoiceForOrder(
  db: AppDb,
  actor: ActorContext,
  input: { orderId: string; vatRate: number; notes: string },
): string {
  assertPermission(actor, "finance.manage");
  if (!INVOICE_VAT_RATES.includes(input.vatRate as (typeof INVOICE_VAT_RATES)[number])) {
    throw new ValidationError("Thuế suất VAT không hợp lệ.");
  }
  const order = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)))
    .get();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng.");
  assertBranchAccess(actor, order.branchId);
  if (order.status === "cancelled") {
    throw new ValidationError("Không thể xuất hóa đơn cho đơn đã hủy.");
  }
  const existing = db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, actor.tenantId),
        eq(invoices.orderId, order.id),
        sql`${invoices.status} != 'cancelled'`,
      ),
    )
    .get();
  if (existing) {
    throw new ValidationError("Đơn hàng đã có hóa đơn đang hiệu lực.");
  }
  const now = new Date();
  const prefix = `HD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const invoiceId = crypto.randomUUID();
  db.transaction(
    (tx) => {
      let sequence =
        (tx
          .select({ value: count() })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, actor.tenantId),
              sql`${invoices.invoiceNo} like ${`${prefix}%`}`,
            ),
          )
          .get()?.value ?? 0) + 1;
      let invoiceNo = `${prefix}${String(sequence).padStart(4, "0")}`;
      while (
        tx
          .select({ id: invoices.id })
          .from(invoices)
          .where(and(eq(invoices.tenantId, actor.tenantId), eq(invoices.invoiceNo, invoiceNo)))
          .get()
      ) {
        sequence += 1;
        invoiceNo = `${prefix}${String(sequence).padStart(4, "0")}`;
      }
      const subtotal = Math.round((order.total * 100) / (100 + input.vatRate));
      const vatAmount = order.total - subtotal;
      tx.insert(invoices)
        .values({
          id: invoiceId,
          tenantId: actor.tenantId,
          branchId: order.branchId,
          orderId: order.id,
          customerId: order.customerId,
          invoiceNo,
          taxCode: getTenantSettings(tx, actor.tenantId)["studio.taxCode"] ?? null,
          subtotal,
          vatRate: input.vatRate,
          vatAmount,
          total: order.total,
          status: "issued",
          issuedAt: now,
          notes: input.notes.trim() || null,
          createdBy: actor.staffId,
        })
        .run();
    },
    { behavior: "immediate" },
  );
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.invoice.create",
    entity: "invoice",
    entityId: invoiceId,
    metadata: { orderId: order.id, total: order.total, vatRate: input.vatRate },
  });
  return invoiceId;
}

export type InvoiceDetail = {
  invoice: typeof invoices.$inferSelect;
  orderCode: string;
  customerName: string | null;
  customerPhone: string;
  customerAddress: string | null;
  branchName: string;
  branchAddress: string;
  studioName: string;
  studioTaxCode: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
};

export function getInvoiceDetail(
  db: AppDb,
  actor: ActorContext,
  invoiceId: string,
): InvoiceDetail {
  assertPermission(actor, "finance.view");
  const row = db
    .select({
      invoice: invoices,
      orderCode: orders.code,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      branchName: branches.name,
      branchAddress: branches.address,
    })
    .from(invoices)
    .innerJoin(orders, eq(invoices.orderId, orders.id))
    .innerJoin(branches, eq(invoices.branchId, branches.id))
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, actor.tenantId)))
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy hóa đơn.");
  assertBranchAccess(actor, row.invoice.branchId);
  const settingsMap = getTenantSettings(db, actor.tenantId);
  const items = db
    .select({
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
    })
    .from(orderItems)
    .where(
      and(
        eq(orderItems.tenantId, actor.tenantId),
        eq(orderItems.orderId, row.invoice.orderId),
      ),
    )
    .orderBy(asc(orderItems.sortOrder))
    .all();
  return {
    invoice: row.invoice,
    orderCode: row.orderCode,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerAddress: row.customerAddress,
    branchName: row.branchName,
    branchAddress: row.branchAddress,
    studioName: settingsMap["studio.name"] ?? actor.tenantName,
    studioTaxCode: settingsMap["studio.taxCode"] ?? "Chưa cấu hình",
    items,
  };
}

export function updateInvoiceStatus(
  db: AppDb,
  actor: ActorContext,
  invoiceId: string,
  status: InvoiceStatus,
): void {
  assertPermission(actor, "finance.manage");
  const invoice = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, actor.tenantId)))
    .get();
  if (!invoice) throw new NotFoundError("Không tìm thấy hóa đơn.");
  assertBranchAccess(actor, invoice.branchId);
  const allowed: Record<string, string[]> = {
    draft: ["issued", "cancelled"],
    issued: ["paid", "cancelled"],
    paid: [],
    cancelled: [],
  };
  if (!(allowed[invoice.status] ?? []).includes(status)) {
    throw new ValidationError("Không thể chuyển trạng thái hóa đơn.");
  }
  db.update(invoices)
    .set({ status, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.invoice.status",
    entity: "invoice",
    entityId: invoiceId,
    metadata: { from: invoice.status, to: status },
  });
}

export function listDebtors(
  db: AppDb,
  actor: ActorContext,
  filters: { branchId?: string; q?: string } = {},
): {
  rows: DebtRow[];
  buckets: Record<"0-30" | "31-60" | "61-90" | "90+", number>;
  total: number;
} {
  assertPermission(actor, "finance.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") {
    return { rows: [], buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }, total: 0 };
  }
  const conditions: SQL[] = [
    eq(orders.tenantId, actor.tenantId),
    sql`${orders.remaining} > 0`,
    sql`${orders.status} != 'cancelled'`,
  ];
  if (scope.mode === "branch") conditions.push(eq(orders.branchId, scope.branchId));
  else if (filters.branchId) conditions.push(eq(orders.branchId, filters.branchId));
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().toLowerCase()}%`;
    const search = or(
      sql`lower(${orders.code}) like ${term}`,
      sql`lower(${customers.name}) like ${term}`,
      sql`lower(${customers.phone}) like ${term}`,
    );
    if (search) conditions.push(search);
  }
  const now = Date.now();
  const rows = db
    .select({
      orderId: orders.id,
      orderCode: orders.code,
      customerId: customers.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      branchId: orders.branchId,
      branchName: branches.name,
      total: orders.total,
      paid: orders.paid,
      remaining: orders.remaining,
      scheduledAt: orders.scheduledAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(desc(orders.remaining))
    .all()
    .map((row) => {
      const anchor = row.scheduledAt ?? row.createdAt;
      const ageDays = Math.max(
        0,
        Math.floor((now - anchor.getTime()) / (24 * 60 * 60 * 1000)),
      );
      const bucket =
        ageDays <= 30 ? "0-30" : ageDays <= 60 ? "31-60" : ageDays <= 90 ? "61-90" : "90+";
      return { ...row, ageDays, bucket } satisfies DebtRow;
    });
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const row of rows) buckets[row.bucket] += row.remaining;
  return {
    rows,
    buckets,
    total: rows.reduce((sum, row) => sum + row.remaining, 0),
  };
}

export function remindDebt(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
): void {
  assertPermission(actor, "finance.view");
  const row = db
    .select({ order: orders, customerName: customers.name })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.tenantId)))
    .get();
  if (!row) throw new NotFoundError("Không tìm thấy đơn hàng.");
  assertBranchAccess(actor, row.order.branchId);
  if (row.order.remaining <= 0) {
    throw new ValidationError("Đơn hàng đã thu đủ, không cần nhắc.");
  }
  const now = new Date();
  db.insert(customerInteractions)
    .values({
      id: crypto.randomUUID(),
      tenantId: actor.tenantId,
      customerId: row.order.customerId,
      type: "debt_reminder",
      content: `Nhắc thu công nợ đơn ${row.order.code}: còn ${row.order.remaining.toLocaleString("vi-VN")}đ.`,
      occurredAt: now,
      createdBy: actor.staffId,
    })
    .run();
  if (row.order.createdBy) {
    createNotification(db, {
      tenantId: actor.tenantId,
      userId: row.order.createdBy,
      type: "debt_reminder",
      title: "Đã ghi nhận nhắc thu",
      content: `${row.customerName} · đơn ${row.order.code} còn ${row.order.remaining.toLocaleString("vi-VN")}đ.`,
      link: `/manage/orders/${row.order.id}`,
    });
  }
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.debt.remind",
    entity: "order",
    entityId: orderId,
    metadata: { remaining: row.order.remaining },
  });
}

export function recordRefund(
  db: AppDb,
  actor: ActorContext,
  input: { orderId: string; amount: number; reason: string; method: PaymentMethod },
): string {
  assertPermission(actor, "finance.manage");
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Số tiền hoàn không hợp lệ.");
  }
  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new ValidationError("Phương thức hoàn tiền không hợp lệ.");
  }
  const order = db
    .select()
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)))
    .get();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng.");
  assertBranchAccess(actor, order.branchId);
  if (input.amount > order.paid) {
    throw new ValidationError("Số tiền hoàn vượt quá số đã thu.");
  }
  const transactionId = crypto.randomUUID();
  const paymentId = crypto.randomUUID();
  db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: transactionId,
        tenantId: actor.tenantId,
        branchId: order.branchId,
        type: "refund",
        category: "refund",
        amount: input.amount,
        orderId: order.id,
        customerId: order.customerId,
        method: input.method,
        description: input.reason.trim() || "Hoàn tiền đơn hàng",
        occurredAt: new Date(),
        createdBy: actor.staffId,
      })
      .run();
    tx.insert(payments)
      .values({
        id: paymentId,
        tenantId: actor.tenantId,
        orderId: order.id,
        amount: input.amount,
        method: input.method,
        status: "refunded",
        reference: input.reason.trim() || "REFUND",
        idempotencyKey: `refund:${transactionId}`,
        paidAt: new Date(),
        createdBy: actor.staffId,
      })
      .run();
    tx.update(orders)
      .set({
        paid: order.paid - input.amount,
        remaining: order.remaining + input.amount,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))
      .run();
  });
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "finance.refund.create",
    entity: "transaction",
    entityId: transactionId,
    metadata: { orderId: order.id, amount: input.amount },
  });
  return transactionId;
}

export type PaymentSettings = {
  provider: "manual" | "vietqr";
  bankBin: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
};

export function getPaymentSettings(db: AppDb, tenantId: string): PaymentSettings {
  const map = getTenantSettings(db, tenantId);
  const provider =
    process.env.PAYMENT_PROVIDER === "vietqr" ? "vietqr" : "manual";
  return {
    provider,
    bankBin: map["payment.bankBin"] ?? "",
    accountNumber: map["payment.bankAccountNumber"] ?? "",
    accountName: map["payment.bankAccountName"] ?? "",
    bankName: map["payment.bankName"] ?? "",
  };
}

export function buildVietQrForOrder(
  db: AppDb,
  actor: ActorContext,
  input: { orderId: string; amount: number; content: string },
): {
  payload: string;
  content: string;
  imageUrl: string;
  amount: number;
  orderCode: string;
  provider: "manual" | "vietqr";
} {
  assertPermission(actor, "finance.view");
  const order = db
    .select({ id: orders.id, code: orders.code, remaining: orders.remaining, branchId: orders.branchId })
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)))
    .get();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng.");
  assertBranchAccess(actor, order.branchId);
  const amount = input.amount > 0 ? input.amount : order.remaining;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError("Số tiền VietQR không hợp lệ.");
  }
  const settings = getPaymentSettings(db, actor.tenantId);
  const vietQr = buildVietQrPayload({
    bankBin: settings.bankBin,
    accountNumber: settings.accountNumber,
    accountName: settings.accountName,
    amount,
    content: input.content || `Thanh toan ${order.code}`,
  });
  return {
    ...vietQr,
    amount,
    orderCode: order.code,
    provider: "vietqr" as const,
  };
}

export type PaymentWebhookInput = {
  provider: string;
  eventId: string;
  eventType: string;
  orderId: string;
  amount: number;
  reference?: string;
  occurredAt?: string;
};

export function processPaymentWebhook(
  db: AppDb,
  input: PaymentWebhookInput,
  rawPayload: string,
): { status: "processed" | "duplicate"; paymentId?: string } {
  if (!input.eventId || !input.orderId) {
    throw new ValidationError("Webhook thiếu event/order.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Số tiền webhook không hợp lệ.");
  }
  const order = db
    .select()
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .get();
  if (!order) throw new NotFoundError("Không tìm thấy đơn hàng.");
  const payloadHash = crypto.createHash("sha256").update(rawPayload).digest("hex");

  const existing = db
    .select()
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.tenantId, order.tenantId),
        eq(paymentWebhookEvents.provider, input.provider),
        eq(paymentWebhookEvents.externalEventId, input.eventId),
      ),
    )
    .get();
  if (existing) {
    return { status: "duplicate" };
  }
  if (order.status === "cancelled") {
    throw new ValidationError("Đơn hàng đã hủy.");
  }
  if (input.amount > order.remaining) {
    throw new ValidationError("Số tiền webhook vượt quá công nợ còn lại.");
  }

  const paymentId = crypto.randomUUID();
  const eventRowId = crypto.randomUUID();
  try {
    db.transaction(
      (tx) => {
        tx.insert(paymentWebhookEvents)
          .values({
            id: eventRowId,
            tenantId: order.tenantId,
            provider: input.provider,
            externalEventId: input.eventId,
            eventType: input.eventType,
            payloadHash,
            status: "processing",
          })
          .run();
        tx.insert(payments)
          .values({
            id: paymentId,
            tenantId: order.tenantId,
            orderId: order.id,
            amount: input.amount,
            method: "bank_transfer",
            status: "completed",
            reference: input.reference?.trim() || input.provider,
            idempotencyKey: `webhook:${input.provider}:${input.eventId}`,
            paidAt: input.occurredAt
              ? parseVietnamDateTimeLocal(input.occurredAt) ?? new Date()
              : new Date(),
            createdBy: order.createdBy,
          })
          .run();
        const newPaid = order.paid + input.amount;
        const newRemaining = Math.max(0, order.total - newPaid);
        tx.update(orders)
          .set({
            paid: newPaid,
            remaining: newRemaining,
            status: order.status === "new" ? "deposit_received" : order.status,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id))
          .run();
        tx.insert(transactions)
          .values({
            id: crypto.randomUUID(),
            tenantId: order.tenantId,
            branchId: order.branchId,
            type: "income",
            category: "order_payment",
            amount: input.amount,
            orderId: order.id,
            customerId: order.customerId,
            method: "bank_transfer",
            description: `Webhook ${input.provider} thanh toán đơn ${order.code}`,
            reference: input.reference?.trim() || input.provider,
            idempotencyKey: `webhook:${input.provider}:${input.eventId}`,
            occurredAt: new Date(),
            createdBy: order.createdBy,
          })
          .run();
        tx.insert(orderStatusHistory)
          .values({
            id: crypto.randomUUID(),
            tenantId: order.tenantId,
            orderId: order.id,
            fromStatus: order.status,
            toStatus: order.status === "new" ? "deposit_received" : order.status,
            note: `Thanh toán webhook ${input.provider}.`,
            changedBy: null,
            createdAt: new Date(),
          })
          .run();
        tx.update(paymentWebhookEvents)
          .set({ status: "processed", processedAt: new Date() })
          .where(eq(paymentWebhookEvents.id, eventRowId))
          .run();
      },
      { behavior: "immediate" },
    );
  } catch (error) {
    const duplicate = db
      .select()
      .from(paymentWebhookEvents)
      .where(
        and(
          eq(paymentWebhookEvents.tenantId, order.tenantId),
          eq(paymentWebhookEvents.provider, input.provider),
          eq(paymentWebhookEvents.externalEventId, input.eventId),
        ),
      )
      .get();
    if (duplicate) return { status: "duplicate" };
    throw error;
  }

  writeAudit(db, {
    tenantId: order.tenantId,
    actorId: null,
    action: "finance.webhook.payment",
    entity: "payment",
    entityId: paymentId,
    metadata: { orderId: order.id, amount: input.amount, provider: input.provider },
  });
  return { status: "processed", paymentId };
}

export function validatePaymentWebhookOrder(
  db: AppDb,
  orderId: string,
): { id: string; code: string; remaining: number; tenantId: string } | null {
  return (
    db
      .select({
        id: orders.id,
        code: orders.code,
        remaining: orders.remaining,
        tenantId: orders.tenantId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .get() ?? null
  );
}

export function listFinanceOrderOptions(db: AppDb, actor: ActorContext) {
  assertPermission(actor, "finance.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [
    eq(orders.tenantId, actor.tenantId),
    sql`${orders.status} != 'cancelled'`,
  ];
  if (scope.mode === "branch") conditions.push(eq(orders.branchId, scope.branchId));
  return db
    .select({
      id: orders.id,
      code: orders.code,
      customerName: customers.name,
      total: orders.total,
      paid: orders.paid,
      remaining: orders.remaining,
      branchId: orders.branchId,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(100)
    .all();
}

export function listInvoiceOrderOptions(db: AppDb, actor: ActorContext) {
  assertPermission(actor, "finance.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [
    eq(orders.tenantId, actor.tenantId),
    sql`${orders.status} != 'cancelled'`,
  ];
  if (scope.mode === "branch") conditions.push(eq(orders.branchId, scope.branchId));
  return db
    .select({
      id: orders.id,
      code: orders.code,
      total: orders.total,
      remaining: orders.remaining,
      customerName: customers.name,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(100)
    .all();
}

export function sanitizePaymentContent(value: string): string {
  return sanitizeTransferContent(value);
}

export function ensureFinancePermission(actor: ActorContext, manage = false): void {
  if (manage && !actor.permissions.includes("finance.manage")) {
    throw new AuthorizationError("Bạn không có quyền quản lý tài chính.");
  }
  if (!manage && !actor.permissions.includes("finance.view")) {
    throw new AuthorizationError("Bạn không có quyền xem tài chính.");
  }
}
