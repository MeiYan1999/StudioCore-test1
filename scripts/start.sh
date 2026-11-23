#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data "${UPLOAD_ROOT:-/app/public/uploads}" /app/demo-data
  chown -R nextjs:nodejs /app/data "${UPLOAD_ROOT:-/app/public/uploads}" /app/demo-data
  exec gosu nextjs:nodejs /bin/sh /app/scripts/start.sh
fi

export DB_BACKUP_GENERATION="${DB_BACKUP_GENERATION:-$(date +%s)}"

# 1. Phục hồi database từ Cloudflare R2 nếu có
node --import tsx scripts/restore-db.ts

# 2. Áp dụng migrations mới nhất
npm run db:migrate

# 3. Seed dữ liệu ban đầu nếu chưa có dữ liệu và chưa từng được seed
if [ ! -f "/app/data/.seeded" ]; then
  if [ ! -f "/app/data/studiocore.db" ] || [ "${SEED_DEMO:-false}" = "true" ]; then
    echo "[Init] Khởi tạo database ban đầu..."
    npm run db:seed || true
    touch /app/data/.seeded
    # Sao lưu ngay lên R2 bản đầu tiên
    node --import tsx -e 'import { backupDbToR2 } from "./src/lib/db/r2-backup"; await backupDbToR2();' || true
  fi
else
  echo "[Init] Database đã tồn tại từ trước hoặc đã phục hồi từ R2, bỏ qua seed để bảo vệ tài khoản người dùng."
fi

# 4. Ảnh demo nằm ngoài database (UPLOAD_ROOT, demo-data/, R2), tạo/upload lại nếu thiếu
node --import tsx -e 'import { ensureDemoAlbumAssets } from "./src/lib/storage/local-storage"; await ensureDemoAlbumAssets();' || true

node_modules/.bin/next start &
server_pid=$!
shutdown() {
  kill -TERM "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  node --import tsx scripts/backup-db.ts || true
  exit 0
}
trap shutdown TERM INT
wait "$server_pid"
