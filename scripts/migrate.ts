import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "../src/lib/db/client";

const db = createDb();
const migrationsFolder = path.resolve(process.cwd(), "drizzle");

migrate(db, { migrationsFolder });
console.log(`Đã áp dụng migration từ ${migrationsFolder}`);
