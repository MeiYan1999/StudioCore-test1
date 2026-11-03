import { and, count, countDistinct, desc, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  activityLogs,
  customers,
  services,
  staff,
  staffBranches,
  wardrobeItems,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertPermission, getBranchScope } from "../auth/permissions";
import { activityActionLabel } from "../audit";

export type DashboardData = {
  counts: {
    customers: number;
    activeServices: number;
    availableWardrobe: number;
    activeStaff: number;
  };
  branchCount: number;
  activeBranchName: string;
  scopeLabel: string;
  recentActivity: {
    id: string;
    action: string;
    actionLabel: string;
    entity: string;
    createdAt: Date;
    actorName: string;
  }[];
};

export function getDashboardData(db: AppDb, actor: ActorContext): DashboardData {
  assertPermission(actor, "dashboard.view");

  const scope = getBranchScope(actor);

  const activeBranchName = actor.activeBranchId
    ? actor.branches.find((branch) => branch.id === actor.activeBranchId)?.name ??
      "Chi nhánh không xác định"
    : actor.role === "owner"
      ? "Tất cả chi nhánh"
      : "Chưa gán chi nhánh";

  const emptyCounts = {
    customers: 0,
    activeServices: 0,
    availableWardrobe: 0,
    activeStaff: 0,
  };

  let counts = emptyCounts;

  if (scope.mode !== "none") {
    const branchCondition =
      scope.mode === "branch" ? scope.branchId : null;

    const customerCount =
      db
        .select({ value: count() })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, actor.tenantId),
            isNull(customers.archivedAt),
            branchCondition ? eq(customers.branchId, branchCondition) : undefined,
          ),
        )
        .get()?.value ?? 0;

    const activeServices =
      db
        .select({ value: count() })
        .from(services)
        .where(
          and(
            eq(services.tenantId, actor.tenantId),
            eq(services.active, true),
            branchCondition ? eq(services.branchId, branchCondition) : undefined,
          ),
        )
        .get()?.value ?? 0;

    const availableWardrobe =
      db
        .select({ value: count() })
        .from(wardrobeItems)
        .where(
          and(
            eq(wardrobeItems.tenantId, actor.tenantId),
            eq(wardrobeItems.status, "available"),
            branchCondition ? eq(wardrobeItems.branchId, branchCondition) : undefined,
          ),
        )
        .get()?.value ?? 0;

    const activeStaff =
      branchCondition === null
        ? db
            .select({ value: count() })
            .from(staff)
            .where(
              and(
                eq(staff.tenantId, actor.tenantId),
                eq(staff.active, true),
                isNull(staff.archivedAt),
              ),
            )
            .get()?.value ?? 0
        : db
            .select({ value: countDistinct(staff.id) })
            .from(staffBranches)
            .innerJoin(staff, eq(staffBranches.staffId, staff.id))
            .where(
              and(
                eq(staffBranches.tenantId, actor.tenantId),
                eq(staffBranches.branchId, branchCondition),
                eq(staff.active, true),
                isNull(staff.archivedAt),
              ),
            )
            .get()?.value ?? 0;

    counts = {
      customers: customerCount,
      activeServices,
      availableWardrobe,
      activeStaff,
    };
  }

  const recentActivity = db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entity: activityLogs.entity,
      createdAt: activityLogs.createdAt,
      actorName: staff.name,
    })
    .from(activityLogs)
    .leftJoin(staff, eq(activityLogs.actorId, staff.id))
    .where(eq(activityLogs.tenantId, actor.tenantId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(6)
    .all()
    .map((row) => ({
      ...row,
      actionLabel: activityActionLabel(row.action),
      actorName: row.actorName ?? "Hệ thống",
    }));

  return {
    counts,
    branchCount: actor.branches.length,
    activeBranchName,
    scopeLabel:
      scope.mode === "all"
        ? "Toàn bộ chi nhánh"
        : scope.mode === "branch"
          ? activeBranchName
          : "Chưa gán chi nhánh",
    recentActivity,
  };
}
