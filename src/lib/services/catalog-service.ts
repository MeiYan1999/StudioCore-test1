import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  branches,
  products,
  serviceAddons,
  services,
  vouchers,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import {
  assertBranchAccess,
  assertPermission,
  getBranchScope,
} from "../auth/permissions";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";

export type ServiceItem = {
  id: string;
  name: string;
  category: string;
  branchId: string;
  branchName: string;
  price: number;
  durationMinutes: number;
  description: string | null;
  active: boolean;
};

export type AddonItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  branchId: string;
  name: string;
  price: number;
  active: boolean;
};

export type ProductItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
};

export type VoucherItem = {
  id: string;
  code: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  discountType: "percent" | "fixed";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
};

export type ServiceInput = {
  name: string;
  category: string;
  branchId: string;
  price: number;
  durationMinutes: number;
  description: string;
  active: boolean;
};

export type AddonInput = {
  serviceId: string;
  name: string;
  price: number;
  active: boolean;
};

export type ProductInput = {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
};

export type VoucherInput = {
  code: string;
  name: string;
  branchId: string | null;
  discountType: "percent" | "fixed";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

function serviceScopeConditions(actor: ActorContext): SQL[] {
  const scope = getBranchScope(actor);
  const conditions: SQL[] = [eq(services.tenantId, actor.tenantId)];

  if (scope.mode === "branch") {
    conditions.push(eq(services.branchId, scope.branchId));
  }
  if (scope.mode === "none") {
    conditions.push(eq(services.id, "__scope_none__"));
  }

  return conditions;
}

export function listServices(db: AppDb, actor: ActorContext): ServiceItem[] {
  assertPermission(actor, "orders.view");

  return db
    .select({
      id: services.id,
      name: services.name,
      category: services.category,
      branchId: services.branchId,
      branchName: branches.name,
      price: services.price,
      durationMinutes: services.durationMinutes,
      description: services.description,
      active: services.active,
    })
    .from(services)
    .leftJoin(branches, eq(services.branchId, branches.id))
    .where(and(...serviceScopeConditions(actor)))
    .orderBy(asc(services.name))
    .all()
    .map((row) => ({
      ...row,
      branchName: row.branchName ?? "Không xác định",
    }));
}

export function listServiceAddons(db: AppDb, actor: ActorContext): AddonItem[] {
  assertPermission(actor, "orders.view");

  return db
    .select({
      id: serviceAddons.id,
      serviceId: serviceAddons.serviceId,
      serviceName: services.name,
      branchId: services.branchId,
      name: serviceAddons.name,
      price: serviceAddons.price,
      active: serviceAddons.active,
    })
    .from(serviceAddons)
    .innerJoin(services, eq(serviceAddons.serviceId, services.id))
    .where(and(...serviceScopeConditions(actor)))
    .orderBy(asc(serviceAddons.name))
    .all();
}

export function listProducts(db: AppDb, actor: ActorContext): ProductItem[] {
  assertPermission(actor, "orders.view");

  return db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      category: products.category,
      price: products.price,
      stock: products.stock,
      status: products.status,
    })
    .from(products)
    .where(eq(products.tenantId, actor.tenantId))
    .orderBy(asc(products.name))
    .all();
}

