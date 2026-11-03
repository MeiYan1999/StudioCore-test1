import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getEnv } from "../env";
import * as schema from "./schema";

export type AppDb = BetterSQLite3Database<typeof schema>;

const DATA_DIR = path.join(process.cwd(), "data");

function resolveDatabasePath(url: string): string {
  if (url === ":memory:" || url.startsWith("file:")) {
    return url;
  }

  if (path.isAbsolute(url)) {
    throw new Error("DATABASE_URL SQLite phải nằm trong thư mục data của dự án.");
  }

  const normalized = url
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^data\//, "");

  const absolutePath = path.join(DATA_DIR, normalized);
  if (!absolutePath.startsWith(`${DATA_DIR}${path.sep}`)) {
    throw new Error("DATABASE_URL không được trỏ ra ngoài thư mục data.");
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  return absolutePath;
}

export function createDb(url: string = getEnv().DATABASE_URL): AppDb {
  const filename = resolveDatabasePath(url);
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return drizzle(sqlite, { schema });
}

const globalForDb = globalThis as unknown as { studiocoreDb?: AppDb };

export function getDb(): AppDb {
  if (!globalForDb.studiocoreDb) {
    globalForDb.studiocoreDb = createDb();
  }

  return globalForDb.studiocoreDb;
}

export * from "./schema";
