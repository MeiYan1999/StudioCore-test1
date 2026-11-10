import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import type { AppDb } from "../db/client";
import { driveConnections, settings, tenants } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission } from "../auth/permissions";
import { AuthorizationError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { getEnv } from "../env";
import { decryptSecret, encryptSecret } from "../security/secret-crypto";
import { setTenantSetting } from "./settings-write-service";
import { getTenantSettings } from "./settings-service";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");
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
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    env.GOOGLE_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    env.GOOGLE_CLIENT_SECRET?.trim() ||
    "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    env.GOOGLE_REDIRECT_URI?.trim() ||
    (env.NEXT_PUBLIC_SITE_URL ? `${env.NEXT_PUBLIC_SITE_URL}/api/integrations/google/callback` : "");
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
    scope: DRIVE_SCOPES,
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
  accessToken?: string;
  expiresIn?: number;
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
  return {
    refreshToken: payload.refresh_token,
    accessToken: payload.access_token,
    expiresIn: payload.expires_in,
  };
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

export function saveGoogleConnectionDirect(
  db: AppDb,
  tenantId: string,
  staffId: string,
  refreshToken: string,
): void {
  const existing = getGoogleConnection(db, tenantId);
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
        tenantId,
        provider: "google",
        refreshTokenEncrypted: encrypted,
        status: "connected",
      })
      .run();
  }
  writeAudit(db, {
    tenantId,
    actorId: staffId,
    action: "integrations.google.connect",
    entity: "drive_connection",
  });
}

export function saveGoogleConnection(
  db: AppDb,
  actor: ActorContext,
  refreshToken: string,
): void {
  assertPermission(actor, "integrations.manage");
  saveGoogleConnectionDirect(db, actor.tenantId, actor.staffId, refreshToken);
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

  const driveSettingKeys = [
    "drive.google.folder_id",
    "drive.google.folder_name",
    "drive.google.folder_url",
    "drive.google.account_email",
    "drive.google.storage_usage_bytes",
    "drive.google.storage_limit_bytes",
    "drive.google.storage_usage_text",
    "drive.google.storage_limit_text",
    "drive.google.percent_used",
    "drive.google.token_expires_at",
    "drive.google.token_refreshed_at",
  ];
  for (const k of driveSettingKeys) {
    db.delete(settings)
      .where(and(eq(settings.tenantId, actor.tenantId), eq(settings.key, k)))
      .run();
  }

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "integrations.google.disconnect",
    entity: "drive_connection",
  });
}

export async function refreshAccessToken(
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
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (payload.expires_in ?? 3600) * 1000);
  db.update(driveConnections)
    .set({ status: "connected", updatedAt: now, lastSyncedAt: now })
    .where(eq(driveConnections.id, connection.id))
    .run();

  setTenantSetting(db, tenantId, "drive.google.token_refreshed_at", now.toISOString());
  setTenantSetting(db, tenantId, "drive.google.token_expires_at", expiresAt.toISOString());

  return payload.access_token;
}

export type GoogleDriveAuth =
  | { type: "api_key"; key: string }
  | { type: "bearer"; token: string };

export async function resolveGoogleDriveAuth(
  db: AppDb,
  tenantId?: string,
): Promise<GoogleDriveAuth> {
  const apiKey =
    process.env.GOOGLE_API_KEY?.trim() ||
    getEnv().GOOGLE_API_KEY?.trim();
  if (apiKey) {
    return { type: "api_key", key: apiKey };
  }

  if (tenantId) {
    const currentConn = getGoogleConnection(db, tenantId);
    if (currentConn && currentConn.status === "connected") {
      try {
        const token = await refreshAccessToken(db, tenantId);
        return { type: "bearer", token };
      } catch {
        // Fallback to other connections if current refresh fails
      }
    }
  }

  const anyConn = db
    .select()
    .from(driveConnections)
    .where(
      and(
        eq(driveConnections.provider, "google"),
        eq(driveConnections.status, "connected"),
      ),
    )
    .limit(1)
    .get();

  if (anyConn) {
    try {
      const token = await refreshAccessToken(db, anyConn.tenantId);
      return { type: "bearer", token };
    } catch {
      // Continue to error
    }
  }

  throw new ValidationError(
    "Chưa cấu hình GOOGLE_API_KEY hoặc chưa kết nối Google Drive. Vui lòng thêm GOOGLE_API_KEY vào biến môi trường (hoặc vào mục Tích hợp để kết nối Google Drive) để quét link Drive công khai.",
  );
}

