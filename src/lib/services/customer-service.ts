import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  like,
  ne,
  or,
  sum,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  branches,
  customerInteractions,
  customers,
  orders,
  staff,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission, assertBranchAccess, getBranchScope } from "../auth/permissions";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { normalizeVietnamesePhone } from "../utils/phone";
import { parseVietnamDateTimeLocal, toDateTimeLocalValue } from "../utils";

export type CustomerFilters = {
  q?: string;
  status?: string;
  tier?: string;
  source?: string;
  ownerId?: string;
  branchId?: string;
  segment?: string;
  page?: number;
  pageSize?: number;
};

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  branchId: string;
  branchName: string;
  status: string;
  tier: string;
  source: string;
  ownerId: string | null;
  ownerName: string | null;
  tags: string[];
  lastContactAt: Date | null;
  followUpAt: Date | null;
  followUpOverdue: boolean;
  createdAt: Date;
};

export type CustomerInteractionItem = {
  id: string;
  type: string;
  content: string;
  occurredAt: Date;
  createdByName: string | null;
};

export type CustomerOrderSummary = {
  id: string;
  code: string;
  status: string;
  total: number;
  paid: number;
  remaining: number;
  scheduledAt: Date | null;
  createdAt: Date;
};

export type CustomerDetail = CustomerListItem & {
  address: string | null;
  birthday: string | null;
  measurements: Record<string, string>;
  notes: string | null;
  interactions: CustomerInteractionItem[];
  orders: CustomerOrderSummary[];
  metrics: {
    ltv: number;
    totalPaid: number;
    debt: number;
    orderCount: number;
    averageOrderValue: number;
    lastOrderAt: Date | null;
  };
};

export type CustomerCreateData = {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  birthday: string | null;
  source: "facebook" | "tiktok" | "google" | "referral" | "walk_in" | "other";
  tier: "standard" | "vip" | "vvip";
  status: "lead" | "active" | "inactive" | "churned";
  ownerId: string | null;
  branchId: string;
  tags: string[];
  heightCm: string;
  dressSize: string;
  shoeSize: string;
  measurementsNote: string;
  followUpAt: string;
  notes: string | null;
};

export type CustomerUpdateData = CustomerCreateData;

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function customerScopeConditions(actor: ActorContext): SQL[] {
  const scope = getBranchScope(actor);
  const conditions: SQL[] = [
    eq(customers.tenantId, actor.tenantId),
    isNull(customers.archivedAt),
  ];

  if (scope.mode === "branch") {
    conditions.push(eq(customers.branchId, scope.branchId));
  }

  return conditions;
}

function buildCustomerConditions(
  db: AppDb,
  actor: ActorContext,
  filters: CustomerFilters,
): SQL[] {
  const scope = getBranchScope(actor);
  const conditions = customerScopeConditions(actor);

  if (scope.mode === "none") {
    conditions.push(eq(customers.id, "__scope_none__"));
    return conditions;
  }

  if (filters.branchId) {
    assertBranchAccess(actor, filters.branchId);
    conditions.push(eq(customers.branchId, filters.branchId));
  }

  if (filters.status) {
    conditions.push(eq(customers.status, filters.status));
  }
  if (filters.tier) {
    conditions.push(eq(customers.tier, filters.tier));
  }
  if (filters.source) {
    conditions.push(eq(customers.source, filters.source));
  }
  if (filters.ownerId) {
    conditions.push(eq(customers.ownerId, filters.ownerId));
  }

  if (filters.segment) {
    const now = new Date();
    switch (filters.segment) {
      case "vip":
        conditions.push(inArray(customers.tier, ["vip", "vvip"]));
        break;
      case "new_30d":
        conditions.push(
          gte(customers.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
        );
        break;
      case "at_risk":
        conditions.push(inArray(customers.status, ["inactive", "churned"]));
        break;
      case "birthday_month": {
        const month = String(now.getMonth() + 1).padStart(2, "0");
        conditions.push(like(customers.birthday, `%-${month}-%`));
        break;
      }
      case "debt": {
        const debtCustomerIds = db
          .select({ customerId: orders.customerId })
          .from(orders)
          .where(
            and(
              eq(orders.tenantId, actor.tenantId),
              ne(orders.status, "cancelled"),
              gt(orders.remaining, 0),
              isNull(orders.archivedAt),
            ),
          )
          .all()
          .map((row) => row.customerId);
        conditions.push(
          debtCustomerIds.length > 0
            ? inArray(customers.id, debtCustomerIds)
            : eq(customers.id, "__no_debt_customers__"),
        );
        break;
      }
      case "lead":
        conditions.push(eq(customers.status, "lead"));
        break;
      default:
        break;
    }
  }

  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    const search = or(
      like(customers.name, term),
      like(customers.phone, term),
      like(customers.email, term),
      like(customers.tags, term),
      like(customers.notes, term),
    );
    if (search) {
      conditions.push(search);
    }
  }

  return conditions;
}

