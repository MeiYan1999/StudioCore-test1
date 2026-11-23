"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "tif", "tiff", "gif"]);
const RAW_EXT = new Set([
  "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "raf", "dng", "orf", "rw2", "pef", "srw", "x3f", "3fr", "iiq", "raw",
]);
const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "webm", "mkv"]);
const MAX_FILES = 20000;
const MAX_DEPTH = 6;
const SKIP_DIRS = new Set(["khach-chon", "node_modules", "$recycle.bin", "system volume information"]);

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

function kindOf(name) {
  const ext = extOf(name);
  if (IMAGE_EXT.has(ext)) return "image";
  if (RAW_EXT.has(ext)) return "raw";
  if (VIDEO_EXT.has(ext)) return "video";
  return null;
}

function stem(name) {
  const i = name.lastIndexOf(".");
  return (i < 0 ? name : name.slice(0, i)).toLowerCase();
}

/** Khoá công khai của tệp: không lộ đường dẫn, ổn định giữa các lần quét. */
function fileKey(salt, relPath) {
  return crypto
    .createHash("sha256")
    .update(`${salt}\n${relPath.split(path.sep).join("/")}`)
    .digest("base64url")
    .slice(0, 22);
}

const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

/**
 * Quét thư mục thành danh mục tệp. Ở chế độ thông thường, RAW có ảnh JPG cùng tên
 * không được đưa lên link (khách xem JPG; RAW được ghép lại khi lọc ảnh đã chọn).
 */
async function scanFolder(root, salt, options = {}) {
  const entries = [];
  const includeAllFiles = options.includeAllFiles === true;
  const skipDirs = new Set([
    ...SKIP_DIRS,
    ...(Array.isArray(options.skipDirs)
      ? options.skipDirs.filter((name) => typeof name === "string").map((name) => name.toLowerCase())
      : []),
  ]);
  async function walk(dir, depth) {
    let list;
    try {
      list = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    list.sort((a, b) => collator.compare(a.name, b.name));
    const viewable = new Set(
      list.filter((d) => d.isFile() && kindOf(d.name) === "image").map((d) => stem(d.name)),
    );
    for (const item of list) {
      if (entries.length >= MAX_FILES) return;
      if (item.name.startsWith(".") || item.isSymbolicLink()) continue;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (depth < MAX_DEPTH && !skipDirs.has(item.name.toLowerCase())) await walk(full, depth + 1);
        continue;
      }
      if (!item.isFile()) continue;
      const detectedKind = kindOf(item.name);
      const kind = detectedKind || (includeAllFiles ? "other" : null);
      if (!kind) continue;
      if (!includeAllFiles && kind === "raw" && viewable.has(stem(item.name))) continue;
      let stat;
      try {
        stat = await fs.stat(full);
      } catch {
        continue;
      }
      const rel = path.relative(root, full);
      entries.push({ key: fileKey(salt, rel), name: item.name, kind, size: stat.size, rel });
    }
  }
  await walk(root, 0);
  return entries;
}

/** Trả về đường dẫn tuyệt đối nếu `rel` thật sự nằm trong `root` (chặn `..` và symlink thoát ra ngoài). */
async function resolveInside(root, rel) {
  if (typeof rel !== "string" || rel.length === 0 || path.isAbsolute(rel)) return null;
  try {
    const realRoot = await fs.realpath(root);
    const real = await fs.realpath(path.join(realRoot, rel));
    const relative = path.relative(realRoot, real);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return real;
  } catch {
    return null;
  }
}

module.exports = { scanFolder, resolveInside, fileKey, kindOf, extOf, stem, RAW_EXT, IMAGE_EXT, VIDEO_EXT };
