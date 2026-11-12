import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { Permission, Role } from "../auth/roles";
import type { OrderStatus } from "../orders/status";
import type { AppointmentStatus } from "../scheduling/status";

const createdAtColumn = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const updatedAtColumn = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    plan: text("plan").notNull().default("trial"),
    planExpiresAt: integer("plan_expires_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("tenants_slug_unique").on(table.slug)],
);

export const platformSubscriptions = sqliteTable(
  "platform_subscriptions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    plan: text("plan").notNull(),
    billingCycle: text("billing_cycle").notNull().default("monthly"),
    amount: integer("amount").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull().default("pending"),
    gateway: text("gateway"),
    transactionRef: text("transaction_ref"),
    accountNumber: text("account_number"),
    content: text("content"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("platform_subs_tenant_idx").on(table.tenantId),
    uniqueIndex("platform_subs_code_unique").on(table.code),
    index("platform_subs_status_idx").on(table.status),
  ],
);

export const branches = sqliteTable(
  "branches",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    timezone: text("timezone").notNull().default("Asia/Ho_Chi_Minh"),
    workingHours: text("working_hours").notNull().default("{}"),
    status: text("status").notNull().default("active"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("branches_tenant_idx").on(table.tenantId),
    uniqueIndex("branches_tenant_name_unique").on(table.tenantId, table.name),
  ],
);

export const staff = sqliteTable(
  "staff",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    role: text("role").$type<Role>().notNull(),
    pinHash: text("pin_hash"),
    passwordHash: text("password_hash"),
    email: text("email"),
    phone: text("phone"),
    baseSalary: integer("base_salary").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("staff_tenant_idx").on(table.tenantId),
    index("staff_tenant_role_idx").on(table.tenantId, table.role),
    uniqueIndex("staff_code_unique").on(table.code),
    uniqueIndex("staff_email_unique").on(table.email),
  ],
);

export const staffBranches = sqliteTable(
  "staff_branches",
  {
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    createdAt: createdAtColumn(),
  },
  (table) => [
    primaryKey({ columns: [table.staffId, table.branchId] }),
    index("staff_branches_tenant_idx").on(table.tenantId),
    index("staff_branches_branch_idx").on(table.branchId),
  ],
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    role: text("role").$type<Role>().notNull(),
    permission: text("permission").$type<Permission>().notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("role_permissions_unique").on(table.tenantId, table.role, table.permission),
    index("role_permissions_tenant_role_idx").on(table.tenantId, table.role),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    activeBranchId: text("active_branch_id").references(() => branches.id),
    ip: text("ip").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: createdAtColumn(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    readOnly: integer("read_only", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("sessions_staff_idx").on(table.staffId),
    index("sessions_tenant_idx").on(table.tenantId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_unique").on(table.tokenHash),
    index("password_reset_tokens_staff_idx").on(table.staffId),
  ],
);

export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    ip: text("ip").notNull().default(""),
    success: integer("success", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("login_attempts_identifier_idx").on(table.identifier, table.createdAt),
    index("login_attempts_ip_idx").on(table.ip, table.createdAt),
  ],
);

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id),
    actorId: text("actor_id").references(() => staff.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("activity_logs_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("activity_logs_actor_idx").on(table.actorId),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => staff.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    link: text("link"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("notifications_tenant_user_idx").on(table.tenantId, table.userId),
    index("notifications_read_idx").on(table.userId, table.readAt),
  ],
);

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address"),
    birthday: text("birthday"),
    measurements: text("measurements").notNull().default("{}"),
    source: text("source").notNull().default("walk_in"),
    tier: text("tier").notNull().default("standard"),
    status: text("status").notNull().default("lead"),
    tags: text("tags").notNull().default("[]"),
    ownerId: text("owner_id").references(() => staff.id),
    followUpAt: integer("follow_up_at", { mode: "timestamp_ms" }),
    lastContactAt: integer("last_contact_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("customers_tenant_phone_unique").on(table.tenantId, table.phone),
    index("customers_tenant_branch_idx").on(table.tenantId, table.branchId),
    index("customers_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const services = sqliteTable(
  "services",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    price: integer("price").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    description: text("description"),
    image: text("image"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("services_tenant_branch_idx").on(table.tenantId, table.branchId),
    index("services_tenant_category_idx").on(table.tenantId, table.category),
  ],
);

export const wardrobeItems = sqliteTable(
  "wardrobe_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    sku: text("sku").notNull(),
    qrCode: text("qr_code").notNull(),
    name: text("name").notNull(),
    size: text("size").notNull(),
    color: text("color").notNull(),
    status: text("status").notNull().default("available"),
    rentalPrice: integer("rental_price").notNull().default(0),
    depositPrice: integer("deposit_price").notNull().default(0),
    image: text("image"),
    notes: text("notes"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("wardrobe_items_tenant_sku_unique").on(table.tenantId, table.sku),
    uniqueIndex("wardrobe_items_tenant_qr_unique").on(table.tenantId, table.qrCode),
    index("wardrobe_items_tenant_branch_idx").on(table.tenantId, table.branchId),
  ],
);

export const settings = sqliteTable(
  "settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id").references(() => branches.id),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("settings_tenant_key_branch_unique").on(table.tenantId, table.key, table.branchId),
    index("settings_tenant_idx").on(table.tenantId),
  ],
);

