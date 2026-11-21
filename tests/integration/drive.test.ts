import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import type { DriveDevice } from "@/lib/db/schema";
import {
  fulfillDriveJob,
  pollDriveJobs,
  requestDriveFile,
  resetDriveRelayForTests,
} from "@/lib/drive/relay";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  authenticateDriveDevice,
  createDrivePairingCode,
  createDriveShare,
  deleteDriveShareByActor,
  drivePickCodes,
  getDrivePicksForActor,
  getDrivePicksForDevice,
  getDriveShareBySlug,
  listDriveDevices,
  listDrivePublicFiles,
  listDriveSharesForTenant,
  listDriveSubmissionsSince,
  pairDriveDevice,
  replaceDriveShareFiles,
  revokeDriveDevice,
  setDrivePick,
  submitDriveSelection,
  updateDriveShareByActor,
  updateDriveShareFromDevice,
  verifyDriveSharePin,
} from "@/lib/services/drive-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let outsider: ActorContext;

function pair(name = "PC-Studio"): { device: DriveDevice; token: string } {
  const { code } = createDrivePairingCode(db, owner);
  const paired = pairDriveDevice(db, { code, name, platform: "win32", appVersion: "2.0.0" });
  return { device: authenticateDriveDevice(db, paired.deviceToken), token: paired.deviceToken };
}

const files = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    key: `key-${String(i).padStart(4, "0")}`,
    name: `IMG_${1000 + i}.JPG`,
    kind: "image" as const,
    size: 1000 + i,
  }));

beforeAll(async () => {
  db = createTestDb();
  const login = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.77", userAgent: "vitest-drive" },
  );
  if (!login.ok) throw new Error(login.error);
  const actor = await getActorFromToken(db, login.token);
  if (!actor) throw new Error("Không dựng owner actor");
  owner = actor;
  outsider = { ...actor, tenantId: "tenant-khac", staffId: actor.staffId };
});

beforeEach(() => resetDriveRelayForTests());

describe("ghép nối thiết bị", () => {
  it("mã kết nối dùng một lần và token thiết bị không lưu dạng thô", () => {
    const { code } = createDrivePairingCode(db, owner);
    const paired = pairDriveDevice(db, { code, name: "Mac", platform: "darwin", appVersion: "2.0.0" });
    expect(paired.deviceToken).toMatch(/^scdt-/);
    expect(() => pairDriveDevice(db, { code, name: "Mac 2", platform: "darwin", appVersion: "" })).toThrow(
      AuthorizationError,
    );
    const device = authenticateDriveDevice(db, paired.deviceToken);
    expect(device.tenantId).toBe(owner.tenantId);
    expect(device.tokenHash).not.toContain(paired.deviceToken);
  });

  it("từ chối mã sai, token sai và khoá demo của bản cũ", () => {
    expect(() => pairDriveDevice(db, { code: "scd-sai", name: "x", platform: "", appVersion: "" })).toThrow(
      AuthorizationError,
    );
    expect(() => authenticateDriveDevice(db, "sc_drive_live_tenant_demo_984f7b2e1a")).toThrow(AuthorizationError);
    expect(() => authenticateDriveDevice(db, "scdt-khong-ton-tai")).toThrow(AuthorizationError);
    expect(() => authenticateDriveDevice(db, null)).toThrow(AuthorizationError);
  });

  it("gỡ thiết bị thì token hết hiệu lực và link tạm dừng", () => {
    const { device, token } = pair("Sẽ bị gỡ");
    const share = createDriveShare(db, device, { title: "A", kind: "select", files: files(2) });
    expect(() => revokeDriveDevice(db, outsider, device.id)).toThrow(NotFoundError);
    revokeDriveDevice(db, owner, device.id);
    expect(() => authenticateDriveDevice(db, token)).toThrow(AuthorizationError);
    expect(getDriveShareBySlug(db, share.slug).state).toBe("paused");
    expect(listDriveDevices(db, owner).some((d) => d.id === device.id)).toBe(false);
  });
});