export function listVouchers(db: AppDb, actor: ActorContext): VoucherItem[] {
  assertPermission(actor, "orders.view");
  const scope = getBranchScope(actor);
  const conditions: SQL[] = [eq(vouchers.tenantId, actor.tenantId)];

  if (scope.mode === "branch") {
    const branchCondition = or(
      isNull(vouchers.branchId),
      eq(vouchers.branchId, scope.branchId),
    );
    if (branchCondition) {
      conditions.push(branchCondition);
    }
  }
  if (scope.mode === "none") {
    conditions.push(eq(vouchers.id, "__scope_none__"));
  }

  return db
    .select({
      id: vouchers.id,
      code: vouchers.code,
      name: vouchers.name,
      branchId: vouchers.branchId,
      branchName: branches.name,
      discountType: vouchers.discountType,
      value: vouchers.value,
      minOrder: vouchers.minOrder,
      maxDiscount: vouchers.maxDiscount,
      usageLimit: vouchers.usageLimit,
      usedCount: vouchers.usedCount,
      startsAt: vouchers.startsAt,
      endsAt: vouchers.endsAt,
      active: vouchers.active,
    })
    .from(vouchers)
    .leftJoin(branches, eq(vouchers.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(asc(vouchers.code))
    .all();
}

export type CatalogOptions = {
  services: ServiceItem[];
  addons: AddonItem[];
  products: ProductItem[];
  vouchers: VoucherItem[];
};

export function listCatalogOptions(db: AppDb, actor: ActorContext): CatalogOptions {
  assertPermission(actor, "orders.view");
  return {
    services: listServices(db, actor).filter((service) => service.active),
    addons: listServiceAddons(db, actor).filter((addon) => addon.active),
    products: listProducts(db, actor).filter((product) => product.status === "active"),
    vouchers: listVouchers(db, actor).filter((voucher) => isVoucherUsable(voucher)),
  };
}

function assertServiceBranch(db: AppDb, actor: ActorContext, serviceId: string): void {
  const service = db
    .select({ branchId: services.branchId, tenantId: services.tenantId })
    .from(services)
    .where(eq(services.id, serviceId))
    .get();

  if (!service || service.tenantId !== actor.tenantId) {
    throw new ValidationError("Dịch vụ không hợp lệ.");
  }

  assertBranchAccess(actor, service.branchId);
}

export function createService(
  db: AppDb,
  actor: ActorContext,
  input: ServiceInput,
): string {
  assertPermission(actor, "catalog.manage");
  assertBranchAccess(actor, input.branchId);

  const id = crypto.randomUUID();
  db.insert(services)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      durationMinutes: input.durationMinutes,
      description: input.description.trim() || null,
      active: input.active,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.service.create",
    entity: "service",
    entityId: id,
    metadata: { name: input.name, branchId: input.branchId },
  });

  return id;
}

export function updateService(
  db: AppDb,
  actor: ActorContext,
  serviceId: string,
  input: ServiceInput,
): void {
  assertPermission(actor, "catalog.manage");
  assertBranchAccess(actor, input.branchId);

  const existing = db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.tenantId, actor.tenantId)))
    .get();

  if (!existing) {
    throw new NotFoundError("Không tìm thấy dịch vụ.");
  }

  db.update(services)
    .set({
      branchId: input.branchId,
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      durationMinutes: input.durationMinutes,
      description: input.description.trim() || null,
      active: input.active,
      updatedAt: new Date(),
    })
    .where(and(eq(services.id, serviceId), eq(services.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.service.update",
    entity: "service",
    entityId: serviceId,
    metadata: { name: input.name, branchId: input.branchId },
  });
}

export function createAddon(
  db: AppDb,
  actor: ActorContext,
  input: AddonInput,
): string {
  assertPermission(actor, "catalog.manage");
  assertServiceBranch(db, actor, input.serviceId);

  const id = crypto.randomUUID();
  db.insert(serviceAddons)
    .values({
      id,
      tenantId: actor.tenantId,
      serviceId: input.serviceId,
      name: input.name.trim(),
      price: input.price,
      active: input.active,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.addon.create",
    entity: "service_addon",
    entityId: id,
    metadata: { name: input.name, serviceId: input.serviceId },
  });

  return id;
}

