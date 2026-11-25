import { and, count, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { branches, staff, tenants } from "../db/schema";
import { ValidationError } from "../errors";

export type PlanLimits = { branches: number | null; staff: number | null };

/** Per-plan caps as advertised on the pricing page; null means unlimited. */
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  trial: { branches: 3, staff: 30 },
  basic: { branches: 1, staff: 10 },
  pro: { branches: 3, staff: 30 },
  enterprise: { branches: null, staff: null },
};

export const PLAN_GRACE_DAYS = 7;
export const TRIAL_DAYS = 30;

/** Expiry of a trial that starts at `from`. */
export function trialExpiryFrom(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}
const PLAN_GRACE_MS = PLAN_GRACE_DAYS * 24 * 60 * 60 * 1000;

/** Unknown plan keys are not capped, so legacy tenants keep working. */
export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] ?? { branches: null, staff: null };
}

/** True once the plan expired more than the grace period ago. No expiry date means no lapse. */
export function isPlanLapsed(planExpiresAt: Date | null, now: Date = new Date()): boolean {
  return planExpiresAt !== null && planExpiresAt.getTime() + PLAN_GRACE_MS < now.getTime();
}

/**
 * Blocks creating one more branch or staff member beyond the plan's cap.
 * Existing data above the cap is left alone.
 */
export function assertPlanAllowsNew(
  db: AppDb,
  tenantId: string,
  resource: "branches" | "staff",
): void {
  const tenant = db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .get();
  if (!tenant) return;
  const limit = getPlanLimits(tenant.plan)[resource];
  if (limit === null) return;

  const used =
    resource === "branches"
      ? db
          .select({ value: count() })
          .from(branches)
          .where(eq(branches.tenantId, tenantId))
          .get()
      : db
          .select({ value: count() })
          .from(staff)
          .where(and(eq(staff.tenantId, tenantId), isNull(staff.archivedAt)))
          .get();
  if ((used?.value ?? 0) >= limit) {
    throw new ValidationError(
      resource === "branches"
        ? `Gói hiện tại cho phép tối đa ${limit} chi nhánh. Hãy nâng cấp gói để thêm chi nhánh.`
        : `Gói hiện tại cho phép tối đa ${limit} nhân sự. Hãy nâng cấp gói để thêm nhân sự.`,
    );
  }
}
