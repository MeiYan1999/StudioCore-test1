import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { AppDb } from "../db/client";
import { driveConnections } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission } from "../auth/permissions";
import { AuthorizationError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { getEnv } from "../env";
import { decryptSecret, encryptSecret } from "../security/secret-crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const STATE_TTL_SECONDS = 10 * 60;
const CACHE_TTL_MS = 5 * 60 * 1000;

export type GoogleOAuthConfig = {
  configured: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const env = getEnv();
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = env.GOOGLE_REDIRECT_URI?.trim() ?? "";
  return {
    configured: Boolean(clientId && clientSecret && redirectUri),
    clientId,
    clientSecret,
    redirectUri,
  };
}

function getStateSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function createGoogleStateToken(
  tenantId: string,
  staffId: string,
): Promise<string> {
  return new SignJWT({ tenantId, staffId, nonce: crypto.randomUUID() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS)
    .sign(getStateSecret());
}

export async function verifyGoogleStateToken(
  token: string,
): Promise<{ tenantId: string; staffId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getStateSecret());
    if (
      typeof payload.tenantId !== "string" ||
      typeof payload.staffId !== "string"
    ) {
      return null;
    }
    return { tenantId: payload.tenantId, staffId: payload.staffId };
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(state: string): string {
  const config = getGoogleOAuthConfig();
  if (!config.configured) {
    throw new ValidationError("Google Drive OAuth chưa được cấu hình.");
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleCode(code: string): Promise<{
  refreshToken: string;
}> {
  const config = getGoogleOAuthConfig();
  if (!config.configured) {
    throw new ValidationError("Google Drive OAuth chưa được cấu hình.");
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.refresh_token) {
    throw new ValidationError(
      payload.error_description ||
        payload.error ||
        "Google không trả refresh token. Thử thu hồi quyền và kết nối lại.",
    );
  }
  return { refreshToken: payload.refresh_token };
}

export function getGoogleConnection(db: AppDb, tenantId: string) {
  return (
    db
      .select()
      .from(driveConnections)
      .where(
        and(
          eq(driveConnections.tenantId, tenantId),
          eq(driveConnections.provider, "google"),
        ),
      )
      .get() ?? null
  );
}

export function saveGoogleConnection(
  db: AppDb,
  actor: ActorContext,
  refreshToken: string,
): void {
  assertPermission(actor, "integrations.manage");
  const existing = getGoogleConnection(db, actor.tenantId);
  const encrypted = encryptSecret(refreshToken);
  if (existing) {
    db.update(driveConnections)
      .set({
        refreshTokenEncrypted: encrypted,
        status: "connected",
        updatedAt: new Date(),
      })
      .where(eq(driveConnections.id, existing.id))
      .run();
  } else {
    db.insert(driveConnections)
      .values({
        id: crypto.randomUUID(),
        tenantId: actor.tenantId,
        provider: "google",
        refreshTokenEncrypted: encrypted,
        status: "connected",
      })
      .run();
  }
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "integrations.google.connect",
    entity: "drive_connection",
  });
}

export function disconnectGoogleConnection(
  db: AppDb,
  actor: ActorContext,
): void {
  assertPermission(actor, "integrations.manage");
  db.delete(driveConnections)
    .where(
      and(
        eq(driveConnections.tenantId, actor.tenantId),
        eq(driveConnections.provider, "google"),
      ),
    )
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "integrations.google.disconnect",
    entity: "drive_connection",
  });
}

async function refreshAccessToken(
  db: AppDb,
  tenantId: string,
): Promise<string> {
  const connection = getGoogleConnection(db, tenantId);
  if (!connection) {
    throw new ValidationError(
      "Google Drive chưa được kết nối. Vào Tích hợp để kết nối OAuth.",
    );
  }
  const refreshToken = decryptSecret(connection.refreshTokenEncrypted);
  if (!refreshToken) {
    throw new ValidationError(
      "Không giải mã được refresh token Google. Kết nối lại Drive.",
    );
  }
  const config = getGoogleOAuthConfig();
  if (!config.configured) {
    throw new ValidationError("Google Drive OAuth chưa được cấu hình.");
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    db.update(driveConnections)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(driveConnections.id, connection.id))
      .run();
    throw new ValidationError(
      payload.error_description ||
        "Google từ chối refresh token. Kết nối lại Drive.",
    );
  }
  db.update(driveConnections)
    .set({ status: "connected", updatedAt: new Date(), lastSyncedAt: new Date() })
    .where(eq(driveConnections.id, connection.id))
    .run();
  return payload.access_token;
}