export function updateAddon(
  db: AppDb,
  actor: ActorContext,
  addonId: string,
  input: AddonInput,
): void {
  assertPermission(actor, "catalog.manage");
  assertServiceBranch(db, actor, input.serviceId);

  const existing = db
    .select({ id: serviceAddons.id })
    .from(serviceAddons)
    .where(
      and(eq(serviceAddons.id, addonId), eq(serviceAddons.tenantId, actor.tenantId)),
    )
    .get();

  if (!existing) {
    throw new NotFoundError("Không tìm thấy add-on.");
  }

  db.update(serviceAddons)
    .set({
      serviceId: input.serviceId,
      name: input.name.trim(),
      price: input.price,
      active: input.active,
      updatedAt: new Date(),
    })
    .where(
      and(eq(serviceAddons.id, addonId), eq(serviceAddons.tenantId, actor.tenantId)),
    )
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.addon.update",
    entity: "service_addon",
    entityId: addonId,
    metadata: { name: input.name, serviceId: input.serviceId },
  });
}

export function createProduct(
  db: AppDb,
  actor: ActorContext,
  input: ProductInput,
): string {
  assertPermission(actor, "catalog.manage");
  const sku = input.sku.trim().toUpperCase();
  const duplicate = db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.tenantId, actor.tenantId), eq(products.sku, sku)))
    .get();

  if (duplicate) {
    throw new ValidationError("SKU sản phẩm đã tồn tại.");
  }

  const id = crypto.randomUUID();
  db.insert(products)
    .values({
      id,
      tenantId: actor.tenantId,
      sku,
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      stock: input.stock,
      status: input.status,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.product.create",
    entity: "product",
    entityId: id,
    metadata: { sku, name: input.name },
  });

  return id;
}

export function updateProduct(
  db: AppDb,
  actor: ActorContext,
  productId: string,
  input: ProductInput,
): void {
  assertPermission(actor, "catalog.manage");
  const sku = input.sku.trim().toUpperCase();
  const duplicate = db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.tenantId, actor.tenantId),
        eq(products.sku, sku),
        ne(products.id, productId),
      ),
    )
    .get();

  if (duplicate) {
    throw new ValidationError("SKU sản phẩm đã tồn tại.");
  }

  const existing = db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.tenantId, actor.tenantId)))
    .get();

  if (!existing) {
    throw new NotFoundError("Không tìm thấy sản phẩm.");
  }

  db.update(products)
    .set({
      sku,
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      stock: input.stock,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, productId), eq(products.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.product.update",
    entity: "product",
    entityId: productId,
    metadata: { sku, name: input.name },
  });
}

function parseOptionalDate(value: string, label: string): Date | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = parseVietnamDateTimeLocal(value);
  if (!parsed) {
    throw new ValidationError(`${label} không hợp lệ.`);
  }
  return parsed;
}

export function createVoucher(
  db: AppDb,
  actor: ActorContext,
  input: VoucherInput,
): string {
  assertPermission(actor, "catalog.manage");
  if (input.branchId) {
    assertBranchAccess(actor, input.branchId);
  }
  if (input.discountType === "percent" && (input.value < 1 || input.value > 100)) {
    throw new ValidationError("Phần trăm giảm phải từ 1 đến 100.");
  }
  if (input.discountType === "fixed" && input.value <= 0) {
    throw new ValidationError("Số tiền giảm phải lớn hơn 0.");
  }

  const code = input.code.trim().toUpperCase();
  const duplicate = db
    .select({ id: vouchers.id })
    .from(vouchers)
    .where(and(eq(vouchers.tenantId, actor.tenantId), eq(vouchers.code, code)))
    .get();

  if (duplicate) {
    throw new ValidationError("Mã voucher đã tồn tại.");
  }

  const startsAt = parseOptionalDate(input.startsAt, "Ngày bắt đầu");
  const endsAt = parseOptionalDate(input.endsAt, "Ngày kết thúc");
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new ValidationError("Ngày kết thúc phải sau ngày bắt đầu.");
  }

  const id = crypto.randomUUID();
  db.insert(vouchers)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      code,
      name: input.name.trim(),
      discountType: input.discountType,
      value: input.value,
      minOrder: input.minOrder,
      maxDiscount: input.maxDiscount,
      usageLimit: input.usageLimit,
      startsAt,
      endsAt,
      active: input.active,
    })
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.voucher.create",
    entity: "voucher",
    entityId: id,
    metadata: { code, discountType: input.discountType, value: input.value },
  });

  return id;
}

