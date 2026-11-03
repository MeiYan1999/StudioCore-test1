export const ALBUM_STATUSES = [
  "draft",
  "processing",
  "ready",
  "delivered",
  "archived",
] as const;

export type AlbumStatus = (typeof ALBUM_STATUSES)[number];

export const ALBUM_STATUS_META: Record<
  AlbumStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Chưa upload", tone: "neutral" },
  processing: { label: "Đang xử lý", tone: "warning" },
  ready: { label: "Sẵn sàng", tone: "success" },
  delivered: { label: "Đã giao", tone: "info" },
  archived: { label: "Lưu trữ", tone: "neutral" },
};

export const ALBUM_STATUS_TRANSITIONS: Record<AlbumStatus, readonly AlbumStatus[]> = {
  draft: ["processing", "ready", "archived"],
  processing: ["ready", "archived"],
  ready: ["delivered", "archived"],
  delivered: ["archived"],
  archived: ["ready"],
};

export const SELECTION_STATUSES = ["draft", "submitted", "locked"] as const;

export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export const SELECTION_STATUS_META: Record<
  SelectionStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" }
> = {
  draft: { label: "Khách đang chọn", tone: "info" },
  submitted: { label: "Khách đã gửi", tone: "warning" },
  locked: { label: "Đã khóa lựa chọn", tone: "success" },
};

export const QUOTA_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50] as const;

export const ALBUM_SOURCE_TYPES = ["drive", "multi_link", "upload"] as const;

export type AlbumSourceType = (typeof ALBUM_SOURCE_TYPES)[number];

export const ALBUM_SOURCE_LABELS: Record<AlbumSourceType, string> = {
  drive: "Thư mục Drive/NAS",
  multi_link: "Dán nhiều link",
  upload: "Tải thư mục/ZIP",
};

export function isAlbumStatus(value: string): value is AlbumStatus {
  return (ALBUM_STATUSES as readonly string[]).includes(value);
}

export function canTransitionAlbum(from: AlbumStatus, to: AlbumStatus): boolean {
  return ALBUM_STATUS_TRANSITIONS[from].includes(to);
}