export type Tenant = typeof tenants.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Service = typeof services.$inferSelect;
export type WardrobeItem = typeof wardrobeItems.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export const customerInteractions = sqliteTable(
  "customer_interactions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    type: text("type").notNull(),
    content: text("content").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("customer_interactions_tenant_customer_idx").on(
      table.tenantId,
      table.customerId,
    ),
    index("customer_interactions_occurred_idx").on(table.occurredAt),
  ],
);

export const serviceAddons = sqliteTable(
  "service_addons",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("service_addons_tenant_service_idx").on(table.tenantId, table.serviceId),
  ],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    price: integer("price").notNull(),
    stock: integer("stock").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("products_tenant_sku_unique").on(table.tenantId, table.sku),
    index("products_tenant_category_idx").on(table.tenantId, table.category),
  ],
);

export const vouchers = sqliteTable(
  "vouchers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id").references(() => branches.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    discountType: text("discount_type")
      .$type<"percent" | "fixed">()
      .notNull(),
    value: integer("value").notNull(),
    minOrder: integer("min_order").notNull().default(0),
    maxDiscount: integer("max_discount"),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("vouchers_tenant_code_unique").on(table.tenantId, table.code),
    index("vouchers_tenant_branch_idx").on(table.tenantId, table.branchId),
  ],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    code: text("code").notNull(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    status: text("status").$type<OrderStatus>().notNull().default("new"),
    photographerId: text("photographer_id").references(() => staff.id),
    editorId: text("editor_id").references(() => staff.id),
    makeupId: text("makeup_id").references(() => staff.id),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    location: text("location"),
    subtotal: integer("subtotal").notNull().default(0),
    surcharge: integer("surcharge").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    voucherId: text("voucher_id").references(() => vouchers.id),
    voucherCode: text("voucher_code"),
    voucherDiscount: integer("voucher_discount").notNull().default(0),
    total: integer("total").notNull().default(0),
    deposit: integer("deposit").notNull().default(0),
    paid: integer("paid").notNull().default(0),
    remaining: integer("remaining").notNull().default(0),
    notes: text("notes"),
    cancelReason: text("cancel_reason"),
    contractConfirmedAt: integer("contract_confirmed_at", { mode: "timestamp_ms" }),
    contractConfirmedBy: text("contract_confirmed_by").references(() => staff.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("orders_tenant_code_unique").on(table.tenantId, table.code),
    index("orders_tenant_branch_idx").on(table.tenantId, table.branchId),
    index("orders_tenant_status_idx").on(table.tenantId, table.status),
    index("orders_tenant_customer_idx").on(table.tenantId, table.customerId),
    index("orders_tenant_scheduled_idx").on(table.tenantId, table.scheduledAt),
  ],
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    itemType: text("item_type")
      .$type<"service" | "addon" | "product" | "custom">()
      .notNull(),
    refId: text("ref_id"),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("order_items_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const orderStatusHistory = sqliteTable(
  "order_status_history",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    fromStatus: text("from_status").$type<OrderStatus>(),
    toStatus: text("to_status").$type<OrderStatus>().notNull(),
    note: text("note"),
    changedBy: text("changed_by").references(() => staff.id),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("order_status_history_order_idx").on(table.orderId, table.createdAt),
    index("order_status_history_tenant_idx").on(table.tenantId),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    status: text("status")
      .$type<"completed" | "refunded">()
      .notNull()
      .default("completed"),
    reference: text("reference"),
    idempotencyKey: text("idempotency_key"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("payments_tenant_order_idx").on(table.tenantId, table.orderId),
    uniqueIndex("payments_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
  ],
);

export type CustomerInteraction = typeof customerInteractions.$inferSelect;
export type ServiceAddon = typeof serviceAddons.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Voucher = typeof vouchers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type Payment = typeof payments.$inferSelect;

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(1),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("rooms_tenant_branch_name_unique").on(
      table.tenantId,
      table.branchId,
      table.name,
    ),
    index("rooms_tenant_branch_idx").on(table.tenantId, table.branchId),
  ],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    roomId: text("room_id").references(() => rooms.id),
    photographerId: text("photographer_id").references(() => staff.id),
    makeupId: text("makeup_id").references(() => staff.id),
    editorId: text("editor_id").references(() => staff.id),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    bufferMinutes: integer("buffer_minutes").notNull().default(30),
    status: text("status")
      .$type<AppointmentStatus>()
      .notNull()
      .default("scheduled"),
    idempotencyKey: text("idempotency_key").notNull(),
    notes: text("notes"),
    checkInAt: integer("check_in_at", { mode: "timestamp_ms" }),
    checkOutAt: integer("check_out_at", { mode: "timestamp_ms" }),
    checkedInBy: text("checked_in_by").references(() => staff.id),
    checkedOutBy: text("checked_out_by").references(() => staff.id),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("appointments_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("appointments_tenant_branch_start_idx").on(
      table.tenantId,
      table.branchId,
      table.startAt,
    ),
    index("appointments_room_start_idx").on(table.roomId, table.startAt),
    index("appointments_photographer_start_idx").on(
      table.photographerId,
      table.startAt,
    ),
    index("appointments_order_idx").on(table.orderId),
  ],
);

