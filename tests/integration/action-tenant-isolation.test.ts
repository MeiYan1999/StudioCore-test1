import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import { getDb, type AppDb } from "@/lib/db/client";
import {
  attendance,
  driveShares,
  leaveRequests,
  sessions,
  staff,
  taskComments,
  tasks,
  wardrobeItems,
  wardrobeRentals,
} from "@/lib/db/schema";
import {
  createDrivePairingCode,
  createDriveShare,
  authenticateDriveDevice,
  pairDriveDevice,
} from "@/lib/services/drive-service";
import {
  createLeaveRequest,
  recordCheckIn,
  setLeaveStatus,
  updateStaffBaseSalary,
} from "@/lib/services/hr-service";
import {
  getStaffDetail,
  listStaff,
  revokeSession,
  updateStaff,
} from "@/lib/services/staff-service";
import {
  addTaskComment,
  createTask,
  getTaskDetail,
  listTasks,
  setTaskStatus,
  updateTask,
} from "@/lib/services/task-service";
import {
  createRental,
  getWardrobeItemDetail,
  listRentals,
  listWardrobeItems,
  returnRental,
  updateWardrobeItem,
} from "@/lib/services/wardrobe-service";
import { createTestDb } from "../helpers/test-db";

vi.mock("@/lib/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/client")>()),
  getDb: vi.fn(),
}));

let db: AppDb;
let demoOwner: ActorContext;
let outsider: ActorContext;
let outsiderBranchId: string;

