import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getR2Config } from "../storage/r2-storage";

const DB_OBJECT_KEY = "db/studiocore.db";
const lastSuccessfulBackups = new Map<string, string>();
const backupJobs = new Map<string, Promise<boolean>>();

type BackupState = {
  etag: string | null;
  digest: string | null;
  pending?: string[];
};

const SNAPSHOT_DIGEST_METADATA = "snapshot-sha256";
const SHA256 = /^[a-f0-9]{64}$/;
const EMPTY_STATE: BackupState = { etag: null, digest: null };

class BackupConflictError extends Error {}

function readBackupState(dbPath: string): BackupState | undefined {
  const statePath = `${dbPath}.r2-state.json`;
  try {
    const state = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ statePath, "utf8"));
    if (!state ||
      !((state.etag === null && state.digest === null) ||
        (typeof state.etag === "string" && !!state.etag &&
          typeof state.digest === "string" && SHA256.test(state.digest))) ||
      (state.pending !== undefined && (!Array.isArray(state.pending) ||
        state.pending.some((digest: unknown) => typeof digest !== "string" || !SHA256.test(digest))))) {
      throw new Error("Trạng thái sao lưu R2 không hợp lệ.");
    }
    return state;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function writeBackupState(dbPath: string, state: BackupState) {
  const statePath = `${dbPath}.r2-state.json`;
  const tempPath = `${statePath}.tmp`;
  fs.writeFileSync(/*turbopackIgnore: true*/ tempPath, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(/*turbopackIgnore: true*/ tempPath, statePath);
}

function snapshotDigest(bytes: Buffer) {
  const hash = crypto.createHash("sha256");
  if (bytes.subarray(0, 16).toString("ascii") === "SQLite format 3\0") {
    // SQLite header bytes 18 and 19 change when switching journal modes.
    return hash.update(bytes.subarray(0, 18)).update(bytes.subarray(20)).digest("hex");
  }
  return hash.update(bytes).digest("hex");
}

async function snapshotDatabase(dbPath: string, sqlite?: Database.Database) {
  const snapshotPath = `${dbPath}.${process.pid}.${crypto.randomUUID()}.backup-tmp`;
  const source = sqlite ?? new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(snapshotPath);
    return fs.readFileSync(/*turbopackIgnore: true*/ snapshotPath);
  } finally {
    if (!sqlite) source.close();
    fs.rmSync(/*turbopackIgnore: true*/ snapshotPath, { force: true });
  }
}

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

type R2Connection = NonNullable<ReturnType<typeof getS3Client>>;

function isMissingObject(error: unknown) {
  const failure = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return failure?.name === "NoSuchKey" || failure?.name === "NotFound" ||
    (failure?.name !== "NoSuchBucket" && failure?.$metadata?.httpStatusCode === 404);
}

async function headBackup(s3: R2Connection) {
  try {
    const remote = await s3.client.send(new HeadObjectCommand({
      Bucket: s3.bucket, Key: DB_OBJECT_KEY,
    }));
    if (!remote.ETag) throw new Error("R2 không trả về ETag của bản sao lưu.");
    return { etag: remote.ETag, metadata: remote.Metadata };
  } catch (error) {
    if (isMissingObject(error)) return null;
    throw error;
  }
}

async function recoverPendingUpload(dbPath: string, s3: R2Connection, state: BackupState): Promise<BackupState> {
  if (!state.pending?.length) return state;

  const remote = await headBackup(s3);
  const digest = remote?.metadata?.[SNAPSHOT_DIGEST_METADATA];
  if (remote && digest && state.pending.includes(digest)) {
    const confirmed = { etag: remote.etag, digest };
    writeBackupState(dbPath, confirmed);
    return confirmed;
  }
  if ((remote?.etag ?? null) !== state.etag) throw new BackupConflictError();
  return state;
}

async function stageRemoteDb(s3: R2Connection, tempPath: string, etag?: string) {
  const result = await s3.client.send(new GetObjectCommand({
    Bucket: s3.bucket,
    Key: DB_OBJECT_KEY,
    IfMatch: etag,
  }));
  if (!result.Body || !result.ETag) throw new Error("R2 không trả về database hoặc ETag.");
  const bytes = await result.Body.transformToByteArray();
  if (bytes.length === 0) throw new Error("Database được tải từ R2 đang trống.");
  fs.writeFileSync(/*turbopackIgnore: true*/ tempPath, Buffer.from(bytes));
  return { etag: result.ETag, size: bytes.length, digest: snapshotDigest(await snapshotDatabase(tempPath)) };
}

