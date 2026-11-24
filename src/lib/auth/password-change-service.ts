import { and, count, eq, gt, gte, isNull, ne } from "drizzle-orm";
import { PASSWORD_CHANGED, writeAudit } from "../audit";
import type { AppDb } from "../db/client";
import { activityLogs, passwordResetTokens, sessions, staff, tenants } from "../db/schema";
import { isSharedDemoStaff } from "../demo-accounts";
import { hashSecret, verifySecret } from "./password";
import { RECOVERED_SESSION_USER_AGENT } from "./session-core";
import type { ActorContext } from "./types";

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const FAILED_ACTION = "auth.password.change.failed";

type PasswordChangeResult = { ok: true } | { ok: false; error: string };

export function changeOwnPassword(
  db: AppDb,
  actor: ActorContext,
  input: { currentPassword: string; newPassword: string; confirmation: string },
): PasswordChangeResult {
  if (actor.readOnly) {
    return { ok: false, error: "Không thể đổi mật khẩu trong phiên demo chỉ xem." };
  }
  if (isSharedDemoStaff(actor.staffId)) {
    return { ok: false, error: "Không thể đổi mật khẩu của tài khoản demo dùng chung." };
  }
  if (!input.currentPassword || input.currentPassword.length > 128) {
    return { ok: false, error: "Vui lòng nhập mật khẩu hiện tại hợp lệ." };
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 72) {
    return { ok: false, error: "Mật khẩu mới phải từ 8–72 ký tự." };
  }
  if (input.newPassword !== input.confirmation) {
    return { ok: false, error: "Xác nhận mật khẩu mới không khớp." };
  }

  return db.transaction((tx): PasswordChangeResult => {
    const now = new Date();
    const account = tx.select({ passwordHash: staff.passwordHash })
      .from(sessions)
      .innerJoin(staff, and(eq(staff.id, sessions.staffId), eq(staff.tenantId, sessions.tenantId)))
      .innerJoin(tenants, eq(tenants.id, sessions.tenantId))
      .where(and(
        eq(sessions.id, actor.sessionId),
        eq(sessions.tenantId, actor.tenantId),
        eq(sessions.staffId, actor.staffId),
        eq(sessions.readOnly, false),
        ne(sessions.userAgent, RECOVERED_SESSION_USER_AGENT),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
        eq(staff.active, true),
        isNull(staff.archivedAt),
        eq(tenants.status, "active"),
      ))
      .get();
    if (!account) {
      return { ok: false, error: "Phiên đăng nhập không hỗ trợ đổi mật khẩu. Vui lòng đăng nhập lại." };
    }
    if (!account.passwordHash) {
      return { ok: false, error: "Tài khoản chưa có mật khẩu. Không thể đổi mật khẩu tại đây." };
    }

    const audit = { tenantId: actor.tenantId, actorId: actor.staffId, entity: "staff", entityId: actor.staffId };
    const failures = tx.select({ value: count() }).from(activityLogs)
      .where(and(
        eq(activityLogs.tenantId, actor.tenantId),
        eq(activityLogs.actorId, actor.staffId),
        eq(activityLogs.action, FAILED_ACTION),
        gte(activityLogs.createdAt, new Date(now.getTime() - FAILURE_WINDOW_MS)),
      ))
      .get()?.value ?? 0;
    if (failures >= MAX_FAILURES) {
      return { ok: false, error: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút." };
    }
    if (!verifySecret(input.currentPassword, account.passwordHash)) {
      writeAudit(tx, { ...audit, action: FAILED_ACTION });
      return { ok: false, error: "Mật khẩu hiện tại không đúng." };
    }
    if (input.newPassword === input.currentPassword) {
      return { ok: false, error: "Mật khẩu mới phải khác mật khẩu hiện tại." };
    }

    tx.update(staff)
      .set({ passwordHash: hashSecret(input.newPassword), updatedAt: now })
      .where(and(eq(staff.id, actor.staffId), eq(staff.tenantId, actor.tenantId)))
      .run();
    tx.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.staffId, actor.staffId),
        eq(passwordResetTokens.tenantId, actor.tenantId),
        isNull(passwordResetTokens.usedAt),
      ))
      .run();
    tx.update(sessions)
      .set({ revokedAt: now })
      .where(and(
        eq(sessions.staffId, actor.staffId),
        eq(sessions.tenantId, actor.tenantId),
        isNull(sessions.revokedAt),
      ))
      .run();
    writeAudit(tx, { ...audit, action: PASSWORD_CHANGED });
    return { ok: true };
  }, { behavior: "immediate" });
}
