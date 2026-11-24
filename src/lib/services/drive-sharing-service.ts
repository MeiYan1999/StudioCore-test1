import { and, eq, isNull, ne } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { albums, albumSources } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import { NotFoundError } from "../errors";
import { writeAudit } from "../audit";
import {
  getGoogleConnection,
  getGoogleOAuthConfig,
  refreshAccessToken,
} from "./drive-connection-service";

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const RECONNECT_HINT =
  "Vào Cài đặt → Kết nối Google Drive để kết nối (lại) bằng tài khoản sở hữu thư mục ảnh.";

export type DriveSharingSyncResult = {
  /** "none": album không có nguồn Google Drive cần xử lý. */
  status: "none" | "ok" | "not_connected" | "failed";
  target: "private" | "public";
  changed: number;
  failed: number;
  message: string | null;
};

type DriveCallOutcome =
  | { ok: true; changed: boolean }
  | { ok: false; reason: string };

function driveErrorReason(status: number, body: string): string {
  if (status === 401) return `Google từ chối token. ${RECONNECT_HINT}`;
  if (status === 403) {
    if (/insufficient.*(scope|permission)/i.test(body)) {
      return `Kết nối Google Drive hiện tại chưa có quyền quản lý chia sẻ. ${RECONNECT_HINT}`;
    }
    return "Tài khoản Google đã kết nối không có quyền đổi chia sẻ của thư mục này (không phải chủ sở hữu, hoặc quyền được kế thừa từ thư mục cha).";
  }
  if (status === 404) return "Tài khoản Google đã kết nối không thấy thư mục này.";
  return `Google Drive trả lỗi HTTP ${status}.`;
}

