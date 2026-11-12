import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  like,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  branches,
  customers,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  products,
  serviceAddons,
  services,
  staff,
  staffBranches,
  transactions,
  vouchers,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import {
  assertBranchAccess,
  assertPermission,
  getBranchScope,
  hasPermission,
} from "../auth/permissions";
import type { OrderStatus } from "../orders/status";
import { canTransitionOrder } from "../orders/status";
import { accrueCommissionsForOrderSystem } from "./commission-payroll-service";
import { queueReviewRequest } from "./notification-service";
import {
  calculateOrderTotals,
  calculateRemaining,
  type VoucherRule,
} from "../orders/totals";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { normalizeVietnamesePhone } from "../utils/phone";
import { parseVietnamDateTimeLocal } from "../utils";

export type OrderItemInput = {
  itemType: "service" | "addon" | "product" | "custom";
  refId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type OrderCreateData = {
  customerMode: "existing" | "new";
  customerId: string;
  customerName: string;
  customerPhone: string;
  branchId: string;
  scheduledAt: string;
  location: string;
  photographerId: string | null;
  editorId: string | null;
  makeupId: string | null;
  items: OrderItemInput[];
  surcharge: number;
  discount: number;
  voucherCode: string;
  deposit: number;
  depositMethod: string;
  notes: string;
};

export type OrderListFilters = {
  q?: string;
  status?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
};

export type OrderListItem = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  branchName: string;
  status: OrderStatus;
  total: number;
  paid: number;
  remaining: number;
  scheduledAt: Date | null;
  createdAt: Date;
};

export type OrderItemView = {
  id: string;
  itemType: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sortOrder: number;
};

export type OrderPaymentView = {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  paidAt: Date;
  createdAt: Date;
  createdByName: string | null;
};

export type OrderHistoryView = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  changedByName: string | null;
  createdAt: Date;
};

export type OrderDetail = {
  id: string;
  tenantId: string;
  branchId: string;
  branchName: string;
  code: string;
  status: OrderStatus;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    branchId: string;
  };
  photographer: { id: string; name: string } | null;
  editor: { id: string; name: string } | null;
  makeup: { id: string; name: string } | null;
  scheduledAt: Date | null;
  location: string | null;
  subtotal: number;
  surcharge: number;
  discount: number;
  voucherCode: string | null;
  voucherDiscount: number;
  total: number;
  deposit: number;
  paid: number;
  remaining: number;
  notes: string | null;
  cancelReason: string | null;
  contractConfirmedAt: Date | null;
  contractConfirmedBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  scheduleOverdue: boolean;
  upcoming: boolean;
  items: OrderItemView[];
  payments: OrderPaymentView[];
  history: OrderHistoryView[];
};

function orderScopeConditions(actor: ActorContext): SQL[] {
  const scope = getBranchScope(actor);
  const conditions: SQL[] = [
    eq(orders.tenantId, actor.tenantId),
    isNull(orders.archivedAt),
  ];
  if (scope.mode === "branch") {
    conditions.push(eq(orders.branchId, scope.branchId));
  }
  if (scope.mode === "none") {
    conditions.push(eq(orders.id, "__scope_none__"));
  }
  return conditions;
}

function buildOrderConditions(actor: ActorContext, filters: OrderListFilters): SQL[] {
  const scope = getBranchScope(actor);
  const conditions = orderScopeConditions(actor);

  if (scope.mode === "none") {
    return conditions;
  }

  if (filters.branchId) {
    assertBranchAccess(actor, filters.branchId);
    conditions.push(eq(orders.branchId, filters.branchId));
  }
  if (filters.status) {
    conditions.push(eq(orders.status, filters.status as OrderStatus));
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    const search = or(
      like(orders.code, term),
      like(customers.name, term),
      like(customers.phone, term),
    );
    if (search) {
      conditions.push(search);
    }
  }

  return conditions;
}

