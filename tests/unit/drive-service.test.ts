import { describe, expect, it } from "vitest";
import {
  listDriveShares,
  getDriveShareById,
  updateDriveShareStatus,
  toggleDriveItemSelection,
  addDriveVideoComment,
  getDriveExportRawCodes,
} from "@/lib/services/drive-service";

describe("StudioCore Drive Service", () => {
  it("liệt kê danh sách demo drive shares đầy đủ 3 loại link", () => {
    const shares = listDriveShares();
    expect(shares.length).toBeGreaterThanOrEqual(3);

    const types = shares.map((s) => s.type);
    expect(types).toContain("album");
    expect(types).toContain("folder");
    expect(types).toContain("video");
  });

  it("lấy thông tin chi tiết một share theo id", () => {
    const share = getDriveShareById("cuoi-minh-lan-dalat");
    expect(share).toBeDefined();
    expect(share?.title).toContain("Cưới Minh & Lan");
    expect(share?.agentConnected).toBe(true);
    expect(share?.items.length).toBeGreaterThan(0);
  });

  it("cho phép cập nhật trạng thái link (tạm dừng / mở lại)", () => {
    const ok = updateDriveShareStatus("cuoi-minh-lan-dalat", "paused");
    expect(ok).toBe(true);
    let share = getDriveShareById("cuoi-minh-lan-dalat");
    expect(share?.status).toBe("paused");

    updateDriveShareStatus("cuoi-minh-lan-dalat", "active");
    share = getDriveShareById("cuoi-minh-lan-dalat");
    expect(share?.status).toBe("active");
  });

  it("cho phép khách chọn ảnh và xuất danh sách mã file RAW", () => {
    const initialCodes = getDriveExportRawCodes("cuoi-minh-lan-dalat");
    expect(initialCodes).toContain("IMG_0124");

    toggleDriveItemSelection("cuoi-minh-lan-dalat", "img-0205", "Ghi chú làm mịn da");
    const updatedCodes = getDriveExportRawCodes("cuoi-minh-lan-dalat");
    expect(updatedCodes).toContain("IMG_0205");

    const share = getDriveShareById("cuoi-minh-lan-dalat");
    const item = share?.items.find((i) => i.id === "img-0205");
    expect(item?.selected).toBe(true);
    expect(item?.note).toBe("Ghi chú làm mịn da");
  });

  it("cho phép thêm góp ý video theo mốc thời gian timestamp", () => {
    const comment = addDriveVideoComment(
      "highlight-cuoi-minh-lan-video",
      95,
      "Cô dâu Phương Lan",
      "Đoạn này đổi bài hát nhẹ hơn một chút ạ",
    );
    expect(comment).toBeDefined();
    expect(comment?.timeLabel).toBe("01:35");
    expect(comment?.author).toBe("Cô dâu Phương Lan");

    const share = getDriveShareById("highlight-cuoi-minh-lan-video");
    expect(share?.comments?.some((c) => c.seconds === 95)).toBe(true);
  });
});