async function driveFetch(url: string, auth: GoogleDriveAuth): Promise<Response> {
  let targetUrl = url;
  const headers: Record<string, string> = {};

  if (auth.type === "api_key") {
    const parsed = new URL(targetUrl);
    parsed.searchParams.set("key", auth.key);
    targetUrl = parsed.toString();
  } else {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) return response;
      if (response.status === 401) {
        throw new AuthorizationError("Google access token hoặc API key không hợp lệ.");
      }
      if (response.status === 404) {
        throw new ValidationError(
          "Không tìm thấy thư mục trên Google Drive. Vui lòng kiểm tra lại đường link đã nhập.",
        );
      }
      if (response.status === 403) {
        throw new ValidationError(
          "Không có quyền truy cập thư mục Google Drive này. Hãy mở thư mục trên Google Drive, bấm 'Chia sẻ' và chọn 'Bất kỳ ai có đường liên kết đều có thể xem'.",
        );
      }
      if (response.status !== 429 && response.status < 500) {
        return response;
      }
      lastError = new Error(`Google Drive HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthorizationError) {
        throw error;
      }
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

const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|avif)$/i;
const PHOTO_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif|bmp|tiff?|cr2|cr3|nef|arw|dng|raw|raf)$/i;

function isImageOrPhoto(file: DriveApiFile): boolean {
  if (IMAGE_MIME.test(file.mimeType)) return true;
  if (file.mimeType.startsWith("image/")) return true;
  if (PHOTO_EXTENSIONS.test(file.name)) return true;
  return false;
}

async function listFolderChildren(
  auth: GoogleDriveAuth,
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
      auth,
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

  const auth = await resolveGoogleDriveAuth(db, actor.tenantId);

  let rootName = "Google Drive";
  try {
    const metaResponse = await driveFetch(
      `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType&supportsAllDrives=true`,
      auth,
    );
    if (metaResponse.ok) {
      const meta = (await metaResponse.json()) as {
        id: string;
        name: string;
        mimeType: string;
      };
      if (meta.mimeType && meta.mimeType !== "application/vnd.google-apps.folder") {
        throw new ValidationError(
          `Link vừa nhập là tập tin có tên "${meta.name}", không phải là một thư mục Google Drive. Vui lòng dán link thư mục chứa ảnh.`,
        );
      }
      if (meta.name) {
        rootName = meta.name;
      }
    }
  } catch (error) {
    if (error instanceof ValidationError || error instanceof AuthorizationError) {
      throw error;
    }
  }

  const rootFiles = await listFolderChildren(auth, folderId);
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
        : await listFolderChildren(auth, current.id);
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
      if (!isImageOrPhoto(child)) {
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
        checksum: child.md5Checksum ?? child.id,
        width: child.imageMediaMetadata?.width ?? 1200,
        height: child.imageMediaMetadata?.height ?? 800,
        folderId: current.depth === 0 ? folderId : current.id,
        folderName: current.depth === 0 ? rootName : current.name,
        relativePath,
        thumbnailLink:
          child.thumbnailLink ??
          `https://drive.google.com/thumbnail?id=${child.id}&sz=w800`,
      });
    }
  }

  if (files.length === 0 && folders.length === 0) {
    throw new ValidationError(
      `Thư mục "${rootName}" không có ảnh nào hợp lệ (JPG, PNG, WebP...) hoặc chưa bật quyền chia sẻ. Vui lòng kiểm tra lại.`,
    );
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
  const auth = await resolveGoogleDriveAuth(db, tenantId);
  const response = await driveFetch(
    `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    auth,
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

export function formatDriveBytes(bytes: number): string {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(units.length - 1, Math.max(0, i));
  const val = bytes / Math.pow(1024, idx);
  const formatted = val < 10 ? val.toFixed(2) : val.toFixed(1);
  return `${formatted.replace(/\.?0+$/, "")} ${units[idx]}`;
}

export type GoogleDriveWorkspaceInfo = {
  connected: boolean;
  configured: boolean;
  status: string;
  accountEmail: string;
  folderId: string | null;
  folderName: string;
  folderUrl: string;
  storageUsageText: string;
  storageLimitText: string;
  percentUsed: string;
  percentNumber: number;
  refreshedAt: string | null;
  expiresAt: string | null;
  subfolders: string[];
};

export async function setupStudioDriveWorkspaceWithToken(
  db: AppDb,
  tenantId: string,
  accessToken: string,
): Promise<{
  folderId: string;
  folderName: string;
  folderUrl: string;
  storageUsage: string;
  storageLimit: string;
  percentUsed: string;
  email: string;
}> {
  // 1. Get studio name
  let studioName = "StudioCore";
  const studioSetting = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "studio.name")))
    .get();

  if (studioSetting?.value?.trim()) {
    studioName = studioSetting.value.trim();
  } else {
    const tenant = db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .get();
    if (tenant?.name?.trim()) {
      studioName = tenant.name.trim();
    }
  }

  const targetFolderName = `STUDIOCORE.IO.VN - ${studioName}`;

  // 2. Query Google Drive API for storage quota and user info
  let email = "";
  let usageBytes = 0;
  let limitBytes = 15 * 1024 * 1024 * 1024;
  try {
    const aboutRes = await fetch(
      `${GOOGLE_DRIVE_API}/about?fields=storageQuota,user`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (aboutRes.ok) {
      const aboutData = (await aboutRes.json()) as {
        user?: { emailAddress?: string };
        storageQuota?: { usage?: string; limit?: string };
      };
      if (aboutData.user?.emailAddress) {
        email = aboutData.user.emailAddress;
      }
      if (aboutData.storageQuota?.usage) {
        usageBytes = Number(aboutData.storageQuota.usage) || 0;
      }
      if (aboutData.storageQuota?.limit) {
        limitBytes = Number(aboutData.storageQuota.limit) || 0;
      }
    }
  } catch (err) {
    console.warn("Could not query Google Drive quota:", err);
  }

  const usageText = formatDriveBytes(usageBytes);
  const limitText =
    limitBytes > 0
      ? formatDriveBytes(limitBytes).replace(/\.0\s/, " ")
      : "Không giới hạn";
  const percentCalc =
    limitBytes > 0
      ? ((usageBytes / limitBytes) * 100).toFixed(1)
      : "0.0";
  const percentUsed = `${percentCalc}%`;

  // 3. Search or create root folder
  let rootFolderId = "";
  let rootFolderUrl = "";

  const escapedName = targetFolderName.replace(/'/g, "\\'");
  try {
    const searchRes = await fetch(
      `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(
        `mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and trashed=false`,
      )}&fields=files(id,name,webViewLink)&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as {
        files?: Array<{ id: string; name: string; webViewLink?: string }>;
      };
      if (searchData.files && searchData.files.length > 0) {
        rootFolderId = searchData.files[0].id;
        rootFolderUrl =
          searchData.files[0].webViewLink ||
          `https://drive.google.com/drive/folders/${rootFolderId}`;
      }
    }
  } catch (err) {
    console.warn("Error searching Drive folder:", err);
  }

  // If not found, create root folder
  if (!rootFolderId) {
    try {
      const createRes = await fetch(
        `${GOOGLE_DRIVE_API}/files?fields=id,name,webViewLink&supportsAllDrives=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: targetFolderName,
            mimeType: "application/vnd.google-apps.folder",
            description:
              "Kho lưu trữ dữ liệu của studio: ảnh/tệp trong chat, tệp đính kèm đơn hàng & chi phí, ảnh checklist, sao lưu tự động",
            folderColorRgb: "#ea4335",
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (createRes.ok) {
        const created = (await createRes.json()) as {
          id: string;
          name: string;
          webViewLink?: string;
        };
        rootFolderId = created.id;
        rootFolderUrl =
          created.webViewLink ||
          `https://drive.google.com/drive/folders/${rootFolderId}`;
      }
    } catch (err) {
      console.warn("Error creating root Drive folder:", err);
    }
  }

  if (rootFolderId && !rootFolderUrl) {
    rootFolderUrl = `https://drive.google.com/drive/folders/${rootFolderId}`;
  }

  // 4. Create standard subfolders if root folder exists
  const subfolders = [
    "Sao lưu tự động",
    "Đơn hàng & Chi phí",
    "Tệp tin & Tài liệu",
  ];
  if (rootFolderId) {
    for (const subName of subfolders) {
      try {
        const subEscaped = subName.replace(/'/g, "\\'");
        const checkRes = await fetch(
          `${GOOGLE_DRIVE_API}/files?q=${encodeURIComponent(
            `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${subEscaped}' and trashed=false`,
          )}&fields=files(id,name)&supportsAllDrives=true`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10_000),
          },
        );
        let exists = false;
        if (checkRes.ok) {
          const checkData = (await checkRes.json()) as {
            files?: Array<{ id: string }>;
          };
          if (checkData.files && checkData.files.length > 0) {
            exists = true;
          }
        }
        if (!exists) {
          await fetch(
            `${GOOGLE_DRIVE_API}/files?fields=id,name&supportsAllDrives=true`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: subName,
                mimeType: "application/vnd.google-apps.folder",
                parents: [rootFolderId],
              }),
              signal: AbortSignal.timeout(15_000),
            },
          );
        }
      } catch (subErr) {
        console.warn(`Could not verify/create subfolder "${subName}":`, subErr);
      }
    }
  }

  // 5. Save metadata to DB
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

  const existingConn = getGoogleConnection(db, tenantId);
  if (existingConn) {
    db.update(driveConnections)
      .set({
        folderId: rootFolderId || existingConn.folderId,
        status: "connected",
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(driveConnections.id, existingConn.id))
      .run();
  }

  setTenantSetting(db, tenantId, "drive.google.folder_id", rootFolderId);
  setTenantSetting(db, tenantId, "drive.google.folder_name", targetFolderName);
  setTenantSetting(db, tenantId, "drive.google.folder_url", rootFolderUrl);
  if (email) {
    setTenantSetting(db, tenantId, "drive.google.account_email", email);
  }
  setTenantSetting(db, tenantId, "drive.google.storage_usage_bytes", String(usageBytes));
  setTenantSetting(db, tenantId, "drive.google.storage_limit_bytes", String(limitBytes));
  setTenantSetting(db, tenantId, "drive.google.storage_usage_text", usageText);
  setTenantSetting(db, tenantId, "drive.google.storage_limit_text", limitText);
  setTenantSetting(db, tenantId, "drive.google.percent_used", percentUsed);
  setTenantSetting(db, tenantId, "drive.google.token_refreshed_at", now.toISOString());
  setTenantSetting(db, tenantId, "drive.google.token_expires_at", expiresAt.toISOString());

  return {
    folderId: rootFolderId,
    folderName: targetFolderName,
    folderUrl: rootFolderUrl,
    storageUsage: usageText,
    storageLimit: limitText,
    percentUsed,
    email,
  };
}

export async function setupStudioDriveWorkspace(
  db: AppDb,
  tenantId: string,
): Promise<{
  folderId: string;
  folderName: string;
  folderUrl: string;
  storageUsage: string;
  storageLimit: string;
  percentUsed: string;
  email: string;
}> {
  const accessToken = await refreshAccessToken(db, tenantId);
  return setupStudioDriveWorkspaceWithToken(db, tenantId, accessToken);
}

export function getGoogleDriveWorkspaceInfo(
  db: AppDb,
  tenantId: string,
): GoogleDriveWorkspaceInfo {
  const config = getGoogleOAuthConfig();
  const conn = getGoogleConnection(db, tenantId);
  const isConnected = Boolean(conn && conn.status === "connected");
  const studioSettings = getTenantSettings(db, tenantId);

  let studioName = "StudioCore";
  if (studioSettings["studio.name"]?.trim()) {
    studioName = studioSettings["studio.name"].trim();
  } else {
    const tenant = db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .get();
    if (tenant?.name?.trim()) {
      studioName = tenant.name.trim();
    }
  }

  const folderId = studioSettings["drive.google.folder_id"] || conn?.folderId || null;
  const folderName =
    studioSettings["drive.google.folder_name"] ||
    `STUDIOCORE.IO.VN - ${studioName}`;
  const folderUrl =
    studioSettings["drive.google.folder_url"] ||
    (folderId
      ? `https://drive.google.com/drive/folders/${folderId}`
      : "https://drive.google.com");

  const accountEmail = studioSettings["drive.google.account_email"] || "";
  const storageUsageText =
    studioSettings["drive.google.storage_usage_text"] || "9.44 MB";
  const storageLimitText =
    studioSettings["drive.google.storage_limit_text"] || "15 GB";
  const percentUsed =
    studioSettings["drive.google.percent_used"] || "0.1%";
  const percentNumber =
    parseFloat(percentUsed.replace("%", "")) || 0.1;

  const refreshedAt =
    studioSettings["drive.google.token_refreshed_at"] ||
    (conn?.lastSyncedAt ? conn.lastSyncedAt.toISOString() : null);

  const expiresAt =
    studioSettings["drive.google.token_expires_at"] ||
    (refreshedAt
      ? new Date(new Date(refreshedAt).getTime() + 60 * 60 * 1000).toISOString()
      : null);

  return {
    connected: isConnected,
    configured: config.configured,
    status: conn?.status || "disconnected",
    accountEmail,
    folderId,
    folderName,
    folderUrl,
    storageUsageText,
    storageLimitText,
    percentUsed,
    percentNumber,
    refreshedAt,
    expiresAt,
    subfolders: ["Sao lưu tự động", "Đơn hàng & Chi phí", "Tệp tin & Tài liệu"],
  };
}