export function listOrders(
  db: AppDb,
  actor: ActorContext,
  filters: OrderListFilters,
): { items: OrderListItem[]; total: number; page: number; pageSize: number } {
  assertPermission(actor, "orders.view");
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const conditions = buildOrderConditions(actor, filters);
  const where = and(...conditions);

  const total =
    db
      .select({ value: count() })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(where)
      .get()?.value ?? 0;

  const rows = db
    .select({
      id: orders.id,
      code: orders.code,
      customerName: customers.name,
      customerPhone: customers.phone,
      branchName: branches.name,
      status: orders.status,
      total: orders.total,
      paid: orders.paid,
      remaining: orders.remaining,
      scheduledAt: orders.scheduledAt,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(branches, eq(orders.branchId, branches.id))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()
    .map((row) => ({
      ...row,
      branchName: row.branchName ?? "Không xác định",
    }));

  return { items: rows, total, page, pageSize };
}

function getAssigneeName(
  db: AppDb,
  tenantId: string,
  staffId: string | null,
): { id: string; name: string } | null {
  if (!staffId) {
    return null;
  }
  const row = db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.tenantId, tenantId)))
    .get();
  return row ?? null;
}

export function getOrderDetail(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
): OrderDetail | null {
  assertPermission(actor, "orders.view");

  const row = db
    .select({
      order: orders,
      customer: customers,
      branchName: branches.name,
      createdByName: staff.name,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(branches, eq(orders.branchId, branches.id))
    .leftJoin(staff, eq(orders.createdBy, staff.id))
    .where(and(...orderScopeConditions(actor), eq(orders.id, orderId)))
    .get();

  if (!row) {
    return null;
  }

  const itemRows = db
    .select({
      id: orderItems.id,
      itemType: orderItems.itemType,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
      sortOrder: orderItems.sortOrder,
    })
    .from(orderItems)
    .where(
      and(eq(orderItems.tenantId, actor.tenantId), eq(orderItems.orderId, orderId)),
    )
    .orderBy(asc(orderItems.sortOrder))
    .all();

  const paymentRows = db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      status: payments.status,
      reference: payments.reference,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
      createdByName: staff.name,
    })
    .from(payments)
    .leftJoin(staff, eq(payments.createdBy, staff.id))
    .where(
      and(eq(payments.tenantId, actor.tenantId), eq(payments.orderId, orderId)),
    )
    .orderBy(desc(payments.paidAt))
    .all();

  const historyRows = db
    .select({
      id: orderStatusHistory.id,
      fromStatus: orderStatusHistory.fromStatus,
      toStatus: orderStatusHistory.toStatus,
      note: orderStatusHistory.note,
      changedByName: staff.name,
      createdAt: orderStatusHistory.createdAt,
    })
    .from(orderStatusHistory)
    .leftJoin(staff, eq(orderStatusHistory.changedBy, staff.id))
    .where(
      and(
        eq(orderStatusHistory.tenantId, actor.tenantId),
        eq(orderStatusHistory.orderId, orderId),
      ),
    )
    .orderBy(desc(orderStatusHistory.createdAt))
    .all();

  const confirmedBy = row.order.contractConfirmedBy
    ? getAssigneeName(db, actor.tenantId, row.order.contractConfirmedBy)
    : null;

  const now = new Date();
  const activeProduction = !["delivered", "completed", "cancelled"].includes(
    row.order.status,
  );
  const scheduleOverdue =
    activeProduction &&
    row.order.scheduledAt !== null &&
    row.order.scheduledAt.getTime() < now.getTime();
  const upcoming =
    activeProduction &&
    row.order.scheduledAt !== null &&
    row.order.scheduledAt.getTime() >= now.getTime() &&
    row.order.scheduledAt.getTime() <= now.getTime() + 7 * 24 * 60 * 60 * 1000;

  return {
    id: row.order.id,
    tenantId: row.order.tenantId,
    branchId: row.order.branchId,
    branchName: row.branchName ?? "Không xác định",
    code: row.order.code,
    status: row.order.status,
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      phone: row.customer.phone,
      email: row.customer.email,
      address: row.customer.address,
      branchId: row.customer.branchId,
    },
    photographer: getAssigneeName(db, actor.tenantId, row.order.photographerId),
    editor: getAssigneeName(db, actor.tenantId, row.order.editorId),
    makeup: getAssigneeName(db, actor.tenantId, row.order.makeupId),
    scheduledAt: row.order.scheduledAt,
    location: row.order.location,
    subtotal: row.order.subtotal,
    surcharge: row.order.surcharge,
    discount: row.order.discount,
    voucherCode: row.order.voucherCode,
    voucherDiscount: row.order.voucherDiscount,
    total: row.order.total,
    deposit: row.order.deposit,
    paid: row.order.paid,
    remaining: row.order.remaining,
    notes: row.order.notes,
    cancelReason: row.order.cancelReason,
    contractConfirmedAt: row.order.contractConfirmedAt,
    contractConfirmedBy: confirmedBy?.name ?? null,
    createdByName: row.createdByName,
    createdAt: row.order.createdAt,
    updatedAt: row.order.updatedAt,
    scheduleOverdue,
    upcoming,
    items: itemRows,
    payments: paymentRows,
    history: historyRows,
  };
}

