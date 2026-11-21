# StudioCore Drive

Current implementation: tenant-scoped devices and shares in the database,
authenticated agent API under `/api/drive/agent/`, customer galleries at
`/drive/[token]`, staff management at `/manage/drive`, and a zero-dependency
Node desktop agent with a secured loopback browser GUI.

## Installation and packaging

1. Install Node.js LTS (desktop minimum 18).
2. Download the Windows/macOS ZIP from the staff guide or `/studiocore-drive`.
3. Unzip the whole `StudioCore Drive` folder; run `windows/install.bat` or
   `install.command`. No npm install is needed by end users.
4. Add a device in `/manage/drive`. Paste its one-time connection key into the
   desktop **Cài đặt → Khóa kết nối** field, save, then create a share.

`npm run drive:package` builds the two tracked archives in `public/downloads/`.
The script `scripts/drive-package.mjs` selects runtime files only and records
Unix executable modes for macOS launchers. Regenerate after desktop changes.
Archive validation is part of `cd desktop-app && node --test`.

## Boundaries

- Media stays on the computer; outbound Cloudflare Tunnel exposes only the media
  server. The token-protected GUI stays on `127.0.0.1:3888` or a fallback port.
- Device keys authenticate the agent. There is no desktop Google login, mock
  in-memory device registry, or legacy `/api/drive/agent` mock endpoint.
- File lists are snapshots at share creation. Folder watching, Google Drive sync,
  a standalone NAS service and customer billing are not implemented in Drive.
- The computer, agent and tunnel must remain online. Quick tunnel delivery may
  be blocked by upstream policy; a named tunnel requires ingress configuration.
- RAW previews use embedded JPEGs, not full RAW demosaicing. Video playback depends
  on browser codecs. HTTPS through a tunnel is not end-to-end device encryption.
- Native installers and integrations still require Windows/macOS smoke testing.
  Uninstall removes integrations and launchers but retains user data and core files.

Existing Google Drive/PhotoShare adapters described in historical phase docs are
separate from this desktop Drive feature. For configuration, CLI commands,
security and filtering details, see [desktop README](../desktop-app/README.md).
