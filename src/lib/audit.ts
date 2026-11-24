import { eq } from "drizzle-orm";
import type { AppDb } from "./db/client";
import {
  activityLogs,
  aiJobs,
  albums,
  appointments,
  attendance,
  budgets,
  campaigns,
  commissions,
  conversations,
  customers,
  documents,
  equipment,
  expenses,
  facebookPages,
  invoices,
  leaveRequests,
  orders,
  payments,
  photoFilterJobs,
  rooms,
  serviceAddons,
  services,
  tasks,
  transactions,
  vouchers,
  wardrobeItems,
  wardrobeRentals,
} from "./db/schema";

export const PASSWORD_CHANGED = "auth.password.change.success";

type AuditInput = {
  tenantId: string | null;
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  /** Omit to take the branch from the record named by `entity`/`entityId`. */
  branchId?: string | null;
  metadata?: Record<string, unknown>;
};

const BRANCH_TABLES = {
  album: albums,
  appointment: appointments,
  attendance,
  budget: budgets,
  campaign: campaigns,
  conversation: conversations,
  customer: customers,
  document: documents,
  equipment,
  expense: expenses,
  facebook_page: facebookPages,
  invoice: invoices,
  leave_request: leaveRequests,
  order: orders,
  room: rooms,
  service: services,
  task: tasks,
  transaction: transactions,
  voucher: vouchers,
  wardrobe_item: wardrobeItems,
  wardrobe_rental: wardrobeRentals,
} as const;

/** Branch of the record an audit entry is about, or null when it has none. */
export function resolveAuditBranchId(
  db: AppDb,
  entity: string,
  entityId: string | null | undefined,
): string | null {
  if (!entityId) return null;
  if (entity === "branch") return entityId;
  if (entity === "payment") {
    const row = db
      .select({ branchId: orders.branchId })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(eq(payments.id, entityId))
      .get();
    return row?.branchId ?? null;
  }
  // Records without their own branch take it from the record they belong to.
  if (entity === "commission") {
    const row = db
      .select({ branchId: orders.branchId })
      .from(commissions)
      .innerJoin(orders, eq(commissions.orderId, orders.id))
      .where(eq(commissions.id, entityId))
      .get();
    return row?.branchId ?? null;
  }
  if (entity === "service_addon") {
    const row = db
      .select({ branchId: services.branchId })
      .from(serviceAddons)
      .innerJoin(services, eq(serviceAddons.serviceId, services.id))
      .where(eq(serviceAddons.id, entityId))
      .get();
    return row?.branchId ?? null;
  }
  if (entity === "ai_job") {
    const row = db
      .select({ branchId: albums.branchId })
      .from(aiJobs)
      .innerJoin(albums, eq(aiJobs.albumId, albums.id))
      .where(eq(aiJobs.id, entityId))
      .get();
    return row?.branchId ?? null;
  }
  if (entity === "photo_filter_job") {
    const row = db
      .select({ albumBranchId: albums.branchId, orderBranchId: orders.branchId })
      .from(photoFilterJobs)
      .leftJoin(albums, eq(photoFilterJobs.albumId, albums.id))
      .leftJoin(orders, eq(photoFilterJobs.orderId, orders.id))
      .where(eq(photoFilterJobs.id, entityId))
      .get();
    return row?.albumBranchId ?? row?.orderBranchId ?? null;
  }
  const table = BRANCH_TABLES[entity as keyof typeof BRANCH_TABLES];
  if (!table) return null;
  const row = db
    .select({ branchId: table.branchId })
    .from(table)
    .where(eq(table.id, entityId))
    .get();
  return row?.branchId ?? null;
}

export function writeAudit(db: AppDb, input: AuditInput): void {
  const branchId =
    input.branchId !== undefined
      ? input.branchId
      : resolveAuditBranchId(db, input.entity, input.entityId);
  db.insert(activityLogs)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      branchId,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
      createdAt: new Date(),
    })
    .run();
}

const AUDIT_LABELS: Record<string, string> = {
  "auth.login.success": "Đăng nhập thành công",
  "auth.login.failed": "Đăng nhập thất bại",
  "auth.logout": "Đăng xuất",
  [PASSWORD_CHANGED]: "Đổi mật khẩu",
  "auth.password.change.failed": "Đổi mật khẩu thất bại",
  "auth.branch.switch": "Chuyển chi nhánh",
  "system.seed": "Khởi tạo dữ liệu demo",
  "settings.user.create": "Thêm nhân sự",
  "settings.user.update": "Cập nhật nhân sự",
  "settings.role.update": "Cập nhật quyền vai trò",
  "settings.session.revoke": "Thu hồi phiên đăng nhập",
  "customers.create": "Thêm khách hàng",
  "customers.update": "Cập nhật khách hàng",
  "customers.interaction.create": "Ghi nhận tương tác khách hàng",
  "customers.export": "Xuất dữ liệu khách hàng",
  "catalog.service.create": "Thêm dịch vụ",
  "catalog.service.update": "Cập nhật dịch vụ",
  "catalog.addon.create": "Thêm add-on",
  "catalog.addon.update": "Cập nhật add-on",
  "catalog.product.create": "Thêm sản phẩm",
  "catalog.product.update": "Cập nhật sản phẩm",
  "catalog.voucher.create": "Thêm voucher",
  "catalog.voucher.update": "Cập nhật voucher",
  "orders.create": "Tạo đơn hàng",
  "orders.status.change": "Đổi trạng thái đơn hàng",
  "orders.payment.record": "Ghi nhận thanh toán",
  "orders.contract.confirm": "Xác nhận hợp đồng nội bộ",
  "rooms.create": "Thêm phòng chụp",
  "rooms.update": "Cập nhật phòng chụp",
  "appointments.create": "Xếp lịch chụp",
  "appointments.update": "Cập nhật lịch chụp",
  "appointments.cancel": "Hủy lịch chụp",
  "appointments.check_in": "Check-in buổi chụp",
  "appointments.check_out": "Check-out buổi chụp",
  "wardrobe.item.create": "Thêm trang phục",
  "wardrobe.item.update": "Cập nhật trang phục",
  "wardrobe.rental.create": "Tạo phiếu thuê trang phục",
  "wardrobe.rental.return": "Nhận lại trang phục",
  "equipment.create": "Thêm thiết bị",
  "equipment.update": "Cập nhật thiết bị",
};

export function activityActionLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action;
}
