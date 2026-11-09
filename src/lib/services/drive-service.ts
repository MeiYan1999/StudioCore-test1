export type DriveShareType = "album" | "folder" | "video";
export type DriveShareStatus = "active" | "paused" | "expired";

export interface DriveItem {
  id: string;
  name: string;
  filename: string;
  path: string;
  sizeBytes: number;
  sizeLabel: string;
  type: "image" | "raw" | "video" | "document";
  format: "CR3" | "CR2" | "ARW" | "NEF" | "JPG" | "PNG" | "MP4" | "MOV" | "ZIP" | "PDF";
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  width?: number;
  height?: number;
  selected?: boolean;
  favorite?: boolean;
  note?: string | null;
}

export interface DriveVideoComment {
  id: string;
  seconds: number;
  timeLabel: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface DriveShare {
  id: string;
  tenantId: string;
  title: string;
  subtitle?: string;
  type: DriveShareType;
  status: DriveShareStatus;
  localPath: string;
  agentHostname: string;
  agentConnected: boolean;
  passwordProtected: boolean;
  allowRawDownload: boolean;
  allowZipDownload: boolean;
  maxSelectCount: number;
  selectedCount: number;
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeLabel: string;
  viewsCount: number;
  downloadsCount: number;
  clientName?: string;
  clientPhone?: string;
  createdAt: string;
  expiresAt: string | null;
  items: DriveItem[];
  videoMeta?: {
    videoUrl: string;
    durationSeconds: number;
    durationLabel: string;
    resolution: string;
    coverUrl: string;
  };
  comments?: DriveVideoComment[];
}

const DEFAULT_DEMO_SHARES: DriveShare[] = [
  {
    id: "cuoi-minh-lan-dalat",
    tenantId: "tenant-demo",
    title: "Cưới Minh & Lan — Ngoại Cảnh Đà Lạt",
    subtitle: "Show ngoại cảnh 3 ngày 2 đêm · StudioCore Drive Live",
    type: "album",
    status: "active",
    localPath: "D:/StudioCore-Data/2026/Cuoi_Minh_Lan_DaLat",
    agentHostname: "PC-PhongDung-01 (Windows 11)",
    agentConnected: true,
    passwordProtected: false,
    allowRawDownload: true,
    allowZipDownload: true,
    maxSelectCount: 40,
    selectedCount: 14,
    totalFiles: 1248,
    totalSizeBytes: 34359738368, // ~32 GB
    totalSizeLabel: "32.4 GB",
    viewsCount: 28,
    downloadsCount: 5,
    clientName: "Trần Minh & Lê Phương Lan",
    clientPhone: "0988 123 456",
    createdAt: "2026-11-08T08:30:00Z",
    expiresAt: "2026-12-08T23:59:59Z",
    items: [
      {
        id: "img-0124",
        name: "IMG_0124.CR3",
        filename: "IMG_0124.CR3",
        path: "D:/StudioCore-Data/2026/Cuoi_Minh_Lan_DaLat/IMG_0124.CR3",
        sizeBytes: 31457280,
        sizeLabel: "30.0 MB",
        type: "raw",
        format: "CR3",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-001-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-001.jpg",
        downloadUrl: "#download-0124",
        width: 6000,
        height: 4000,
        selected: true,
        favorite: true,
        note: "Chỉnh màu sáng góc váy và mây trời",
      },
      {
        id: "img-0138",
        name: "IMG_0138.CR3",
        filename: "IMG_0138.CR3",
        path: "D:/StudioCore-Data/2026/Cuoi_Minh_Lan_DaLat/IMG_0138.CR3",
        sizeBytes: 29360128,
        sizeLabel: "28.0 MB",
        type: "raw",
        format: "CR3",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-002-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-002.jpg",
        downloadUrl: "#download-0138",
        width: 6000,
        height: 4000,
        selected: true,
        favorite: true,
        note: "Xóa bóng người đi ngang phía sau",
      },
      {
        id: "img-0189",
        name: "IMG_0189.CR3",
        filename: "IMG_0189.CR3",
        path: "D:/StudioCore-Data/2026/Cuoi_Minh_Lan_DaLat/IMG_0189.CR3",
        sizeBytes: 32505856,
        sizeLabel: "31.0 MB",
        type: "raw",
        format: "CR3",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-003-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-003.jpg",
        downloadUrl: "#download-0189",
        width: 6000,
        height: 4000,
        selected: true,
        favorite: false,
        note: null,
      },
      {
        id: "img-0205",
        name: "IMG_0205.CR3",
        filename: "IMG_0205.CR3",
        path: "D:/StudioCore-Data/2026/Cuoi_Minh_Lan_DaLat/IMG_0205.CR3",
        sizeBytes: 28311552,
        sizeLabel: "27.0 MB",
        type: "raw",
        format: "CR3",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-004-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-004.jpg",
        downloadUrl: "#download-0205",
        width: 6000,
        height: 4000,
        selected: false,
        favorite: false,
        note: null,
      },
      {
        id: "img-0211",
        name: "IMG_0211.CR3",
        filename: "IMG_0211.CR3",
        path: "D:/StudioCore-Data/2026/Cuoi_Minh_Lan_DaLat/IMG_0211.CR3",
        sizeBytes: 30408704,
        sizeLabel: "29.0 MB",
        type: "raw",
        format: "CR3",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-005-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-005.jpg",
        downloadUrl: "#download-0211",
        width: 6000,
        height: 4000,
        selected: false,
        favorite: false,
        note: null,
      },
      {
        id: "img-0220",
        name: "IMG_0220.CR3",
        filename: "IMG_0220.CR3",
        path: "D:/StudioCore-Data/2026/Cuoi_Minh_Lan_DaLat/IMG_0220.CR3",
        sizeBytes: 31457280,
        sizeLabel: "30.0 MB",
        type: "raw",
        format: "CR3",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-006-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-006.jpg",
        downloadUrl: "#download-0220",
        width: 6000,
        height: 4000,
        selected: true,
        favorite: false,
        note: null,
      },
    ],
  },
  {
    id: "ky-yeu-12a1-folder",
    tenantId: "tenant-demo",
    title: "Kỷ yếu Lớp 12A1 — Trọn Bộ File In & Bản Đẹp",
    subtitle: "Thư mục bàn giao file in photobook và ảnh thẻ phóng sự",
    type: "folder",
    status: "active",
    localPath: "/Volumes/NAS_Studio/Ky_Yeu_2026/Lop_12A1",
    agentHostname: "Mac Studio M2 Ultra (macOS Sequoia)",
    agentConnected: true,
    passwordProtected: false,
    allowRawDownload: false,
    allowZipDownload: true,
    maxSelectCount: 0,
    selectedCount: 0,
    totalFiles: 248,
    totalSizeBytes: 3328599654, // ~3.1 GB
    totalSizeLabel: "3.1 GB",
    viewsCount: 92,
    downloadsCount: 45,
    clientName: "Lớp trưởng Nguyễn Thu Trang",
    clientPhone: "0912 345 678",
    createdAt: "2026-11-07T14:00:00Z",
    expiresAt: "2026-12-31T23:59:59Z",
    items: [
      {
        id: "file-01",
        name: "01_Anh_Tap_The_Ao_Dai.jpg",
        filename: "01_Anh_Tap_The_Ao_Dai.jpg",
        path: "/Volumes/NAS_Studio/Ky_Yeu_2026/Lop_12A1/01_Anh_Tap_The_Ao_Dai.jpg",
        sizeBytes: 18874368,
        sizeLabel: "18.0 MB",
        type: "image",
        format: "JPG",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-007-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-007.jpg",
        downloadUrl: "#download-tapthe",
        width: 7952,
        height: 5304,
      },
      {
        id: "file-02",
        name: "02_Bia_Photobook_Final.pdf",
        filename: "02_Bia_Photobook_Final.pdf",
        path: "/Volumes/NAS_Studio/Ky_Yeu_2026/Lop_12A1/02_Bia_Photobook_Final.pdf",
        sizeBytes: 47185920,
        sizeLabel: "45.0 MB",
        type: "document",
        format: "PDF",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-008-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-008.jpg",
        downloadUrl: "#download-pdf",
      },
      {
        id: "file-03",
        name: "03_Tron_Bo_Anh_Ca_Nhan_35HS.zip",
        filename: "03_Tron_Bo_Anh_Ca_Nhan_35HS.zip",
        path: "/Volumes/NAS_Studio/Ky_Yeu_2026/Lop_12A1/03_Tron_Bo_Anh_Ca_Nhan_35HS.zip",
        sizeBytes: 1610612736,
        sizeLabel: "1.5 GB",
        type: "document",
        format: "ZIP",
        thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-009-thumb.jpg",
        previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-009.jpg",
        downloadUrl: "#download-zip",
      },
    ],
  },
  {
    id: "highlight-cuoi-minh-lan-video",
    tenantId: "tenant-demo",
    title: "Highlight Phóng Sự Cưới — Minh & Lan (Bản 4K)",
    subtitle: "Khách xem trực tiếp & góp ý chỉnh sửa theo từng giây",
    type: "video",
    status: "active",
    localPath: "D:/StudioCore-Data/Videos/2026/Highlight_Minh_Lan_4K.mp4",
    agentHostname: "PC-PhongDung-01 (Windows 11)",
    agentConnected: true,
    passwordProtected: false,
    allowRawDownload: true,
    allowZipDownload: false,
    maxSelectCount: 0,
    selectedCount: 0,
    totalFiles: 1,
    totalSizeBytes: 2362232012, // ~2.2 GB
    totalSizeLabel: "2.2 GB",
    viewsCount: 42,
    downloadsCount: 12,
    clientName: "Trần Minh & Lê Phương Lan",
    clientPhone: "0988 123 456",
    createdAt: "2026-11-09T02:00:00Z",
    expiresAt: "2026-12-15T23:59:59Z",
    items: [],
    videoMeta: {
      videoUrl: "/api/files/tenant-demo/demo-video-highlight.mp4",
      durationSeconds: 275, // 4m35s
      durationLabel: "04:35",
      resolution: "4K UHD (3840 x 2160)",
      coverUrl: "/marketing/dashboard.jpg",
    },
    comments: [
      {
        id: "cmt-1",
        seconds: 45,
        timeLabel: "00:45",
        author: "Phương Lan (Cô dâu)",
        content: "Đoạn bố trao tay cắt nhanh hơn 2 giây giúp em nhé studio.",
        createdAt: "2026-11-09T03:15:00Z",
      },
      {
        id: "cmt-2",
        seconds: 124,
        timeLabel: "02:04",
        author: "Trần Minh (Chú rể)",
        content: "Màu đoạn nâng ly này đẹp lắm, giữ nguyên nhé anh em!",
        createdAt: "2026-11-09T04:20:00Z",
      },
      {
        id: "cmt-3",
        seconds: 215,
        timeLabel: "03:35",
        author: "Phương Lan (Cô dâu)",
        content: "Nhạc nền đoạn này chuyển êm một chút trước khi sang phần pháo sáng ạ.",
        createdAt: "2026-11-09T05:00:00Z",
      },
    ],
  },
];

// Persistent runtime store for demo & studio shares
let globalShares = [...DEFAULT_DEMO_SHARES];

export function listDriveShares(tenantId?: string): DriveShare[] {
  if (!tenantId) return globalShares;
  return globalShares.filter((s) => s.tenantId === tenantId || s.tenantId === "tenant-demo");
}

export function getDriveShareById(id: string): DriveShare | undefined {
  return globalShares.find((s) => s.id === id);
}

export function createDriveShare(share: Omit<DriveShare, "viewsCount" | "downloadsCount" | "selectedCount">): DriveShare {
  const newShare: DriveShare = {
    ...share,
    viewsCount: 0,
    downloadsCount: 0,
    selectedCount: share.items.filter((i) => i.selected).length,
  };
  globalShares = [newShare, ...globalShares];
  return newShare;
}

export function updateDriveShareStatus(id: string, status: DriveShareStatus): boolean {
  const share = globalShares.find((s) => s.id === id);
  if (!share) return false;
  share.status = status;
  return true;
}

export function deleteDriveShare(id: string): boolean {
  const index = globalShares.findIndex((s) => s.id === id);
  if (index === -1) return false;
  globalShares.splice(index, 1);
  return true;
}

export function toggleDriveItemSelection(shareId: string, itemId: string, note?: string | null): boolean {
  const share = globalShares.find((s) => s.id === shareId);
  if (!share) return false;
  const item = share.items.find((i) => i.id === itemId);
  if (!item) return false;

  item.selected = !item.selected;
  if (note !== undefined) {
    item.note = note;
  }
  share.selectedCount = share.items.filter((i) => i.selected).length;
  return true;
}

export function addDriveVideoComment(shareId: string, seconds: number, author: string, content: string): DriveVideoComment | null {
  const share = globalShares.find((s) => s.id === shareId);
  if (!share) return null;
  if (!share.comments) share.comments = [];

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  const timeLabel = `${mins}:${secs}`;

  const comment: DriveVideoComment = {
    id: `cmt-${Date.now()}`,
    seconds,
    timeLabel,
    author: author.trim() || "Khách hàng",
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };

  share.comments.push(comment);
  share.comments.sort((a, b) => a.seconds - b.seconds);
  return comment;
}

export function getDriveExportRawCodes(shareId: string): string {
  const share = globalShares.find((s) => s.id === shareId);
  if (!share) return "";
  const selectedItems = share.items.filter((i) => i.selected);
  return selectedItems.map((i) => i.filename.replace(/\.[^/.]+$/, "")).join(", ");
}

export function incrementDriveViews(shareId: string): void {
  const share = globalShares.find((s) => s.id === shareId);
  if (share) {
    share.viewsCount += 1;
  }
}
