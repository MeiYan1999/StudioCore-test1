import type { AppDb } from "./db/client";
import { activityLogs } from "./db/schema";

type AuditInput = {
  tenantId: string | null;
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export function writeAudit(db: AppDb, input: AuditInput): void {
  db.insert(activityLogs)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
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
