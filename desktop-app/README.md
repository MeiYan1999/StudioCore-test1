# StudioCore Drive

Independent, zero-npm-dependency desktop core and local web GUI. Node **18+**,
CommonJS, Windows/macOS; Linux for development. No Electron or build step.

## Download packages

From the repository root, run `npm run drive:package`. The zero-dependency Node
packager creates `public/downloads/StudioCore-Drive-Windows.zip` and
`StudioCore-Drive-macOS.zip`. Each contains a `StudioCore Drive/` folder with the
current runtime, README and platform installers, not tests, local data, cache,
node_modules or binaries downloaded at runtime. macOS `.command` files and app
launcher retain executable permissions. ZIP timestamps and ordering are fixed
for reproducible outputs; regenerate and commit both archives after runtime edits.

Install Node.js LTS, unzip the complete folder, then run `windows/install.bat`
or `install.command`. Create a device at `/manage/drive`, paste its one-time key
into **Cài đặt → Khóa kết nối**, and save. The installer opens a browser GUI;
this is not an Electron application or a Google sign-in flow. Keep the agent and
computer running while customers use the links. Native installers are unsigned.

## Start

```sh
node cli.js                    # GUI + agent + browser
node cli.js gui --no-open       # GUI + agent without opening browser
node cli.js daemon             # same, no browser
node cli.js open               # open existing GUI, otherwise start
node cli.js share --path "/photos/album" --kind album
node cli.js status
```

The GUI starts on `http://127.0.0.1:3888` (next available port if occupied). Enter
the one-time device key from the staff web page under **Cài đặt**. `share` hands
off to the running GUI's create dialog; if necessary it starts a detached daemon
first. A per-profile instance lock prevents concurrent agents. `gui.json` contains
the actual GUI port and PID. No global npm installation is required.

Data lives in `~/.studiocore-drive`; override `STUDIOCORE_DRIVE_DIR` for an isolated
profile. JSON writes use private temporary files, fsync and rename. Config schema
and defaults: `src/store.js`. Config, shares, GUI token and port metadata use mode
0600; data directory uses 0700 (Windows also relies on user-profile ACLs). Secrets
are intentionally available to the authenticated local GUI, never to public web
pages. Do not expose the GUI through a tunnel or reverse proxy.

Development: configure `serverUrl: http://localhost:3000`, then run
`node cli.js gui --no-tunnel --no-open`. The flag is restricted to loopback server
URLs and non-production NODE_ENV. Media heartbeats use the local media port, so
customer pages only work on that machine in this mode.

## GUI and security

- Album & link: kind/search filters, link/message copying, pause/revoke/reopen,
  customer selections/notes, create dialog and duplicate-folder warning.
- Lọc ảnh: shared selections or pasted codes, source/output picking, preview,
  safe copy, notes report, reveal output folder.
- Nhật ký: most recent 300 access records, refreshing every 5 seconds when visible.
- Cài đặt: persisted connection, quick/named tunnel, link defaults, notifications,
  filtering, cache, autostart and context menu controls. Saving reconnects the agent.
- Bell: persisted finalized-selection notifications/read state; optional OS
  notifications and automatic filtering/copying. OS notification failures are
  best effort and cannot crash the agent. Other failures appear in the header.

The GUI binds only loopback, validates Host (including actual port), and rejects
all API calls without `X-SC-Token`. Non-GET calls check Origin when supplied,
require JSON and enforce a 256KB body cap. The per-install random token is injected
into a meta tag. No CORS permissions are granted. CSP prohibits inline scripts,
framing, plugins and remote resources. User data is rendered exclusively through
textContent/createElement, not HTML interpretation. Another process running as
the same OS user can read private files; it is outside this browser-CSRF boundary.

## Media, RAW and filtering

Media binds `127.0.0.1`, uses constant-time secret checks, active/expiry checks,
key-only lookup and realpath containment. Original/ZIP downloads require permission.
Video supports byte ranges. ZIP streams store-only UTF-8 entries, CRC32, data
descriptors and ZIP64, without buffering file bodies in memory.

