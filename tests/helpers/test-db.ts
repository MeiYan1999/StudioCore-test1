import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb, type AppDb } from "@/lib/db/client";
import { seedDatabase } from "@/lib/db/seed";

export function createTestDb(): AppDb {
  const db = createDb(":memory:");
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  seedDatabase(db);
  return db;
}
