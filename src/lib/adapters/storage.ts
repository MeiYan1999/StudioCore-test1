import type { Buffer } from "node:buffer";
import {
  MAX_UPLOAD_BYTES,
  processImageBuffer,
  publicUploadUrl,
  readStorageBuffer,
  writeStorageBuffer,
} from "../storage/local-storage";
import { createR2Adapter, getR2Config } from "../storage/r2-storage";

export type StorageProvider = "local" | "s3" | "r2";

export type ProcessedImage = {
  width: number;
  height: number;
  size: number;
  format: string;
  checksum: string;
  storageKey: string;
  thumbnailKey: string;
  previewKey: string;
};

export type StorageAdapter = {
  provider: StorageProvider;
  configured: boolean;
  demoPublic: boolean;
  label: string;
  put(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  processImage(buffer: Buffer, keyBase: string): Promise<ProcessedImage>;
  publicUrl(key: string): string;
};

const localAdapter: StorageAdapter = {
  provider: "local",
  configured: true,
  demoPublic: true,
  label: "Local demo (/public/uploads)",
  async put(key, buffer) {
    writeStorageBuffer(key, buffer);
  },
  async read(key) {
    return readStorageBuffer(key);
  },
  async processImage(buffer, keyBase) {
    return processImageBuffer(buffer, keyBase);
  },
  publicUrl(key) {
    return publicUploadUrl(key);
  },
};

function unconfiguredAdapter(
  provider: Exclude<StorageProvider, "local">,
): StorageAdapter {
  const fail = (): never => {
    throw new Error(
      `Storage ${provider.toUpperCase()} chưa được cấu hình. Đặt STORAGE_PROVIDER=local cho môi trường demo.`,
    );
  };
  return {
    provider,
    configured: false,
    demoPublic: false,
    label: `${provider.toUpperCase()} (chưa cấu hình)`,
    async put() {
      return fail();
    },
    async read() {
      return fail();
    },
    async processImage() {
      return fail();
    },
    publicUrl() {
      return fail();
    },
  };
}

export function getStorageProvider(): StorageProvider {
  const value = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (value === "s3" || value === "r2") {
    return value;
  }
  if (getR2Config()) {
    return "r2";
  }
  return "local";
}

export function getStorageAdapter(): StorageAdapter {
  const provider = getStorageProvider();
  if (provider === "s3") {
    return unconfiguredAdapter("s3");
  }
  if (provider === "r2") {
    return createR2Adapter();
  }
  return localAdapter;
}

export function storageEnvSummary(): {
  provider: StorageProvider;
  configured: boolean;
  demoPublic: boolean;
  maxUploadMb: number;
  note: string;
} {
  const adapter = getStorageAdapter();
  return {
    provider: adapter.provider,
    configured: adapter.configured,
    demoPublic: adapter.demoPublic,
    maxUploadMb: Math.round(MAX_UPLOAD_BYTES / (1024 * 1024)),
    note: adapter.demoPublic
      ? "Ảnh demo công khai tại /public/uploads. Production phải dùng private storage + signed URL hoặc route kiểm tra quyền."
      : "Storage ngoài chưa cấu hình; upload sẽ báo lỗi thay vì giả lập thành công.",
  };
}