async function removeAnyoneAccess(
  accessToken: string,
  folderId: string,
): Promise<DriveCallOutcome> {
  const base = `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(folderId)}`;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const response = await fetch(
    `${base}/permissions/anyoneWithLink?supportsAllDrives=true`,
    { method: "DELETE", headers, signal: AbortSignal.timeout(20_000) },
  );
  if (response.ok) return { ok: true, changed: true };
  const body = await response.text().catch(() => "");
  if (response.status === 404) {
    // 404 có hai nghĩa: thư mục vốn không chia sẻ công khai, hoặc tài khoản
    // không thấy thư mục. Chỉ coi là xong khi đọc được thư mục.
    const meta = await fetch(`${base}?fields=id&supportsAllDrives=true`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if (meta.ok) return { ok: true, changed: false };
    return { ok: false, reason: driveErrorReason(meta.status, "") };
  }
  return { ok: false, reason: driveErrorReason(response.status, body) };
}

async function addAnyoneReader(
  accessToken: string,
  folderId: string,
): Promise<DriveCallOutcome> {
  const response = await fetch(
    `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(folderId)}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "anyone", role: "reader" }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (response.ok) return { ok: true, changed: true };
  const body = await response.text().catch(() => "");
  return { ok: false, reason: driveErrorReason(response.status, body) };
}

function isClosed(album: { shareRevokedAt: Date | null; status: string }): boolean {
  return album.shareRevokedAt !== null || album.status === "archived";
}

/**
 * Đưa quyền "Bất kỳ ai có đường liên kết" trên các thư mục Google Drive của
 * album về đúng trạng thái link: link đã thu hồi/album lưu trữ → gỡ quyền;
 * link mở lại → bật lại đúng những thư mục StudioCore đã gỡ trước đó.
 * Không ném lỗi do Google: việc thu hồi link trong StudioCore luôn giữ nguyên,
 * kết quả phía Drive trả về qua `message`.
 */
export async function syncAlbumDriveSharing(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
): Promise<DriveSharingSyncResult> {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  const target: DriveSharingSyncResult["target"] = isClosed(album)
    ? "private"
    : "public";
  const sources = db
    .select()
    .from(albumSources)
    .where(
      and(
        eq(albumSources.albumId, albumId),
        eq(albumSources.tenantId, actor.tenantId),
        eq(albumSources.provider, "google"),
      ),
    )
    .all()
    .filter((source) => Boolean(source.externalFolderId));

  const pending =
    target === "private"
      ? sources.filter((source) => source.driveAccessRevokedAt === null)
      : sources.filter((source) => source.driveAccessRevokedAt !== null);
  const result: DriveSharingSyncResult = {
    status: "none",
    target,
    changed: 0,
    failed: 0,
    message: null,
  };
  if (pending.length === 0) return result;

  const connection = getGoogleConnection(db, actor.tenantId);
  if (!connection || !getGoogleOAuthConfig().configured) {
    result.status = "not_connected";
    result.message =
      target === "private"
        ? `Chưa kết nối Google Drive nên quyền xem trên Drive chưa được gỡ: ai có link Drive vẫn mở được ảnh. ${RECONNECT_HINT}`
        : `Chưa kết nối Google Drive nên chưa bật lại được quyền xem trên Drive; khách sẽ không thấy ảnh. ${RECONNECT_HINT}`;
    return result;
  }

  let accessToken: string;
  try {
    accessToken = await refreshAccessToken(db, actor.tenantId);
  } catch (error) {
    result.status = "failed";
    result.failed = pending.length;
    result.message = `Không đổi được quyền trên Google Drive: ${
      error instanceof Error ? error.message : "không lấy được token."
    }`;
    return result;
  }

  // Thư mục còn được một album khác đang mở link dùng thì không gỡ quyền.
  const sharedElsewhere = new Set<string>();
  if (target === "private") {
    const others = db
      .select({ folderId: albumSources.externalFolderId })
      .from(albumSources)
      .innerJoin(albums, eq(albums.id, albumSources.albumId))
      .where(
        and(
          eq(albumSources.tenantId, actor.tenantId),
          eq(albumSources.provider, "google"),
          ne(albumSources.albumId, albumId),
          isNull(albums.shareRevokedAt),
          ne(albums.status, "archived"),
        ),
      )
      .all();
    for (const other of others) {
      if (other.folderId) sharedElsewhere.add(other.folderId);
    }
  }

  const reasons = new Set<string>();
  let skipped = 0;
  for (const source of pending) {
    const folderId = source.externalFolderId as string;
    if (sharedElsewhere.has(folderId)) {
      skipped += 1;
      continue;
    }
    let outcome: DriveCallOutcome;
    try {
      outcome =
        target === "private"
          ? await removeAnyoneAccess(accessToken, folderId)
          : await addAnyoneReader(accessToken, folderId);
    } catch {
      outcome = { ok: false, reason: "Không gọi được Google Drive API." };
    }
    if (!outcome.ok) {
      result.failed += 1;
      reasons.add(outcome.reason);
      continue;
    }
    if (outcome.changed) result.changed += 1;
    // Chỉ đánh dấu thư mục StudioCore thực sự gỡ quyền, để lúc mở lại link
    // không tự công khai thư mục vốn đang riêng tư.
    db.update(albumSources)
      .set({
        driveAccessRevokedAt:
          target === "private" && outcome.changed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(albumSources.id, source.id))
      .run();
  }

  if (result.changed > 0 || result.failed > 0) {
    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action:
        target === "private"
          ? "albums.share.drive_access.revoke"
          : "albums.share.drive_access.restore",
      entity: "album",
      entityId: albumId,
      metadata: { changed: result.changed, failed: result.failed, skipped },
    });
  }

  const parts: string[] = [];
  if (result.changed > 0) {
    parts.push(
      target === "private"
        ? `Đã gỡ quyền "Bất kỳ ai có đường liên kết" trên ${result.changed} thư mục Google Drive.`
        : `Đã bật lại quyền xem bằng đường liên kết trên ${result.changed} thư mục Google Drive.`,
    );
  }
  if (skipped > 0) {
    parts.push(
      `${skipped} thư mục giữ nguyên quyền vì album khác đang mở link dùng chung.`,
    );
  }
  if (result.failed > 0) {
    parts.push(
      `${result.failed} thư mục Drive chưa đổi được quyền: ${[...reasons].join(" ")}`,
    );
  }
  result.status = result.failed > 0 ? "failed" : "ok";
  result.message = parts.length > 0 ? parts.join(" ") : null;
  return result;
}