async function login(email: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip: "192.0.2.220", userAgent: "vitest-action-isolation" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

/** Chạy thao tác của studio khác: phải bị từ chối và không đổi dòng dữ liệu. */
async function expectRejectedUnchanged(read: () => unknown, action: () => unknown): Promise<void> {
  const before = JSON.stringify(read());
  expect(before).not.toBe(JSON.stringify(undefined));
  await expect((async () => action())()).rejects.toThrow();
  expect(JSON.stringify(read())).toBe(before);
}

beforeAll(async () => {
  db = createTestDb();
  demoOwner = await login("owner@studiocore.demo");
  outsider = await login("owner@studiobinhminh.demo");
  outsiderBranchId = outsider.branches[0].id;
});

beforeEach(() => {
  vi.mocked(getDb).mockReturnValue(db);
});

describe("cô lập tenant: kho trang phục", () => {
  const item = () => db.select().from(wardrobeItems).where(eq(wardrobeItems.id, "wardrobe-demo-02")).get();
  const rental = () => db.select().from(wardrobeRentals).where(eq(wardrobeRentals.id, "rental-demo-active")).get();

  it("không đọc được trang phục và phiếu thuê của studio khác", () => {
    expect(getWardrobeItemDetail(db, demoOwner, "wardrobe-demo-02")).not.toBeNull();
    expect(getWardrobeItemDetail(db, outsider, "wardrobe-demo-02")).toBeNull();
    expect(listWardrobeItems(db, outsider, { q: "QR-VD-002" })).toHaveLength(0);
    expect(listRentals(db, outsider).some((row) => row.id === "rental-demo-active")).toBe(false);
  });

  it("không sửa, cho thuê hay nhận trả trang phục của studio khác", async () => {
    await expectRejectedUnchanged(item, () =>
      updateWardrobeItem(db, outsider, "wardrobe-demo-02", {
        branchId: outsiderBranchId,
        sku: "X-001",
        qrCode: "QR-X-001",
        name: "Đổi tên",
        size: "M",
        color: "Đỏ",
        status: "available",
        rentalPrice: 1,
        depositPrice: 1,
        image: "",
        notes: "",
      }),
    );
    await expectRejectedUnchanged(item, () =>
      createRental(db, outsider, {
        wardrobeItemId: "wardrobe-demo-02",
        orderId: "order-demo-02",
        dueAt: "2027-01-10T10:00",
        deposit: 0,
        conditionOut: "good",
        notes: "",
      }),
    );
    await expectRejectedUnchanged(rental, () =>
      returnRental(db, outsider, "rental-demo-active", {
        conditionIn: "good",
        cleaningFee: 0,
        damageFee: 0,
        notes: "",
      }),
    );
  });
});

describe("cô lập tenant: công việc", () => {
  const task = () => db.select().from(tasks).where(eq(tasks.id, "task-demo-01")).get();
  const comments = () => db.select().from(taskComments).where(eq(taskComments.taskId, "task-demo-01")).all();
  const input = (overrides: Partial<Parameters<typeof createTask>[2]> = {}) => ({
    title: "Việc của studio khác",
    description: "",
    branchId: outsiderBranchId,
    assigneeId: "",
    orderId: "",
    customerId: "",
    albumId: "",
    priority: "medium" as const,
    status: "todo" as const,
    dueAt: "",
    ...overrides,
  });

  it("không đọc, sửa, đổi trạng thái hay bình luận công việc của studio khác", async () => {
    expect(getTaskDetail(db, demoOwner, "task-demo-01").id).toBe("task-demo-01");
    expect(() => getTaskDetail(db, outsider, "task-demo-01")).toThrow();
    expect(listTasks(db, outsider, {}).some((row) => row.id === "task-demo-01")).toBe(false);

    await expectRejectedUnchanged(task, () => updateTask(db, outsider, "task-demo-01", input()));
    await expectRejectedUnchanged(task, () => setTaskStatus(db, outsider, "task-demo-01", "done"));
    await expectRejectedUnchanged(comments, () => addTaskComment(db, outsider, "task-demo-01", "chen vao"));
  });

  it("không tạo được công việc gắn chi nhánh, nhân sự, đơn hay khách của studio khác", async () => {
    const own = () => db.select().from(tasks).where(eq(tasks.tenantId, outsider.tenantId)).all();
    for (const overrides of [
      { branchId: "branch-demo-q1" },
      { assigneeId: "staff-sc-photo" },
      { orderId: "order-demo-01" },
      { customerId: "customer-demo-02" },
    ]) {
      await expectRejectedUnchanged(own, () => createTask(db, outsider, input(overrides)));
    }
  });
});

describe("cô lập tenant: nhân sự", () => {
  const member = () => db.select().from(staff).where(eq(staff.id, "staff-sc-photo")).get();
  const leave = () => db.select().from(leaveRequests).where(eq(leaveRequests.id, "leave-demo-photo2-20261112")).get();

  it("không đọc hay sửa nhân sự của studio khác", async () => {
    expect(getStaffDetail(db, demoOwner, "staff-sc-photo")).not.toBeNull();
    expect(getStaffDetail(db, outsider, "staff-sc-photo")).toBeNull();
    expect(listStaff(db, outsider).some((row) => row.id === "staff-sc-photo")).toBe(false);

    await expectRejectedUnchanged(member, () =>
      updateStaff(db, outsider, "staff-sc-photo", {
        name: "Bị đổi tên",
        code: "SC-PHOTO",
        email: "",
        phone: "",
        role: "manager",
        pin: "",
        password: "",
        branchIds: [outsiderBranchId],
        active: true,
      } as Parameters<typeof updateStaff>[3]),
    );
    await expectRejectedUnchanged(member, () => updateStaffBaseSalary(db, outsider, "staff-sc-photo", 1));
  });

  it("không duyệt đơn nghỉ, chấm công hay tạo đơn nghỉ cho nhân sự studio khác", async () => {
    await expectRejectedUnchanged(leave, () =>
      setLeaveStatus(db, outsider, "leave-demo-photo2-20261112", "approved"),
    );
    const demoAttendance = () =>
      db.select().from(attendance).where(eq(attendance.staffId, "staff-sc-photo")).all();
    await expectRejectedUnchanged(demoAttendance, () =>
      recordCheckIn(db, outsider, {
        staffId: "staff-sc-photo",
        branchId: outsiderBranchId,
        method: "manual",
        checkIn: "2027-01-10T08:00",
        latitude: "",
        longitude: "",
        device: "",
        notes: "",
      }),
    );
    const demoLeaves = () =>
      db.select().from(leaveRequests).where(eq(leaveRequests.staffId, "staff-sc-photo")).all();
    await expectRejectedUnchanged(demoLeaves, () =>
      createLeaveRequest(db, outsider, {
        staffId: "staff-sc-photo",
        branchId: outsiderBranchId,
        startAt: "2027-01-10T08:00",
        endAt: "2027-01-11T08:00",
        reason: "chen vao",
      }),
    );
  });

  it("không thu hồi được phiên đăng nhập của studio khác", async () => {
    const demoSession = db.select().from(sessions).where(eq(sessions.staffId, demoOwner.staffId)).all()[0];
    const read = () => db.select().from(sessions).where(eq(sessions.id, demoSession.id)).get();
    await expectRejectedUnchanged(read, () => revokeSession(db, outsider, demoSession.id));
  });
});

describe("cô lập tenant: API của máy StudioCore Drive", () => {
  function pair(actor: ActorContext) {
    const { code } = createDrivePairingCode(db, actor);
    const paired = pairDriveDevice(db, { code, name: "PC", platform: "win32", appVersion: "2.0.0" });
    return { token: paired.deviceToken, device: authenticateDriveDevice(db, paired.deviceToken) };
  }
  const agentRequest = (token: string, method: string, body?: unknown) =>
    new Request("http://localhost/api/drive/agent/shares/x", {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("máy của studio khác không đọc, sửa, thay tệp hay xóa được link chia sẻ", async () => {
    const mine = pair(demoOwner);
    const theirs = pair(outsider);
    const share = createDriveShare(db, mine.device, {
      title: "Của studio demo",
      kind: "select",
      files: [{ key: "key-0001", name: "IMG_1.JPG", kind: "image", size: 10 }],
    });
    const read = () => db.select().from(driveShares).where(eq(driveShares.id, share.id)).get();
    const before = JSON.stringify(read());
    const context = { params: Promise.resolve({ id: share.id }) };

    const shareRoute = await import("@/app/api/drive/agent/shares/[id]/route");
    const picksRoute = await import("@/app/api/drive/agent/shares/[id]/picks/route");
    const listRoute = await import("@/app/api/drive/agent/shares/route");

    expect((await picksRoute.GET(agentRequest(mine.token, "GET"), context)).status).toBe(200);
    expect((await picksRoute.GET(agentRequest(theirs.token, "GET"), context)).status).toBe(404);
    expect(
      (await shareRoute.PATCH(agentRequest(theirs.token, "PATCH", { status: "paused" }), context)).status,
    ).toBe(404);
    expect(
      (await shareRoute.PUT(agentRequest(theirs.token, "PUT", { files: [] }), context)).status,
    ).toBe(404);
    expect((await shareRoute.DELETE(agentRequest(theirs.token, "DELETE"), context)).status).toBe(404);
    expect((await shareRoute.DELETE(agentRequest("sai-token", "DELETE"), context)).status).toBe(401);
    expect(JSON.stringify(read())).toBe(before);

    const listed = await listRoute.GET(agentRequest(theirs.token, "GET"));
    expect(listed.status).toBe(200);
    expect(JSON.stringify(await listed.json())).not.toContain(share.id);
  });
});
