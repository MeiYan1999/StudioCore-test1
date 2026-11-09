const fs = require("node:fs");
const path = require("node:path");

const RAW_EXTS = new Set([".cr3", ".cr2", ".arw", ".nef", ".raf", ".dng", ".rw2", ".orf"]);
const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".psd"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".m4v"]);
const DOC_EXTS = new Set([".pdf", ".zip", ".rar", ".7z"]);

const DEMO_PREVIEWS = [
  { folder: "duoi-ca", name: "anh-001" },
  { folder: "duoi-ca", name: "anh-002" },
  { folder: "duoi-ca", name: "anh-003" },
  { folder: "duoi-ca", name: "anh-004" },
  { folder: "truyen-thong", name: "anh-005" },
  { folder: "truyen-thong", name: "anh-006" },
  { folder: "truyen-thong", name: "anh-007" },
  { folder: "truyen-thong", name: "anh-008" },
  { folder: "le-gia-tien", name: "anh-009" },
  { folder: "le-gia-tien", name: "anh-010" },
  { folder: "le-gia-tien", name: "anh-011" },
  { folder: "le-gia-tien", name: "anh-012" },
];

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function scanFolder(folderPath, maxFiles = 2000) {
  const normalizedPath = path.resolve(folderPath);

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Thư mục không tồn tại: ${normalizedPath}`);
  }

  const stat = fs.statSync(normalizedPath);
  if (!stat.isDirectory()) {
    // Single file mode (e.g. video)
    const ext = path.extname(normalizedPath).toLowerCase();
    const isVideo = VIDEO_EXTS.has(ext);
    return {
      title: path.basename(normalizedPath),
      localPath: normalizedPath,
      type: isVideo ? "video" : "folder",
      totalFiles: 1,
      totalSizeBytes: stat.size,
      totalSizeLabel: formatBytes(stat.size),
      items: [
        {
          id: `f-1`,
          name: path.basename(normalizedPath),
          filename: path.basename(normalizedPath),
          path: normalizedPath,
          sizeBytes: stat.size,
          sizeLabel: formatBytes(stat.size),
          type: isVideo ? "video" : "document",
          format: ext.replace(".", "").toUpperCase(),
          thumbnailUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-001-thumb.jpg",
          previewUrl: "/api/files/tenant-demo/album-demo-01/duoi-ca/anh-001.jpg",
          downloadUrl: "#",
        },
      ],
      videoMeta: isVideo
        ? {
            videoUrl: "#",
            durationSeconds: 180,
            durationLabel: "03:00",
            resolution: "4K UHD (3840 x 2160)",
            coverUrl: "/marketing/dashboard.jpg",
          }
        : undefined,
    };
  }

  // Directory scan
  const dirents = fs.readdirSync(normalizedPath, { withFileTypes: true });
  const items = [];
  let totalSizeBytes = 0;
  let rawCount = 0;
  let videoCount = 0;

  for (const dirent of dirents) {
    if (dirent.name.startsWith(".") || dirent.name.startsWith("$")) continue;
    if (items.length >= maxFiles) break;

    const fullPath = path.join(normalizedPath, dirent.name);
    try {
      const fileStat = fs.statSync(fullPath);
      if (fileStat.isFile()) {
        const ext = path.extname(dirent.name).toLowerCase();
        let fileType = "document";
        if (RAW_EXTS.has(ext)) {
          fileType = "raw";
          rawCount++;
        } else if (IMG_EXTS.has(ext)) {
          fileType = "image";
        } else if (VIDEO_EXTS.has(ext)) {
          fileType = "video";
          videoCount++;
        } else if (DOC_EXTS.has(ext)) {
          fileType = "document";
        }

        totalSizeBytes += fileStat.size;
        const sample = DEMO_PREVIEWS[items.length % DEMO_PREVIEWS.length];
        items.push({
          id: `item-${items.length + 1}`,
          name: dirent.name,
          filename: dirent.name,
          path: fullPath,
          sizeBytes: fileStat.size,
          sizeLabel: formatBytes(fileStat.size),
          type: fileType,
          format: ext.replace(".", "").toUpperCase(),
          thumbnailUrl: `/api/files/tenant-demo/album-demo-01/${sample.folder}/${sample.name}-thumb.jpg`,
          previewUrl: `/api/files/tenant-demo/album-demo-01/${sample.folder}/${sample.name}.jpg`,
          downloadUrl: "#",
        });
      }
    } catch {
      // Skip inaccessible file
    }
  }

  let detectedType = "folder";
  if (items.length > 0 && rawCount / items.length > 0.3) {
    detectedType = "album";
  } else if (items.length > 0 && (items[0].type === "image" || items[0].type === "raw")) {
    detectedType = "album";
  } else if (items.length === 1 && videoCount === 1) {
    detectedType = "video";
  }

  return {
    title: path.basename(normalizedPath),
    localPath: normalizedPath,
    type: detectedType,
    totalFiles: items.length,
    totalSizeBytes,
    totalSizeLabel: formatBytes(totalSizeBytes),
    items,
  };
}

module.exports = {
  scanFolder,
  formatBytes,
};