Scanner skips dotfiles/system names, Windows hidden/system attributes, symlinks
and filter output. Albums group case-insensitive extensionless relative paths:
JPG/JPEG is preferred for preview, then another image, then RAW. One logical entry
is published per code; the original map points to RAW where paired. Folder shares
do not deduplicate; video accepts directories or single files. Keys are 24-char
base64url SHA-256 hashes of the preview's relative POSIX path. Unchanged layouts
keep their keys; adding a preferred JPG to a RAW-only entry changes that key.

400px thumbs / 1600px previews use sips, PowerShell System.Drawing or ImageMagick.
RAW uses the largest structurally valid embedded JPEG (bounded 128MB per candidate),
not sensor demosaicing. Converter failure falls back to embedded JPEG/original,
possibly preserving original type/dimensions. Missing RAW JPEGs return a media
error. Cache generation is limited to two concurrent jobs; cleanup runs at startup
and every 12h. `PreviewCache.clearCache()` clears derivatives after pending work.

The filter normalizes pasted codes (whitespace, comma, semicolon, pipe), strips
extensions and deduplicates case-insensitively. Selected codes received as an
array preserve spaces in filenames. RAW/JPG/both modes report missing codes and
all multi-file matches. **All matches are copied**, including ambiguous ones;
the preview lets staff review them first. Output folders and symlinks are skipped.
Existing files are never overwritten: suffixes are added, including repeated
`GHI_CHU_KHACH_1.txt` reports. Original files are never moved or deleted. Reports
include customer, album, date, Lightroom filter codes, notes and missing codes.

Cloudflared is found at configured path, data `bin/`, then PATH, or downloaded
from official GitHub release assets. Named tunnel ingress must point to the local
media port; set a fixed `mediaPort` for that use. Heartbeats run every 30 seconds,
share sync every 60 seconds. Finalization timestamps suppress duplicate events.

### Cloudflare browser 403 investigation

Both default and no-referrer image policies were blocked by Cloudflare during
VM testing; customer images already set no-referrer. Curl with the browser's
User-Agent alone reproduced 403, while curl's default UA and individual sec-ch-ua
headers received 530 on the same new quick tunnel. This isolates a UA-sensitive
upstream response, not an application media authorization failure. The 530 and
an initial new-host DNS failure mean successful media delivery on that particular
probe was not established. Earlier real-tunnel curl media downloads were 200.
VM-IP reputation / Cloudflare anti-abuse policy remains plausible but unproven.
No UA spoofing or unverified application fix was added. Use a properly configured
named tunnel for deployment; the local fallback is for development only.

## User-level installation

- Windows: run `windows/install.bat`. Requires Node 18+, copies app into
  `%LOCALAPPDATA%\StudioCore Drive\app`, registers HKCU Explorer menus, creates
  Desktop/Start Menu shortcuts and starts GUI through a hidden VBS launcher.
  Directory/background menus have album/view/folder actions; video extensions have
  video sharing. Registry writes use `reg.exe` argument arrays, not a shell.
- macOS: run `install.command`. Installs core in `~/.studiocore-drive/app`, Finder
  workflows under `~/Library/Services`, and launcher in
  `~/Applications/StudioCore Drive.app`. It records the resolved Node executable.
  Unsigned app bundles can fail through LaunchServices; execute
  `~/Applications/StudioCore Drive.app/Contents/MacOS/app-launcher` directly.
- Autostart: toggle in settings (HKCU Run on Windows, RunAtLoad LaunchAgent on macOS).
- Uninstall: `windows/uninstall.bat` or `uninstall.command` removes menus, shortcuts /
  launcher, autostart and stops the daemon. Personal state **and installed core**
  are deliberately retained; the script prints the app directory for manual removal.
  This prevents accidental deletion of shared originals or user state.

Native installers/notifications/pickers must be smoke-tested on their target OS
before distribution; generated artifacts and shell syntax are tested on Linux.

## Checks

```sh
node --test
for f in cli.js src/*.js; do node --check "$f"; done
bash -n install.command uninstall.command "macos/StudioCore Drive.app/Contents/MacOS/app-launcher"
```

Tests use Node built-ins and Python 3 standard-library zipfile/plistlib for
independent format validation. No npm install is necessary. Access logs are private
JSONL (`access.jsonl`, rotated `.1` around 5MB) and omit secrets/full request URLs.
