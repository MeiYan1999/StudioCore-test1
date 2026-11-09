import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { mimeForFilename } from "../http/download";
import type { StorageAdapter, ProcessedImage } from "../adapters/storage";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB for cloud R2

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

export function getR2Config(): R2Config | null {
  const accountId =
    process.env.R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID;
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName =
    process.env.R2_BUCKET_NAME ||
    process.env.R2_BUCKET ||
    process.env.AWS_BUCKET_NAME;
  const publicUrl =
    process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl: publicUrl?.replace(/\/$/, ""),
  };
}

export function createR2Adapter(): StorageAdapter {
  const cfg = getR2Config();

  if (!cfg) {
    return {
      provider: "r2",
      configured: false,
      demoPublic: false,
      label: "Cloudflare R2 (chưa cấu hình biến môi trường)",
      async put() {
        throw new Error(
          "Cloudflare R2 chưa được cấu hình. Vui lòng cung cấp R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.",
        );
      },
      async read() {
        throw new Error("Cloudflare R2 chưa được cấu hình.");
      },
      async processImage() {
        throw new Error("Cloudflare R2 chưa được cấu hình.");
      },
      publicUrl(key) {
        return `/api/files/${key}`;
      },
    };
  }

  const endpoint = `https://${cfg.accountId}.r2.cloudflarestorage.com`;
  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  const adapter: StorageAdapter = {
    provider: "r2",
    configured: true,
    demoPublic: !!cfg.publicUrl,
    label: `Cloudflare R2 (${cfg.bucketName})`,

    async put(key: string, buffer: Buffer): Promise<void> {
      const cleanKey = key.replace(/^\/+/, "");
      await s3.send(
        new PutObjectCommand({
          Bucket: cfg.bucketName,
          Key: cleanKey,
          Body: buffer,
          ContentType: mimeForFilename(cleanKey),
        }),
      );
    },

    async read(key: string): Promise<Buffer> {
      const cleanKey = key.replace(/^\/+/, "");
      const res = await s3.send(
        new GetObjectCommand({
          Bucket: cfg.bucketName,
          Key: cleanKey,
        }),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) {
        throw new Error(`Không tìm thấy file trên R2: ${key}`);
      }
      return Buffer.from(bytes);
    },

    async processImage(buffer: Buffer, keyBase: string): Promise<ProcessedImage> {
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
        throw new Error("Dung lượng ảnh vượt quá giới hạn cho phép.");
      }

      const image = sharp(buffer, { limitInputPixels: 100_000_000 });
      let metadata: Awaited<ReturnType<typeof image.metadata>>;
      try {
        metadata = await image.metadata();
      } catch {
        throw new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
      }

      if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
        throw new Error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
      }

      const origWidth = metadata.width ?? 1200;
      const origHeight = metadata.height ?? 800;

      // 1. Bản gốc WebP chất lượng cao
      const originalWebp = await sharp(buffer)
        .rotate()
        .webp({ quality: 90 })
        .toBuffer();

      // 2. Thumbnail
      const thumbBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 360, height: 360, fit: "cover", position: "centre" })
        .webp({ quality: 80 })
        .toBuffer();

      // 3. Preview với watermark nhẹ bảo vệ ảnh studio
      const previewBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

      const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
      const cleanBase = keyBase.replace(/^\/+/, "");

      const storageKey = `${cleanBase}.webp`;
      const thumbnailKey = `${cleanBase}-thumb.webp`;
      const previewKey = `${cleanBase}-preview.webp`;

      // Upload song song cả 3 phiên bản lên Cloudflare R2
      await Promise.all([
        adapter.put(storageKey, originalWebp),
        adapter.put(thumbnailKey, thumbBuffer),
        adapter.put(previewKey, previewBuffer),
      ]);

      return {
        width: origWidth,
        height: origHeight,
        size: originalWebp.length,
        format: "webp",
        checksum,
        storageKey,
        thumbnailKey,
        previewKey,
      };
    },

    publicUrl(key: string): string {
      const cleanKey = key.replace(/^\/+/, "");
      if (cfg.publicUrl) {
        return `${cfg.publicUrl}/${cleanKey}`;
      }
      return `/api/files/${cleanKey.split("/").map(encodeURIComponent).join("/")}`;
    },
  };

  return adapter;
}
