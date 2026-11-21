# StudioCore Drive core v2

Zero npm dependencies; Node **18+**; CommonJS. Windows/macOS are supported by the
core; Linux supports development. GUI, notifications, automatic copying, autostart
and OS integration are deferred to phase 3b. Old mock GUI/install scripts have
been removed; `node cli.js start` / `gui` are no longer commands.

## Configuration and commands

Data defaults to `~/.studiocore-drive` on every OS. Override with
`STUDIOCORE_DRIVE_DIR` for an isolated profile. Set up configuration from Node:

```js
const { Store } = require('./src/store');
const store = new Store();
store.saveConfig({
  ...store.loadConfig(),
  connectKey: 'PASTE_THE_ONE_TIME_KEY_FROM_THE_STAFF_WEB_PAGE',
});
```

Use the actual `scd_…` key, not the placeholder. Default server:
`https://www.studiocore.io.vn`. Configuration schema/defaults are in `src/store.js`:
`defaults`, `filter`, `cache`, `tunnel`, `autoStart`, plus optional `mediaPort` (0
selects a random port), `tunnel.cloudflaredPath`. Keys/tokens are not printed by
`status`. JSON is validated and schema-merged on load. Writes use an exclusive
temporary file, fsync and same-directory rename. State files use mode 0600 and
the data directory 0700 (Windows also relies on the user's profile ACLs).
`shares.lock` serializes read-modify-write across processes; abandoned locks from
dead PIDs are reclaimed. A busy writer returns an error rather than losing data.

```sh
node cli.js status
node cli.js daemon
node cli.js share --path "/photos/wedding" --kind album --title "Ảnh cưới" --customer "An" --max 30 --days 30
node cli.js share --path "/videos/film.mp4" --kind video --pin 123456
node --test
```

`share` only scans, registers with the web API and saves the local mapping. It
does **not** start a daemon/tunnel. Keep `daemon` running for media to be available.
The media server reads share state for every request, including shares made by a
separate CLI process. `--no-tunnel` is a development-only daemon flag requiring a
loopback web server URL and non-production NODE_ENV; it heartbeats the local media
origin directly. Do not use it for customers on other machines.

## Files and RAW pairing

Scanner ignores dotfiles/directories, known system names, Windows hidden/system
attributes, symlinks, and the configured filter output directory. `album`/`view`
group by case-insensitive extensionless relative path. One entry is listed per
code: JPG/JPEG is the preferred preview, then another image, then RAW. The local
`files[fileKey]` map points to RAW when paired, and optional `previews[fileKey]`
points to JPG. Metadata displays the preview name and original byte size. Keys
are the first 24 base64url SHA-256 characters of the preview's POSIX relative path;
rescanning the same layout preserves them. Adding/removing a preferred JPG can
change a previously RAW-only key. Grouping stays within each relative folder.
`folder` does not deduplicate; `video` accepts directories or a single video.

Originals/ZIP use the original mapping: paired albums deliver RAW, or its largest
embedded full JPEG when `rawDownload=jpg`. ZIP has one entry per published file
key, preserving subfolders (not unpublished paired sidecars). It streams without
compression, uses UTF-8 names, CRC32/data descriptors, and ZIP64 for large files,
offsets and entry counts. Downloading RAW as JPEG requires an embedded JPEG; it
does not demosaic sensor data. No untrusted relative request path is used to find
a file: only the local key map, with realpath containment enforced.

## Previews and tunnels

`PreviewCache.get(file, key, variant)` generates 400px thumbs / 1600px previews via
macOS `sips`, Windows System.Drawing PowerShell, or Linux ImageMagick `convert`.
Paths are argument values, never interpolated into shell/PowerShell code. RAW
JPEG extraction validates frame/scan markers, supports nested metadata and scans
large files incrementally (individual embedded JPEG candidates capped at 128MB).
Without a working converter, embedded JPEG or the original is returned, which
may retain original dimensions/type. RAW with no JPEG yields a friendly web media
error. Two generators maximum; in-flight identical requests are coalesced.
`clearCache()` waits for in-flight work and deletes cached derivatives. Cleanup
runs at daemon startup and every 12h, enforcing age and byte limits, oldest first.

Cloudflared is located at `tunnel.cloudflaredPath`, data `bin/`, then PATH; otherwise
`downloadCloudflared()` downloads the official GitHub latest asset. macOS archives
are extracted with system `tar`. Quick tunnels publish an origin once the URL and
registered connection appear in output. Named tunnels use configured token and
hostname; configure that tunnel's Cloudflare ingress to the local media port
(use a fixed `mediaPort`). Failures clear the heartbeat origin and reconnect with
1–60s exponential backoff. Tokens/raw child output are never logged.

`Agent` emits `media`, `tunnel`, `warning` and `finalized` events; the latter carries
`{shareId, selection}`. Heartbeats run every 30s, share sync every 60s. A persisted
finalization timestamp prevents duplicate notifications and supports reopen /
finalize cycles. Revocations absent from the server's list are denied locally
after the next successful sync. Shutdown stops tunnels/media and clears origin.

Access logs are JSONL in `access.jsonl` (one rotated `.1`, around 5MB), with time,
CF-Connecting-IP/socket IP, share ID, mapped filename, variant and status, never
the secret or full request URL. Secret-bearing media URLs are capability links:
do not share them publicly. Cached previews can remain in a browser for 24h after
revocation; the server still checks current local status on each new request.

Tests use only Node core plus Python 3's standard `zipfile` for independent ZIP
validation; no npm install is needed. The forced-ZIP64 test lowers the threshold
instead of allocating a multi-GB fixture. Native Windows/macOS resizing should
also be exercised on those platforms before distributing installers.
