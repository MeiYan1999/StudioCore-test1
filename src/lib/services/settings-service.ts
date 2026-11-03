import { and, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { settings } from "../db/schema";

export function getTenantSettings(
  db: AppDb,
  tenantId: string,
): Record<string, string> {
  const rows = db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), isNull(settings.branchId)))
    .all();

  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
