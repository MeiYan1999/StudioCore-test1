import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import Database from "better-sqlite3";
import {
  backupDbToR2,
  restoreDbFromR2IfMissing,
} from "@/lib/db/r2-backup";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getDb: vi.fn(),
  resolveDbFilename: vi.fn(),
  getR2Config: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class MockCommand {
    constructor(public input: Record<string, unknown>) {}
  }
  class S3Client {
    send(...args: unknown[]) {
      return mocks.send(...args);
    }
  }
  return {
    S3Client,
    GetObjectCommand: class GetObjectCommand extends MockCommand {},
    HeadObjectCommand: class HeadObjectCommand extends MockCommand {},
    PutObjectCommand: class PutObjectCommand extends MockCommand {},
  };
});

vi.mock("@/lib/db/client", () => ({
  getDb: mocks.getDb,
  resolveDbFilename: mocks.resolveDbFilename,
}));

vi.mock("@/lib/storage/r2-storage", () => ({
  getR2Config: mocks.getR2Config,
}));

const tempDirs: string[] = [];

function makeDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studiocore-r2-backup-"));
  tempDirs.push(dir);
  return path.join(dir, "studiocore.db");
}

describe("R2 database backups", () => {
  beforeEach(() => {
    mocks.send.mockReset().mockResolvedValue({});
    mocks.getDb.mockReset();
    mocks.resolveDbFilename.mockReset().mockReturnValue(
      path.resolve("data/studiocore.db"),
    );
    mocks.getR2Config.mockReturnValue({
      accountId: "test-account",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucketName: "test-bucket",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps a non-empty local database without requesting the R2 copy", async () => {
    const dbPath = makeDbPath();
    const contents = Buffer.from("current database");
    fs.writeFileSync(dbPath, contents);

    await expect(restoreDbFromR2IfMissing(dbPath)).resolves.toBe("kept");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(fs.readFileSync(dbPath)).toEqual(contents);
  });

  it("returns none when R2 is unconfigured and no local database exists", async () => {
    const dbPath = makeDbPath();
    mocks.getR2Config.mockReturnValueOnce(null);

    await expect(restoreDbFromR2IfMissing(dbPath)).resolves.toBe("none");
    expect(mocks.send).not.toHaveBeenCalled();
    expect(fs.existsSync(dbPath)).toBe(false);
  });

  it("restores a missing database and removes stale SQLite sidecars", async () => {
    const dbPath = makeDbPath();
    fs.writeFileSync(`${dbPath}-wal`, "stale wal");
    fs.writeFileSync(`${dbPath}-shm`, "stale shm");
    const restoredBytes = Buffer.from("restored database");
    mocks.send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: async () => restoredBytes,
      },
    });

    await expect(restoreDbFromR2IfMissing(dbPath)).resolves.toBe("restored");
    expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(fs.readFileSync(dbPath)).toEqual(restoredBytes);
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
    expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
    expect(fs.existsSync(`${dbPath}.restore-tmp`)).toBe(false);
  });

  it("returns none when R2 confirms that the backup object is missing", async () => {
    const dbPath = makeDbPath();
    const missingObject = Object.assign(new Error("Missing object"), {
      name: "NoSuchKey",
    });
    mocks.send.mockRejectedValueOnce(missingObject);

    await expect(restoreDbFromR2IfMissing(dbPath)).resolves.toBe("none");
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.existsSync(`${dbPath}.restore-tmp`)).toBe(false);
  });

  it("rethrows transient R2 errors without creating a database", async () => {
    const dbPath = makeDbPath();
    const serviceUnavailable = Object.assign(new Error("Service unavailable"), {
      name: "ServiceUnavailable",
      $metadata: { httpStatusCode: 503 },
    });
    mocks.send.mockRejectedValueOnce(serviceUnavailable);

    await expect(restoreDbFromR2IfMissing(dbPath)).rejects.toBe(
      serviceUnavailable,
    );
    expect(fs.existsSync(dbPath)).toBe(false);
    expect(fs.existsSync(`${dbPath}.restore-tmp`)).toBe(false);
  });

  it("skips a second upload when the database has not changed", async () => {
    const dbPath = makeDbPath();
    mocks.resolveDbFilename.mockReturnValue(path.resolve(dbPath));
    fs.writeFileSync(dbPath, "current database");
    const backup = vi.fn(async (targetPath: string) => {
      fs.writeFileSync(targetPath, "consistent snapshot");
    });
    mocks.getDb.mockReturnValue({ $client: { backup } });

    await expect(backupDbToR2(dbPath)).resolves.toBe(true);
    const firstCommand = mocks.send.mock.calls[0][0] as PutObjectCommand;
    expect(firstCommand).toBeInstanceOf(PutObjectCommand);
    expect(firstCommand.input.Body).toEqual(Buffer.from("consistent snapshot"));
    expect(backup).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(backup.mock.calls[0][0])).toBe(false);

    await expect(backupDbToR2(dbPath)).resolves.toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(backup).toHaveBeenCalledTimes(1);
  });

  it("snapshots an explicit database path instead of the live database", async () => {
    const dbPath = makeDbPath();
    const sourceDb = new Database(dbPath);
    sourceDb.exec(
      "CREATE TABLE records (value TEXT); INSERT INTO records VALUES ('source database')",
    );
    sourceDb.close();

    mocks.resolveDbFilename.mockReturnValue(
      path.resolve(path.dirname(dbPath), "live-database.db"),
    );
    const liveBackup = vi.fn(async (targetPath: string) => {
      fs.writeFileSync(targetPath, "wrong database");
    });
    mocks.getDb.mockReturnValue({ $client: { backup: liveBackup } });

    await expect(backupDbToR2(dbPath)).resolves.toBe(true);
    const command = mocks.send.mock.calls[0][0] as PutObjectCommand;
    const snapshotPath = path.join(path.dirname(dbPath), "snapshot.db");
    fs.writeFileSync(snapshotPath, command.input.Body as Buffer);
    const snapshotDb = new Database(snapshotPath, {
      readonly: true,
      fileMustExist: true,
    });
    expect(snapshotDb.prepare("SELECT value FROM records").get()).toEqual({
      value: "source database",
    });
    snapshotDb.close();
    expect(liveBackup).not.toHaveBeenCalled();
  });

  it("skips upload when a newer remote generation owns the backup", async () => {
    const dbPath = makeDbPath();
    fs.writeFileSync(dbPath, "current database");
    mocks.resolveDbFilename.mockReturnValue(path.resolve(dbPath));
    const backup = vi.fn(async (targetPath: string) => {
      fs.writeFileSync(targetPath, "consistent snapshot");
    });
    mocks.getDb.mockReturnValue({ $client: { backup } });
    vi.stubEnv("DB_BACKUP_GENERATION", "9");
    mocks.send.mockResolvedValueOnce({ Metadata: { generation: "10" } });

    await expect(backupDbToR2(dbPath)).resolves.toBe(false);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect(backup).not.toHaveBeenCalled();
  });

  it.each([
    { label: "older", remoteGeneration: "9", generation: "10" },
    { label: "equal", remoteGeneration: "10", generation: "10" },
  ])(
    "uploads when the remote generation is $label",
    async ({ remoteGeneration, generation }) => {
      const dbPath = makeDbPath();
      fs.writeFileSync(dbPath, "current database");
      mocks.resolveDbFilename.mockReturnValue(path.resolve(dbPath));
      const backup = vi.fn(async (targetPath: string) => {
        fs.writeFileSync(targetPath, "consistent snapshot");
      });
      mocks.getDb.mockReturnValue({ $client: { backup } });
      vi.stubEnv("DB_BACKUP_GENERATION", generation);
      mocks.send
        .mockResolvedValueOnce({
          Metadata: { generation: remoteGeneration },
        })
        .mockResolvedValueOnce({});

      await expect(backupDbToR2(dbPath)).resolves.toBe(true);
      expect(mocks.send).toHaveBeenCalledTimes(2);
      expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
      const putCommand = mocks.send.mock.calls[1][0] as PutObjectCommand;
      expect(putCommand).toBeInstanceOf(PutObjectCommand);
      expect(putCommand.input.Metadata).toEqual({ generation });
      expect(backup).toHaveBeenCalledTimes(1);
    },
  );

  it("uploads with generation metadata when the remote object is missing", async () => {
    const dbPath = makeDbPath();
    fs.writeFileSync(dbPath, "current database");
    mocks.resolveDbFilename.mockReturnValue(path.resolve(dbPath));
    const backup = vi.fn(async (targetPath: string) => {
      fs.writeFileSync(targetPath, "consistent snapshot");
    });
    mocks.getDb.mockReturnValue({ $client: { backup } });
    vi.stubEnv("DB_BACKUP_GENERATION", "10");
    mocks.send.mockRejectedValueOnce(
      Object.assign(new Error("Missing object"), {
        name: "NotFound",
        $metadata: { httpStatusCode: 404 },
      }),
    );

    await expect(backupDbToR2(dbPath)).resolves.toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    const putCommand = mocks.send.mock.calls[1][0] as PutObjectCommand;
    expect(putCommand.input.Metadata).toEqual({ generation: "10" });
    expect(backup).toHaveBeenCalledTimes(1);
  });

  it("skips upload when the remote generation lookup fails", async () => {
    const dbPath = makeDbPath();
    fs.writeFileSync(dbPath, "current database");
    mocks.resolveDbFilename.mockReturnValue(path.resolve(dbPath));
    const backup = vi.fn(async (targetPath: string) => {
      fs.writeFileSync(targetPath, "consistent snapshot");
    });
    mocks.getDb.mockReturnValue({ $client: { backup } });
    vi.stubEnv("DB_BACKUP_GENERATION", "10");
    mocks.send.mockRejectedValueOnce(
      Object.assign(new Error("Service unavailable"), {
        name: "ServiceUnavailable",
        $metadata: { httpStatusCode: 503 },
      }),
    );

    await expect(backupDbToR2(dbPath)).resolves.toBe(false);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect(backup).not.toHaveBeenCalled();
  });
});
