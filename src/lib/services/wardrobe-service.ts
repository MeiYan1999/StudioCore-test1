import { and, asc, count, desc, eq, like, ne, or, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  branches,
  customers,
  orderItems,
  orders,
  wardrobeItems,
  wardrobeRentals,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";
import { isSqliteBusy, sleep, withKeyedMutex } from "../concurrency/keyed-mutex";

export type WardrobeItemView = {
  id: string;
  branchId: string;
  branchName: string;
  sku: string;
  qrCode: string;
  name: string;
  size: string;
  color: string;
  status: string;
  rentalPrice: number;
  depositPrice: number;
  image: string | null;
};

export type RentalView = {
  id: string;
  wardrobeItemId: string;
  itemName: string;
  itemQr: string;
  orderId: string | null;
  orderCode: string | null;
  customerId: string | null;
  customerName: string | null;
  branchId: string;
  branchName: string;
  checkedOutAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  conditionOut: string;
  conditionIn: string | null;
  cleaningFee: number;
  damageFee: number;
  deposit: number;
  status: string;
  notes: string | null;
  overdue: boolean;
};

export type WardrobeItemDetail = WardrobeItemView & {
  notes: string | null;
  rentals: RentalView[];
};

export type WardrobeItemInput = {
  branchId: string;
  sku: string;
  qrCode: string;
  name: string;
  size: string;
  color: string;
  status: string;
  rentalPrice: number;
  depositPrice: number;
  image: string;
  notes: string;
};

export type RentalInput = {
  wardrobeItemId: string;
  orderId: string;
  dueAt: string;
  deposit: number;
  conditionOut: string;
  notes: string;
};

export type RentalReturnInput = {
  conditionIn: string;
  cleaningFee: number;
  damageFee: number;
  notes: string;
};

function itemScopeConditions(actor: ActorContext) {
  const scope = getBranchScope(actor);
  const conditions = [
    eq(wardrobeItems.tenantId, actor.tenantId),
  ];
  if (scope.mode === "branch") {
    conditions.push(eq(wardrobeItems.branchId, scope.branchId));
  }
  if (scope.mode === "none") {
    conditions.push(eq(wardrobeItems.id, "__scope_none__"));
  }
  return conditions;
}

export function listWardrobeItems(
  db: AppDb,
  actor: ActorContext,
  filters: { q?: string; status?: string; branchId?: string } = {},
): WardrobeItemView[] {
  assertPermission(actor, "schedule.view");
  const conditions = itemScopeConditions(actor);

  if (filters.branchId) {
    assertBranchAccess(actor, filters.branchId);
    conditions.push(eq(wardrobeItems.branchId, filters.branchId));
  }
  if (filters.status) {
    conditions.push(eq(wardrobeItems.status, filters.status));
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    const search = or(
      like(wardrobeItems.name, term),
      like(wardrobeItems.sku, term),
      like(wardrobeItems.qrCode, term),
    );
    if (search) {
      conditions.push(search);
    }
  }

  return db
    .select({
      id: wardrobeItems.id,
      branchId: wardrobeItems.branchId,
      branchName: branches.name,
      sku: wardrobeItems.sku,
      qrCode: wardrobeItems.qrCode,
      name: wardrobeItems.name,
      size: wardrobeItems.size,
      color: wardrobeItems.color,
      status: wardrobeItems.status,
      rentalPrice: wardrobeItems.rentalPrice,
      depositPrice: wardrobeItems.depositPrice,
      image: wardrobeItems.image,
    })
    .from(wardrobeItems)
    .leftJoin(branches, eq(wardrobeItems.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(asc(wardrobeItems.name))
    .all()
    .map((row) => ({
      ...row,
      branchName: row.branchName ?? "Không xác định",
    }));
}

function mapRental(row: {
  rental: typeof wardrobeRentals.$inferSelect;
  itemName: string | null;
  itemQr: string | null;
  orderCode: string | null;
  customerName: string | null;
  branchName: string | null;
}): RentalView {
  const now = new Date();
  return {
    id: row.rental.id,
    wardrobeItemId: row.rental.wardrobeItemId,
    itemName: row.itemName ?? "Không xác định",
    itemQr: row.itemQr ?? "",
    orderId: row.rental.orderId,
    orderCode: row.orderCode,
    customerId: row.rental.customerId,
    customerName: row.customerName,
    branchId: row.rental.branchId,
    branchName: row.branchName ?? "Không xác định",
    checkedOutAt: row.rental.checkedOutAt,
    dueAt: row.rental.dueAt,
    returnedAt: row.rental.returnedAt,
    conditionOut: row.rental.conditionOut,
    conditionIn: row.rental.conditionIn,
    cleaningFee: row.rental.cleaningFee,
    damageFee: row.rental.damageFee,
    deposit: row.rental.deposit,
    status: row.rental.status,
    notes: row.rental.notes,
    overdue:
      row.rental.status === "active" && row.rental.dueAt.getTime() < now.getTime(),
  };
}

export function getWardrobeItemDetail(
  db: AppDb,
  actor: ActorContext,
  itemId: string,
): WardrobeItemDetail | null {
  assertPermission(actor, "schedule.view");
  const row = db
    .select({
      item: wardrobeItems,
      branchName: branches.name,
    })
    .from(wardrobeItems)
    .leftJoin(branches, eq(wardrobeItems.branchId, branches.id))
    .where(and(...itemScopeConditions(actor), eq(wardrobeItems.id, itemId)))
    .get();

  if (!row) return null;

  const rentals = db
    .select({
      rental: wardrobeRentals,
      itemName: wardrobeItems.name,
      itemQr: wardrobeItems.qrCode,
      orderCode: orders.code,
      customerName: customers.name,
      branchName: branches.name,
    })
    .from(wardrobeRentals)
    .leftJoin(wardrobeItems, eq(wardrobeRentals.wardrobeItemId, wardrobeItems.id))
    .leftJoin(orders, eq(wardrobeRentals.orderId, orders.id))
    .leftJoin(customers, eq(wardrobeRentals.customerId, customers.id))
    .leftJoin(branches, eq(wardrobeRentals.branchId, branches.id))
    .where(
      and(
        eq(wardrobeRentals.tenantId, actor.tenantId),
        eq(wardrobeRentals.wardrobeItemId, itemId),
      ),
    )
    .orderBy(desc(wardrobeRentals.checkedOutAt))
    .all()
    .map(mapRental);

  return {
    id: row.item.id,
    branchId: row.item.branchId,
    branchName: row.branchName ?? "Không xác định",
    sku: row.item.sku,
    qrCode: row.item.qrCode,
    name: row.item.name,
    size: row.item.size,
    color: row.item.color,
    status: row.item.status,
    rentalPrice: row.item.rentalPrice,
    depositPrice: row.item.depositPrice,
    image: row.item.image,
    notes: row.item.notes,
    rentals,
  };
}

export function createWardrobeItem(
  db: AppDb,
  actor: ActorContext,
  input: WardrobeItemInput,
): string {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);
  const sku = input.sku.trim().toUpperCase();
  const qrCode = input.qrCode.trim().toUpperCase() || `QR-${sku}`;

  const duplicateSku = db
    .select({ id: wardrobeItems.id })
    .from(wardrobeItems)
    .where(and(eq(wardrobeItems.tenantId, actor.tenantId), eq(wardrobeItems.sku, sku)))
    .get();
  if (duplicateSku) {
    throw new ValidationError("SKU trang phục đã tồn tại.");
  }
  const duplicateQr = db
    .select({ id: wardrobeItems.id })
    .from(wardrobeItems)
    .where(and(eq(wardrobeItems.tenantId, actor.tenantId), eq(wardrobeItems.qrCode, qrCode)))
    .get();
  if (duplicateQr) {
    throw new ValidationError("Mã QR trang phục đã tồn tại.");
  }

  const id = crypto.randomUUID();
  db.insert(wardrobeItems)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      sku,
      qrCode,
      name: input.name.trim(),
      size: input.size.trim(),
      color: input.color.trim(),
      status: input.status,
      rentalPrice: input.rentalPrice,
      depositPrice: input.depositPrice,
      image: input.image.trim() || null,
      notes: input.notes.trim() || null,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "wardrobe.item.create",
    entity: "wardrobe_item",
    entityId: id,
    metadata: { sku, qrCode, branchId: input.branchId },
  });

  return id;
}

