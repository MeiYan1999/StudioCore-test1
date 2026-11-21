#!/bin/bash
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")" && pwd)"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 || ! node -e 'if(Number(process.versions.node.split(".")[0])<18)process.exit(1)'; then
  osascript -e 'display alert "StudioCore Drive" message "Vui lòng cài Node.js 18 trở lên tại https://nodejs.org rồi chạy lại trình cài đặt."'
  open https://nodejs.org
  exit 1
fi
NODE="$(node -p 'process.execPath')"
DEST="$HOME/.studiocore-drive/app"
mkdir -p "$DEST" "$HOME/Applications"
if [ "$SOURCE" != "$DEST" ]; then
  /usr/bin/ditto "$SOURCE" "$DEST"
fi
printf '%s\n' "$NODE" > "$HOME/.studiocore-drive/node-path"
chmod 600 "$HOME/.studiocore-drive/node-path"
"$NODE" "$DEST/cli.js" install-context
/usr/bin/ditto "$DEST/macos/StudioCore Drive.app" "$HOME/Applications/StudioCore Drive.app"
chmod +x "$HOME/Applications/StudioCore Drive.app/Contents/MacOS/app-launcher"
# The executable works directly even when LaunchServices rejects unsigned bundles.
"$HOME/Applications/StudioCore Drive.app/Contents/MacOS/app-launcher"
