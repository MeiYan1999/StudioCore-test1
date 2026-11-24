import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { count, eq } from "drizzle-orm";
import JSZip from "jszip";
import { authenticate } from "@/lib/auth/login-service";
import { getActorContext } from "@/lib/auth/session";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import { getDb, type AppDb } from "@/lib/db/client";
import { albums, customers, documents, photos } from "@/lib/db/schema";
import { createTestDb } from "../helpers/test-db";

vi.mock("@/lib/auth/session", () => ({ getActorContext: vi.fn() }));
vi.mock("@/lib/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/client")>()),
  getDb: vi.fn(),
}));

let db: AppDb;
let demoOwner: ActorContext;
let otherOwner: ActorContext;
let demoAlbumId: string;

async function login(email: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip: "192.0.2.210", userAgent: "vitest-route-isolation" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

function as(actor: ActorContext | null) {
  vi.mocked(getActorContext).mockResolvedValue(actor);
}

const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  db = createTestDb();
  demoOwner = await login("owner@studiocore.demo");
  otherOwner = await login("owner@studiobinhminh.demo");
  demoAlbumId = db
    .select({ id: albums.id })
    .from(albums)
    .where(eq(albums.tenantId, demoOwner.tenantId))
    .all()[0].id;
});

beforeEach(() => {
  vi.mocked(getDb).mockReturnValue(db);
});

describe("route handler: cô lập tenant", () => {
  it("hai studio demo là hai tenant khác nhau", () => {
    expect(otherOwner.tenantId).not.toBe(demoOwner.tenantId);
  });

  it("tải tài liệu của studio khác trả 404, không đăng nhập trả 401", async () => {
    const { GET } = await import("@/app/api/documents/[id]/download/route");
    const request = new Request("http://localhost/api/documents/document-demo-01/download");
    expect(
      db.select().from(documents).where(eq(documents.id, "document-demo-01")).get()?.tenantId,
    ).toBe(demoOwner.tenantId);

    as(otherOwner);
    expect((await GET(request, idParams("document-demo-01"))).status).toBe(404);
    as(null);
    expect((await GET(request, idParams("document-demo-01"))).status).toBe(401);
  });

  it("xuất ghi chú và ZIP ảnh chọn của album studio khác trả 404", async () => {
    const notes = await import("@/app/api/albums/[id]/notes/export/route");
    const zip = await import("@/app/api/albums/[id]/zip/route");
    const request = new Request(`http://localhost/api/albums/${demoAlbumId}/notes/export`);

    as(demoOwner);
    expect((await notes.GET(request, idParams(demoAlbumId))).status).toBe(200);

    as(otherOwner);
    expect((await notes.GET(request, idParams(demoAlbumId))).status).toBe(404);
    expect((await zip.GET(request, idParams(demoAlbumId))).status).toBe(404);
    as(null);
    expect((await notes.GET(request, idParams(demoAlbumId))).status).toBe(401);
    expect((await zip.GET(request, idParams(demoAlbumId))).status).toBe(401);
  });

  it("xuất khách hàng chỉ gồm khách của studio đang đăng nhập, kể cả khi truyền chi nhánh studio khác", async () => {
    const { GET } = await import("@/app/api/exports/customers/route");
    const demoNames = db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.tenantId, demoOwner.tenantId))
      .all()
      .map((row) => row.name);
    expect(demoNames.length).toBeGreaterThan(0);

    as(otherOwner);
    const response = await GET(new Request("http://localhost/api/exports/customers"));
    expect(response.status).toBe(200);
    const csv = await response.text();
    for (const name of demoNames) expect(csv).not.toContain(name);

    const foreignBranch = await GET(
      new Request("http://localhost/api/exports/customers?branchId=branch-demo-q1"),
    );
    expect(foreignBranch.status).toBe(403);
    as(null);
    expect((await GET(new Request("http://localhost/api/exports/customers"))).status).toBe(401);
  });

  it("xuất báo cáo với chi nhánh của studio khác không trả dòng dữ liệu nào của studio đó", async () => {
    const { GET } = await import("@/app/api/exports/reports/route");
    const url = (type: string) =>
      `http://localhost/api/exports/reports?type=${type}&branchId=branch-demo-q1`;

    // Chi nhánh của studio khác phải cho kết quả y hệt một chi nhánh không tồn tại.
    as(otherOwner);
    for (const type of ["revenue", "debt", "tax"]) {
      const foreign = await GET(new Request(url(type)));
      const missing = await GET(
        new Request(`http://localhost/api/exports/reports?type=${type}&branchId=branch-khong-ton-tai`),
      );
      expect(foreign.status).toBe(200);
      expect(await foreign.text()).toBe(await missing.text());
    }

    as(demoOwner);
    const debt = await GET(new Request(url("debt")));
    expect((await debt.text()).trim().split("\n").length).toBeGreaterThan(1);
    as(null);
    expect((await GET(new Request(url("debt")))).status).toBe(401);
  });

  it("tải ảnh hoặc ZIP vào album của studio khác bị từ chối và không thêm ảnh", async () => {
    const photosRoute = await import("@/app/api/uploads/photos/route");
    const zipRoute = await import("@/app/api/uploads/zip/route");
    const photoCount = () =>
      db.select({ value: count() }).from(photos).where(eq(photos.albumId, demoAlbumId)).get()!.value;
    const before = photoCount();
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "a.jpg", { type: "image/jpeg" });

    const photoForm = () => {
      const form = new FormData();
      form.set("albumId", demoAlbumId);
      form.append("files", jpeg);
      return new Request("http://localhost/api/uploads/photos", { method: "POST", body: form });
    };
    const archive = new JSZip();
    archive.file("a.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    const zipBytes = await archive.generateAsync({ type: "blob" });
    const zipForm = () => {
      const form = new FormData();
      form.set("albumId", demoAlbumId);
      form.set("zip", new File([zipBytes], "a.zip", { type: "application/zip" }));
      return new Request("http://localhost/api/uploads/zip", { method: "POST", body: form });
    };

    as(otherOwner);
    expect((await photosRoute.POST(photoForm())).status).toBe(404);
    expect((await zipRoute.POST(zipForm())).status).toBe(404);
    as(null);
    expect((await photosRoute.POST(photoForm())).status).toBe(401);
    expect((await zipRoute.POST(zipForm())).status).toBe(401);
    expect(photoCount()).toBe(before);
  });

  it("tải tài liệu lên chi nhánh của studio khác bị từ chối và không tạo tài liệu", async () => {
    const { POST } = await import("@/app/api/documents/upload/route");
    const documentCount = () => db.select({ value: count() }).from(documents).get()!.value;
    const before = documentCount();
    const request = () => {
      const form = new FormData();
      form.set("file", new File(["%PDF-1.4 test"], "x.pdf", { type: "application/pdf" }));
      form.set("name", "x.pdf");
      form.set("category", "finance");
      form.set("visibility", "internal");
      form.set("branchId", "branch-demo-q1");
      return new Request("http://localhost/api/documents/upload", { method: "POST", body: form });
    };

    as(otherOwner);
    expect((await POST(request())).status).toBe(403);
    as(null);
    expect((await POST(request())).status).toBe(401);
    expect(documentCount()).toBe(before);
  });
});