function parseOptionalDate(
  value: string,
  label: string,
): Date | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = parseVietnamDateTimeLocal(value);
  if (!parsed) {
    throw new ValidationError(`${label} không hợp lệ.`);
  }

  return parsed;
}

function assertOwnerInTenant(
  db: AppDb,
  actor: ActorContext,
  ownerId: string | null,
): void {
  if (!ownerId) {
    return;
  }

  const owner = db
    .select({ id: staff.id })
    .from(staff)
    .where(
      and(
        eq(staff.id, ownerId),
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
      ),
    )
    .get();

  if (!owner) {
    throw new ValidationError("Người phụ trách không hợp lệ.");
  }
}

function customerListRow(row: {
  customer: typeof customers.$inferSelect;
  branchName: string | null;
  ownerName: string | null;
}): CustomerListItem {
  return {
    id: row.customer.id,
    name: row.customer.name,
    phone: row.customer.phone,
    email: row.customer.email,
    branchId: row.customer.branchId,
    branchName: row.branchName ?? "Không xác định",
    status: row.customer.status,
    tier: row.customer.tier,
    source: row.customer.source,
    ownerId: row.customer.ownerId,
    ownerName: row.ownerName,
    tags: safeJson<string[]>(row.customer.tags, []),
    lastContactAt: row.customer.lastContactAt,
    followUpAt: row.customer.followUpAt,
    followUpOverdue:
      row.customer.followUpAt !== null &&
      row.customer.followUpAt.getTime() < new Date().getTime(),
    createdAt: row.customer.createdAt,
  };
}

