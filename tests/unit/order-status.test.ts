import { describe, expect, it } from "vitest";
import {
  canTransitionOrder,
  isOrderStatus,
  nextOrderStatuses,
  ORDER_STATUS_META,
} from "@/lib/orders/status";

describe("trạng thái đơn hàng", () => {
  it("new có thể cọc, xác nhận hoặc hủy", () => {
    expect(canTransitionOrder("new", "deposit_received")).toBe(true);
    expect(canTransitionOrder("new", "confirmed")).toBe(true);
    expect(canTransitionOrder("new", "cancelled")).toBe(true);
    expect(canTransitionOrder("new", "completed")).toBe(false);
  });

  it("đi đúng luồng sản xuất", () => {
    expect(canTransitionOrder("confirmed", "scheduled")).toBe(true);
    expect(canTransitionOrder("scheduled", "shooting")).toBe(true);
    expect(canTransitionOrder("shooting", "awaiting_edit")).toBe(true);
    expect(canTransitionOrder("awaiting_edit", "editing")).toBe(true);
    expect(canTransitionOrder("editing", "awaiting_selection")).toBe(true);
    expect(canTransitionOrder("awaiting_selection", "awaiting_approval")).toBe(true);
    expect(canTransitionOrder("awaiting_approval", "delivered")).toBe(true);
    expect(canTransitionOrder("delivered", "completed")).toBe(true);
  });

  it("completed và cancelled không có trạng thái tiếp theo", () => {
    expect(nextOrderStatuses("completed")).toEqual([]);
    expect(nextOrderStatuses("cancelled")).toEqual([]);
  });

  it("có nhãn cho awaiting_selection", () => {
    expect(ORDER_STATUS_META.awaiting_selection.label).toBe("Khách đang chọn ảnh");
    expect(ORDER_STATUS_META.awaiting_selection.tone).toBe("warning");
  });

  it("nhận diện mã trạng thái hợp lệ", () => {
    expect(isOrderStatus("editing")).toBe(true);
    expect(isOrderStatus("khong-hop-le")).toBe(false);
  });
});