describe("link chia sẻ", () => {
  it("giữ nguyên tên có ký tự HTML dưới dạng văn bản và không nhận đường dẫn", () => {
    const { device } = pair();
    const share = createDriveShare(db, device, {
      title: `<img src=x onerror=alert(1)>`,
      kind: "select",
      files: [{ key: "key-xss-1", name: `../..\\<script>alert(1)</script>.jpg`, kind: "image", size: 1 }],
    });
    const [file] = listDrivePublicFiles(db, share.id);
    expect(file.name).not.toMatch(/[\\/]/);
    expect(file).not.toHaveProperty("fileKey");
    expect(Object.keys(file).sort()).toEqual(["id", "kind", "name", "note", "picked", "size"]);
    const summary = listDriveSharesForTenant(db, owner).find((s) => s.id === share.id);
    expect(summary?.title).toBe(`<img src=x onerror=alert(1)>`);
    expect(JSON.stringify(summary)).not.toContain("folder");
  });

  it("từ chối danh mục tệp không hợp lệ", () => {
    const { device } = pair();
    expect(() => createDriveShare(db, device, { title: "A", kind: "select", files: [] })).toThrow(ValidationError);
    expect(() =>
      createDriveShare(db, device, {
        title: "A",
        kind: "select",
        files: [{ key: "../etc/passwd", name: "a.jpg", kind: "image", size: 1 }],
      }),
    ).toThrow(ValidationError);
    expect(() =>
      createDriveShare(db, device, { title: "A", kind: "select", pin: "12", files: files(1) }),
    ).toThrow(ValidationError);
  });

  it("cô lập theo studio và theo thiết bị", () => {
    const a = pair("A");
    const b = pair("B");
    const share = createDriveShare(db, a.device, { title: "Của A", kind: "select", files: files(3) });
    expect(() => updateDriveShareFromDevice(db, b.device, share.id, { status: "paused" })).toThrow(NotFoundError);
    expect(() => getDrivePicksForDevice(db, b.device, share.id)).toThrow(NotFoundError);
    expect(() => updateDriveShareByActor(db, outsider, share.id, { status: "paused" })).toThrow(NotFoundError);
    expect(() => deleteDriveShareByActor(db, outsider, share.id)).toThrow(NotFoundError);
    expect(() => getDrivePicksForActor(db, outsider, share.id)).toThrow(NotFoundError);
    expect(listDriveSharesForTenant(db, outsider)).toHaveLength(0);
    expect(() => listDriveSharesForTenant(db, { ...owner, permissions: [] })).toThrow(AuthorizationError);
  });

  it("tạm dừng, hết hạn và PIN", () => {
    const { device } = pair();
    const share = createDriveShare(db, device, { title: "PIN", kind: "deliver", pin: "2468", files: files(1) });
    expect(share.pinHash).not.toContain("2468");
    expect(share.allowOriginal).toBe(true);
    expect(verifyDriveSharePin(db, share, "0000", "192.0.2.1").ok).toBe(false);
    expect(verifyDriveSharePin(db, share, "2468", "192.0.2.1").ok).toBe(true);
    for (let i = 0; i < 8; i += 1) verifyDriveSharePin(db, share, "9999", "192.0.2.1");
    expect(verifyDriveSharePin(db, share, "2468", "192.0.2.1")).toEqual({ ok: false, locked: true });

    updateDriveShareByActor(db, owner, share.id, { status: "paused" });
    expect(getDriveShareBySlug(db, share.slug).state).toBe("paused");
    updateDriveShareByActor(db, owner, share.id, { status: "active", expiresInDays: 1 });
    expect(getDriveShareBySlug(db, share.slug).state).toBe("ok");
    expect(getDriveShareBySlug(db, "khong-ton-tai-123").state).toBe("not_found");
    expect(getDriveShareBySlug(db, "../../etc").state).toBe("not_found");
  });
});