export function listCustomers(
  db: AppDb,
  actor: ActorContext,
  filters: CustomerFilters,
): { items: CustomerListItem[]; total: number; page: number; pageSize: number } {
  assertPermission(actor, "customers.view");

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(5000, Math.max(1, filters.pageSize ?? 20));
  const conditions = buildCustomerConditions(db, actor, filters);
  const where = and(...conditions);

  const total =
    db.select({ value: count() }).from(customers).where(where).get()?.value ?? 0;

  const rows = db
    .select({
      customer: customers,
      branchName: branches.name,
      ownerName: staff.name,
    })
    .from(customers)
    .leftJoin(branches, eq(customers.branchId, branches.id))
    .leftJoin(staff, eq(customers.ownerId, staff.id))
    .where(where)
    .orderBy(desc(customers.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  return {
    items: rows.map(customerListRow),
    total,
    page,
    pageSize,
  };
}

export function getCustomerDetail(
  db: AppDb,
  actor: ActorContext,
  customerId: string,
): CustomerDetail | null {
  assertPermission(actor, "customers.view");

  const row = db
    .select({
      customer: customers,
      branchName: branches.name,
      ownerName: staff.name,
    })
    .from(customers)
    .leftJoin(branches, eq(customers.branchId, branches.id))
    .leftJoin(staff, eq(customers.ownerId, staff.id))
    .where(and(...customerScopeConditions(actor), eq(customers.id, customerId)))
    .get();

  if (!row) {
    return null;
  }

  const interactionRows = db
    .select({
      id: customerInteractions.id,
      type: customerInteractions.type,
      content: customerInteractions.content,
      occurredAt: customerInteractions.occurredAt,
      createdByName: staff.name,
    })
    .from(customerInteractions)
    .leftJoin(staff, eq(customerInteractions.createdBy, staff.id))
    .where(
      and(
        eq(customerInteractions.tenantId, actor.tenantId),
        eq(customerInteractions.customerId, customerId),
      ),
    )
    .orderBy(desc(customerInteractions.occurredAt))
    .all();

  const recentOrders = db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      total: orders.total,
      paid: orders.paid,
      remaining: orders.remaining,
      scheduledAt: orders.scheduledAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, actor.tenantId),
        eq(orders.customerId, customerId),
        isNull(orders.archivedAt),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(10)
    .all();

  const stats = db
    .select({
      orderCount: count(),
      total: sum(orders.total),
      paid: sum(orders.paid),
      remaining: sum(orders.remaining),
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, actor.tenantId),
        eq(orders.customerId, customerId),
        isNull(orders.archivedAt),
        ne(orders.status, "cancelled"),
      ),
    )
    .get();

  const lastOrder = db
    .select({ createdAt: orders.createdAt })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, actor.tenantId),
        eq(orders.customerId, customerId),
        isNull(orders.archivedAt),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1)
    .get();

  const orderCount = stats?.orderCount ?? 0;
  const ltv = Number(stats?.total ?? 0);
  const totalPaid = Number(stats?.paid ?? 0);
  const debt = Number(stats?.remaining ?? 0);

  return {
    ...customerListRow(row),
    address: row.customer.address,
    birthday: row.customer.birthday,
    measurements: safeJson<Record<string, string>>(row.customer.measurements, {}),
    notes: row.customer.notes,
    interactions: interactionRows,
    orders: recentOrders,
    metrics: {
      ltv,
      totalPaid,
      debt,
      orderCount,
      averageOrderValue: orderCount > 0 ? Math.round(ltv / orderCount) : 0,
      lastOrderAt: lastOrder?.createdAt ?? null,
    },
  };
}

function buildMeasurements(input: CustomerCreateData): string {
  return JSON.stringify({
    heightCm: input.heightCm,
    dressSize: input.dressSize,
    shoeSize: input.shoeSize,
    note: input.measurementsNote,
  });
}

export function createCustomer(
  db: AppDb,
  actor: ActorContext,
  input: CustomerCreateData,
): string {
  assertPermission(actor, "customers.manage");
  assertBranchAccess(actor, input.branchId);

  const phone = normalizeVietnamesePhone(input.phone);
  if (!phone) {
    throw new ValidationError("Số điện thoại không hợp lệ.");
  }

  const email = input.email?.trim().toLowerCase() || null;
  const duplicate = db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, actor.tenantId), eq(customers.phone, phone)))
    .get();

  if (duplicate) {
    throw new ValidationError("Số điện thoại đã tồn tại trong studio.");
  }

  assertOwnerInTenant(db, actor, input.ownerId || null);
  const followUpAt = parseOptionalDate(input.followUpAt, "Ngày follow-up");
  const customerId = crypto.randomUUID();

  db.insert(customers)
    .values({
      id: customerId,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      phone,
      email,
      address: input.address?.trim() || null,
      birthday: input.birthday?.trim() || null,
      measurements: buildMeasurements(input),
      source: input.source,
      tier: input.tier,
      status: input.status,
      tags: JSON.stringify(input.tags),
      ownerId: input.ownerId || null,
      followUpAt,
      notes: input.notes?.trim() || null,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "customers.create",
    entity: "customer",
    entityId: customerId,
    metadata: { phone, branchId: input.branchId, status: input.status },
  });

  return customerId;
}

