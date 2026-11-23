import { resolveDbFilename } from "../src/lib/db/client";
import { restoreDbFromR2IfMissing } from "../src/lib/db/r2-backup";
import fs from "node:fs";
import path from "node:path";

try {
  const dbPath = resolveDbFilename();
  const seededPath = path.join(path.dirname(dbPath), ".seeded");
  const existsBefore = fs.existsSync(dbPath);

  console.log(`[Restore DB] Đang kiểm tra sao lưu database từ Cloudflare R2 (${dbPath})...`);
  const result = await restoreDbFromR2IfMissing(dbPath);

  if (result === "restored") {
    try {
      fs.writeFileSync(seededPath, `restored-at-${new Date().toISOString()}`);
    } catch {}
    console.log("[Restore DB] ✅ Đã khôi phục dữ liệu StudioCore từ Cloudflare R2!");
  } else if (result === "kept") {
    console.log("[Restore DB] Đang sử dụng database hiện có.");
  } else if (!existsBefore) {
    console.log("[Restore DB] Chưa có database, sẽ tiến hành khởi tạo và seed mới.");
  } else {
    console.log("[Restore DB] Không có database khả dụng từ R2, sẽ tiến hành khởi tạo và seed mới.");
  }
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[Restore DB] Không thể phục hồi database từ Cloudflare R2: ${message}`);
  process.exitCode = 1;
}