function removeStagedDb(tempPath: string) {
  fs.rmSync(/*turbopackIgnore: true*/ tempPath, { force: true });
  fs.rmSync(/*turbopackIgnore: true*/ `${tempPath}-wal`, { force: true });
  fs.rmSync(/*turbopackIgnore: true*/ `${tempPath}-shm`, { force: true });
}

async function establishRetainedBaseline(dbPath: string) {
  if (readBackupState(dbPath)) return;
  const s3 = getS3Client();
  if (!s3) return;
  const remote = await headBackup(s3);
  if (!remote) return;
  const tempPath = `${dbPath}.r2-compare-tmp`;
  try {
    const snapshot = await stageRemoteDb(s3, tempPath, remote.etag);
    const digest = snapshotDigest(await snapshotDatabase(dbPath));
    if (digest !== snapshot.digest) {
      console.error("[R2 Backup] XUNG ĐỘT: database giữ lại khác bản R2 và chưa có ETag gốc. Giữ cả hai bản để đối chiếu, không ghi đè.");
      return;
    }
    writeBackupState(dbPath, { etag: snapshot.etag, digest });
  } finally {
    removeStagedDb(tempPath);
  }
}

export async function restoreDbFromR2IfMissing(
  targetPath?: string,
): Promise<"kept" | "restored" | "none"> {
  const dbPath =
    targetPath ?? (await import("./client")).resolveDbFilename();
  let kept = false;
  try {
    const stat = fs.statSync(/*turbopackIgnore: true*/ dbPath);
    kept = stat.isFile() && stat.size > 0;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[R2 Backup] Không thể kiểm tra database hiện có: ${message}`);
      throw err;
    }
  }
  if (kept) {
    await establishRetainedBaseline(dbPath);
    return "kept";
  }

  const s3 = getS3Client();
  if (!s3) {
    if (process.env.STORAGE_PROVIDER === "r2") {
      throw new Error("Cần cấu hình Cloudflare R2 trước khi khởi động với STORAGE_PROVIDER=r2.");
    }
    console.warn("[R2 Backup] R2 chưa được cấu hình, bỏ qua phục hồi database.");
    return "none";
  }

  const restorePath = `${dbPath}.restore-tmp`;
  try {
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(dbPath), { recursive: true });
    const { etag, digest, size } = await stageRemoteDb(s3, restorePath);
    fs.rmSync(/*turbopackIgnore: true*/ `${dbPath}-wal`, { force: true });
    fs.rmSync(/*turbopackIgnore: true*/ `${dbPath}-shm`, { force: true });
    writeBackupState(dbPath, { etag, digest });
    fs.renameSync(/*turbopackIgnore: true*/ restorePath, dbPath);

    console.log(`[R2 Backup] ✅ Đã phục hồi database từ Cloudflare R2 (${(size / 1024 / 1024).toFixed(2)} MB)!`);
    return "restored";
  } catch (err: unknown) {
    const error =
      typeof err === "object" && err !== null
        ? (err as { name?: string })
        : undefined;
    if (error?.name === "NoSuchKey") {
      const statePath = `${dbPath}.r2-state.json`;
      fs.rmSync(/*turbopackIgnore: true*/ statePath, { force: true });
      console.log("[R2 Backup] Chưa có bản sao lưu database trên R2, bắt đầu với database mới.");
      return "none";
    } else {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[R2 Backup] Không thể tải database từ R2: ${message}`);
      throw err;
    }
  } finally {
    removeStagedDb(restorePath);
  }
}

