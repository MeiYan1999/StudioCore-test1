import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Config } from "../storage/r2-storage";

const DB_OBJECT_KEY = "db/studiocore.db";

function getS3Client() {
  const cfg = getR2Config();
  if (!cfg) return null;

  return {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    }),
    bucket: cfg.bucketName,
  };
}

export async function restoreDbFromR2(targetPath?: string): Promise<boolean> {
  const dbPath = targetPath || path.join(process.cwd(), "data", "studiocore.db");
  const s3 = getS3Client();
  if (!s3) {
    console.warn("[R2 Backup] R2 chưa được cấu hình, bỏ qua phục hồi database.");
    return false;
  }

  try {
    const res = await s3.client.send(
      new GetObjectCommand({
        Bucket: s3.bucket,
        Key: DB_OBJECT_KEY,
      }),
    );

    if (!res.Body) return false;

    const bytes = await res.Body.transformToByteArray();
    if (!bytes || bytes.length === 0) return false;

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, Buffer.from(bytes));
    // Đánh dấu đã có dữ liệu để không chạy seed ghi đè tài khoản người dùng
    try {
      fs.writeFileSync(path.join(path.dirname(dbPath), ".seeded"), "restored-from-r2");
    } catch {}

    console.log(`[R2 Backup] ✅ Đã phục hồi database từ Cloudflare R2 (${(bytes.length / 1024 / 1024).toFixed(2)} MB)!`);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NoSuchKey") || message.includes("404")) {
      console.log("[R2 Backup] Chưa có bản sao lưu database trên R2, bắt đầu với database mới.");
    } else {
      console.warn(`[R2 Backup] Không thể tải database từ R2: ${message}`);
    }
    return false;
  }
}

export async function backupDbToR2(sourcePath?: string): Promise<boolean> {
  const dbPath = sourcePath || path.join(process.cwd(), "data", "studiocore.db");
  const s3 = getS3Client();
  if (!s3) return false;

  if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) return false;

  try {
    // Flush WAL trước khi copy file db
    try {
      const { getDb } = await import("./client");
      const db = getDb();
      (db as unknown as { $client?: { pragma?: (source: string) => unknown } }).$client?.pragma?.("wal_checkpoint(TRUNCATE)");
    } catch {}

    const buffer = fs.readFileSync(/*turbopackIgnore: true*/ dbPath);
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: DB_OBJECT_KEY,
        Body: buffer,
        ContentType: "application/x-sqlite3",
      }),
    );
    console.log(`[R2 Backup] ☁️ Đã sao lưu database lên Cloudflare R2 (${(buffer.length / 1024 / 1024).toFixed(2)} MB).`);
    return true;
  } catch (err: unknown) {
    console.warn("[R2 Backup] Lỗi khi sao lưu database lên R2:", err);
    return false;
  }
}

let backupTimeout: NodeJS.Timeout | null = null;

export function triggerDbBackupDebounced(delayMs = 2000) {
  if (backupTimeout) {
    clearTimeout(backupTimeout);
  }
  backupTimeout = setTimeout(() => {
    backupDbToR2().catch(() => {});
  }, delayMs);
}