export function updateWardrobeItem(
  db: AppDb,
  actor: ActorContext,
  itemId: string,
  input: WardrobeItemInput,
): void {
  assertPermission(actor, "schedule.manage");
  assertBranchAccess(actor, input.branchId);
  const item = db
    .select({ id: wardrobeItems.id })
    .from(wardrobeItems)
    .where(
      and(
        eq(wardrobeItems.id, itemId),
        eq(wardrobeItems.tenantId, actor.tenantId),
      ),
    )
    .get();
  if (!item) throw new NotFoundError("Không tìm thấy trang phục.");

  const sku = input.sku.trim().toUpperCase();
  const qrCode = input.qrCode.trim().toUpperCase() || `QR-${sku}`;
  const duplicateSku = db
    .select({ id: wardrobeItems.id })
    .from(wardrobeItems)
    .where(
      and(
        eq(wardrobeItems.tenantId, actor.tenantId),
        eq(wardrobeItems.sku, sku),
        ne(wardrobeItems.id, itemId),
      ),
    )
    .get();
  if (duplicateSku) throw new ValidationError("SKU trang phục đã tồn tại.");
  const duplicateQr = db
    .select({ id: wardrobeItems.id })
    .from(wardrobeItems)
    .where(
      and(
        eq(wardrobeItems.tenantId, actor.tenantId),
        eq(wardrobeItems.qrCode, qrCode),
        ne(wardrobeItems.id, itemId),
      ),
    )
    .get();
  if (duplicateQr) throw new ValidationError("Mã QR trang phục đã tồn tại.");

  db.update(wardrobeItems)
    .set({
      branchId: input.branchId,
      sku,
      qrCode,
      name: input.name.trim(),
      size: input.size.trim(),
      color: input.color.trim(),
      status: input.status,
      rentalPrice: input.rentalPrice,
      depositPrice: input.depositPrice,
      image: input.image.trim() || null,
      notes: input.notes.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(wardrobeItems.id, itemId), eq(wardrobeItems.tenantId, actor.tenantId)),
    )
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "wardrobe.item.update",
    entity: "wardrobe_item",
    entityId: itemId,
    metadata: { sku, qrCode, branchId: input.branchId, status: input.status },
  });
}

