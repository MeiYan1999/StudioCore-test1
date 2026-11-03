import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "../env";
import type { AppDb } from "../db/client";
import { branches, rolePermissions, sessions, staff, staffBranches, tenants } from "../db/schema";
import type { ActorBranch, ActorContext } from "./types";
import { PERMISSIONS, type Role } from "./roles";
import { AuthorizationError } from "../errors";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

export async function signSessionToken(sessionId: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sid === "string" ? payload.sid : null;
  } catch {
    return null;
  }
}

export type SessionCreation = {
  sessionId: string;
  token: string;
  expiresAt: Date;
};

export async function createSession(
  db: AppDb,
  input: {
    tenantId: string;
    staffId: string;
    activeBranchId: string | null;
    ip: string;
    userAgent: string;
    readOnly?: boolean;
    ttlMinutes?: number;
  },
): Promise<SessionCreation> {
  const ttlMinutes = input.ttlMinutes ?? getEnv().SESSION_TTL_HOURS * 60;
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  db.insert(sessions)
    .values({
      id: sessionId,
      tenantId: input.tenantId,
      staffId: input.staffId,
      activeBranchId: input.activeBranchId,
      ip: input.ip,
      userAgent: input.userAgent,
      expiresAt,
      readOnly: input.readOnly ?? false,
    })
    .run();

  const token = await signSessionToken(sessionId, expiresAt);
  return { sessionId, token, expiresAt };
}

export function getAllowedBranches(
  db: AppDb,
  staffId: string,
  tenantId: string,
  role: Role,
): ActorBranch[] {
  if (role === "owner") {
    return db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.status, "active")))
      .orderBy(asc(branches.name))
      .all();
  }

  return db
    .select({ id: branches.id, name: branches.name })
    .from(staffBranches)
    .innerJoin(branches, eq(staffBranches.branchId, branches.id))
    .where(
      and(
        eq(staffBranches.staffId, staffId),
        eq(staffBranches.tenantId, tenantId),
        eq(branches.status, "active"),
      ),
    )
    .orderBy(asc(branches.name))
    .all();
}

export async function getActorFromToken(
  db: AppDb,
  token: string,
): Promise<ActorContext | null> {
  const sessionId = await verifySessionToken(token);
  if (!sessionId) {
    return null;
  }

  const row = db
    .select({
      session: sessions,
      staff,
      tenant: tenants,
    })
    .from(sessions)
    .innerJoin(staff, eq(sessions.staffId, staff.id))
    .innerJoin(tenants, eq(sessions.tenantId, tenants.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .get();

  if (!row) {
    return null;
  }

  if (!row.staff.active || row.staff.archivedAt !== null || row.tenant.status !== "active") {
    return null;
  }

  const readOnly = row.session.readOnly;
  const permissions = readOnly
    ? PERMISSIONS.filter((permission) => permission.endsWith(".view"))
    : db
        .select({ permission: rolePermissions.permission })
        .from(rolePermissions)
        .where(
          and(
            eq(rolePermissions.tenantId, row.tenant.id),
            eq(rolePermissions.role, row.staff.role),
          ),
        )
        .all()
        .map((item) => item.permission);

  const allowedBranches = getAllowedBranches(
    db,
    row.staff.id,
    row.tenant.id,
    row.staff.role,
  );

  let activeBranchId = row.session.activeBranchId;
  if (row.staff.role !== "owner") {
    if (!activeBranchId || !allowedBranches.some((branch) => branch.id === activeBranchId)) {
      activeBranchId = allowedBranches[0]?.id ?? null;
    }
  } else if (activeBranchId && !allowedBranches.some((branch) => branch.id === activeBranchId)) {
    activeBranchId = null;
  }

  return {
    sessionId: row.session.id,
    staffId: row.staff.id,
    tenantId: row.tenant.id,
    tenantName: row.tenant.name,
    tenantSlug: row.tenant.slug,
    tenantPlan: row.tenant.plan,
    staffName: row.staff.name,
    staffCode: row.staff.code,
    staffEmail: row.staff.email,
    role: row.staff.role,
    permissions,
    branches: allowedBranches,
    activeBranchId,
    readOnly,
  };
}

export function revokeSessionById(db: AppDb, sessionId: string, tenantId: string): void {
  db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.tenantId, tenantId)))
    .run();
}

export function setActiveBranch(
  db: AppDb,
  actor: ActorContext,
  branchId: string | null,
): void {
  if (branchId === null) {
    if (actor.role !== "owner") {
      throw new AuthorizationError("Chỉ chủ studio được xem tất cả chi nhánh.");
    }
  } else if (!actor.branches.some((branch) => branch.id === branchId)) {
    throw new AuthorizationError("Bạn không được giao chi nhánh này.");
  }

  db.update(sessions)
    .set({ activeBranchId: branchId, lastSeenAt: new Date() })
    .where(and(eq(sessions.id, actor.sessionId), eq(sessions.tenantId, actor.tenantId)))
    .run();
}
