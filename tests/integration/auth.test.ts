import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { PASSWORD_CHANGED } from "@/lib/audit";
import { authenticate, isLoginLocked } from "@/lib/auth/login-service";
import { changeOwnPassword } from "@/lib/auth/password-change-service";
import {
  createSession,
  getActorFromToken,
  revokeSessionById,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/session-core";
import type { AppDb } from "@/lib/db/client";
import { activityLogs, passwordResetTokens, sessions, staff } from "@/lib/db/schema";
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

describe("đổi mật khẩu khi đã đăng nhập", () => {
  let passwordDb: AppDb;
  const validChange = {
    currentPassword: "Demo@123",
    newPassword: "New-test-password!",
    confirmation: "New-test-password!",
  };

  beforeAll(() => {
    passwordDb = createTestDb();
  });

  async function signIn(identifier: string, secret = "Demo@123") {
    const result = await authenticate(passwordDb, { mode: "password", identifier, secret }, meta("127.0.0.10"));
    if (!result.ok) throw new Error(result.error);
    const actor = await getActorFromToken(passwordDb, result.token);
    if (!actor) throw new Error("Không tìm thấy phiên kiểm thử.");
    return { ...result, actor };
  }

  function createPrivateAccount(seedEmail: string) {
    const seedAccount = passwordDb.select().from(staff).where(eq(staff.email, seedEmail)).get();
    if (!seedAccount) throw new Error("Không tìm thấy tài khoản mẫu.");
    const email = `private-${seedEmail}`;
    passwordDb.insert(staff).values({
      ...seedAccount,
      id: `private-${seedAccount.id}`,
      code: `PRIVATE-${seedAccount.code}`,
      email,
    }).run();
    return email;
  }

  it("đổi mật khẩu của platform admin và thu hồi phiên, token đặt lại của riêng tài khoản", async () => {
    const email = createPrivateAccount("platform@studiocore.demo");
    const { actor, token } = await signIn(email);
    const otherSession = await signIn(email);
    const missingSession = await signIn(email);
    passwordDb.delete(sessions).where(eq(sessions.id, missingSession.sessionId)).run();
    const unrelated = await signIn("owner@studiobinhminh.demo");
    for (const owner of [actor, unrelated.actor]) {
      passwordDb.insert(passwordResetTokens).values({
        id: owner.staffId,
        tenantId: owner.tenantId,
        staffId: owner.staffId,
        tokenHash: `token-${owner.staffId}`,
        expiresAt: new Date(Date.now() + 60_000),
      }).run();
    }

    expect(actor.canChangePassword).toBe(true);
    expect(changeOwnPassword(passwordDb, actor, validChange)).toEqual({ ok: true });
    for (const revokedToken of [token, otherSession.token, missingSession.token]) {
      expect(await getActorFromToken(passwordDb, revokedToken)).toBeNull();
    }
    expect(await getActorFromToken(passwordDb, unrelated.token)).not.toBeNull();
    expect(passwordDb.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, actor.staffId)).get()?.usedAt).toBeInstanceOf(Date);
    expect(passwordDb.select().from(passwordResetTokens).where(eq(passwordResetTokens.id, unrelated.actor.staffId)).get()?.usedAt).toBeNull();
    const audit = passwordDb.select().from(activityLogs).where(eq(activityLogs.action, PASSWORD_CHANGED)).get();
    expect(audit).toMatchObject({ actorId: actor.staffId, tenantId: actor.tenantId, metadata: "{}" });

    const oldLogin = await authenticate(passwordDb, { mode: "password", identifier: email, secret: validChange.currentPassword }, meta("127.0.0.11"));
    expect(oldLogin.ok).toBe(false);
    expect((await signIn(email, validChange.newPassword)).actor.role).toBe("platform_admin");
  });

  it("từ chối sai mật khẩu, xác nhận không khớp, độ dài sai và mật khẩu không đổi", async () => {
    const email = createPrivateAccount("manager@studiocore.demo");
    const { actor, token } = await signIn(email);
    for (const [overrides, error] of [
      [{ currentPassword: "wrong-password" }, "không đúng"],
      [{ confirmation: "mismatch!" }, "không khớp"],
      [{ newPassword: "tiny", confirmation: "tiny" }, "8–72"],
      [{ newPassword: "x".repeat(73), confirmation: "x".repeat(73) }, "8–72"],
      [{ newPassword: validChange.currentPassword, confirmation: validChange.currentPassword }, "phải khác"],
    ] as const) {
      expect(changeOwnPassword(passwordDb, actor, { ...validChange, ...overrides })).toMatchObject({
        ok: false,
        error: expect.stringContaining(error),
      });
    }
    expect(await getActorFromToken(passwordDb, token)).not.toBeNull();
    expect((await signIn(email)).actor.staffId).toBe(actor.staffId);
  });

  it("giới hạn thử mật khẩu hiện tại theo tài khoản, kể cả qua nhiều phiên", async () => {
    const email = createPrivateAccount("ketoan@studiocore.demo");
    const { actor } = await signIn(email);
    const secondSession = await signIn(email);
    for (let index = 0; index < 5; index += 1) {
      expect(changeOwnPassword(passwordDb, actor, { ...validChange, currentPassword: "wrong-password" })).toMatchObject({
        ok: false,
        error: expect.stringContaining("không đúng"),
      });
    }
    expect(changeOwnPassword(passwordDb, secondSession.actor, validChange)).toMatchObject({
      ok: false,
      error: expect.stringContaining("quá nhiều lần"),
    });
  });

  it("không đổi mật khẩu từ phiên demo, tài khoản demo dùng chung, phiên phục hồi hay tài khoản không có mật khẩu", async () => {
    const { actor: sharedOwner } = await signIn("owner@studiocore.demo");
    const { actor: sharedPlatformAdmin } = await signIn("platform@studiocore.demo");
    for (const actor of [sharedOwner, sharedPlatformAdmin]) {
      expect(actor.canChangePassword).toBe(false);
      expect(changeOwnPassword(passwordDb, actor, validChange)).toMatchObject({
        ok: false,
        error: expect.stringContaining("demo dùng chung"),
      });
    }

    const { actor, sessionId, token } = await signIn(createPrivateAccount("owner@studiocore.demo"));
    const demo = await createSession(passwordDb, {
      tenantId: actor.tenantId,
      staffId: actor.staffId,
      activeBranchId: null,
      ip: "127.0.0.1",
      userAgent: "vitest",
      readOnly: true,
    });
    const demoActor = await getActorFromToken(passwordDb, demo.token);
    expect(demoActor).toMatchObject({ readOnly: true, canChangePassword: false });
    expect(changeOwnPassword(passwordDb, { ...actor, ...demoActor }, validChange).ok).toBe(false);
    passwordDb.delete(sessions).where(eq(sessions.id, demo.sessionId)).run();
    expect(await getActorFromToken(passwordDb, demo.token)).toBeNull();

    passwordDb.delete(sessions).where(eq(sessions.id, sessionId)).run();
    const recoveredActor = await getActorFromToken(passwordDb, token);
    expect(recoveredActor).toMatchObject({ canChangePassword: false });
    expect(changeOwnPassword(passwordDb, actor, validChange).ok).toBe(false);

    const { actor: pinActor, token: pinToken } = await signIn(createPrivateAccount("letan@studiocore.demo"));
    passwordDb.update(staff).set({ passwordHash: null }).where(eq(staff.id, pinActor.staffId)).run();
    expect(await getActorFromToken(passwordDb, pinToken)).toMatchObject({ canChangePassword: false });
    expect(changeOwnPassword(passwordDb, pinActor, validChange)).toMatchObject({
      ok: false,
      error: expect.stringContaining("chưa có mật khẩu"),
    });
  });
});
