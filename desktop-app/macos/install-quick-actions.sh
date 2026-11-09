#!/usr/bin/env bash
set -e

echo "==================================================================="
echo "    StudioCore Drive — Cài đặt Finder Quick Action trên macOS"
echo "==================================================================="
echo ""

APP_DIR="$HOME/.studiocore-drive/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/3] Đang cài đặt ứng dụng vào: $APP_DIR"
mkdir -p "$APP_DIR"
cp -R "$SCRIPT_DIR"/* "$APP_DIR/"

# Tạo symlink CLI
mkdir -p "$HOME/.local/bin"
ln -sf "$APP_DIR/cli.js" "$HOME/.local/bin/studiocore-drive"
chmod +x "$APP_DIR/cli.js"

echo "[2/3] Đang đăng ký Quick Action cho Finder macOS..."
SERVICES_DIR="$HOME/Library/Services"
WORKFLOW_NAME="StudioCore Drive - Tạo link gửi khách.workflow"
WORKFLOW_PATH="$SERVICES_DIR/$WORKFLOW_NAME"

mkdir -p "$WORKFLOW_PATH/Contents"

# Tạo Info.plist cho Quick Action
cat << 'EOF' > "$WORKFLOW_PATH/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSServices</key>
    <array>
        <dict>
            <key>NSMenuItem</key>
            <dict>
                <key>default</key>
                <string>StudioCore Drive: Tạo link gửi khách</string>
            </dict>
            <key>NSMessage</key>
            <string>runWorkflowAsService</string>
            <key>NSSendFileTypes</key>
            <array>
                <string>public.folder</string>
                <string>public.movie</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
EOF

# Tạo script thực thi Quick Action
cat << EOF > "$WORKFLOW_PATH/Contents/document.wflow"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>AMApplicationBuild</key>
    <string>523</string>
    <key>AMApplicationVersion</key>
    <string>2.10</string>
    <key>AMDocumentVersion</key>
    <string>2</string>
    <key>actions</key>
    <array>
        <dict>
            <key>action</key>
            <dict>
                <key>ActionBundlePath</key>
                <string>/System/Library/Automator/Run Shell Script.action</string>
                <key>ActionName</key>
                <string>Run Shell Script</string>
                <key>COMMAND_STRING</key>
                <string>
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
NODE_CMD="$(which node 2>/dev/null || echo '/usr/local/bin/node')"
for f in "$@"
do
    "$NODE_CMD" "$APP_DIR/cli.js" share --path "$f"
done
                </string>
                <key>inputMethod</key>
                <integer>1</integer>
                <key>shell</key>
                <string>/bin/bash</string>
                <key>source</key>
                <string></string>
            </dict>
        </dict>
    </array>
</dict>
</plist>
EOF

echo "[3/3] Hoàn tất thiết lập quyền thực thi!"
chmod +x "$APP_DIR/cli.js"

echo ""
echo "==================================================================="
echo "  CÀI ĐẶT THÀNH CÔNG!"
echo "  Bạn có thể chuột phải vào bất kỳ thư mục nào trong Finder ›"
echo "  Thao tác nhanh (Quick Actions) › 'StudioCore Drive: Tạo link gửi khách'"
echo "  để nhận link gửi khách ngay tức thì!"
echo "==================================================================="