function getDatabaseFingerprint(dbPath: string): string {
  const dbStat = fs.statSync(/*turbopackIgnore: true*/ dbPath, { bigint: true });
  if (!dbStat.isFile()) throw new Error("Database path is not a file");

  let walFingerprint = "missing";
  try {
    const walStat = fs.statSync(/*turbopackIgnore: true*/ `${dbPath}-wal`, { bigint: true });
    walFingerprint = `${walStat.mtimeNs}:${walStat.ctimeNs}:${walStat.size}`;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  return `${dbStat.mtimeNs}:${dbStat.ctimeNs}:${dbStat.size}:${walFingerprint}`;
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

  const generation = process.env.DB_BACKUP_GENERATION;
  if (generation !== undefined) {
    const generationNumber = Number(generation);
    if (generation.trim() === "" || !Number.isFinite(generationNumber)) {
      console.warn("[R2 Backup] DB_BACKUP_GENERATION không hợp lệ, bỏ qua sao lưu.");
      return false;
    }

    try {
      const current = await s3.client.send(
        new HeadObjectCommand({
          Bucket: s3.bucket,
          Key: DB_OBJECT_KEY,
        }),
      );
      const remoteGeneration = current.Metadata?.generation;
      if (
        remoteGeneration !== undefined &&
        Number.isFinite(Number(remoteGeneration)) &&
        Number(remoteGeneration) > generationNumber
      ) {
        console.error("[R2 Backup] XUNG ĐỘT: instance mới hơn sở hữu bản sao lưu. Không ghi đè.");
        return false;
      }
    } catch (err: unknown) {
      const error =
        typeof err === "object" && err !== null
          ? (err as {
              name?: string;
              $metadata?: { httpStatusCode?: number };
            })
          : undefined;
      if (
        error?.name !== "NoSuchKey" &&
        error?.$metadata?.httpStatusCode !== 404
      ) {
        console.warn(
          "[R2 Backup] Không thể kiểm tra bản sao lưu hiện có, bỏ qua sao lưu:",
          err,
        );
        return false;
      }
    }
  }

  try {
    let sqlite: Database.Database | undefined;
    const { resolveDbFilename } = await import("./client");
    if (path.resolve(dbPath) === resolveDbFilename()) {
      const { getDb } = await import("./client");
      sqlite = (getDb() as { $client?: Database.Database }).$client;
      if (!sqlite) throw new Error("SQLite client không hỗ trợ sao lưu.");
    }
    const state = await recoverPendingUpload(dbPath, s3, readBackupState(dbPath) ?? EMPTY_STATE);
    const buffer = await snapshotDatabase(dbPath, sqlite);
    const digest = snapshotDigest(buffer);
    if (state.digest === digest) {
      lastSuccessfulBackups.set(dbPath, fingerprint);
      return true;
    }

    const attempt = { ...state, pending: [...new Set([...(state.pending ?? []), digest])] };
    writeBackupState(dbPath, attempt);
    try {
      const result = await s3.client.send(new PutObjectCommand({
        Bucket: s3.bucket,
        Key: DB_OBJECT_KEY,
        Body: buffer,
        ContentType: "application/x-sqlite3",
        ...(state.etag ? { IfMatch: state.etag } : { IfNoneMatch: "*" }),
        Metadata: {
          [SNAPSHOT_DIGEST_METADATA]: digest,
          ...(generation !== undefined ? { generation } : {}),
        },
      }));
      if (!result.ETag) throw new Error("R2 không trả về ETag sau khi sao lưu.");
      writeBackupState(dbPath, { etag: result.ETag, digest });
    } catch (error) {
      const recovered = await recoverPendingUpload(dbPath, s3, attempt);
      if (recovered.digest !== digest) throw error;
    }
    lastSuccessfulBackups.set(dbPath, fingerprint);
    console.log(`[R2 Backup] ☁️ Đã sao lưu database lên Cloudflare R2 (${(buffer.length / 1024 / 1024).toFixed(2)} MB).`);
    return true;
  } catch (err: unknown) {
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
    if (err instanceof BackupConflictError || error?.name === "PreconditionFailed" || error?.$metadata?.httpStatusCode === 412) {
      console.error("[R2 Backup] XUNG ĐỘT: bản SQLite trên R2 đã thay đổi. Không ghi đè. Kiểm tra và giữ lại database cục bộ trước khi khởi động lại.");
      return false;
    }
    console.warn("[R2 Backup] Lỗi khi sao lưu database lên R2:", err);
    return false;
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

export function watchDbBackups(dbPath: string): () => void {
  let observer: Database.Database | undefined;
  let attemptedVersion: number | undefined;
  let running = false;

  async function check(periodic = false) {
    if (running) return;
    try {
      if (!observer) {
        if (!fs.existsSync(/*turbopackIgnore: true*/ dbPath)) return;
        observer = new Database(dbPath, { readonly: true, fileMustExist: true });
      }
      const version = observer.pragma("data_version", { simple: true }) as number;
      if (!periodic && version === attemptedVersion) return;
      attemptedVersion = version;
      running = true;
      await backupDbToR2(dbPath);
    } catch (error) {
      console.warn("[R2 Backup] Không thể theo dõi thay đổi database:", error);
    } finally {
      running = false;
    }
  }

  const changes = setInterval(() => void check(), 2_000);
  const periodic = setInterval(() => void check(true), 60_000);
  changes.unref();
  periodic.unref();
  return () => {
    clearInterval(changes);
    clearInterval(periodic);
    observer?.close();
  };
}
