export const ORDER_STATUSES = [
  "new",
  "deposit_received",
  "confirmed",
  "scheduled",
  "shooting",
  "awaiting_edit",
  "editing",
  "awaiting_selection",
  "awaiting_approval",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: OrderStatusTone }
> = {
  new: { label: "Mới tiếp nhận", tone: "neutral" },
  deposit_received: { label: "Đã cọc", tone: "info" },
  confirmed: { label: "Đã xác nhận", tone: "info" },
  scheduled: { label: "Đã lên lịch", tone: "info" },
  shooting: { label: "Đang chụp", tone: "info" },
  awaiting_edit: { label: "Đã chụp xong", tone: "warning" },
  editing: { label: "Đang hậu kỳ", tone: "info" },
  awaiting_selection: { label: "Khách đang chọn ảnh", tone: "warning" },
  awaiting_approval: { label: "Chờ duyệt", tone: "warning" },
  delivered: { label: "Đã bàn giao", tone: "success" },
  completed: { label: "Hoàn tất", tone: "success" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
};

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["deposit_received", "confirmed", "cancelled"],
  deposit_received: ["confirmed", "scheduled", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
  scheduled: ["shooting", "cancelled"],
  shooting: ["awaiting_edit", "cancelled"],
  awaiting_edit: ["editing"],
  editing: ["awaiting_selection", "awaiting_approval"],
  awaiting_selection: ["awaiting_approval", "editing"],
  awaiting_approval: ["delivered", "editing"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function nextOrderStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[status];
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
