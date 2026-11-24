import crypto from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  passwordResetTokens,
  sessions,
  staff,
} from "../db/schema";
import { hashSecret } from "../auth/password";
import { ValidationError } from "../errors";
import { writeAudit } from "../audit";

export function hashPasswordResetToken(rawToken: string): string {
  // Do not accept the unversioned hashes of tokens issued by the public form.
  return crypto.createHash("sha256").update(`password-reset:v2:${rawToken}`).digest("hex");
}

export function resetPasswordWithToken(
  db: AppDb,
  rawToken: string,
  newPassword: string,
): void {
  if (!rawToken.trim()) {
    throw new ValidationError("Token đặt lại mật khẩu không hợp lệ.");
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    throw new ValidationError("Mật khẩu mới phải từ 8–72 ký tự.");
  }
  const tokenHash = hashPasswordResetToken(rawToken.trim());
  const row = db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .get();
  if (!row) {
    throw new ValidationError("Token không hợp lệ hoặc đã hết hạn.");
  }
  const passwordHash = hashSecret(newPassword);
  db.transaction((tx) => {
    const now = new Date();
    const claimed = tx.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.id, row.id),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ id: passwordResetTokens.id })
      .get();
    if (!claimed) {
      throw new ValidationError("Token không hợp lệ hoặc đã hết hạn.");
    }
    tx.update(staff)
      .set({ passwordHash, updatedAt: now })
      .where(and(eq(staff.id, row.staffId), eq(staff.tenantId, row.tenantId)))
      .run();
    tx.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tenantId, row.tenantId),
          eq(passwordResetTokens.staffId, row.staffId),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .run();
    tx.update(sessions)
      .set({ revokedAt: now })
      .where(
        and(eq(sessions.tenantId, row.tenantId), eq(sessions.staffId, row.staffId)),
      )
      .run();
  });
  writeAudit(db, {
    tenantId: row.tenantId,
    actorId: row.staffId,
    action: "auth.password.reset.success",
    entity: "staff",
    entityId: row.staffId,
  });
}