export async function createRental(
  db: AppDb,
  actor: ActorContext,
  input: RentalInput,
): Promise<string> {
  assertPermission(actor, "schedule.manage");

  const item = db
    .select()
    .from(wardrobeItems)
    .where(
      and(
        eq(wardrobeItems.id, input.wardrobeItemId),
        eq(wardrobeItems.tenantId, actor.tenantId),
      ),
    )
    .get();
  if (!item) throw new NotFoundError("Không tìm thấy trang phục.");
  assertBranchAccess(actor, item.branchId);
  if (item.status !== "available") {
    throw new ValidationError("Trang phục không ở trạng thái sẵn sàng.");
  }

  const dueAt = parseVietnamDateTimeLocal(input.dueAt);
  if (!dueAt || dueAt <= new Date()) {
    throw new ValidationError("Hạn trả không hợp lệ.");
  }
  if (input.deposit < 0 || !Number.isInteger(input.deposit)) {
    throw new ValidationError("Tiền cọc không hợp lệ.");
  }
  if (!["good", "cleaning", "damaged"].includes(input.conditionOut)) {
    throw new ValidationError("Tình trạng xuất kho không hợp lệ.");
  }

  let orderId: string | null = null;
  let customerId: string | null = null;
  if (input.orderId) {
    const order = db
      .select({
        id: orders.id,
        branchId: orders.branchId,
        customerId: orders.customerId,
        status: orders.status,
      })
      .from(orders)
      .where(
        and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.tenantId)),
      )
      .get();
    if (!order) throw new ValidationError("Đơn hàng không hợp lệ.");
    if (order.branchId !== item.branchId) {
      throw new ValidationError("Đơn hàng không thuộc chi nhánh của trang phục.");
    }
    if (order.status === "cancelled") {
      throw new ValidationError("Không thể cho thuê cho đơn đã hủy.");
    }
    orderId = order.id;
    customerId = order.customerId;
  }

  return withKeyedMutex([`wardrobe:${item.id}`], async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const rentalId = crypto.randomUUID();
        db.transaction(
          (tx) => {
            const current = tx
              .select({ status: wardrobeItems.status })
              .from(wardrobeItems)
              .where(
                and(
                  eq(wardrobeItems.id, item.id),
                  eq(wardrobeItems.tenantId, actor.tenantId),
                ),
              )
              .get();
            if (!current || current.status !== "available") {
              throw new ValidationError("Trang phục vừa được cho thuê bởi giao dịch khác.");
            }

            tx.insert(wardrobeRentals)
              .values({
                id: rentalId,
                tenantId: actor.tenantId,
                branchId: item.branchId,
                wardrobeItemId: item.id,
                orderId,
                customerId,
                checkedOutAt: new Date(),
                dueAt,
                conditionOut: input.conditionOut,
                cleaningFee: 0,
                damageFee: 0,
                deposit: input.deposit,
                status: "active",
                notes: input.notes.trim() || null,
                createdBy: actor.staffId,
              })
              .run();

            tx.update(wardrobeItems)
              .set({ status: "rented", updatedAt: new Date() })
              .where(
                and(
                  eq(wardrobeItems.id, item.id),
                  eq(wardrobeItems.tenantId, actor.tenantId),
                ),
              )
              .run();
          },
          { behavior: "immediate" },
        );

        writeAudit(db, {
          tenantId: actor.tenantId,
          actorId: actor.staffId,
          action: "wardrobe.rental.create",
          entity: "wardrobe_rental",
          entityId: rentalId,
          metadata: {
            wardrobeItemId: item.id,
            orderId,
            deposit: input.deposit,
            dueAt: dueAt.toISOString(),
          },
        });

        return rentalId;
      } catch (error) {
        if (!isSqliteBusy(error) || attempt === 2) {
          throw error;
        }
        await sleep(60 * (attempt + 1));
      }
    }

    throw new ValidationError("Không thể tạo phiếu thuê. Vui lòng thử lại.");
  });
}

