export const DRIVE_RELEASES_URL = "https://github.com/MeiYan1999/StudioCore-test1/releases/latest";

export const DRIVE_FACE_DIM = 128;
export const DRIVE_FACE_MAX_PER_FILE = 20;
export const DRIVE_FACE_MATCH_THRESHOLD = 0.5;

export const DRIVE_DOWNLOADS = {
  windows: "https://github.com/MeiYan1999/StudioCore-test1/releases/latest/download/StudioCore-Drive-win-x64.exe",
  macArm64:
    "https://github.com/MeiYan1999/StudioCore-test1/releases/latest/download/StudioCore-Drive-mac-arm64.dmg",
  macX64: "https://github.com/MeiYan1999/StudioCore-test1/releases/latest/download/StudioCore-Drive-mac-x64.dmg",
} as const;

export function formatDriveBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
