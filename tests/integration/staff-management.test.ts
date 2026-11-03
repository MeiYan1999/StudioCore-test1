import { beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/auth/roles";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import {
  createStaff,
  getStaffDetail,
  listActiveSessions,
  listRoleMatrix,
  listStaff,
  revokeSession,
  updateRolePermissions,
  updateStaff,
} from "@/lib/services/staff-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;

beforeAll(async () => {
  db = createTestDb();
  const login = await authenticate(
    db,
    {
      mode: "password",
      identifier: "owner@studiocore.demo",
      secret: "Demo@123",
    },
    { ip: "198.51.100.1", userAgent: "vitest" },
  );

  if (!login.ok) {
    throw new Error("Không đăng nhập được owner test");
  }

  const actor = await getActorFromToken(db, login.token);
  if (!actor) {
    throw new Error("Không tạo được actor test");
  }

  owner = actor;
});

describe("quản lý nhân sự", () => {
  it("owner thấy đúng 8 nhân sự seed", () => {
    expect(listStaff(db, owner)).toHaveLength(8);
  });

  it("tạo nhân sự mới, chặn mã trùng và chi nhánh sai", () => {
    const createdId = createStaff(db, owner, {
      name: "QA Nhân Sự",
      code: "QA-001",
      email: "qa001@studiocore.demo",
      phone: "0900000088",
      role: "receptionist",
      pin: "123456",
      password: null,
      branchIds: ["branch-demo-q1"],
      active: true,
    });

    expect(createdId).toBeTruthy();
    expect(listStaff(db, owner)).toHaveLength(9);

    expect(() =>
      createStaff(db, owner, {
        name: "QA Trùng Mã",
        code: "QA-001",
        email: "qa002@studiocore.demo",
        phone: null,
        role: "receptionist",
        pin: "123456",
        password: null,
        branchIds: ["branch-demo-q1"],
        active: true,
      }),
    ).toThrow(/Mã nhân viên/);

    expect(() =>
      createStaff(db, owner, {
        name: "QA Sai Chi Nhánh",
        code: "QA-002",
        email: "qa003@studiocore.demo",
        phone: null,
        role: "receptionist",
        pin: "123456",
        password: null,
        branchIds: ["branch-khong-ton-tai"],
        active: true,
      }),
    ).toThrow(/chi nhánh/i);

    const detail = getStaffDetail(db, owner, createdId);
    expect(detail?.role).toBe("receptionist");
    expect(detail?.branchIds).toEqual(["branch-demo-q1"]);

    updateStaff(db, owner, createdId, {
      name: "QA Nhân Sự Cập Nhật",
      code: "QA-001",
      email: "qa001@studiocore.demo",
      phone: "0900000077",
      role: "manager",
      pin: null,
      password: null,
      branchIds: ["branch-demo-thu-duc"],
      active: true,
    });

    const updated = getStaffDetail(db, owner, createdId);
    expect(updated?.name).toBe("QA Nhân Sự Cập Nhật");
    expect(updated?.role).toBe("manager");
    expect(updated?.phone).toBe("0900000077");
    expect(updated?.branchIds).toEqual(["branch-demo-thu-duc"]);
  });

  it("không cho hạ quyền hoặc khóa chủ studio", () => {
    expect(() =>
      updateStaff(db, owner, owner.staffId, {
        name: owner.staffName,
        code: owner.staffCode,
        email: owner.staffEmail,
        phone: null,
        role: "manager",
        pin: null,
        password: null,
        branchIds: ["branch-demo-q1"],
        active: true,
      }),
    ).toThrow(/chủ studio/i);
  });
});

describe("quản lý vai trò", () => {
  it("cập nhật quyền manager và khôi phục mặc định", () => {
    const before = listRoleMatrix(db, owner).find((item) => item.role === "manager");
    expect(before?.permissions).toContain("reports.view");

    updateRolePermissions(
      db,
      owner,
      "manager",
      before?.permissions.filter((permission) => permission !== "reports.view") ?? [],
    );

    const after = listRoleMatrix(db, owner).find((item) => item.role === "manager");
    expect(after?.permissions).not.toContain("reports.view");

    updateRolePermissions(db, owner, "manager", [
      ...DEFAULT_ROLE_PERMISSIONS.manager,
    ]);
  });

  it("không cho chỉnh quyền owner", () => {
    expect(() => updateRolePermissions(db, owner, "owner", ["dashboard.view"])).toThrow(
      /không thể chỉnh sửa/i,
    );
  });
});

describe("quản lý phiên đăng nhập", () => {
  it("thu hồi phiên của nhân sự khác", async () => {
    const managerLogin = await authenticate(
      db,
      { mode: "pin", identifier: "SC-MANAGER", secret: "222222" },
      { ip: "198.51.100.2", userAgent: "vitest-session" },
    );

    expect(managerLogin.ok).toBe(true);
    if (!managerLogin.ok) {
      return;
    }

    const sessionsBefore = listActiveSessions(db, owner);
    expect(sessionsBefore.some((session) => session.id === managerLogin.sessionId)).toBe(
      true,
    );

    revokeSession(db, owner, managerLogin.sessionId);

    const sessionsAfter = listActiveSessions(db, owner);
    expect(sessionsAfter.some((session) => session.id === managerLogin.sessionId)).toBe(
      false,
    );
  });
});