function generateOrderCode(db: AppDb): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `DH-${datePart}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const existing = db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.code, code))
      .get();
    if (!existing) {
      return code;
    }
  }

  throw new ValidationError("Không thể sinh mã đơn. Vui lòng thử lại.");
}

function resolveItems(
  db: AppDb,
  actor: ActorContext,
  branchId: string,
  items: OrderItemInput[],
): {
  items: {
    itemType: OrderItemInput["itemType"];
    refId: string | null;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sortOrder: number;
  }[];
} {
  if (items.length === 0) {
    throw new ValidationError("Đơn hàng phải có ít nhất một item.");
  }

  const resolved = items.map((item, index) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ValidationError("Số lượng item phải là số nguyên dương.");
    }

    if (item.itemType === "service") {
      if (!item.refId) throw new ValidationError("Dịch vụ không hợp lệ.");
      const service = db
        .select()
        .from(services)
        .where(
          and(
            eq(services.id, item.refId),
            eq(services.tenantId, actor.tenantId),
            eq(services.active, true),
          ),
        )
        .get();
      if (!service || service.branchId !== branchId) {
        throw new ValidationError("Dịch vụ không thuộc chi nhánh của đơn.");
      }
      return {
        itemType: "service" as const,
        refId: service.id,
        name: service.name,
        quantity: item.quantity,
        unitPrice: service.price,
        total: item.quantity * service.price,
        sortOrder: index + 1,
      };
    }

    if (item.itemType === "addon") {
      if (!item.refId) throw new ValidationError("Add-on không hợp lệ.");
      const addon = db
        .select({
          id: serviceAddons.id,
          name: serviceAddons.name,
          price: serviceAddons.price,
          active: serviceAddons.active,
          branchId: services.branchId,
          tenantId: serviceAddons.tenantId,
        })
        .from(serviceAddons)
        .innerJoin(services, eq(serviceAddons.serviceId, services.id))
        .where(
          and(
            eq(serviceAddons.id, item.refId),
            eq(serviceAddons.tenantId, actor.tenantId),
            eq(serviceAddons.active, true),
          ),
        )
        .get();
      if (!addon || addon.branchId !== branchId) {
        throw new ValidationError("Add-on không thuộc chi nhánh của đơn.");
      }
      return {
        itemType: "addon" as const,
        refId: addon.id,
        name: addon.name,
        quantity: item.quantity,
        unitPrice: addon.price,
        total: item.quantity * addon.price,
        sortOrder: index + 1,
      };
    }

    if (item.itemType === "product") {
      if (!item.refId) throw new ValidationError("Sản phẩm không hợp lệ.");
      const product = db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, item.refId),
            eq(products.tenantId, actor.tenantId),
            eq(products.status, "active"),
          ),
        )
        .get();
      if (!product) {
        throw new ValidationError("Sản phẩm không hợp lệ hoặc đã ngừng bán.");
      }
      return {
        itemType: "product" as const,
        refId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        total: item.quantity * product.price,
        sortOrder: index + 1,
      };
    }

    if (!item.name.trim() || item.unitPrice < 0) {
      throw new ValidationError("Item tự nhập cần tên và đơn giá hợp lệ.");
    }

    return {
      itemType: "custom" as const,
      refId: null,
      name: item.name.trim(),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
      sortOrder: index + 1,
    };
  });

  return { items: resolved };
}

function resolveAssignee(
  db: AppDb,
  actor: ActorContext,
  staffId: string | null,
  expectedRole: "photographer" | "retoucher" | "makeup",
  branchId: string,
): string | null {
  if (!staffId) {
    return null;
  }
  const row = db
    .select({ id: staff.id, role: staff.role })
    .from(staff)
    .innerJoin(staffBranches, eq(staffBranches.staffId, staff.id))
    .where(
      and(
        eq(staff.id, staffId),
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        isNull(staff.archivedAt),
        eq(staffBranches.branchId, branchId),
      ),
    )
    .get();

  if (!row || row.role !== expectedRole) {
    throw new ValidationError("Nhân sự được phân công không đúng vai trò hoặc chi nhánh.");
  }

  return row.id;
}

function resolveVoucher(
  db: AppDb,
  actor: ActorContext,
  code: string,
  branchId: string,
  subtotal: number,
): { id: string; code: string; rule: VoucherRule; usedCount: number } | null {
  if (!code.trim()) {
    return null;
  }

  const voucher = db
    .select()
    .from(vouchers)
    .where(and(eq(vouchers.tenantId, actor.tenantId), eq(vouchers.code, code.trim().toUpperCase())))
    .get();

  if (!voucher) {
    throw new ValidationError("Voucher không tồn tại.");
  }

  const now = new Date();
  if (!voucher.active) {
    throw new ValidationError("Voucher đang tạm ngưng.");
  }
  if (voucher.startsAt && voucher.startsAt > now) {
    throw new ValidationError("Voucher chưa đến thời gian áp dụng.");
  }
  if (voucher.endsAt && voucher.endsAt < now) {
    throw new ValidationError("Voucher đã hết hạn.");
  }
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
    throw new ValidationError("Voucher đã hết lượt sử dụng.");
  }
  if (voucher.branchId && voucher.branchId !== branchId) {
    throw new ValidationError("Voucher không áp dụng cho chi nhánh này.");
  }

  const rule: VoucherRule = {
    discountType: voucher.discountType,
    value: voucher.value,
    minOrder: voucher.minOrder,
    maxDiscount: voucher.maxDiscount,
  };

  if (subtotal < rule.minOrder) {
    throw new ValidationError("Đơn hàng chưa đạt giá trị tối thiểu của voucher.");
  }

  return { id: voucher.id, code: voucher.code, rule, usedCount: voucher.usedCount };
}

export function createOrder(
  db: AppDb,
  actor: ActorContext,
  input: OrderCreateData,
): string {
  assertPermission(actor, "orders.manage");
  assertBranchAccess(actor, input.branchId);

  if (!Number.isInteger(input.surcharge) || input.surcharge < 0) {
    throw new ValidationError("Phụ thu không hợp lệ.");
  }
  if (!Number.isInteger(input.discount) || input.discount < 0) {
    throw new ValidationError("Giảm giá không hợp lệ.");
  }

  const resolved = resolveItems(db, actor, input.branchId, input.items);
  const subtotal = resolved.items.reduce((sum, item) => sum + item.total, 0);
  const voucher = resolveVoucher(
    db,
    actor,
    input.voucherCode,
    input.branchId,
    subtotal,
  );
  const totals = calculateOrderTotals({
    items: resolved.items,
    surcharge: input.surcharge,
    discount: input.discount,
    voucher: voucher?.rule ?? null,
  });

  if (input.deposit < 0 || input.deposit > totals.total) {
    throw new ValidationError("Tiền cọc không hợp lệ.");
  }
  if (!["cash", "bank_transfer", "card", "ewallet"].includes(input.depositMethod)) {
    throw new ValidationError("Phương thức cọc không hợp lệ.");
  }

  const photographerId = resolveAssignee(
    db,
    actor,
    input.photographerId,
    "photographer",
    input.branchId,
  );
  const editorId = resolveAssignee(
    db,
    actor,
    input.editorId,
    "retoucher",
    input.branchId,
  );
  const makeupId = resolveAssignee(
    db,
    actor,
    input.makeupId,
    "makeup",
    input.branchId,
  );
  const scheduledAt = input.scheduledAt
    ? parseVietnamDateTimeLocal(input.scheduledAt)
    : null;
  if (input.scheduledAt && !scheduledAt) {
    throw new ValidationError("Lịch chụp không hợp lệ.");
  }

  let customerId = input.customerId;
  let newCustomer:
    | {
        id: string;
        name: string;
        phone: string;
      }
    | undefined;

  if (input.customerMode === "existing") {
    const customer = db
      .select({ id: customers.id, branchId: customers.branchId })
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.tenantId, actor.tenantId),
          isNull(customers.archivedAt),
        ),
      )
      .get();

    if (!customer) {
      throw new ValidationError("Khách hàng không hợp lệ.");
    }
    const scope = getBranchScope(actor);
    if (scope.mode === "branch" && customer.branchId !== scope.branchId) {
      throw new AuthorizationError("Khách hàng không thuộc chi nhánh được giao.");
    }
  } else {
    const name = input.customerName.trim();
    const phone = normalizeVietnamesePhone(input.customerPhone);
    if (!name || !phone) {
      throw new ValidationError("Tên và số điện thoại khách mới là bắt buộc.");
    }
    const duplicate = db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(eq(customers.tenantId, actor.tenantId), eq(customers.phone, phone)),
      )
      .get();
    if (duplicate) {
      throw new ValidationError(
        "Số điện thoại đã tồn tại. Hãy chọn khách hàng có sẵn.",
      );
    }
    customerId = crypto.randomUUID();
    newCustomer = { id: customerId, name, phone };
  }

  const orderId = crypto.randomUUID();
  const code = generateOrderCode(db);
  const status: OrderStatus = input.deposit > 0 ? "deposit_received" : "new";
  const paid = input.deposit;
  const remaining = calculateRemaining(totals.total, paid);
  const now = new Date();

  db.transaction((tx) => {
    if (newCustomer) {
      tx.insert(customers)
        .values({
          id: newCustomer.id,
          tenantId: actor.tenantId,
          branchId: input.branchId,
          name: newCustomer.name,
          phone: newCustomer.phone,
          status: "active",
          source: "walk_in",
          tier: "standard",
          tags: "[]",
          measurements: "{}",
          ownerId: actor.staffId,
        })
        .run();
    }

    tx.insert(orders)
      .values({
        id: orderId,
        tenantId: actor.tenantId,
        branchId: input.branchId,
        code,
        customerId,
        status,
        photographerId,
        editorId,
        makeupId,
        scheduledAt,
        location: input.location.trim() || null,
        subtotal: totals.subtotal,
        surcharge: input.surcharge,
        discount: input.discount,
        voucherId: voucher?.id ?? null,
        voucherCode: voucher?.code ?? null,
        voucherDiscount: totals.voucherDiscount,
        total: totals.total,
        deposit: input.deposit,
        paid,
        remaining,
        notes: input.notes.trim() || null,
        createdBy: actor.staffId,
      })
      .run();

    tx.insert(orderItems)
      .values(
        resolved.items.map((item) => ({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          orderId,
          itemType: item.itemType,
          refId: item.refId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          sortOrder: item.sortOrder,
        })),
      )
      .run();

    tx.insert(orderStatusHistory)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        orderId,
        fromStatus: null,
        toStatus: status,
        note: "Tạo đơn hàng.",
        changedBy: actor.staffId,
        createdAt: now,
      })
      .run();

    if (voucher) {
      tx.update(vouchers)
        .set({ usedCount: voucher.usedCount + 1 })
        .where(and(eq(vouchers.id, voucher.id), eq(vouchers.tenantId, actor.tenantId)))
        .run();
    }

    if (input.deposit > 0) {
      tx.insert(payments)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          orderId,
          amount: input.deposit,
          method: input.depositMethod,
          status: "completed",
          reference: `COC-${code}`,
          idempotencyKey: `order-${orderId}-deposit`,
          paidAt: now,
          createdBy: actor.staffId,
        })
        .run();
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "orders.create",
    entity: "order",
    entityId: orderId,
    metadata: {
      code,
      branchId: input.branchId,
      customerId,
      status,
      total: totals.total,
      deposit: input.deposit,
    },
  });

  return orderId;
}

export function changeOrderStatus(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
  toStatus: OrderStatus,
  note: string,
): void {
  assertPermission(actor, "orders.manage");

  const order = db
    .select({
      id: orders.id,
      status: orders.status,
      branchId: orders.branchId,
    })
    .from(orders)
    .where(and(...orderScopeConditions(actor), eq(orders.id, orderId)))
    .get();

  if (!order) {
    throw new NotFoundError("Không tìm thấy đơn hàng.");
  }
  if (!canTransitionOrder(order.status, toStatus)) {
    throw new ValidationError("Không thể chuyển sang trạng thái này.");
  }
  if (toStatus === "cancelled" && !note.trim()) {
    throw new ValidationError("Vui lòng nhập lý do hủy đơn.");
  }

  const now = new Date();
  db.transaction((tx) => {
    tx.update(orders)
      .set({
        status: toStatus,
        cancelReason: toStatus === "cancelled" ? note.trim() : undefined,
        updatedAt: now,
      })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.tenantId)))
      .run();

    tx.insert(orderStatusHistory)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        orderId,
        fromStatus: order.status,
        toStatus,
        note: note.trim() || null,
        changedBy: actor.staffId,
        createdAt: now,
      })
      .run();
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "orders.status.change",
    entity: "order",
    entityId: orderId,
    metadata: { from: order.status, to: toStatus, note: note.trim() },
  });

  if (toStatus === "completed") {
    accrueCommissionsForOrderSystem(db, orderId, new Date());
    queueReviewRequest(db, orderId, actor.staffId);
  }
}

export function canRecordPayment(actor: ActorContext): boolean {
  return (
    hasPermission(actor.permissions, "orders.manage") ||
    hasPermission(actor.permissions, "finance.manage")
  );
}

export function recordOrderPayment(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
  input: {
    amount: number;
    method: string;
    reference: string;
    paidAt: string;
  },
): string {
  const inboxBooking = db.get(sql`SELECT id FROM inbox_bookings WHERE order_id=${orderId} AND tenant_id=${actor.tenantId}`);
  if (inboxBooking && !actor.permissions.includes("finance.manage")) throw new AuthorizationError("Cần quyền xác nhận cọc tài chính.");
  if (!canRecordPayment(actor)) {
    throw new AuthorizationError("Bạn không có quyền ghi nhận thanh toán.");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new ValidationError("Số tiền thanh toán không hợp lệ.");
  }
  if (!["cash", "bank_transfer", "card", "ewallet"].includes(input.method)) {
    throw new ValidationError("Phương thức thanh toán không hợp lệ.");
  }

  const order = db
    .select({
      id: orders.id,
      status: orders.status,
      total: orders.total,
      paid: orders.paid,
      remaining: orders.remaining,
      branchId: orders.branchId,
      customerId: orders.customerId,
    })
    .from(orders)
    .where(and(...orderScopeConditions(actor), eq(orders.id, orderId)))
    .get();

  if (!order) {
    throw new NotFoundError("Không tìm thấy đơn hàng.");
  }
  if (order.status === "cancelled") {
    throw new ValidationError("Không thể thu tiền đơn đã hủy.");
  }
  if (order.remaining <= 0) {
    throw new ValidationError("Đơn hàng đã thu đủ.");
  }
  if (input.amount > order.remaining) {
    throw new ValidationError("Số tiền vượt quá công nợ còn lại.");
  }

  const paidAt = input.paidAt
    ? parseVietnamDateTimeLocal(input.paidAt)
    : new Date();
  if (!paidAt) {
    throw new ValidationError("Thời điểm thanh toán không hợp lệ.");
  }

  const paymentId = crypto.randomUUID();
  const newPaid = order.paid + input.amount;
  const newRemaining = calculateRemaining(order.total, newPaid);
  const statusAfter =
    order.status === "new" ? ("deposit_received" as OrderStatus) : order.status;

  db.transaction((tx) => {
    tx.insert(payments)
      .values({
        id: paymentId,
        tenantId: actor.tenantId,
        orderId,
        amount: input.amount,
        method: input.method,
        status: "completed",
        reference: input.reference.trim() || null,
        idempotencyKey: crypto.randomUUID(),
        paidAt,
        createdBy: actor.staffId,
      })
      .run();

    tx.insert(transactions)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        branchId: order.branchId,
        type: "income",
        category: "order_payment",
        amount: input.amount,
        orderId,
        customerId: order.customerId,
        staffId: actor.staffId,
        method: input.method,
        description: `Thu tiền đơn ${orderId.slice(0, 8)}`,
        reference: input.reference.trim() || null,
        idempotencyKey: `payment:${paymentId}`,
        occurredAt: paidAt,
        createdBy: actor.staffId,
      })
      .run();

    tx.update(orders)
      .set({
        paid: newPaid,
        remaining: newRemaining,
        status: statusAfter,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.tenantId)))
      .run();

    tx.run(sql`UPDATE inbox_bookings SET status='confirmed' WHERE order_id=${orderId} AND tenant_id=${actor.tenantId} AND status='held' AND expires_at>${Date.now()} AND (SELECT paid >= deposit FROM orders WHERE id=${orderId})`);

    if (statusAfter !== order.status) {
      tx.insert(orderStatusHistory)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          orderId,
          fromStatus: order.status,
          toStatus: statusAfter,
          note: "Ghi nhận thanh toán.",
          changedBy: actor.staffId,
          createdAt: new Date(),
        })
        .run();
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "orders.payment.record",
    entity: "payment",
    entityId: paymentId,
    metadata: { orderId, amount: input.amount, method: input.method },
  });

  return paymentId;
}

export function confirmOrderContract(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
): void {
  assertPermission(actor, "orders.manage");

  const order = db
    .select({ id: orders.id, contractConfirmedAt: orders.contractConfirmedAt })
    .from(orders)
    .where(and(...orderScopeConditions(actor), eq(orders.id, orderId)))
    .get();

  if (!order) {
    throw new NotFoundError("Không tìm thấy đơn hàng.");
  }
  if (order.contractConfirmedAt) {
    return;
  }

  db.update(orders)
    .set({
      contractConfirmedAt: new Date(),
      contractConfirmedBy: actor.staffId,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "orders.contract.confirm",
    entity: "order",
    entityId: orderId,
  });
}

export function listOrderHistoryForTenant(
  db: AppDb,
  actor: ActorContext,
  orderId: string,
): OrderHistoryView[] {
  assertPermission(actor, "orders.view");
  const detail = getOrderDetail(db, actor, orderId);
  return detail?.history ?? [];
}

export type AssigneeOption = {
  id: string;
  name: string;
  branchIds: string[];
};

export type OrderOption = {
  id: string;
  code: string;
  customerName: string;
  status: OrderStatus;
  branchId: string;
};

export function listOrderOptions(db: AppDb, actor: ActorContext): OrderOption[] {
  assertPermission(actor, "orders.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") {
    return [];
  }

  return db
    .select({
      id: orders.id,
      code: orders.code,
      customerName: customers.name,
      status: orders.status,
      branchId: orders.branchId,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        ...orderScopeConditions(actor),
        ne(orders.status, "cancelled"),
        ne(orders.status, "completed"),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(500)
    .all();
}

export function orderAssigneeOptions(
  db: AppDb,
  actor: ActorContext,
): {
  photographers: AssigneeOption[];
  editors: AssigneeOption[];
  makeup: AssigneeOption[];
} {
  assertPermission(actor, "orders.view");
  const allowedBranchIds = actor.branches.map((branch) => branch.id);
  if (allowedBranchIds.length === 0) {
    return { photographers: [], editors: [], makeup: [] };
  }

  const rows = db
    .select({
      id: staff.id,
      name: staff.name,
      role: staff.role,
      branchId: staffBranches.branchId,
    })
    .from(staff)
    .innerJoin(staffBranches, eq(staffBranches.staffId, staff.id))
    .where(
      and(
        eq(staff.tenantId, actor.tenantId),
        eq(staff.active, true),
        isNull(staff.archivedAt),
        inArray(staffBranches.branchId, allowedBranchIds),
      ),
    )
    .orderBy(asc(staff.name))
    .all();

  const grouped = new Map<string, AssigneeOption & { role: string }>();
  for (const row of rows) {
    const current = grouped.get(row.id);
    if (current) {
      if (!current.branchIds.includes(row.branchId)) {
        current.branchIds.push(row.branchId);
      }
    } else {
      grouped.set(row.id, {
        id: row.id,
        name: row.name,
        role: row.role,
        branchIds: [row.branchId],
      });
    }
  }

  const options = [...grouped.values()];
  return {
    photographers: options
      .filter((row) => row.role === "photographer")
      .map((row) => ({ id: row.id, name: row.name, branchIds: row.branchIds })),
    editors: options
      .filter((row) => row.role === "retoucher")
      .map((row) => ({ id: row.id, name: row.name, branchIds: row.branchIds })),
    makeup: options
      .filter((row) => row.role === "makeup")
      .map((row) => ({ id: row.id, name: row.name, branchIds: row.branchIds })),
  };
}

export function listOrderIdsForCustomer(
  db: AppDb,
  tenantId: string,
  customerId: string,
): string[] {
  return db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        eq(orders.customerId, customerId),
        isNull(orders.archivedAt),
      ),
    )
    .all()
    .map((row) => row.id);
}

export function orderItemsForIds(
  db: AppDb,
  tenantId: string,
  orderIds: string[],
): OrderItemView[] {
  if (orderIds.length === 0) return [];
  return db
    .select({
      id: orderItems.id,
      itemType: orderItems.itemType,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      total: orderItems.total,
      sortOrder: orderItems.sortOrder,
    })
    .from(orderItems)
    .where(
      and(eq(orderItems.tenantId, tenantId), inArray(orderItems.orderId, orderIds)),
    )
    .all();
}
