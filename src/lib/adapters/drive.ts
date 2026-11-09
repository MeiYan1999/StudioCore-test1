import fs from "node:fs";
import path from "node:path";
import {
  DEMO_ALBUM,
  demoDriveFilePath,
} from "../demo-album";
import { DEMO_DRIVE_ROOT, resolveStoragePath, sha256 } from "../storage/local-storage";

const DRIVE_FILE_PATTERN = /^[A-Za-z0-9_-]{3,120}$/;
const RAW_EXTENSIONS = new Set([".raw", ".cr2", ".nef", ".arw", ".dng", ".raf"]);

export type DriveSourceProvider = "local_demo" | "google";

export type ParsedDriveLink = {
  provider: DriveSourceProvider;
  folderId: string;
  normalizedUrl: string;
  demo: boolean;
};

export type DemoDriveFile = {
  filename: string;
  relativePath: string;
  folderKey: string;
  folderName: string;
  folderExternalId: string;
  sourceFileId: string;
  size: number;
  checksum: string;
  isRaw: boolean;
};

export type DemoDriveFolder = {
  externalId: string;
  key: string;
  name: string;
  relativePath: string;
  photoCount: number;
};

export type LocalDemoScan = {
  mode: "local_demo";
  folderId: string;
  folderName: string;
  folders: DemoDriveFolder[];
  files: DemoDriveFile[];
  scannedAt: Date;
};

export function isDemoFolderId(folderId: string): boolean {
  return (
    folderId === DEMO_ALBUM.driveFolderId ||
    DEMO_ALBUM.folders.some((folder) => folder.externalId === folderId)
  );
}

export function parseDriveFolderLink(input: string): ParsedDriveLink | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  if (DRIVE_FILE_PATTERN.test(value) && value.startsWith("demo-folder-")) {
    return {
      provider: "local_demo",
      folderId: value,
      normalizedUrl: `https://drive.google.com/drive/folders/${value}`,
      demo: true,
    };
  }

  if (
    !value.includes("/") &&
    !value.includes(".") &&
    value.length >= 25 &&
    DRIVE_FILE_PATTERN.test(value)
  ) {
    return {
      provider: "google",
      folderId: value,
      normalizedUrl: `https://drive.google.com/drive/folders/${value}`,
      demo: false,
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" || url.hostname !== "drive.google.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  let folderId: string | null = null;
  const foldersIndex = segments.lastIndexOf("folders");
  if (foldersIndex >= 0 && segments[foldersIndex + 1]) {
    folderId = segments[foldersIndex + 1] ?? null;
  } else if (
    url.pathname === "/open" ||
    url.pathname === "/folderview" ||
    url.searchParams.has("id")
  ) {
    folderId = url.searchParams.get("id");
  }

  if (!folderId || !DRIVE_FILE_PATTERN.test(folderId)) {
    return null;
  }

  const demo = isDemoFolderId(folderId);
  return {
    provider: demo ? "local_demo" : "google",
    folderId,
    normalizedUrl: `https://drive.google.com/drive/folders/${folderId}`,
    demo,
  };
}

export function googleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_API_KEY?.trim() ||
      (process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim() &&
        process.env.GOOGLE_REDIRECT_URI?.trim()),
  );
}

export function driveProviderLabel(provider: string): string {
  if (provider === "local_demo") return "Drive demo (local adapter)";
  if (provider === "google") {
    return "Google Drive (Link công khai hoặc OAuth)";
  }
  return provider;
}

function walkRecursive(root: string, current = root): string[] {
  const entries = fs.readdirSync(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRecursive(root, fullPath));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function folderKeyForName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "folder";
}

function demoFolderMeta(key: string, name: string): {
  externalId: string;
  key: string;
  name: string;
} {
  const known = DEMO_ALBUM.folders.find((folder) => folder.key === key);
  if (known) {
    return { externalId: known.externalId, key: known.key, name: known.name };
  }
  return {
    externalId: `local-${key}`,
    key,
    name,
  };
}

export function scanLocalDemoDrive(folderId: string): LocalDemoScan {
  if (!isDemoFolderId(folderId)) {
    throw new Error(
      "Folder demo local không tồn tại. Dùng folder demo-folder-1 hoặc thư mục con đã seed.",
    );
  }

  const demoFolder = DEMO_ALBUM.folders.find(
    (folder) => folder.externalId === folderId,
  );
  const archiveRoot = resolveStoragePath(
    demoFolder ? demoFolder.key : DEMO_ALBUM.driveFolderId,
    DEMO_DRIVE_ROOT,
  );

  if (!fs.existsSync(archiveRoot)) {
    throw new Error(
      "Chưa có thư mục Drive demo trên máy. Chạy npm run db:seed để tạo ảnh synthetic.",
    );
  }

  const relativeFiles = walkRecursive(archiveRoot, archiveRoot);
  const fileEntries: DemoDriveFile[] = [];
  const folderMap = new Map<string, DemoDriveFolder>();

  for (const relativePath of relativeFiles) {
    const segments = relativePath.split("/");
    const filename = segments.pop() ?? relativePath;
    const folderName = demoFolder
      ? demoFolder.name
      : segments[0] ?? "Ảnh gốc";
    const key = demoFolder
      ? demoFolder.key
      : segments.length > 0
        ? folderKeyForName(folderName)
        : "root";
    const meta = demoFolder
      ? {
          externalId: demoFolder.externalId,
          key: demoFolder.key,
          name: demoFolder.name,
        }
      : demoFolderMeta(key, folderName);
    const externalId = meta.externalId;

    if (!folderMap.has(key)) {
      folderMap.set(key, {
        externalId,
        key,
        name: meta.name,
        relativePath: demoFolder
          ? demoFolder.key
          : segments.length > 0
            ? segments.join("/")
            : "",
        photoCount: 0,
      });
    }

    const fullPath = path.join(archiveRoot, relativePath);
    const buffer = fs.readFileSync(fullPath);
    const extension = path.extname(filename).toLowerCase();
    const entry: DemoDriveFile = {
      filename,
      relativePath,
      folderKey: key,
      folderName: meta.name,
      folderExternalId: externalId,
      sourceFileId: `${externalId}:${filename}`,
      size: buffer.length,
      checksum: sha256(buffer),
      isRaw: RAW_EXTENSIONS.has(extension),
    };
    fileEntries.push(entry);
    const folder = folderMap.get(key);
    if (folder) {
      folder.photoCount += 1;
    }
  }

  return {
    mode: "local_demo",
    folderId,
    folderName: demoFolder?.name ?? "Album Cưới Demo",
    folders: [...folderMap.values()].sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath),
    ),
    files: fileEntries.sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath),
    ),
    scannedAt: new Date(),
  };
}

export function demoDriveAbsolutePath(relativePath: string): string {
  return resolveStoragePath(relativePath, DEMO_DRIVE_ROOT);
}

export function demoDriveRelativePath(
  folderKey: string,
  filename: string,
): string {
  return demoDriveFilePath(folderKey, filename);
}
