import { and, count, desc, eq, gte, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { activityLogs, staff } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission, getBranchScope } from "../auth/permissions";

export type AuditFilters = {
  q?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type AuditView = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  metadata: string;
  createdAt: Date;
};

/**
 * A branch-scoped viewer sees entries about their branch plus entries that
 * have no branch (logins, staff, settings): all of them for the owner, only
 * their own for anyone else.
 */
function auditBranchConditions(actor: ActorContext): SQL[] {
  const scope = getBranchScope(actor);
  if (scope.mode === "all") return [];
  const tenantWide =
    actor.role === "owner"
      ? isNull(activityLogs.branchId)
      : and(isNull(activityLogs.branchId), eq(activityLogs.actorId, actor.staffId));
  const visible =
    scope.mode === "branch" ? or(eq(activityLogs.branchId, scope.branchId), tenantWide) : tenantWide;
  return visible ? [visible] : [];
}

export function listActivityLogs(
  db: AppDb,
  actor: ActorContext,
  filters: AuditFilters,
): { items: AuditView[]; total: number; page: number; pageSize: number } {
  assertPermission(actor, "audit.view");
  const conditions: SQL[] = [eq(activityLogs.tenantId, actor.tenantId), ...auditBranchConditions(actor)];
  if (filters.action) conditions.push(eq(activityLogs.action, filters.action));
  if (filters.entity) conditions.push(eq(activityLogs.entity, filters.entity));
  if (filters.from) {
    conditions.push(gte(activityLogs.createdAt, new Date(`${filters.from}T00:00:00+07:00`)));
  }
  if (filters.to) {
    conditions.push(lte(activityLogs.createdAt, new Date(`${filters.to}T23:59:59+07:00`)));
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim().toLowerCase()}%`;
    const search = or(
      sql`lower(${activityLogs.action}) like ${term}`,
      sql`lower(${activityLogs.entity}) like ${term}`,
      sql`lower(coalesce(${activityLogs.entityId}, '')) like ${term}`,
      sql`lower(coalesce(${staff.name}, '')) like ${term}`,
    );
    if (search) conditions.push(search);
  }
  const where = and(...conditions);
  const total = db.select({ value: count() }).from(activityLogs).where(where).get()?.value ?? 0;
  const items = db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entity: activityLogs.entity,
      entityId: activityLogs.entityId,
      actorName: staff.name,
      metadata: activityLogs.metadata,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(staff, eq(activityLogs.actorId, staff.id))
    .where(where)
    .orderBy(desc(activityLogs.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize)
    .all();
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export function listAuditActions(db: AppDb, actor: ActorContext): string[] {
  assertPermission(actor, "audit.view");
  return db
    .selectDistinct({ action: activityLogs.action })
    .from(activityLogs)
    .where(and(eq(activityLogs.tenantId, actor.tenantId), ...auditBranchConditions(actor)))
    .orderBy(activityLogs.action)
    .all()
    .map((row) => row.action);
}
