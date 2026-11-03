export const DOCUMENT_CATEGORIES = [
  "contract",
  "album",
  "drive",
  "guide",
  "finance",
  "other",
] as const;

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  contract: "Hợp đồng",
  album: "Album",
  drive: "Drive/NAS",
  guide: "Hướng dẫn",
  finance: "Tài chính",
  other: "Khác",
};

export const DOCUMENT_VISIBILITIES = ["internal", "branch"] as const;
export const DOCUMENT_VISIBILITY_LABELS: Record<string, string> = {
  internal: "Nội bộ",
  branch: "Theo chi nhánh",
};

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
] as const;
