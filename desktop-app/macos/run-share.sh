#!/usr/bin/env bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"

APP_DIR="$HOME/.studiocore-drive/app"
CLI_PATH="$APP_DIR/cli.js"

# Detect node binary
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
elif [ -x "/opt/homebrew/bin/node" ]; then
    NODE_BIN="/opt/homebrew/bin/node"
elif [ -x "/usr/local/bin/node" ]; then
    NODE_BIN="/usr/local/bin/node"
elif [ -d "$HOME/.nvm/versions/node" ]; then
    LATEST_NVM_NODE="$(ls -d "$HOME"/.nvm/versions/node/v* 2>/dev/null | tail -n 1)/bin/node"
    if [ -x "$LATEST_NVM_NODE" ]; then
        NODE_BIN="$LATEST_NVM_NODE"
    fi
fi

if [ -z "$NODE_BIN" ]; then
    osascript -e 'display alert "StudioCore Drive — Thiếu Node.js" message "Không tìm thấy Node.js trên máy Mac của bạn. Vui lòng cài đặt Node.js từ https://nodejs.org để kích hoạt tính năng." as warning'
    open "https://nodejs.org"
    exit 1
fi

for target in "$@"
do
    "$NODE_BIN" "$CLI_PATH" share --path "$target"
done
