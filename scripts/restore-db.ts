import { restoreDbFromR2, backupDbToR2 } from "../src/lib/db/r2-backup";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "studiocore.db");
const seededPath = path.join(dataDir, ".seeded");
const existsBefore = fs.existsSync(dbPath);

console.log(`[Restore DB] Đang kiểm tra sao lưu database từ Cloudflare R2 (${dbPath})...`);
const restored = await restoreDbFromR2(dbPath);

if (restored) {
  try {
    fs.writeFileSync(seededPath, `restored-at-${new Date().toISOString()}`);
  } catch {}
  console.log("[Restore DB] ✅ Đã khôi phục dữ liệu StudioCore từ Cloudflare R2!");
} else if (!existsBefore) {
  console.log("[Restore DB] Chưa có database, sẽ tiến hành khởi tạo và seed mới.");
} else {
  console.log("[Restore DB] Đang sử dụng database hiện có.");
}