export function returnRental(
  db: AppDb,
  actor: ActorContext,
  rentalId: string,
  input: RentalReturnInput,
): { rentalId: string; totalFee: number } {
  assertPermission(actor, "schedule.manage");

  const row = db
    .select({
      rental: wardrobeRentals,
      itemName: wardrobeItems.name,
      itemBranchId: wardrobeItems.branchId,
    })
    .from(wardrobeRentals)
    .innerJoin(wardrobeItems, eq(wardrobeRentals.wardrobeItemId, wardrobeItems.id))
    .where(
      and(
        eq(wardrobeRentals.id, rentalId),
        eq(wardrobeRentals.tenantId, actor.tenantId),
      ),
    )
    .get();

  if (!row) throw new NotFoundError("Không tìm thấy phiếu thuê.");
  assertBranchAccess(actor, row.rental.branchId);
  if (row.rental.status !== "active") {
    throw new ValidationError("Phiếu thuê đã được trả hoặc đã hủy.");
  }
  if (!["good", "cleaning", "damaged"].includes(input.conditionIn)) {
    throw new ValidationError("Tình trạng nhận lại không hợp lệ.");
  }
  if (
    input.cleaningFee < 0 ||
    input.damageFee < 0 ||
    !Number.isInteger(input.cleaningFee) ||
    !Number.isInteger(input.damageFee)
  ) {
    throw new ValidationError("Phí giặt/đền bù không hợp lệ.");
  }
  if (input.conditionIn === "good" && (input.cleaningFee > 0 || input.damageFee > 0)) {
    throw new ValidationError("Tình trạng tốt không thể thu phí giặt/đền bù.");
  }
  if (input.conditionIn === "cleaning" && input.damageFee > 0) {
    throw new ValidationError("Chỉ thu phí giặt khi trang phục cần giặt.");
  }

  const totalFee = input.cleaningFee + input.damageFee;
  const now = new Date();
  const itemStatus =
    input.conditionIn === "damaged"
      ? "maintenance"
      : input.conditionIn === "cleaning"
        ? "cleaning"
        : "available";

  db.transaction(
    (tx) => {
      tx.update(wardrobeRentals)
        .set({
          returnedAt: now,
          conditionIn: input.conditionIn,
          cleaningFee: input.cleaningFee,
          damageFee: input.damageFee,
          status: "returned",
          notes: input.notes.trim() || row.rental.notes,
          updatedAt: now,
        })
        .where(
          and(
            eq(wardrobeRentals.id, rentalId),
            eq(wardrobeRentals.tenantId, actor.tenantId),
          ),
        )
        .run();

      tx.update(wardrobeItems)
        .set({ status: itemStatus, updatedAt: now })
        .where(
          and(
            eq(wardrobeItems.id, row.rental.wardrobeItemId),
            eq(wardrobeItems.tenantId, actor.tenantId),
          ),
        )
        .run();

      if (totalFee > 0 && row.rental.orderId) {
        const order = tx
          .select({ id: orders.id, status: orders.status })
          .from(orders)
          .where(
            and(
              eq(orders.id, row.rental.orderId),
              eq(orders.tenantId, actor.tenantId),
            ),
          )
          .get();

        if (order && order.status !== "cancelled") {
          const itemCount =
            tx
              .select({ value: count() })
              .from(orderItems)
              .where(
                and(
                  eq(orderItems.tenantId, actor.tenantId),
                  eq(orderItems.orderId, order.id),
                ),
              )
              .get()?.value ?? 0;

          tx.insert(orderItems)
            .values({
              id: crypto.randomUUID(),
              tenantId: actor.tenantId,
              orderId: order.id,
              itemType: "custom",
              refId: rentalId,
              name: "Phí giặt / đền bù trang phục",
              quantity: 1,
              unitPrice: totalFee,
              total: totalFee,
              sortOrder: itemCount + 1,
            })
            .run();

          tx.update(orders)
            .set({
              subtotal: sql`${orders.subtotal} + ${totalFee}`,
              total: sql`${orders.total} + ${totalFee}`,
              remaining: sql`${orders.remaining} + ${totalFee}`,
              updatedAt: now,
            })
            .where(
              and(eq(orders.id, order.id), eq(orders.tenantId, actor.tenantId)),
            )
            .run();
        }
      }
    },
    { behavior: "immediate" },
  );

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "wardrobe.rental.return",
    entity: "wardrobe_rental",
    entityId: rentalId,
    metadata: {
      conditionIn: input.conditionIn,
      cleaningFee: input.cleaningFee,
      damageFee: input.damageFee,
      totalFee,
      itemStatus,
    },
  });

  return { rentalId, totalFee };
}