async function driveFetch(url: string, accessToken: string): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) return response;
      if (response.status === 401) {
        throw new AuthorizationError("Google access token hết hạn.");
      }
      if (response.status === 403) {
        throw new AuthorizationError(
          "Google Drive từ chối quyền truy cập hoặc hết quota. Kiểm tra kết nối.",
        );
      }
      if (response.status !== 429 && response.status < 500) {
        return response;
      }
      lastError = new Error(`Google Drive HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Không gọi được Google Drive API.");
}

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  md5Checksum: string | null;
  sourceFileId: string;
  checksum: string;
  width: number;
  height: number;
  folderId: string;
  folderName: string;
  relativePath: string;
  thumbnailLink: string | null;
};

export type GoogleDriveScan = {
  provider: "google";
  folderId: string;
  folderName: string;
  folders: { id: string; name: string; relativePath: string }[];
  files: GoogleDriveFile[];
  scannedAt: Date;
  fromCache: boolean;
};

type CacheEntry = { expiresAt: number; scan: GoogleDriveScan };
const scanCache = new Map<string, CacheEntry>();

type DriveApiFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  thumbnailLink?: string;
  imageMediaMetadata?: { width?: number; height?: number };
};

const IMAGE_MIME = /^image\/(jpeg|png|webp)$/i;

async function listFolderChildren(
  accessToken: string,
  folderId: string,
): Promise<DriveApiFile[]> {
  const results: DriveApiFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`,
      fields:
        "nextPageToken,files(id,name,mimeType,size,md5Checksum,thumbnailLink,imageMediaMetadata(width,height))",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await driveFetch(
      `${GOOGLE_DRIVE_API}/files?${params.toString()}`,
      accessToken,
    );
    if (!response.ok) {
      throw new ValidationError(
        `Google Drive trả lỗi HTTP ${response.status}.`,
      );
    }
    const payload = (await response.json()) as {
      nextPageToken?: string;
      files?: DriveApiFile[];
    };
    results.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
    if (results.length > 2000) break;
  } while (pageToken);
  return results;
}

export async function scanGoogleDriveFolder(
  db: AppDb,
  actor: ActorContext,
  folderId: string,
  options: { recursive?: boolean; force?: boolean } = {},
): Promise<GoogleDriveScan> {
  assertPermission(actor, "albums.manage");
  const cacheKey = `${actor.tenantId}:${folderId}:${options.recursive !== false}`;
  const cached = scanCache.get(cacheKey);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return { ...cached.scan, fromCache: true };
  }

  const accessToken = await refreshAccessToken(db, actor.tenantId);
  const rootFiles = await listFolderChildren(accessToken, folderId);
  const rootName =
    rootFiles.find((file) => file.mimeType === "application/vnd.google-apps.folder")
      ?.name ?? "Google Drive";
  const folders: GoogleDriveScan["folders"] = [];
  const files: GoogleDriveFile[] = [];

  const queue: {
    id: string;
    name: string;
    relativePath: string;
    depth: number;
  }[] = [{ id: folderId, name: rootName, relativePath: "", depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    const children =
      current.depth === 0
        ? rootFiles
        : await listFolderChildren(accessToken, current.id);
    for (const child of children) {
      if (child.mimeType === "application/vnd.google-apps.folder") {
        const relativePath = current.relativePath
          ? `${current.relativePath}/${child.name}`
          : child.name;
        folders.push({ id: child.id, name: child.name, relativePath });
        if (options.recursive !== false && current.depth < 4) {
          queue.push({
            id: child.id,
            name: child.name,
            relativePath,
            depth: current.depth + 1,
          });
        }
        continue;
      }
      if (!IMAGE_MIME.test(child.mimeType)) {
        continue;
      }
      const relativePath = current.relativePath
        ? `${current.relativePath}/${child.name}`
        : child.name;
      files.push({
        id: child.id,
        name: child.name,
        mimeType: child.mimeType,
        size: Number(child.size ?? 0),
        md5Checksum: child.md5Checksum ?? null,
        sourceFileId: `google:${child.id}`,
        checksum: child.md5Checksum ?? "",
        width: child.imageMediaMetadata?.width ?? 0,
        height: child.imageMediaMetadata?.height ?? 0,
        folderId: current.depth === 0 ? folderId : current.id,
        folderName: current.depth === 0 ? rootName : current.name,
        relativePath,
        thumbnailLink: child.thumbnailLink ?? null,
      });
    }
  }

  const scan: GoogleDriveScan = {
    provider: "google",
    folderId,
    folderName: rootName,
    folders,
    files: files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
    scannedAt: new Date(),
    fromCache: false,
  };
  scanCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    scan,
  });
  return scan;
}

export async function downloadGoogleFile(
  db: AppDb,
  tenantId: string,
  fileId: string,
): Promise<Buffer> {
  const accessToken = await refreshAccessToken(db, tenantId);
  const response = await driveFetch(
    `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    accessToken,
  );
  if (!response.ok) {
    throw new ValidationError(
      `Không tải được file Google Drive (HTTP ${response.status}).`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

export function clearGoogleScanCache(tenantId: string): void {
  for (const key of scanCache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      scanCache.delete(key);
    }
  }
}
