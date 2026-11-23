import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Config } from "../storage/r2-storage";

const DB_OBJECT_KEY = "db/studiocore.db";
const lastSuccessfulBackups = new Map<string, string>();
const backupJobs = new Map<string, Promise<boolean>>();

type SqliteClient = {
  backup?: (destination: string) => Promise<unknown>;
  pragma?: (source: string) => unknown;
};

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

export async function restoreDbFromR2IfMissing(
  targetPath?: string,
): Promise<"kept" | "restored" | "none"> {
  const dbPath =
    targetPath ?? (await import("./client")).resolveDbFilename();
  try {
    const stat = fs.statSync(/*turbopackIgnore: true*/ dbPath);
    if (stat.isFile() && stat.size > 0) return "kept";
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[R2 Backup] Không thể kiểm tra database hiện có: ${message}`);
      throw err;
    }
  }

  const s3 = getS3Client();
  if (!s3) {
    console.warn("[R2 Backup] R2 chưa được cấu hình, bỏ qua phục hồi database.");
    return "none";
  }

  const restorePath = `${dbPath}.restore-tmp`;
  try {
    const res = await s3.client.send(
      new GetObjectCommand({
        Bucket: s3.bucket,
        Key: DB_OBJECT_KEY,
      }),
    );

    if (!res.Body) throw new Error("R2 không trả về nội dung database.");

    const bytes = await res.Body.transformToByteArray();
    if (!bytes || bytes.length === 0) {
      throw new Error("Database được tải từ R2 đang trống.");
    }

    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(/*turbopackIgnore: true*/ restorePath, Buffer.from(bytes));
    fs.rmSync(/*turbopackIgnore: true*/ `${dbPath}-wal`, { force: true });
    fs.rmSync(/*turbopackIgnore: true*/ `${dbPath}-shm`, { force: true });
    fs.renameSync(/*turbopackIgnore: true*/ restorePath, dbPath);

    console.log(`[R2 Backup] ✅ Đã phục hồi database từ Cloudflare R2 (${(bytes.length / 1024 / 1024).toFixed(2)} MB)!`);
    return "restored";
  } catch (err: unknown) {
    const error =
      typeof err === "object" && err !== null
        ? (err as {
            name?: string;
            $metadata?: { httpStatusCode?: number };
          })
        : undefined;
    if (
      error?.name === "NoSuchKey" ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      console.log("[R2 Backup] Chưa có bản sao lưu database trên R2, bắt đầu với database mới.");
      return "none";
    } else {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[R2 Backup] Không thể tải database từ R2: ${message}`);
      throw err;
    }
  } finally {
    fs.rmSync(/*turbopackIgnore: true*/ restorePath, { force: true });
  }
}

function getDatabaseFingerprint(dbPath: string): string {
  const dbStat = fs.statSync(/*turbopackIgnore: true*/ dbPath);
  if (!dbStat.isFile()) throw new Error("Database path is not a file");

  let walFingerprint = "missing";
  try {
    const walStat = fs.statSync(/*turbopackIgnore: true*/ `${dbPath}-wal`);
    walFingerprint = `${walStat.mtimeMs}:${walStat.size}`;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  return `${dbStat.mtimeMs}:${dbStat.size}:${walFingerprint}`;
}

async function performDbBackup(dbPath: string): Promise<boolean> {
  const s3 = getS3Client();
  if (!s3) return false;

  let fingerprint: string;
  try {
    fingerprint = getDatabaseFingerprint(dbPath);
  } catch {
    return false;
  }
  if (lastSuccessfulBackups.get(dbPath) === fingerprint) return true;

  const snapshotPath = `${dbPath}.${process.pid}.${crypto.randomUUID()}.backup-tmp`;
  try {
    const { resolveDbFilename } = await import("./client");
    let buffer: Buffer;
    if (path.resolve(dbPath) === resolveDbFilename()) {
      const { getDb } = await import("./client");
      const sqlite = (getDb() as unknown as { $client?: SqliteClient }).$client;
      if (sqlite?.backup) {
        try {
          await sqlite.backup(snapshotPath);
          buffer = fs.readFileSync(/*turbopackIgnore: true*/ snapshotPath);
        } catch {
          fs.rmSync(/*turbopackIgnore: true*/ snapshotPath, { force: true });
          try {
            sqlite.pragma?.("wal_checkpoint(TRUNCATE)");
          } catch {}
          buffer = fs.readFileSync(/*turbopackIgnore: true*/ dbPath);
        }
      } else {
        try {
          sqlite?.pragma?.("wal_checkpoint(TRUNCATE)");
        } catch {}
        buffer = fs.readFileSync(/*turbopackIgnore: true*/ dbPath);
      }
    } else {
      const { default: Database } = await import("better-sqlite3");
      const sqlite = new Database(dbPath, {
        readonly: true,
        fileMustExist: true,
      });
      try {
        await sqlite.backup(snapshotPath);
        buffer = fs.readFileSync(/*turbopackIgnore: true*/ snapshotPath);
      } finally {
        sqlite.close();
      }
    }

    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: DB_OBJECT_KEY,
        Body: buffer,
        ContentType: "application/x-sqlite3",
      }),
    );
    lastSuccessfulBackups.set(dbPath, fingerprint);
    console.log(`[R2 Backup] ☁️ Đã sao lưu database lên Cloudflare R2 (${(buffer.length / 1024 / 1024).toFixed(2)} MB).`);
    return true;
  } catch (err: unknown) {
    console.warn("[R2 Backup] Lỗi khi sao lưu database lên R2:", err);
    return false;
  } finally {
    fs.rmSync(/*turbopackIgnore: true*/ snapshotPath, { force: true });
  }
}

export async function backupDbToR2(sourcePath?: string): Promise<boolean> {
  let dbPath: string;
  try {
    dbPath = path.resolve(
      sourcePath ?? (await import("./client")).resolveDbFilename(),
    );
  } catch (err: unknown) {
    console.warn("[R2 Backup] Không thể xác định đường dẫn database:", err);
    return false;
  }
  const existing = backupJobs.get(dbPath);
  if (existing) return existing;

  const job = performDbBackup(dbPath).finally(() => backupJobs.delete(dbPath));
  backupJobs.set(dbPath, job);
  return job;
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
