import crypto from "node:crypto";
import { and, count, eq, gt, gte, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  passwordResetTokens,
  sessions,
  staff,
  tenants,
} from "../db/schema";
import { hashSecret } from "../auth/password";
import { getEnv } from "../env";
import { ValidationError } from "../errors";
import { writeAudit } from "../audit";

const RESET_TTL_MINUTES = 30;
const RESET_RATE_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5;

export type ResetRequestResult = {
  ok: true;
  link: string | null;
  message: string;
};

export function requestPasswordReset(
  db: AppDb,
  emailInput: string,
): ResetRequestResult {
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Email không hợp lệ.");
  }
  const row = db
    .select({ staff, tenant: tenants })
    .from(staff)
    .innerJoin(tenants, eq(staff.tenantId, tenants.id))
    .where(eq(staff.email, email))
    .get();
  const genericMessage =
    "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được tạo. Môi trường demo hiển thị liên kết trực tiếp thay vì gửi email.";
  if (
    !row ||
    !row.staff.active ||
    row.staff.archivedAt ||
    row.tenant.status !== "active"
  ) {
    return { ok: true, link: null, message: genericMessage };
  }
  const since = new Date(Date.now() - RESET_RATE_WINDOW_MINUTES * 60 * 1000);
  const recent =
    db
      .select({ value: count() })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.staffId, row.staff.id),
          gte(passwordResetTokens.createdAt, since),
        ),
      )
      .get()?.value ?? 0;
  if (recent >= MAX_REQUESTS_PER_WINDOW) {
    throw new ValidationError(
      "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.",
    );
  }
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  db.insert(passwordResetTokens)
    .values({
      id: crypto.randomUUID(),
      tenantId: row.tenant.id,
      staffId: row.staff.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      usedAt: null,
    })
    .run();
  writeAudit(db, {
    tenantId: row.tenant.id,
    actorId: null,
    action: "auth.password.reset.request",
    entity: "staff",
    entityId: row.staff.id,
    metadata: { adapter: "local", delivery: "inline-demo-link" },
  });
  const base = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    ok: true,
    link: `${base}/reset-password?token=${encodeURIComponent(rawToken)}`,
    message: genericMessage,
  };
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
  const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
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
    tx.update(staff)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(staff.id, row.staffId), eq(staff.tenantId, row.tenantId)))
      .run();
    tx.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, row.id))
      .run();
    tx.update(sessions)
      .set({ revokedAt: new Date() })
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