export const staffShifts = sqliteTable(
  "staff_shifts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    role: text("role").notNull().default("shift"),
    status: text("status").notNull().default("active"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("staff_shifts_staff_start_idx").on(table.staffId, table.startAt),
    index("staff_shifts_branch_start_idx").on(table.branchId, table.startAt),
  ],
);

export const leaveRequests = sqliteTable(
  "leave_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    status: text("status").notNull().default("pending"),
    reason: text("reason"),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("leave_requests_staff_start_idx").on(table.staffId, table.startAt),
    index("leave_requests_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const wardrobeRentals = sqliteTable(
  "wardrobe_rentals",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    wardrobeItemId: text("wardrobe_item_id")
      .notNull()
      .references(() => wardrobeItems.id),
    orderId: text("order_id").references(() => orders.id),
    customerId: text("customer_id").references(() => customers.id),
    checkedOutAt: integer("checked_out_at", { mode: "timestamp_ms" }).notNull(),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    returnedAt: integer("returned_at", { mode: "timestamp_ms" }),
    conditionOut: text("condition_out").notNull().default("good"),
    conditionIn: text("condition_in"),
    cleaningFee: integer("cleaning_fee").notNull().default(0),
    damageFee: integer("damage_fee").notNull().default(0),
    deposit: integer("deposit").notNull().default(0),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("wardrobe_rentals_item_status_idx").on(
      table.wardrobeItemId,
      table.status,
    ),
    index("wardrobe_rentals_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const equipment = sqliteTable(
  "equipment",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    serialNumber: text("serial_number").notNull(),
    status: text("status").notNull().default("available"),
    notes: text("notes"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("equipment_tenant_serial_unique").on(
      table.tenantId,
      table.serialNumber,
    ),
    index("equipment_tenant_branch_idx").on(table.tenantId, table.branchId),
  ],
);

export const equipmentUsages = sqliteTable(
  "equipment_usages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    equipmentId: text("equipment_id")
      .notNull()
      .references(() => equipment.id),
    orderId: text("order_id").references(() => orders.id),
    appointmentId: text("appointment_id").references(() => appointments.id),
    staffId: text("staff_id").references(() => staff.id),
    checkedOutAt: integer("checked_out_at", { mode: "timestamp_ms" }).notNull(),
    returnedAt: integer("returned_at", { mode: "timestamp_ms" }),
    conditionOut: text("condition_out").notNull().default("good"),
    conditionIn: text("condition_in"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("equipment_usages_equipment_idx").on(
      table.equipmentId,
      table.checkedOutAt,
    ),
  ],
);

export type Room = typeof rooms.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type StaffShift = typeof staffShifts.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type WardrobeRental = typeof wardrobeRentals.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type EquipmentUsage = typeof equipmentUsages.$inferSelect;

export const albums = sqliteTable(
  "albums",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: text("order_id").references(() => orders.id),
    customerId: text("customer_id").references(() => customers.id),
    title: text("title").notNull(),
    sourceType: text("source_type").notNull().default("upload"),
    sourceUrl: text("source_url"),
    driveFolderId: text("drive_folder_id"),
    recursiveScan: integer("recursive_scan", { mode: "boolean" })
      .notNull()
      .default(true),
    selectionLimit: integer("selection_limit").notNull().default(10),
    extraPhotoEnabled: integer("extra_photo_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    extraPhotoPrice: integer("extra_photo_price").notNull().default(0),
    allowFavorites: integer("allow_favorites", { mode: "boolean" })
      .notNull()
      .default(true),
    allowNotes: integer("allow_notes", { mode: "boolean" })
      .notNull()
      .default(true),
    selectionStatus: text("selection_status").notNull().default("draft"),
    selectionSubmittedAt: integer("selection_submitted_at", { mode: "timestamp_ms" }),
    selectionLockedAt: integer("selection_locked_at", { mode: "timestamp_ms" }),
    token: text("token").notNull(),
    tokenEncrypted: text("token_encrypted").notNull(),
    passwordHash: text("password_hash"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    shareRevokedAt: integer("share_revoked_at", { mode: "timestamp_ms" }),
    downloadLimit: integer("download_limit"),
    downloadCount: integer("download_count").notNull().default(0),
    allowDownloads: integer("allow_downloads", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status").notNull().default("draft"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("albums_tenant_token_unique").on(table.tenantId, table.token),
    index("albums_tenant_branch_idx").on(table.tenantId, table.branchId),
    index("albums_tenant_order_idx").on(table.tenantId, table.orderId),
    index("albums_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const albumSources = sqliteTable(
  "album_sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id),
    provider: text("provider").notNull(),
    sourceUrl: text("source_url"),
    externalFolderId: text("external_folder_id"),
    displayName: text("display_name"),
    recursive: integer("recursive", { mode: "boolean" }).notNull().default(true),
    status: text("status").notNull().default("pending"),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    error: text("error"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("album_sources_album_idx").on(table.albumId),
    index("album_sources_tenant_idx").on(table.tenantId),
  ],
);

export const albumFolders = sqliteTable(
  "album_folders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id),
    sourceId: text("source_id")
      .notNull()
      .references(() => albumSources.id),
    externalId: text("external_id"),
    name: text("name").notNull(),
    relativePath: text("relative_path").notNull(),
    photoCount: integer("photo_count").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("album_folders_album_idx").on(table.albumId),
    index("album_folders_source_idx").on(table.sourceId),
  ],
);

export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id),
    folderId: text("folder_id").references(() => albumFolders.id),
    code: text("code").notNull(),
    filename: text("filename").notNull(),
    relativePath: text("relative_path").notNull(),
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key").notNull(),
    previewKey: text("preview_key").notNull(),
    sourceFileId: text("source_file_id"),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    size: integer("size").notNull().default(0),
    isRaw: integer("is_raw", { mode: "boolean" }).notNull().default(false),
    checksum: text("checksum"),
    watermarked: integer("watermarked", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("ready"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("photos_album_code_unique").on(table.albumId, table.code),
    index("photos_album_folder_idx").on(table.albumId, table.folderId),
    index("photos_album_status_idx").on(table.albumId, table.status),
    index("photos_album_checksum_idx").on(table.albumId, table.checksum),
  ],
);

export const photoSelections = sqliteTable(
  "photo_selections",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    albumId: text("album_id")
      .notNull()
      .references(() => albums.id),
    photoId: text("photo_id")
      .notNull()
      .references(() => photos.id),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    selected: integer("selected", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    codeSnapshot: text("code_snapshot"),
    extraFee: integer("extra_fee").notNull().default(0),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("photo_selections_album_photo_unique").on(
      table.albumId,
      table.photoId,
    ),
    index("photo_selections_album_selected_idx").on(table.albumId, table.selected),
  ],
);

export const driveConnections = sqliteTable(
  "drive_connections",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    provider: text("provider").notNull().default("google"),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    folderId: text("folder_id"),
    status: text("status").notNull().default("connected"),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("drive_connections_tenant_provider_unique").on(
      table.tenantId,
      table.provider,
    ),
  ],
);

export const photoFilterJobs = sqliteTable(
  "photo_filter_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    albumId: text("album_id").references(() => albums.id),
    customerId: text("customer_id").references(() => customers.id),
    orderId: text("order_id").references(() => orders.id),
    mode: text("mode").notNull().default("alphanumeric"),
    inputCodes: text("input_codes").notNull(),
    parsedCount: integer("parsed_count").notNull().default(0),
    matchedCount: integer("matched_count").notNull().default(0),
    missingCount: integer("missing_count").notNull().default(0),
    ambiguousCount: integer("ambiguous_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    outputMode: text("output_mode").notNull().default("subfolder"),
    outputFolderName: text("output_folder_name").notNull().default("Ảnh khách chọn"),
    fileType: text("file_type").notNull().default("all"),
    status: text("status").notNull().default("pending"),
    createdBy: text("created_by").references(() => staff.id),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    error: text("error"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("photo_filter_jobs_tenant_idx").on(table.tenantId, table.createdAt),
  ],
);

export const photoFilterItems = sqliteTable(
  "photo_filter_items",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    jobId: text("job_id")
      .notNull()
      .references(() => photoFilterJobs.id),
    inputCode: text("input_code").notNull(),
    matchedPhotoId: text("matched_photo_id"),
    matchedFilename: text("matched_filename"),
    status: text("status").notNull(),
    message: text("message"),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("photo_filter_items_job_idx").on(table.jobId),
  ],
);

export const aiJobs = sqliteTable(
  "ai_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    albumId: text("album_id").references(() => albums.id),
    type: text("type").notNull(),
    provider: text("provider").notNull().default("local"),
    status: text("status").notNull().default("pending"),
    inputRef: text("input_ref"),
    outputRef: text("output_ref"),
    estimatedCost: integer("estimated_cost").notNull().default(0),
    error: text("error"),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("ai_jobs_tenant_idx").on(table.tenantId, table.createdAt),
  ],
);

export const paymentRequests = sqliteTable(
  "payment_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    albumId: text("album_id").references(() => albums.id),
    orderId: text("order_id").references(() => orders.id),
    customerId: text("customer_id").references(() => customers.id),
    code: text("code").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("pending"),
    note: text("note"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("payment_requests_tenant_code_unique").on(
      table.tenantId,
      table.code,
    ),
    index("payment_requests_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    type: text("type").notNull(),
    category: text("category").notNull(),
    amount: integer("amount").notNull(),
    orderId: text("order_id").references(() => orders.id),
    customerId: text("customer_id").references(() => customers.id),
    staffId: text("staff_id").references(() => staff.id),
    method: text("method").notNull().default("cash"),
    description: text("description"),
    reference: text("reference"),
    idempotencyKey: text("idempotency_key"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("transactions_tenant_idempotency_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
    index("transactions_tenant_branch_occurred_idx").on(
      table.tenantId,
      table.branchId,
      table.occurredAt,
    ),
    index("transactions_tenant_type_idx").on(table.tenantId, table.type),
    index("transactions_tenant_order_idx").on(table.tenantId, table.orderId),
  ],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    category: text("category").notNull(),
    amount: integer("amount").notNull(),
    vendor: text("vendor"),
    description: text("description"),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    transactionId: text("transaction_id").references(() => transactions.id),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("expenses_tenant_branch_occurred_idx").on(
      table.tenantId,
      table.branchId,
      table.occurredAt,
    ),
  ],
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id").references(() => branches.id),
    category: text("category").notNull(),
    period: text("period").notNull(),
    amount: integer("amount").notNull(),
    notes: text("notes"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("budgets_tenant_period_idx").on(table.tenantId, table.period),
  ],
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    customerId: text("customer_id").references(() => customers.id),
    invoiceNo: text("invoice_no").notNull(),
    taxCode: text("tax_code"),
    subtotal: integer("subtotal").notNull().default(0),
    vatRate: integer("vat_rate").notNull().default(8),
    vatAmount: integer("vat_amount").notNull().default(0),
    total: integer("total").notNull().default(0),
    status: text("status").notNull().default("draft"),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("invoices_tenant_no_unique").on(table.tenantId, table.invoiceNo),
    index("invoices_tenant_order_idx").on(table.tenantId, table.orderId),
    index("invoices_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const commissionRules = sqliteTable(
  "commission_rules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    role: text("role").notNull(),
    type: text("type").notNull(),
    value: integer("value").notNull(),
    effectiveFrom: integer("effective_from", { mode: "timestamp_ms" }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("commission_rules_tenant_role_idx").on(table.tenantId, table.role),
    index("commission_rules_tenant_active_idx").on(table.tenantId, table.active),
  ],
);

export const commissions = sqliteTable(
  "commissions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    ruleId: text("rule_id").references(() => commissionRules.id),
    role: text("role").notNull(),
    ruleType: text("rule_type").notNull(),
    ruleValue: integer("rule_value").notNull(),
    baseAmount: integer("base_amount").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("pending"),
    approvedBy: text("approved_by").references(() => staff.id),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    payrollId: text("payroll_id"),
    note: text("note"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("commissions_tenant_order_staff_role_unique").on(
      table.tenantId,
      table.orderId,
      table.staffId,
      table.role,
    ),
    index("commissions_tenant_status_idx").on(table.tenantId, table.status),
    index("commissions_tenant_staff_created_idx").on(
      table.tenantId,
      table.staffId,
      table.createdAt,
    ),
  ],
);

export const payrolls = sqliteTable(
  "payrolls",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    period: text("period").notNull(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    baseSalary: integer("base_salary").notNull().default(0),
    workDays: integer("work_days").notNull().default(0),
    commissionAmount: integer("commission_amount").notNull().default(0),
    bonus: integer("bonus").notNull().default(0),
    deduction: integer("deduction").notNull().default(0),
    net: integer("net").notNull().default(0),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by").references(() => staff.id),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    uniqueIndex("payrolls_tenant_period_staff_unique").on(
      table.tenantId,
      table.period,
      table.staffId,
    ),
    index("payrolls_tenant_period_idx").on(table.tenantId, table.period),
  ],
);

export const attendance = sqliteTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id),
    checkInAt: integer("check_in_at", { mode: "timestamp_ms" }).notNull(),
    checkOutAt: integer("check_out_at", { mode: "timestamp_ms" }),
    method: text("method").notNull().default("manual"),
    latitude: text("latitude"),
    longitude: text("longitude"),
    device: text("device"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("attendance_tenant_staff_in_idx").on(
      table.tenantId,
      table.staffId,
      table.checkInAt,
    ),
    index("attendance_tenant_branch_idx").on(table.tenantId, table.branchId),
  ],
);

export const paymentWebhookEvents = sqliteTable(
  "payment_webhook_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadHash: text("payload_hash").notNull(),
    status: text("status").notNull().default("received"),
    error: text("error"),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
  },
  (table) => [
    uniqueIndex("payment_webhook_events_tenant_provider_event_unique").on(
      table.tenantId,
      table.provider,
      table.externalEventId,
    ),
    index("payment_webhook_events_tenant_created_idx").on(
      table.tenantId,
      table.createdAt,
    ),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    title: text("title").notNull(),
    description: text("description"),
    assigneeId: text("assignee_id").references(() => staff.id),
    orderId: text("order_id").references(() => orders.id),
    customerId: text("customer_id").references(() => customers.id),
    albumId: text("album_id").references(() => albums.id),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("todo"),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("tasks_tenant_status_due_idx").on(
      table.tenantId,
      table.status,
      table.dueAt,
    ),
    index("tasks_tenant_assignee_idx").on(table.tenantId, table.assigneeId),
    index("tasks_tenant_customer_idx").on(table.tenantId, table.customerId),
  ],
);

export const taskComments = sqliteTable(
  "task_comments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id),
    authorId: text("author_id").references(() => staff.id),
    content: text("content").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("task_comments_tenant_task_idx").on(table.tenantId, table.taskId),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id").references(() => branches.id),
    name: text("name").notNull(),
    category: text("category").notNull().default("other"),
    storageKey: text("storage_key"),
    url: text("url"),
    visibility: text("visibility").notNull().default("internal"),
    version: integer("version").notNull().default(1),
    notes: text("notes"),
    uploadedBy: text("uploaded_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("documents_tenant_category_idx").on(table.tenantId, table.category),
    index("documents_tenant_branch_idx").on(table.tenantId, table.branchId),
  ],
);

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    name: text("name").notNull(),
    source: text("source").notNull(),
    budget: integer("budget").notNull().default(0),
    spend: integer("spend").notNull().default(0),
    leads: integer("leads").notNull().default(0),
    ordersCount: integer("orders_count").notNull().default(0),
    revenue: integer("revenue").notNull().default(0),
    startAt: integer("start_at", { mode: "timestamp_ms" }),
    endAt: integer("end_at", { mode: "timestamp_ms" }),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => staff.id),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("campaigns_tenant_branch_idx").on(table.tenantId, table.branchId),
    index("campaigns_tenant_status_idx").on(table.tenantId, table.status),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    customerId: text("customer_id").references(() => customers.id),
    channel: text("channel").notNull().default("local"),
    subject: text("subject"),
    assignedTo: text("assigned_to").references(() => staff.id),
    status: text("status").notNull().default("unanswered"),
    aiAutoReply: integer("ai_auto_reply", { mode: "boolean" })
      .notNull()
      .default(false),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("conversations_tenant_status_idx").on(table.tenantId, table.status),
    index("conversations_tenant_assigned_idx").on(
      table.tenantId,
      table.assignedTo,
    ),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    direction: text("direction").notNull(),
    senderName: text("sender_name"),
    content: text("content").notNull(),
    externalId: text("external_id"),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [
    index("messages_tenant_conversation_idx").on(
      table.tenantId,
      table.conversationId,
      table.sentAt,
    ),
  ],
);