export function updateVoucher(
  db: AppDb,
  actor: ActorContext,
  voucherId: string,
  input: VoucherInput,
): void {
  assertPermission(actor, "catalog.manage");
  if (input.branchId) {
    assertBranchAccess(actor, input.branchId);
  }
  if (input.discountType === "percent" && (input.value < 1 || input.value > 100)) {
    throw new ValidationError("Phần trăm giảm phải từ 1 đến 100.");
  }
  if (input.discountType === "fixed" && input.value <= 0) {
    throw new ValidationError("Số tiền giảm phải lớn hơn 0.");
  }

  const code = input.code.trim().toUpperCase();
  const duplicate = db
    .select({ id: vouchers.id })
    .from(vouchers)
    .where(
      and(
        eq(vouchers.tenantId, actor.tenantId),
        eq(vouchers.code, code),
        ne(vouchers.id, voucherId),
      ),
    )
    .get();

  if (duplicate) {
    throw new ValidationError("Mã voucher đã tồn tại.");
  }

  const existing = db
    .select({ id: vouchers.id })
    .from(vouchers)
    .where(and(eq(vouchers.id, voucherId), eq(vouchers.tenantId, actor.tenantId)))
    .get();

  if (!existing) {
    throw new NotFoundError("Không tìm thấy voucher.");
  }

  const startsAt = parseOptionalDate(input.startsAt, "Ngày bắt đầu");
  const endsAt = parseOptionalDate(input.endsAt, "Ngày kết thúc");
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new ValidationError("Ngày kết thúc phải sau ngày bắt đầu.");
  }

  db.update(vouchers)
    .set({
      branchId: input.branchId,
      code,
      name: input.name.trim(),
      discountType: input.discountType,
      value: input.value,
      minOrder: input.minOrder,
      maxDiscount: input.maxDiscount,
      usageLimit: input.usageLimit,
      startsAt,
      endsAt,
      active: input.active,
      updatedAt: new Date(),
    })
    .where(and(eq(vouchers.id, voucherId), eq(vouchers.tenantId, actor.tenantId)))
    .run();

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "catalog.voucher.update",
    entity: "voucher",
    entityId: voucherId,
    metadata: { code, discountType: input.discountType, value: input.value },
  });
}

export function assertCatalogServiceBelongsToBranch(
  db: AppDb,
  actor: ActorContext,
  serviceId: string,
): void {
  assertServiceBranch(db, actor, serviceId);
}

export function isVoucherUsable(voucher: VoucherItem, now = new Date()): boolean {
  if (!voucher.active) {
    return false;
  }
  if (voucher.startsAt && voucher.startsAt > now) {
    return false;
  }
  if (voucher.endsAt && voucher.endsAt < now) {
    return false;
  }
  if (voucher.usageLimit !== null && voucher.usedCount >= voucher.usageLimit) {
    return false;
  }
  return true;
}

export function serviceIdsInTenant(
  db: AppDb,
  actor: ActorContext,
  serviceIds: string[],
): string[] {
  if (serviceIds.length === 0) {
    return [];
  }
  return db
    .select({ id: services.id })
    .from(services)
    .where(
      and(
        eq(services.tenantId, actor.tenantId),
        inArray(services.id, serviceIds),
      ),
    )
    .all()
    .map((row) => row.id);
}

export function assertCatalogPermission(actor: ActorContext): void {
  try {
    assertPermission(actor, "catalog.manage");
  } catch {
    throw new AuthorizationError("Bạn không có quyền quản lý danh mục.");
  }
}