export function updateCustomer(
  db: AppDb,
  actor: ActorContext,
  customerId: string,
  input: CustomerUpdateData,
): void {
  assertPermission(actor, "customers.manage");
  assertBranchAccess(actor, input.branchId);

  const existing = db
    .select({ id: customers.id, phone: customers.phone })
    .from(customers)
    .where(
      and(
        ...customerScopeConditions(actor),
        eq(customers.id, customerId),
      ),
    )
    .get();

  if (!existing) {
    throw new NotFoundError("Không tìm thấy khách hàng.");
  }

  const phone = normalizeVietnamesePhone(input.phone);
  if (!phone) {
    throw new ValidationError("Số điện thoại không hợp lệ.");
  }

  const duplicate = db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, actor.tenantId),
        eq(customers.phone, phone),
        ne(customers.id, customerId),
      ),
    )
    .get();

  if (duplicate) {
    throw new ValidationError("Số điện thoại đã thuộc khách hàng khác.");
  }

  assertOwnerInTenant(db, actor, input.ownerId || null);
  const followUpAt = parseOptionalDate(input.followUpAt, "Ngày follow-up");

  db.update(customers)
    .set({
      branchId: input.branchId,
      name: input.name.trim(),
      phone,
      email: input.email?.trim().toLowerCase() || null,
      address: input.address?.trim() || null,
      birthday: input.birthday?.trim() || null,
      measurements: buildMeasurements(input),
      source: input.source,
      tier: input.tier,
      status: input.status,
      tags: JSON.stringify(input.tags),
      ownerId: input.ownerId || null,
      followUpAt,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "customers.update",
    entity: "customer",
    entityId: customerId,
    metadata: { phone, branchId: input.branchId, status: input.status },
  });
}

export function addCustomerInteraction(
  db: AppDb,
  actor: ActorContext,
  input: {
    customerId: string;
    type: "call" | "message" | "meeting" | "note" | "follow_up";
    content: string;
    occurredAt: string;
    followUpAt: string;
  },
): void {
  assertPermission(actor, "customers.manage");

  const customer = db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        ...customerScopeConditions(actor),
        eq(customers.id, input.customerId),
      ),
    )
    .get();

  if (!customer) {
    throw new NotFoundError("Không tìm thấy khách hàng.");
  }

  const occurredAt = parseOptionalDate(input.occurredAt, "Thời điểm tương tác") ?? new Date();
  const followUpAt = parseOptionalDate(input.followUpAt, "Ngày follow-up");

  db.transaction((tx) => {
    tx.insert(customerInteractions)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        customerId: input.customerId,
        type: input.type,
        content: input.content.trim(),
        occurredAt,
        createdBy: actor.staffId,
      })
      .run();

    tx.update(customers)
      .set({
        lastContactAt: occurredAt,
        ...(followUpAt ? { followUpAt } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(customers.id, input.customerId), eq(customers.tenantId, actor.tenantId)),
      )
      .run();
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "customers.interaction.create",
    entity: "customer",
    entityId: input.customerId,
    metadata: { type: input.type },
  });
}

export function customerFormDateTime(value: Date | null): string {
  return toDateTimeLocalValue(value);
}

export function customerCsvRows(
  db: AppDb,
  actor: ActorContext,
  filters: CustomerFilters,
): CustomerListItem[] {
  assertPermission(actor, "customers.view");
  return listCustomers(db, actor, { ...filters, page: 1, pageSize: 5000 }).items;
}

export function listCustomerOptions(
  db: AppDb,
  actor: ActorContext,
): { id: string; name: string; phone: string; branchId: string }[] {
  assertPermission(actor, "orders.view");
  const conditions = customerScopeConditions(actor);
  if (getBranchScope(actor).mode === "none") {
    return [];
  }

  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      branchId: customers.branchId,
    })
    .from(customers)
    .where(and(...conditions))
    .orderBy(asc(customers.name))
    .limit(500)
    .all();
}

export function ensureBranchAccess(actor: ActorContext, branchId: string): void {
  try {
    assertBranchAccess(actor, branchId);
  } catch {
    throw new AuthorizationError("Bạn không có quyền truy cập chi nhánh này.");
  }
}
