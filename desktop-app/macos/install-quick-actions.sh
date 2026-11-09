#!/usr/bin/env bash
set -e

echo "==================================================================="
echo "    StudioCore Drive — Cài đặt Finder Quick Action trên macOS"
echo "==================================================================="
echo ""

APP_DIR="$HOME/.studiocore-drive/app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/4] Đang cài đặt ứng dụng vào: $APP_DIR"
mkdir -p "$APP_DIR"
cp -R "$SCRIPT_DIR"/* "$APP_DIR/"
chmod +x "$APP_DIR/cli.js"
chmod +x "$APP_DIR/macos/run-share.sh" 2>/dev/null || true

# Tạo symlink CLI vào ~/.local/bin
mkdir -p "$HOME/.local/bin"
ln -sf "$APP_DIR/cli.js" "$HOME/.local/bin/studiocore-drive"

echo "[2/4] Đang xây dựng Automator Quick Action cho Finder macOS..."
SERVICES_DIR="$HOME/Library/Services"
WORKFLOW_NAME="StudioCore Drive - Tạo link gửi khách.workflow"
WORKFLOW_PATH="$SERVICES_DIR/$WORKFLOW_NAME"

rm -rf "$WORKFLOW_PATH"
mkdir -p "$WORKFLOW_PATH/Contents"

# 1. Info.plist
cat << 'EOF' > "$WORKFLOW_PATH/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleIdentifier</key>
	<string>com.studiocore.drive.finder-quick-action</string>
	<key>CFBundleName</key>
	<string>StudioCore Drive - Tạo link gửi khách</string>
	<key>CFBundlePackageType</key>
	<string>BNDL</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSBackgroundColorName</key>
			<string>background</string>
			<key>NSIconName</key>
			<string>NSTouchBarCompose</string>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>StudioCore Drive - Tạo link gửi khách</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSRequiredContext</key>
			<dict>
				<key>NSApplicationIdentifier</key>
				<string>com.apple.finder</string>
			</dict>
			<key>NSSendFileTypes</key>
			<array>
				<string>public.item</string>
				<string>public.folder</string>
				<string>public.directory</string>
				<string>public.movie</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
EOF

# 2. document.wflow
cat << 'EOF' > "$WORKFLOW_PATH/Contents/document.wflow"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>541</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Optional</key>
					<true/>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>AMActionVersion</key>
				<string>2.0.3</string>
				<key>AMApplication</key>
				<array>
					<string>Automator</string>
				</array>
				<key>AMParameterProperties</key>
				<dict>
					<key>COMMAND_STRING</key>
					<dict/>
					<key>CheckedForUserDefaultShell</key>
					<dict/>
					<key>inputMethod</key>
					<dict/>
					<key>shell</key>
					<dict/>
					<key>source</key>
					<dict/>
				</dict>
				<key>AMProvides</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>"$HOME/.studiocore-drive/app/macos/run-share.sh" "$@"</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>1</integer>
					<key>shell</key>
					<string>/bin/bash</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>2.0.3</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Category</key>
				<array>
					<string>AMCategoryUtilities</string>
				</array>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>7B1C4A2E-3D6F-4E8A-9C21-5A0D2B6F8E14</string>
				<key>Keywords</key>
				<array>
					<string>Shell</string>
					<string>Script</string>
				</array>
				<key>OutputUUID</key>
				<string>2F9A6C3D-8E4B-4D71-B5A2-9C7E1F4D6B38</string>
				<key>UUID</key>
				<string>4C8E2A71-6B3D-4F95-A1C8-7D5E9B2F4A63</string>
				<key>UnlocalizedApplications</key>
				<array>
					<string>Automator</string>
				</array>
			</dict>
			<key>isViewVisible</key>
			<true/>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>applicationPath</key>
		<string>/System/Library/CoreServices/Finder.app</string>
		<key>applicationPaths</key>
		<array>
			<string>/System/Library/CoreServices/Finder.app</string>
		</array>
		<key>inputTypeIdentifier</key>
		<string>com.apple.Automator.fileSystemObject</string>
		<key>outputTypeIdentifier</key>
		<string>com.apple.Automator.nothing</string>
		<key>presentationMode</key>
		<integer>15</integer>
		<key>processesInput</key>
		<false/>
		<key>serviceApplicationBundleID</key>
		<string>com.apple.finder</string>
		<key>serviceApplicationPath</key>
		<string>/System/Library/CoreServices/Finder.app</string>
		<key>serviceInputTypeIdentifier</key>
		<string>com.apple.Automator.fileSystemObject</string>
		<key>serviceOutputTypeIdentifier</key>
		<string>com.apple.Automator.nothing</string>
		<key>serviceProcessesInput</key>
		<false/>
		<key>systemImageName</key>
		<string>NSTouchBarCompose</string>
		<key>useAutomaticInputType</key>
		<false/>
		<key>workflowTypeIdentifier</key>
		<string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>
EOF

echo "[3/4] Đang kích hoạt Quick Action trong macOS Settings..."
# Kích hoạt trực tiếp trong cơ sở dữ liệu pbs của macOS qua Python3
python3 -c '
import plistlib, os

pbs_path = os.path.expanduser("~/Library/Preferences/pbs.plist")
try:
    with open(pbs_path, "rb") as f:
        pl = plistlib.load(f)
except Exception:
    pl = {}

services = pl.setdefault("NSServicesStatus", {})

cfg = {
    "enabled_context_menu": True,
    "enabled_services_menu": True,
    "presentation_modes": {
        "ContextMenu": 1,
        "FinderPreview": 1,
        "ServicesMenu": 1,
        "TouchBar": 1,
    }
}

services["(null) - StudioCore Drive - Tạo link gửi khách - runWorkflowAsService"] = cfg
services["com.studiocore.drive.finder-quick-action - StudioCore Drive - Tạo link gửi khách - runWorkflowAsService"] = cfg

with open(pbs_path, "wb") as f:
    plistlib.dump(pl, f)
' 2>/dev/null || true

# Flush cache pbs
/System/Library/CoreServices/pbs -flush 2>/dev/null || true

echo "[4/4] Khởi động lại Finder để cập nhật menu..."
killall Finder 2>/dev/null || true

echo ""
echo "==================================================================="
echo "  CÀI ĐẶT THÀNH CÔNG TRÊN MACOS!"
echo ""
echo "  Cách dùng:"
echo "  1. Mở Finder, chuột phải vào thư mục ảnh hoặc video bất kỳ."
echo "  2. Chọn: Quick Actions (Thao tác nhanh) > StudioCore Drive - Tạo link gửi khách"
echo "     (Hoặc trong menu: Dịch vụ / Services > StudioCore Drive)"
echo "  3. Trình duyệt tự mở album, link được copy sẵn vào Clipboard!"
echo "==================================================================="

osascript -e 'display dialog "Cài đặt StudioCore Drive thành công!\n\nChuột phải vào thư mục trong Finder > chọn Quick Actions (Thao tác nhanh) > StudioCore Drive - Tạo link gửi khách." with title "StudioCore Drive macOS" buttons {"OK"} default button "OK"' 2>/dev/null || true
