import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getR2Config, createR2Adapter } from "@/lib/storage/r2-storage";
import { getStorageProvider, getStorageAdapter } from "@/lib/adapters/storage";

describe("Cloudflare R2 Storage Adapter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null config when R2 env vars are absent", () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;

    expect(getR2Config()).toBeNull();
  });

  it("parses valid R2 configuration from environment variables", () => {
    process.env.R2_ACCOUNT_ID = "test-account-id-123456";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET_NAME = "studiocore-test-bucket";
    process.env.R2_PUBLIC_URL = "https://media.studiocore.io.vn/";

    const cfg = getR2Config();
    expect(cfg).not.toBeNull();
    expect(cfg?.accountId).toBe("test-account-id-123456");
    expect(cfg?.bucketName).toBe("studiocore-test-bucket");
    expect(cfg?.publicUrl).toBe("https://media.studiocore.io.vn");
  });

  it("creates configured R2 adapter when env is present", () => {
    process.env.R2_ACCOUNT_ID = "test-account-id-123456";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET_NAME = "studiocore-test-bucket";
    process.env.R2_PUBLIC_URL = "https://media.studiocore.io.vn";

    const adapter = createR2Adapter();
    expect(adapter.provider).toBe("r2");
    expect(adapter.configured).toBe(true);
    expect(adapter.publicUrl("albums/show-1/anh-1.jpg")).toBe(
      "https://media.studiocore.io.vn/albums/show-1/anh-1.jpg",
    );
  });

  it("automatically selects R2 adapter when R2 credentials exist", () => {
    process.env.R2_ACCOUNT_ID = "test-account-id-123456";
    process.env.R2_ACCESS_KEY_ID = "test-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
    process.env.R2_BUCKET_NAME = "studiocore-test-bucket";

    expect(getStorageProvider()).toBe("r2");
    const adapter = getStorageAdapter();
    expect(adapter.provider).toBe("r2");
    expect(adapter.configured).toBe(true);
  });
});