export function listRentals(
  db: AppDb,
  actor: ActorContext,
  filters: { status?: string; q?: string } = {},
): RentalView[] {
  assertPermission(actor, "schedule.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];

  const conditions = [eq(wardrobeRentals.tenantId, actor.tenantId)];
  if (scope.mode === "branch") {
    conditions.push(eq(wardrobeRentals.branchId, scope.branchId));
  }
  if (filters.status) {
    conditions.push(eq(wardrobeRentals.status, filters.status));
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    const search = or(
      like(wardrobeItems.name, term),
      like(wardrobeItems.qrCode, term),
      like(orders.code, term),
      like(customers.name, term),
    );
    if (search) conditions.push(search);
  }

  return db
    .select({
      rental: wardrobeRentals,
      itemName: wardrobeItems.name,
      itemQr: wardrobeItems.qrCode,
      orderCode: orders.code,
      customerName: customers.name,
      branchName: branches.name,
    })
    .from(wardrobeRentals)
    .leftJoin(wardrobeItems, eq(wardrobeRentals.wardrobeItemId, wardrobeItems.id))
    .leftJoin(orders, eq(wardrobeRentals.orderId, orders.id))
    .leftJoin(customers, eq(wardrobeRentals.customerId, customers.id))
    .leftJoin(branches, eq(wardrobeRentals.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(desc(wardrobeRentals.checkedOutAt))
    .all()
    .map(mapRental);
}

export function activeRentalForItem(
  db: AppDb,
  actor: ActorContext,
  itemId: string,
): RentalView | null {
  assertPermission(actor, "schedule.view");
  const row = db
    .select({
      rental: wardrobeRentals,
      itemName: wardrobeItems.name,
      itemQr: wardrobeItems.qrCode,
      orderCode: orders.code,
      customerName: customers.name,
      branchName: branches.name,
    })
    .from(wardrobeRentals)
    .leftJoin(wardrobeItems, eq(wardrobeRentals.wardrobeItemId, wardrobeItems.id))
    .leftJoin(orders, eq(wardrobeRentals.orderId, orders.id))
    .leftJoin(customers, eq(wardrobeRentals.customerId, customers.id))
    .leftJoin(branches, eq(wardrobeRentals.branchId, branches.id))
    .where(
      and(
        eq(wardrobeRentals.tenantId, actor.tenantId),
        eq(wardrobeRentals.wardrobeItemId, itemId),
        eq(wardrobeRentals.status, "active"),
      ),
    )
    .get();
  return row ? mapRental(row) : null;
}
