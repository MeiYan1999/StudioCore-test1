import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

export const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(process.cwd(), "public", "uploads");
export const DEMO_DRIVE_ROOT = path.join(process.cwd(), "demo-data", "drive");
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export function sanitizeSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}

export function sanitizeFilename(filename: string): string {
  return path.basename(filename).replace(/[\u0000-\u001f]/g, "");
}

export function resolveStoragePath(key: string, root = UPLOAD_ROOT): string {
  if (path.isAbsolute(key) || key.startsWith("/") || key.startsWith("\\")) {
    throw new Error("Storage key không hợp lệ.");
  }
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Storage key không hợp lệ.");
  }
  const fullPath = path.join(/* turbopackIgnore: true */ root, normalized);
  if (!fullPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Storage key không được trỏ ra ngoài thư mục uploads.");
  }
  return fullPath;
}

export function writeStorageBuffer(key: string, buffer: Buffer): void {
  const fullPath = resolveStoragePath(key);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
}

export function writeDemoDriveBuffer(key: string, buffer: Buffer): void {
  const fullPath = resolveStoragePath(key, DEMO_DRIVE_ROOT);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
}

export function readStorageBuffer(key: string): Buffer {
  return fs.readFileSync(/* turbopackIgnore: true */ resolveStoragePath(key));
}

export function publicUploadUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function watermarkSvg(width: number, height: number, fontSize: number): Buffer {
  const barHeight = Math.round(fontSize * 2.2);
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="${height - barHeight}" width="${width}" height="${barHeight}" fill="rgba(15,23,42,0.62)"/>
      <text x="${Math.round(fontSize * 1.1)}" y="${height - Math.round(barHeight * 0.32)}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white">StudioCore · ẢNH DEMO · KHÔNG PHẢI ẢNH KHÁCH THẬT</text>
    </svg>`,
  );
}

export async function processImageBuffer(
  buffer: Buffer,
  keyBase: string,
): Promise<{
  width: number;
  height: number;
  size: number;
  format: string;
  checksum: string;
  storageKey: string;
  thumbnailKey: string;
  previewKey: string;
}> {
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Dung lượng ảnh không hợp lệ.");
  }

  const image = sharp(buffer, { limitInputPixels: 80_000_000 });
  let metadata: Awaited<ReturnType<typeof image.metadata>>;
  try {
    metadata = await image.metadata();
  } catch {
    throw new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
  }
  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    throw new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
  }
  if (!metadata.width || !metadata.height) {
    throw new Error("Không đọc được kích thước ảnh.");
  }

  const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;
  const storageKey = `${keyBase}.${extension}`;
  const thumbnailKey = `${keyBase}-thumb.jpg`;
  const previewKey = `${keyBase}-preview.jpg`;

  writeStorageBuffer(storageKey, buffer);

  const thumbnail = await sharp(buffer)
    .rotate()
    .resize({ width: 480, height: 320, fit: "cover" })
    .composite([{ input: watermarkSvg(480, 320, 12), top: 0, left: 0 }])
    .jpeg({ quality: 78 })
    .toBuffer();
  writeStorageBuffer(thumbnailKey, thumbnail);

  const preview = await sharp(buffer)
    .rotate()
    .resize({ width: 1440, height: 960, fit: "cover" })
    .composite([{ input: watermarkSvg(1440, 960, 26), top: 0, left: 0 }])
    .jpeg({ quality: 82 })
    .toBuffer();
  writeStorageBuffer(previewKey, preview);

  return {
    width: metadata.width,
    height: metadata.height,
    size: buffer.length,
    format: metadata.format,
    checksum: sha256(buffer),
    storageKey,
    thumbnailKey,
    previewKey,
  };
}

export async function generateDemoAlbumAssets(): Promise<void> {
  const { DEMO_ALBUM, demoPhotoStorageKey, demoDriveFilePath } =
    await import("../demo-album");

  for (const photo of DEMO_ALBUM.photos) {
    const folder = DEMO_ALBUM.folders.find((item) => item.key === photo.folder);
    if (!folder) {
      continue;
    }
    const svg = Buffer.from(
      `<svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#dbeafe"/>
            <stop offset="55%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#fce7f3"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="800" fill="url(#g)"/>
        <circle cx="920" cy="190" r="150" fill="#bfdbfe" opacity="0.65"/>
        <circle cx="260" cy="620" r="190" fill="#fbcfe8" opacity="0.45"/>
        <rect x="80" y="80" width="1040" height="640" rx="30" fill="none" stroke="#94a3b8" stroke-width="2"/>
        <text x="100" y="150" font-family="Arial, sans-serif" font-size="34" fill="#334155">StudioCore · Ảnh demo</text>
        <text x="100" y="205" font-family="Arial, sans-serif" font-size="22" fill="#64748b">${folder.name}</text>
        <text x="100" y="680" font-family="Arial, sans-serif" font-size="42" fill="#0f172a">${photo.code}</text>
        <text x="100" y="720" font-family="Arial, sans-serif" font-size="18" fill="#64748b">Ảnh synthetic, không dùng người thật</text>
      </svg>`,
    );
    const jpeg = await sharp(svg).jpeg({ quality: 82 }).toBuffer();
    const storageKey = demoPhotoStorageKey(photo.folder, photo.filename);
    await processImageBuffer(jpeg, storageKey.replace(/\.[^.]+$/, ""));

    writeDemoDriveBuffer(
      demoDriveFilePath(photo.folder, photo.filename),
      jpeg,
    );
  }
}
