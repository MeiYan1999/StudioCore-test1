#!/bin/bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
NODE="$(cat "$HOME/.studiocore-drive/node-path" 2>/dev/null || command -v node || true)"
if [ ! -x "$NODE" ]; then
  printf '%s\n' 'Vui lòng cài Node.js từ https://nodejs.org để gỡ tích hợp StudioCore Drive.'
  exit 1
fi
"$NODE" "$HOME/.studiocore-drive/app/cli.js" uninstall
rm -rf "$HOME/Applications/StudioCore Drive.app"
printf '%s\n' 'Đã gỡ menu, ứng dụng mở và tự khởi động. Dữ liệu cá nhân và app core được giữ ở ~/.studiocore-drive; có thể xóa thư mục app thủ công.'