describe("khách chọn ảnh", () => {
  it("giới hạn số ảnh, gửi lựa chọn, khoá sau khi gửi và cho chọn lại", () => {
    const { device } = pair();
    const share = createDriveShare(db, device, { title: "Cưới", kind: "select", maxSelect: 2, files: files(4) });
    const list = listDrivePublicFiles(db, share.id);
    expect(() => submitDriveSelection(db, share, null)).toThrow(ValidationError);
    setDrivePick(db, share, list[0].id, { picked: true, note: "Làm sáng da" });
    expect(setDrivePick(db, share, list[2].id, { picked: true }).pickedCount).toBe(2);
    expect(() => setDrivePick(db, share, list[3].id, { picked: true })).toThrow(ValidationError);
    expect(() => setDrivePick(db, share, "khong-co", { picked: true })).toThrow(NotFoundError);

    const before = Date.now() - 1;
    expect(submitDriveSelection(db, share, "Gửi studio").pickedCount).toBe(2);
    const submitted = getDriveShareBySlug(db, share.slug).share!;
    expect(() => setDrivePick(db, submitted, list[1].id, { picked: true })).toThrow(ValidationError);
    expect(listDriveSubmissionsSince(db, device, before).map((s) => s.id)).toEqual([share.id]);

    const picks = getDrivePicksForDevice(db, device, share.id);
    expect(picks.map((p) => p.key)).toEqual(["key-0000", "key-0002"]);
    expect(picks[0].note).toBe("Làm sáng da");
    expect(drivePickCodes(picks)).toEqual(["IMG_1000", "IMG_1002"]);

    updateDriveShareByActor(db, owner, share.id, { reopen: true });
    const reopened = getDriveShareBySlug(db, share.slug).share!;
    expect(setDrivePick(db, reopened, list[0].id, { picked: false }).pickedCount).toBe(1);
  });

  it("quét lại thư mục giữ lựa chọn của tệp còn tồn tại", () => {
    const { device } = pair();
    const share = createDriveShare(db, device, { title: "Quét lại", kind: "select", files: files(3) });
    const list = listDrivePublicFiles(db, share.id);
    setDrivePick(db, share, list[1].id, { picked: true });
    replaceDriveShareFiles(db, device, share.id, [
      ...files(3).slice(1),
      { key: "key-moi-1", name: "MOI.JPG", kind: "image", size: 5 },
    ]);
    const after = listDrivePublicFiles(db, share.id);
    expect(after.map((f) => f.name)).toEqual(["IMG_1001.JPG", "IMG_1002.JPG", "MOI.JPG"]);
    expect(after[0].picked).toBe(true);
  });

  it("link giao file không nhận lựa chọn", () => {
    const { device } = pair();
    const share = createDriveShare(db, device, { title: "Giao", kind: "deliver", files: files(1) });
    const [file] = listDrivePublicFiles(db, share.id);
    expect(() => setDrivePick(db, share, file.id, { picked: true })).toThrow(ValidationError);
  });
});

describe("cầu nối tệp", () => {
  const job = { shareId: "s1", fileKey: "k1", variant: "thumb" as const, range: null };
  const body = () => new Response("anh").body;

  it("chuyển yêu cầu tới đúng thiết bị và chỉ thiết bị đó trả lời được", async () => {
    const pending = requestDriveFile("dev-a", job, 2000);
    expect(await pollDriveJobs("dev-b", 0)).toHaveLength(0);
    const [taken] = await pollDriveJobs("dev-a", 0);
    expect(taken).toMatchObject(job);
    expect(await pollDriveJobs("dev-a", 0)).toHaveLength(0);
    const result = { status: 200, contentType: "image/jpeg", contentLength: "3", contentRange: null, body: body() };
    expect(fulfillDriveJob("dev-b", taken.id, result)).toBe(false);
    expect(fulfillDriveJob("dev-a", taken.id, result)).toBe(true);
    expect(fulfillDriveJob("dev-a", taken.id, result)).toBe(false);
    const delivered = await pending;
    expect(await new Response(delivered.body).text()).toBe("anh");
  });

  it("long-poll được đánh thức khi có yêu cầu và hết giờ trả 504", async () => {
    const waiting = pollDriveJobs("dev-c", 2000);
    const pending = requestDriveFile("dev-c", job, 60);
    expect(await waiting).toHaveLength(1);
    expect((await pending).status).toBe(504);
  });
});
