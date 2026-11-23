import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  backupDbToR2,
  restoreDbFromR2IfMissing,
} from "@/lib/db/r2-backup";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getDb: vi.fn(),
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
    PutObjectCommand: class PutObjectCommand extends MockCommand {},
  };
});

vi.mock("@/lib/db/client", () => ({
  getDb: mocks.getDb,
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
    mocks.getR2Config.mockReturnValue({
      accountId: "test-account",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucketName: "test-bucket",
    });
  });

  afterEach(() => {
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

  it("skips a second upload when the database has not changed", async () => {
    const dbPath = makeDbPath();
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
});
