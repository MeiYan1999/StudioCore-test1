import { beforeAll, describe, expect, it } from "vitest";
import { authenticate, isLoginLocked } from "@/lib/auth/login-service";
import {
  getActorFromToken,
  revokeSessionById,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/session-core";
import type { AppDb } from "@/lib/db/client";
import { getStaffDetail, listStaff } from "@/lib/services/staff-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;

beforeAll(() => {
  db = createTestDb();
});

function meta(ip: string) {
  return { ip, userAgent: "vitest" };
}

describe("đăng nhập và session", () => {
  it("ký và xác thực session token; token hết hạn bị từ chối", async () => {
    const valid = await signSessionToken(
      "session-test",
      new Date(Date.now() + 60_000),
    );
    expect(await verifySessionToken(valid)).toBe("session-test");

    const expired = await signSessionToken(
      "session-expired",
      new Date(Date.now() - 60_000),
    );
    expect(await verifySessionToken(expired)).toBeNull();
    expect(await verifySessionToken("khong-phai-jwt")).toBeNull();
  });

  it("đăng nhập email + mật khẩu, trả actor đúng tenant", async () => {
    const result = await authenticate(
      db,
      {
        mode: "password",
        identifier: "owner@studiocore.demo",
        secret: "Demo@123",
      },
      meta("127.0.0.1"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const actor = await getActorFromToken(db, result.token);
    expect(actor).not.toBeNull();
    expect(actor?.tenantId).toBe("tenant-demo");
    expect(actor?.role).toBe("owner");
    expect(actor?.permissions).toContain("settings.manage");
    expect(actor?.branches).toHaveLength(2);
    expect(actor?.activeBranchId).toBeNull();
  });

  it("đăng nhập mã nhân viên + PIN, manager chỉ có chi nhánh được giao", async () => {
    const result = await authenticate(
      db,
      { mode: "pin", identifier: "SC-MANAGER", secret: "222222" },
      meta("127.0.0.2"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const actor = await getActorFromToken(db, result.token);
    expect(actor?.role).toBe("manager");
    expect(actor?.branches).toHaveLength(1);
    expect(actor?.activeBranchId).toBe("branch-demo-q1");
  });

  it("từ chối mật khẩu sai", async () => {
    const result = await authenticate(
      db,
      {
        mode: "password",
        identifier: "owner@studiocore.demo",
        secret: "SaiMatKhau",
      },
      meta("127.0.0.3"),
    );

    expect(result.ok).toBe(false);
  });

  it("khóa tạm sau 5 lần sai và không cho đăng nhập đúng", async () => {
    const ip = "203.0.113.55";

    for (let index = 0; index < 5; index += 1) {
      const failed = await authenticate(
        db,
        {
          mode: "password",
          identifier: "owner@studiocore.demo",
          secret: "SaiMatKhau",
        },
        meta(ip),
      );
      expect(failed.ok).toBe(false);
    }

    expect(isLoginLocked(db, "owner@studiocore.demo", ip)).toBe(true);

    const locked = await authenticate(
      db,
      {
        mode: "password",
        identifier: "owner@studiocore.demo",
        secret: "Demo@123",
      },
      meta(ip),
    );

    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.error).toContain("quá nhiều lần");
    }
  });

  it("session bị thu hồi thì token không còn hợp lệ", async () => {
    const result = await authenticate(
      db,
      {
        mode: "password",
        identifier: "ketoan@studiocore.demo",
        secret: "Demo@123",
      },
      meta("127.0.0.4"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const before = await getActorFromToken(db, result.token);
    expect(before).not.toBeNull();

    revokeSessionById(db, result.sessionId, "tenant-demo");

    const after = await getActorFromToken(db, result.token);
    expect(after).toBeNull();
  });
});

describe("cách ly tenant", () => {
  it("owner tenant demo chỉ thấy nhân sự tenant demo", async () => {
    const result = await authenticate(
      db,
      {
        mode: "password",
        identifier: "owner@studiocore.demo",
        secret: "Demo@123",
      },
      meta("127.0.0.5"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const actor = await getActorFromToken(db, result.token);
    expect(actor).not.toBeNull();
    if (!actor) {
      return;
    }

    const staff = listStaff(db, actor);
    expect(staff).toHaveLength(8);
    expect(staff.some((member) => member.code === "BM-OWNER")).toBe(false);
    expect(getStaffDetail(db, actor, "staff-secondary-owner")).toBeNull();
  });

  it("owner tenant phụ chỉ thấy nhân sự tenant phụ", async () => {
    const result = await authenticate(
      db,
      {
        mode: "password",
        identifier: "owner@studiobinhminh.demo",
        secret: "Demo@123",
      },
      meta("127.0.0.6"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const actor = await getActorFromToken(db, result.token);
    expect(actor).not.toBeNull();
    if (!actor) {
      return;
    }

    const staff = listStaff(db, actor);
    expect(staff).toHaveLength(1);
    expect(staff[0]?.code).toBe("BM-OWNER");
    expect(staff.some((member) => member.code === "SC-OWNER")).toBe(false);
  });
});
