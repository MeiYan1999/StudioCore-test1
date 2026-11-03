import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { AppDb } from "../db/client";
import {
  appointments,
  branches,
  commissions,
  customers,
  invoices,
  orderItems,
  orders,
  rooms,
  staff,
  transactions,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission, getBranchScope, hasPermission } from "../auth/permissions";
import { listDebtors } from "../services/finance-service";
import { addMonthsToKey, getVietnamMonthRange } from "../scheduling/time";

export type ReportFilters = {
  from?: string;
  to?: string;
  branchId?: string;
};

export type RevenueReport = {
  from: string;
  to: string;
  collected: number;
  refunded: number;
  expenses: number;
  profit: number;
  expected: number;
  orderCount: number;
  completedOrders: number;
  byBranch: {
    branchId: string;
    branchName: string;
    income: number;
    expense: number;
    profit: number;
  }[];
  byService: { name: string; revenue: number }[];
  byStaff: { staffName: string; orders: number; revenue: number }[];
  monthly: { month: string; income: number; expense: number }[];
};

export type TaxReport = {
  from: string;
  to: string;
  invoiceCount: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  rates: { rate: number; count: number; subtotal: number; vatAmount: number; total: number }[];
  rows: {
    invoiceNo: string;
    orderCode: string;
    customerName: string | null;
    subtotal: number;
    vatRate: number;
    vatAmount: number;
    total: number;
    status: string;
    issuedAt: Date | null;
  }[];
};

export type RoomUtilizationRow = {
  roomId: string;
  roomName: string;
  branchName: string;
  bookedHours: number;
  capacityHours: number;
  utilization: number;
};

function formatDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatMonthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function reportRange(filters: ReportFilters): { start: Date; end: Date; from: string; to: string } {
  const todayKey = formatDateKey(new Date());
  const from = filters.from || `${todayKey.slice(0, 7)}-01`;
  const to = filters.to || todayKey;
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(`${to}T23:59:59.999+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Khoảng ngày báo cáo không hợp lệ.");
  }
  return { start, end, from, to };
}

function branchConditions(
  actor: ActorContext,
  column: SQLiteColumn,
  branchId?: string,
): SQL[] {
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [sql`1=0`];
  if (scope.mode === "branch") return [eq(column, scope.branchId)];
  return branchId ? [eq(column, branchId)] : [];
}

export function getRevenueReport(
  db: AppDb,
  actor: ActorContext,
  filters: ReportFilters,
): RevenueReport {
  assertPermission(actor, "reports.view");
  const range = reportRange(filters);
  const txConditions: SQL[] = [
    eq(transactions.tenantId, actor.tenantId),
    gte(transactions.occurredAt, range.start),
    lte(transactions.occurredAt, range.end),
    ...branchConditions(actor, transactions.branchId, filters.branchId),
  ];
  const transactionRows = db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      branchId: transactions.branchId,
      branchName: branches.name,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .innerJoin(branches, eq(transactions.branchId, branches.id))
    .where(and(...txConditions))
    .all();

  const orderConditions: SQL[] = [
    eq(orders.tenantId, actor.tenantId),
    gte(orders.createdAt, range.start),
    lte(orders.createdAt, range.end),
    ...branchConditions(actor, orders.branchId, filters.branchId),
  ];
  const orderRows = db
    .select({
      id: orders.id,
      total: orders.total,
      paid: orders.paid,
      status: orders.status,
      branchId: orders.branchId,
      photographerId: orders.photographerId,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(...orderConditions))
    .all();

  const collected = transactionRows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const refunded = transactionRows
    .filter((row) => row.type === "refund")
    .reduce((sum, row) => sum + row.amount, 0);
  const expenses = transactionRows
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + row.amount, 0);

  const branchMap = new Map<
    string,
    { branchName: string; income: number; expense: number }
  >();
  for (const row of transactionRows) {
    const entry = branchMap.get(row.branchId) ?? {
      branchName: row.branchName,
      income: 0,
      expense: 0,
    };
    if (row.type === "income") entry.income += row.amount;
    if (row.type === "expense" || row.type === "refund") entry.expense += row.amount;
    branchMap.set(row.branchId, entry);
  }

  const itemConditions: SQL[] = [
    eq(orderItems.tenantId, actor.tenantId),
    gte(orders.createdAt, range.start),
    lte(orders.createdAt, range.end),
    sql`${orders.status} != 'cancelled'`,
    ...branchConditions(actor, orders.branchId, filters.branchId),
  ];
  const itemRows = db
    .select({ name: orderItems.name, total: orderItems.total })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...itemConditions))
    .all();
  const serviceMap = new Map<string, number>();
  for (const item of itemRows) {
    serviceMap.set(item.name, (serviceMap.get(item.name) ?? 0) + item.total);
  }

  const staffConditions: SQL[] = [
    eq(orders.tenantId, actor.tenantId),
    gte(orders.createdAt, range.start),
    lte(orders.createdAt, range.end),
    sql`${orders.status} = 'completed'`,
    ...branchConditions(actor, orders.branchId, filters.branchId),
  ];
  const staffRows = db
    .select({
      staffName: staff.name,
      total: orders.total,
    })
    .from(orders)
    .leftJoin(staff, eq(orders.photographerId, staff.id))
    .where(and(...staffConditions))
    .all();
  const staffMap = new Map<string, { orders: number; revenue: number }>();
  for (const row of staffRows) {
    const name = row.staffName ?? "Chưa phân công";
    const entry = staffMap.get(name) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += row.total;
    staffMap.set(name, entry);
  }

  const monthlyMap = new Map<string, { income: number; expense: number }>();
  const monthlyConditions: SQL[] = [
    eq(transactions.tenantId, actor.tenantId),
    gte(transactions.occurredAt, new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)),
    ...branchConditions(actor, transactions.branchId, filters.branchId),
  ];
  const monthlyRows = db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(and(...monthlyConditions))
    .all();
  for (const row of monthlyRows) {
    const month = formatMonthKey(row.occurredAt);
    const entry = monthlyMap.get(month) ?? { income: 0, expense: 0 };
    if (row.type === "income") entry.income += row.amount;
    if (row.type === "expense" || row.type === "refund") entry.expense += row.amount;
    monthlyMap.set(month, entry);
  }

  return {
    from: range.from,
    to: range.to,
    collected,
    refunded,
    expenses,
    profit: collected - refunded - expenses,
    expected: orderRows
      .filter((row) => row.status !== "cancelled")
      .reduce((sum, row) => sum + row.total, 0),
    orderCount: orderRows.length,
    completedOrders: orderRows.filter((row) => row.status === "completed").length,
    byBranch: [...branchMap.entries()].map(([branchId, entry]) => ({
      branchId,
      branchName: entry.branchName,
      income: entry.income,
      expense: entry.expense,
      profit: entry.income - entry.expense,
    })),
    byService: [...serviceMap.entries()]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue),
    byStaff: [...staffMap.entries()]
      .map(([staffName, entry]) => ({ staffName, ...entry }))
      .sort((a, b) => b.revenue - a.revenue),
    monthly: [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, entry]) => ({ month, ...entry })),
  };
}

export function getTaxReport(
  db: AppDb,
  actor: ActorContext,
  filters: ReportFilters,
): TaxReport {
  assertPermission(actor, "reports.view");
  const range = reportRange(filters);
  const conditions: SQL[] = [
    eq(invoices.tenantId, actor.tenantId),
    gte(invoices.createdAt, range.start),
    lte(invoices.createdAt, range.end),
    ...branchConditions(actor, invoices.branchId, filters.branchId),
  ];
  const rows = db
    .select({
      invoiceNo: invoices.invoiceNo,
      orderCode: orders.code,
      customerName: customers.name,
      subtotal: invoices.subtotal,
      vatRate: invoices.vatRate,
      vatAmount: invoices.vatAmount,
      total: invoices.total,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
    })
    .from(invoices)
    .innerJoin(orders, eq(invoices.orderId, orders.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt))
    .all();
  const rates = new Map<
    number,
    { count: number; subtotal: number; vatAmount: number; total: number }
  >();
  for (const row of rows) {
    if (row.status === "cancelled") continue;
    const entry = rates.get(row.vatRate) ?? {
      count: 0,
      subtotal: 0,
      vatAmount: 0,
      total: 0,
    };
    entry.count += 1;
    entry.subtotal += row.subtotal;
    entry.vatAmount += row.vatAmount;
    entry.total += row.total;
    rates.set(row.vatRate, entry);
  }
  return {
    from: range.from,
    to: range.to,
    invoiceCount: rows.filter((row) => row.status !== "cancelled").length,
    subtotal: rows
      .filter((row) => row.status !== "cancelled")
      .reduce((sum, row) => sum + row.subtotal, 0),
    vatAmount: rows
      .filter((row) => row.status !== "cancelled")
      .reduce((sum, row) => sum + row.vatAmount, 0),
    total: rows
      .filter((row) => row.status !== "cancelled")
      .reduce((sum, row) => sum + row.total, 0),
    rates: [...rates.entries()]
      .sort(([a], [b]) => a - b)
      .map(([rate, entry]) => ({ rate, ...entry })),
    rows,
  };
}

export function getRoomUtilization(
  db: AppDb,
  actor: ActorContext,
  filters: ReportFilters,
): RoomUtilizationRow[] {
  assertPermission(actor, "reports.view");
  const range = reportRange(filters);
  const roomConditions: SQL[] = [eq(rooms.tenantId, actor.tenantId)];
  const scope = getBranchScope(actor);
  if (scope.mode === "branch") roomConditions.push(eq(rooms.branchId, scope.branchId));
  else if (scope.mode === "none") return [];
  else if (filters.branchId) roomConditions.push(eq(rooms.branchId, filters.branchId));
  const roomRows = db
    .select({
      id: rooms.id,
      name: rooms.name,
      branchName: branches.name,
    })
    .from(rooms)
    .innerJoin(branches, eq(rooms.branchId, branches.id))
    .where(and(...roomConditions))
    .all();
  const appointmentConditions: SQL[] = [
    eq(appointments.tenantId, actor.tenantId),
    gte(appointments.startAt, range.start),
    lte(appointments.endAt, range.end),
    sql`${appointments.status} != 'cancelled'`,
  ];
  if (scope.mode === "branch") {
    appointmentConditions.push(eq(appointments.branchId, scope.branchId));
  } else if (filters.branchId) {
    appointmentConditions.push(eq(appointments.branchId, filters.branchId));
  }
  const appointmentRows = db
    .select({
      roomId: appointments.roomId,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
    })
    .from(appointments)
    .where(and(...appointmentConditions))
    .all();
  const bookedMap = new Map<string, number>();
  for (const row of appointmentRows) {
    if (!row.roomId) continue;
    const hours = Math.max(0, (row.endAt.getTime() - row.startAt.getTime()) / 3_600_000);
    bookedMap.set(row.roomId, (bookedMap.get(row.roomId) ?? 0) + hours);
  }
  const days = Math.max(
    1,
    Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)),
  );
  return roomRows.map((room) => {
    const bookedHours = Math.round((bookedMap.get(room.id) ?? 0) * 10) / 10;
    const capacityHours = days * 10;
    return {
      roomId: room.id,
      roomName: room.name,
      branchName: room.branchName,
      bookedHours,
      capacityHours,
      utilization:
        capacityHours > 0 ? Math.round((bookedHours / capacityHours) * 1000) / 10 : 0,
    };
  });
}

export function getPhotographerPerformance(
  db: AppDb,
  actor: ActorContext,
  filters: ReportFilters,
): {
  staffId: string;
  staffName: string;
  shoots: number;
  completedOrders: number;
  revenue: number;
  commissionApproved: number;
}[] {
  assertPermission(actor, "reports.view");
  const range = reportRange(filters);
  const photographers = db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.role, "photographer"),
        eq(staff.active, true),
      ),
    )
    .all();
  return photographers.map((photographer) => {
    const conditions: SQL[] = [
      eq(orders.tenantId, actor.tenantId),
      eq(orders.photographerId, photographer.id),
      gte(orders.createdAt, range.start),
      lte(orders.createdAt, range.end),
    ];
    const rows = db
      .select({ status: orders.status, total: orders.total })
      .from(orders)
      .where(and(...conditions))
      .all();
    const commissionAmount =
      db
        .select({ value: sql<number>`coalesce(sum(${commissions.amount}), 0)` })
        .from(commissions)
        .where(
          and(
            eq(commissions.tenantId, actor.tenantId),
            eq(commissions.staffId, photographer.id),
            eq(commissions.status, "approved"),
            gte(commissions.createdAt, range.start),
            lte(commissions.createdAt, range.end),
          ),
        )
        .get()?.value ?? 0;
    return {
      staffId: photographer.id,
      staffName: photographer.name,
      shoots: rows.length,
      completedOrders: rows.filter((row) => row.status === "completed").length,
      revenue: rows
        .filter((row) => row.status === "completed")
        .reduce((sum, row) => sum + row.total, 0),
      commissionApproved: Number(commissionAmount),
    };
  });
}

export function getSalesPerformance(
  db: AppDb,
  actor: ActorContext,
  filters: ReportFilters,
): {
  staffId: string;
  staffName: string;
  leads: number;
  orders: number;
  completedOrders: number;
  revenue: number;
  closeRate: number;
}[] {
  assertPermission(actor, "reports.view");
  const range = reportRange(filters);
  const salesStaff = db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        sql`${staff.role} in ('receptionist', 'manager', 'owner')`,
      ),
    )
    .all();
  return salesStaff.map((item) => {
    const leadCount =
      db
        .select({ value: sql<number>`count(*)` })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, actor.tenantId),
            eq(customers.ownerId, item.id),
          ),
        )
        .get()?.value ?? 0;
    const rows = db
      .select({ status: orders.status, total: orders.total })
      .from(orders)
      .where(
        and(
          eq(orders.tenantId, actor.tenantId),
          eq(orders.createdBy, item.id),
          gte(orders.createdAt, range.start),
          lte(orders.createdAt, range.end),
        ),
      )
      .all();
    const completed = rows.filter((row) => row.status === "completed");
    return {
      staffId: item.id,
      staffName: item.name,
      leads: Number(leadCount),
      orders: rows.length,
      completedOrders: completed.length,
      revenue: completed.reduce((sum, row) => sum + row.total, 0),
      closeRate:
        Number(leadCount) > 0
          ? Math.round((rows.length / Number(leadCount)) * 1000) / 10
          : 0,
    };
  });
}

export function getDebtReport(
  db: AppDb,
  actor: ActorContext,
  filters: ReportFilters,
) {
  assertPermission(actor, "reports.view");
  return listDebtors(db, actor, { branchId: filters.branchId });
}

export type DashboardOverview = {
  todayRevenue: number;
  monthRevenue: number;
  previousMonthRevenue: number;
  monthExpense: number;
  monthProfit: number;
  debtTotal: number;
  leads: number;
  followUpsDue: number;
  birthdaysThisMonth: number;
  todayAppointments: number;
  weekAppointments: number;
  ordersByStatus: Record<string, number>;
  topServices: { name: string; revenue: number }[];
  monthlyRevenue: { month: string; income: number; expense: number }[];
  sourceBreakdown: { source: string; count: number }[];
  roomUtilization: RoomUtilizationRow[];
  photographerPerformance: {
    staffName: string;
    completedOrders: number;
    revenue: number;
  }[];
};

export function getDashboardOverview(
  db: AppDb,
  actor: ActorContext,
): DashboardOverview {
  assertPermission(actor, "dashboard.view");
  const canFinance =
    hasPermission(actor.permissions, "finance.view") &&
    hasPermission(actor.permissions, "reports.view");
  const emptyReport: RevenueReport = {
    from: "",
    to: "",
    collected: 0,
    refunded: 0,
    expenses: 0,
    profit: 0,
    expected: 0,
    orderCount: 0,
    completedOrders: 0,
    byBranch: [],
    byService: [],
    byStaff: [],
    monthly: [],
  };
  const range = canFinance ? getRevenueReport(db, actor, {}) : emptyReport;
  const debts = canFinance ? listDebtors(db, actor) : { total: 0, rows: [], buckets: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } };
  const now = new Date();
  const todayKey = formatDateKey(now);
  const todayStart = new Date(`${todayKey}T00:00:00+07:00`);
  const todayEnd = new Date(`${todayKey}T23:59:59.999+07:00`);
  const scope = getBranchScope(actor);
  const branchTx =
    scope.mode === "branch" ? [eq(transactions.branchId, scope.branchId)] : [];
  const todayRows = db
    .select({ type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        eq(transactions.tenantId, actor.tenantId),
        gte(transactions.occurredAt, todayStart),
        lte(transactions.occurredAt, todayEnd),
        ...branchTx,
      ),
    )
    .all();
  const todayRevenue = todayRows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + row.amount, 0);

  const previousMonthKey = addMonthsToKey(`${todayKey.slice(0, 7)}-01`, -1).slice(0, 7);
  const previousMonthRange = getVietnamMonthRange(previousMonthKey);
  const previousMonthStart = previousMonthRange.start;
  const previousMonthEnd = previousMonthRange.end;
  const previousRows = db
    .select({ type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(
      and(
        eq(transactions.tenantId, actor.tenantId),
        gte(transactions.occurredAt, previousMonthStart),
        lte(transactions.occurredAt, previousMonthEnd),
        ...branchTx,
      ),
    )
    .all();
  const previousMonthRevenue = previousRows
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + row.amount, 0);

  const orderConditions: SQL[] = [eq(orders.tenantId, actor.tenantId)];
  if (scope.mode === "branch") orderConditions.push(eq(orders.branchId, scope.branchId));
  const orderRows = db
    .select({ status: orders.status, total: orders.total, createdAt: orders.createdAt })
    .from(orders)
    .where(and(...orderConditions))
    .all();
  const ordersByStatus: Record<string, number> = {};
  for (const row of orderRows) {
    ordersByStatus[row.status] = (ordersByStatus[row.status] ?? 0) + 1;
  }

  const customerConditions: SQL[] = [eq(customers.tenantId, actor.tenantId)];
  if (scope.mode === "branch") customerConditions.push(eq(customers.branchId, scope.branchId));
  const customerRows = db
    .select({
      source: customers.source,
      status: customers.status,
      followUpAt: customers.followUpAt,
      birthday: customers.birthday,
    })
    .from(customers)
    .where(and(...customerConditions))
    .all();
  const currentMonth = todayKey.slice(5, 7);
  const sourceMap = new Map<string, number>();
  for (const row of customerRows) {
    sourceMap.set(row.source, (sourceMap.get(row.source) ?? 0) + 1);
  }

  const apptConditions: SQL[] = [eq(appointments.tenantId, actor.tenantId)];
  if (scope.mode === "branch") apptConditions.push(eq(appointments.branchId, scope.branchId));
  const appointmentRows = db
    .select({ startAt: appointments.startAt })
    .from(appointments)
    .where(and(...apptConditions))
    .all();
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    todayRevenue,
    monthRevenue: range.collected - range.refunded,
    previousMonthRevenue,
    monthExpense: range.expenses,
    monthProfit: range.profit,
    debtTotal: debts.total,
    leads: customerRows.filter((row) => row.status === "lead").length,
    followUpsDue: customerRows.filter(
      (row) => row.followUpAt && row.followUpAt.getTime() < now.getTime(),
    ).length,
    birthdaysThisMonth: customerRows.filter((row) =>
      row.birthday ? row.birthday.slice(5, 7) === currentMonth : false,
    ).length,
    todayAppointments: appointmentRows.filter(
      (row) => row.startAt >= todayStart && row.startAt <= todayEnd,
    ).length,
    weekAppointments: appointmentRows.filter(
      (row) => row.startAt >= todayStart && row.startAt <= weekEnd,
    ).length,
    ordersByStatus,
    topServices: range.byService.slice(0, 5),
    monthlyRevenue: range.monthly.slice(-6),
    sourceBreakdown: [...sourceMap.entries()].map(([source, count]) => ({ source, count })),
    roomUtilization: canFinance ? getRoomUtilization(db, actor, {}) : [],
    photographerPerformance: canFinance
      ? getPhotographerPerformance(db, actor, {}).map((row) => ({
          staffName: row.staffName,
          completedOrders: row.completedOrders,
          revenue: row.revenue,
        }))
      : [],
  };
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function reportCsv(
  db: AppDb,
  actor: ActorContext,
  type: "revenue" | "debt" | "tax",
  filters: ReportFilters,
): { filename: string; content: string } {
  if (type === "revenue") {
    const report = getRevenueReport(db, actor, filters);
    const lines = [
      "section,label,income,expense",
      ...report.byBranch.map((row) =>
        ["branch", row.branchName, String(row.income), String(row.expense)].map(csvEscape).join(","),
      ),
      ...report.byService.map((row) =>
        ["service", row.name, String(row.revenue), "0"].map(csvEscape).join(","),
      ),
      `summary,collected,${report.collected},0`,
      `summary,refunded,${report.refunded},0`,
      `summary,expenses,0,${report.expenses}`,
      `summary,profit,${report.profit},0`,
      `summary,expected,${report.expected},0`,
    ];
    return { filename: `revenue-${report.from}-${report.to}.csv`, content: `\uFEFF${lines.join("\r\n")}\r\n` };
  }
  if (type === "debt") {
    const report = getDebtReport(db, actor, filters);
    const lines = [
      "order_code,customer,phone,branch,total,paid,remaining,age_days,bucket",
      ...report.rows.map((row) =>
        [
          row.orderCode,
          row.customerName,
          row.customerPhone,
          row.branchName,
          String(row.total),
          String(row.paid),
          String(row.remaining),
          String(row.ageDays),
          row.bucket,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];
    return { filename: "debt-report.csv", content: `\uFEFF${lines.join("\r\n")}\r\n` };
  }
  const report = getTaxReport(db, actor, filters);
  const lines = [
    "invoice_no,order_code,customer,subtotal,vat_rate,vat_amount,total,status,issued_at",
    ...report.rows.map((row) =>
      [
        row.invoiceNo,
        row.orderCode,
        row.customerName ?? "",
        String(row.subtotal),
        String(row.vatRate),
        String(row.vatAmount),
        String(row.total),
        row.status,
        row.issuedAt ? row.issuedAt.toISOString() : "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return {
    filename: `tax-${report.from}-${report.to}.csv`,
    content: `\uFEFF${lines.join("\r\n")}\r\n`,
  };
}
