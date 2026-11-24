import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../helpers/test-db";
import type { AppDb } from "@/lib/db/client";
import type { ActorContext } from "@/lib/auth/types";
import { albums, albumSources, driveConnections } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/security/secret-crypto";
import {
  DRIVE_SHARING_SCOPE,
  saveGoogleConnectionDirect,
} from "@/lib/services/drive-connection-service";
import { syncAlbumDriveSharing } from "@/lib/services/drive-sharing-service";
import {
  setAlbumShareRevoked,
  updateAlbumStatus,
} from "@/lib/services/album-service";

type Call = { method: string; url: string; body: string | null };

describe("Đồng bộ quyền chia sẻ Google Drive theo link album", () => {
  let db: AppDb;
  let actor: ActorContext;
  let albumIds: string[];
  let calls: Call[];
  const originalEnv = { ...process.env };

  function addSource(albumId: string, folderId: string): string {
    const id = `src-${albumId}-${folderId}`;
    db.insert(albumSources)
      .values({
        id,
        tenantId: actor.tenantId,
        albumId,
        provider: "google",
        sourceUrl: `https://drive.google.com/drive/folders/${folderId}`,
        externalFolderId: folderId,
        status: "synced",
      })
      .run();
    return id;
  }

  function connect(): void {
    db.insert(driveConnections)
      .values({
        id: "conn-test",
        tenantId: actor.tenantId,
        provider: "google",
        refreshTokenEncrypted: encryptSecret("refresh-token"),
        scopes: DRIVE_SHARING_SCOPE,
        status: "connected",
      })
      .run();
  }

  function mockGoogle(
    handler: (call: Call) => Response | undefined = () => undefined,
  ): void {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const call: Call = {
        method: init?.method ?? "GET",
        url: input.toString(),
        body: typeof init?.body === "string" ? init.body : null,
      };
      if (call.url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "access", expires_in: 3600 });
      }
      calls.push(call);
      return handler(call) ?? new Response(null, { status: 204 });
    });
  }

  function source(id: string) {
    return db.select().from(albumSources).where(eq(albumSources.id, id)).get()!;
  }

  beforeEach(() => {
    db = createTestDb();
    calls = [];
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost/callback";
    const rows = db.select().from(albums).all();
    const first = rows[0];
    albumIds = rows
      .filter((row) => row.tenantId === first.tenantId && row.status !== "archived")
      .map((row) => row.id);
    actor = {
      sessionId: "sess-test",
      staffId: first.createdBy,
      tenantId: first.tenantId,
      tenantName: "Demo Studio",
      tenantSlug: "demo-studio",
      tenantPlan: "pro",
      staffName: "Chủ Studio",
      staffCode: "SC-OWNER",
      staffEmail: "owner@studiocore.test",
      role: "owner",
      branches: [
        ...new Set(
          rows
            .filter((row) => row.tenantId === first.tenantId)
            .map((row) => row.branchId),
        ),
      ].map((id) => ({ id, name: id })),
      activeBranchId: first.branchId,
      readOnly: false,
      canChangePassword: false,
      permissions: ["albums.manage", "albums.view"],
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("thu hồi link gỡ đúng quyền anyoneWithLink, mở lại link bật lại quyền đó", async () => {
    connect();
    mockGoogle();
    const sourceId = addSource(albumIds[0], "folder-a");

    setAlbumShareRevoked(db, actor, albumIds[0], true);
    const revoked = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(revoked).toMatchObject({ status: "ok", target: "private", changed: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toContain("/files/folder-a/permissions/anyoneWithLink");
    expect(source(sourceId).driveAccessRevokedAt).not.toBeNull();

    // Gọi lại không gọi Google lần nữa.
    await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(calls).toHaveLength(1);

    setAlbumShareRevoked(db, actor, albumIds[0], false);
    const restored = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(restored).toMatchObject({ status: "ok", target: "public", changed: 1 });
    expect(calls[1].method).toBe("POST");
    expect(calls[1].url).toContain("/files/folder-a/permissions");
    expect(JSON.parse(calls[1].body ?? "{}")).toEqual({
      type: "anyone",
      role: "reader",
    });
    expect(source(sourceId).driveAccessRevokedAt).toBeNull();
  });

  it("lưu trữ album cũng gỡ quyền trên Drive", async () => {
    connect();
    mockGoogle();
    addSource(albumIds[0], "folder-a");
    updateAlbumStatus(db, actor, albumIds[0], "archived");
    const result = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(result).toMatchObject({ status: "ok", target: "private", changed: 1 });
  });

  it("không bật công khai thư mục vốn đã riêng tư khi mở lại link", async () => {
    connect();
    mockGoogle((call) =>
      call.method === "DELETE" ? new Response("{}", { status: 404 }) : undefined,
    );
    const sourceId = addSource(albumIds[0], "folder-a");
    setAlbumShareRevoked(db, actor, albumIds[0], true);
    const revoked = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(revoked).toMatchObject({ status: "ok", changed: 0, failed: 0 });
    expect(source(sourceId).driveAccessRevokedAt).toBeNull();

    setAlbumShareRevoked(db, actor, albumIds[0], false);
    const before = calls.length;
    await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(calls.slice(before).some((call) => call.method === "POST")).toBe(false);
  });

  it("giữ quyền thư mục khi album khác đang mở link dùng chung thư mục", async () => {
    const template = db
      .select()
      .from(albums)
      .where(eq(albums.id, albumIds[0]))
      .get()!;
    db.insert(albums)
      .values({
        ...template,
        id: "album-second",
        token: "second-token",
        shareRevokedAt: null,
      })
      .run();
    albumIds.push("album-second");
    connect();
    mockGoogle();
    const sourceId = addSource(albumIds[0], "folder-shared");
    addSource(albumIds[1], "folder-shared");
    setAlbumShareRevoked(db, actor, albumIds[0], true);
    const result = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(calls).toHaveLength(0);
    expect(result.message).toMatch(/dùng chung/);
    expect(source(sourceId).driveAccessRevokedAt).toBeNull();
  });

  it("báo rõ khi chưa kết nối Google Drive và không gọi Google", async () => {
    mockGoogle();
    addSource(albumIds[0], "folder-a");
    setAlbumShareRevoked(db, actor, albumIds[0], true);
    const result = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(result.status).toBe("not_connected");
    expect(result.message).toMatch(/vẫn mở được ảnh/);
    expect(calls).toHaveLength(0);
  });

  it("Google từ chối thì báo lỗi và để lần sau thử lại", async () => {
    connect();
    mockGoogle(
      () =>
        new Response(
          JSON.stringify({ error: { message: "Insufficient Permission" } }),
          { status: 403 },
        ),
    );
    const sourceId = addSource(albumIds[0], "folder-a");
    setAlbumShareRevoked(db, actor, albumIds[0], true);
    const result = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(result).toMatchObject({ status: "failed", failed: 1, changed: 0 });
    expect(source(sourceId).driveAccessRevokedAt).toBeNull();
  });

  it("album không có nguồn Google Drive thì không làm gì", async () => {
    connect();
    mockGoogle();
    setAlbumShareRevoked(db, actor, albumIds[0], true);
    const result = await syncAlbumDriveSharing(db, actor, albumIds[0]);
    expect(result).toMatchObject({ status: "none", message: null });
    expect(calls).toHaveLength(0);
  });

  it("đăng nhập Google chỉ-đọc không ghi đè kết nối có quyền quản lý chia sẻ", () => {
    connect();
    const before = db.select().from(driveConnections).get()!;
    saveGoogleConnectionDirect(
      db,
      actor.tenantId,
      actor.staffId,
      "weaker-token",
      "openid https://www.googleapis.com/auth/drive.readonly",
    );
    const after = db.select().from(driveConnections).get()!;
    expect(after.refreshTokenEncrypted).toBe(before.refreshTokenEncrypted);
    expect(after.scopes).toBe(DRIVE_SHARING_SCOPE);
  });
});