export type Album = typeof albums.$inferSelect;
export type AlbumSource = typeof albumSources.$inferSelect;
export type AlbumFolder = typeof albumFolders.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type PhotoSelection = typeof photoSelections.$inferSelect;
export type DriveConnection = typeof driveConnections.$inferSelect;
export type PhotoFilterJob = typeof photoFilterJobs.$inferSelect;
export type PhotoFilterItem = typeof photoFilterItems.$inferSelect;
export type AiJob = typeof aiJobs.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type CommissionRule = typeof commissionRules.$inferSelect;
export type Commission = typeof commissions.$inferSelect;
export type Payroll = typeof payrolls.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type MessageRecord = typeof messages.$inferSelect;

export const contactRequests = sqliteTable(
  "contact_requests",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    studioName: text("studio_name").notNull().default(""),
    message: text("message").notNull(),
    source: text("source").notNull().default("landing"),
    status: text("status").notNull().default("new"),
    ip: text("ip").notNull().default(""),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [
    index("contact_requests_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("contact_requests_ip_created_idx").on(table.ip, table.createdAt),
  ],
);

export type ContactRequest = typeof contactRequests.$inferSelect;


// Facebook transport metadata is separate so existing local conversations remain readable.
export const facebookPages = sqliteTable("facebook_pages", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  name: text("name").notNull(),
  avatar: text("avatar"),
  token: text("token"),
  status: text("status").notNull().default("pending"),
  lastEventAt: integer("last_event_at"),
});
export const facebookThreads = sqliteTable("facebook_threads", {
  conversationId: text("conversation_id").primaryKey().references(() => conversations.id),
  pageId: text("page_id").notNull().references(() => facebookPages.id),
  psid: text("psid").notNull(),
  lastInboundAt: integer("last_inbound_at").notNull().default(0),
  readAt: integer("read_at").notNull().default(0),
  label: text("label").notNull().default("Khách mới"),
}, t => [uniqueIndex("facebook_page_psid").on(t.pageId, t.psid)]);
export const facebookDeliveries = sqliteTable("facebook_deliveries", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  messageId: text("message_id"),
  status: text("status").notNull(),
  error: text("error"),
  attachment: text("attachment"),
}, t => [uniqueIndex("facebook_message_mid").on(t.messageId)]);
export const facebookOauth = sqliteTable("facebook_oauth", {
  state: text("state").primaryKey(),
  sessionId: text("session_id").notNull(),
  tenantId: text("tenant_id").notNull(),
  branchId: text("branch_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const bookingOffers = sqliteTable("booking_offers", {
  serviceId: text("service_id").primaryKey().references(() => services.id),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  roomId: text("room_id").references(() => rooms.id),
  photographerId: text("photographer_id").references(() => staff.id),
  opens: integer("opens").notNull().default(540),
  closes: integer("closes").notNull().default(1080),
  closedDays: text("closed_days").notNull().default("0"),
  holidays: text("holidays").notNull().default(""),
  buffer: integer("buffer").notNull().default(30),
  holdMinutes: integer("hold_minutes").notNull().default(30),
  deposit: integer("deposit").notNull().default(0),
  createdBy: text("created_by").notNull().references(() => staff.id),
  active: integer("active").notNull().default(1),
});
export const bookingLinks = sqliteTable("booking_links", {
  tokenHash: text("token_hash").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  expiresAt: integer("expires_at").notNull(),
  bookingId: text("booking_id"),
});
export const inboxBookings = sqliteTable("inbox_bookings", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  conversationId: text("conversation_id").references(() => conversations.id),
  pageId: text("page_id").references(() => facebookPages.id),
  serviceId: text("service_id").notNull().references(() => services.id),
  orderId: text("order_id").notNull().references(() => orders.id),
  appointmentId: text("appointment_id").notNull().references(() => appointments.id),
  status: text("status").notNull().default("held"),
  expiresAt: integer("expires_at").notNull(),
  source: text("source").notNull(),
  requestKey: text("request_key").notNull(),
}, t => [uniqueIndex("inbox_booking_request").on(t.tenantId, t.requestKey), uniqueIndex("inbox_booking_appointment").on(t.appointmentId)]);
export const inboxReceipts = sqliteTable("inbox_receipts", {
  key: text("key").primaryKey(),
  bookingId: text("booking_id").notNull().references(() => inboxBookings.id),
  paymentId: text("payment_id").notNull(),
});
export const inboxNotes = sqliteTable("inbox_notes", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id),
  staffId: text("staff_id").notNull().references(() => staff.id),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const inboxReplies = sqliteTable("inbox_replies", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  content: text("content").notNull(),
});
