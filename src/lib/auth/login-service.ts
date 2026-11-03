import { and, count, eq, gte } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { loginAttempts, staff, tenants } from "../db/schema";
import { getAllowedBranches, createSession } from "./session-core";
import { verifySecret } from "./password";
import { writeAudit } from "../audit";

const LOGIN_WINDOW_MINUTES = 15;
const MAX_IDENTIFIER_FAILURES = 5;
const MAX_IP_FAILURES = 20;

export type LoginMode = "password" | "pin";

export type LoginMeta = {
  ip: string;
  userAgent: string;
};

export type LoginResult =
  | {
      ok: true;
      token: string;
      expiresAt: Date;
      sessionId: string;
    }
  | {
      ok: false;
      error: string;
    };

export function normalizeLoginIdentifier(mode: LoginMode, identifier: string): string {
  const trimmed = identifier.trim();
  return mode === "password" ? trimmed.toLowerCase() : trimmed.toUpperCase();
}

export function isLoginLocked(
  db: AppDb,
  identifier: string,
  ip: string,
  now: Date = new Date(),
): boolean {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60 * 1000);

  const identifierFailures =
    db
      .select({ value: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.identifier, identifier),
          eq(loginAttempts.ip, ip),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, since),
        ),
      )
      .get()?.value ?? 0;

  if (identifierFailures >= MAX_IDENTIFIER_FAILURES) {
    return true;
  }

  const ipFailures =
    db
      .select({ value: count() })
      .from(loginAttempts)
      .where(
        and(
          eq(loginAttempts.ip, ip),
          eq(loginAttempts.success, false),
          gte(loginAttempts.createdAt, since),
        ),
      )
      .get()?.value ?? 0;

  return ipFailures >= MAX_IP_FAILURES;
}

function recordAttempt(
  db: AppDb,
  input: {
    identifier: string;
    ip: string;
    success: boolean;
  },
): void {
  db.insert(loginAttempts)
    .values({
      id: crypto.randomUUID(),
      identifier: input.identifier,
      ip: input.ip,
      success: input.success,
      createdAt: new Date(),
    })
    .run();
}

function auditLoginFailure(
  db: AppDb,
  input: {
    tenantId: string | null;
    mode: LoginMode;
    ip: string;
  },
): void {
  writeAudit(db, {
    tenantId: input.tenantId,
    actorId: null,
    action: "auth.login.failed",
    entity: "auth",
    metadata: { mode: input.mode, ip: input.ip },
  });
}

export async function authenticate(
  db: AppDb,
  input: {
    mode: LoginMode;
    identifier: string;
    secret: string;
  },
  meta: LoginMeta,
  now: Date = new Date(),
): Promise<LoginResult> {
  const identifier = normalizeLoginIdentifier(input.mode, input.identifier);

  if (isLoginLocked(db, identifier, meta.ip, now)) {
    return {
      ok: false,
      error: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.",
    };
  }

  const row =
    input.mode === "password"
      ? db
          .select({ staff, tenant: tenants })
          .from(staff)
          .innerJoin(tenants, eq(staff.tenantId, tenants.id))
          .where(eq(staff.email, identifier))
          .get()
      : db
          .select({ staff, tenant: tenants })
          .from(staff)
          .innerJoin(tenants, eq(staff.tenantId, tenants.id))
          .where(eq(staff.code, identifier))
          .get();

  const storedHash =
    input.mode === "password"
      ? row?.staff.passwordHash ?? null
      : row?.staff.pinHash ?? null;

  const validSecret = row ? verifySecret(input.secret, storedHash) : false;

  if (
    !row ||
    !validSecret ||
    !row.staff.active ||
    row.staff.archivedAt !== null ||
    row.tenant.status !== "active"
  ) {
    recordAttempt(db, { identifier, ip: meta.ip, success: false });
    auditLoginFailure(db, {
      tenantId: row?.tenant.id ?? null,
      mode: input.mode,
      ip: meta.ip,
    });
    return {
      ok: false,
      error: "Thông tin đăng nhập không đúng.",
    };
  }

  db.delete(loginAttempts)
    .where(and(eq(loginAttempts.identifier, identifier), eq(loginAttempts.ip, meta.ip)))
    .run();
  recordAttempt(db, { identifier, ip: meta.ip, success: true });

  const branches = getAllowedBranches(
    db,
    row.staff.id,
    row.tenant.id,
    row.staff.role,
  );
  const activeBranchId =
    row.staff.role === "owner" ? null : branches[0]?.id ?? null;

  const session = await createSession(db, {
    tenantId: row.tenant.id,
    staffId: row.staff.id,
    activeBranchId,
    ip: meta.ip,
    userAgent: meta.userAgent.slice(0, 500),
  });

  writeAudit(db, {
    tenantId: row.tenant.id,
    actorId: row.staff.id,
    action: "auth.login.success",
    entity: "auth",
    metadata: { mode: input.mode, ip: meta.ip },
  });

  return {
    ok: true,
    token: session.token,
    expiresAt: session.expiresAt,
    sessionId: session.sessionId,
  };
}
