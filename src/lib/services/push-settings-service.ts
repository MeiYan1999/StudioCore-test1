import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { settings } from "../db/schema";
import { setTenantSetting } from "./settings-write-service";

export type PushCategoryKey =
  | "messages"
  | "orders"
  | "approvals"
  | "calendar"
  | "social"
  | "system";

export type PushCategories = Record<PushCategoryKey, boolean>;

export const DEFAULT_PUSH_CATEGORIES: PushCategories = {
  messages: true,
  orders: true,
  approvals: true,
  calendar: true,
  social: true,
  system: true,
};

export type PushSettings = {
  enabled: boolean;
  categories: PushCategories;
};

export function getPushSettings(
  db: AppDb,
  tenantId: string,
  staffId: string,
): PushSettings {
  // Enabled flag (default true)
  const enabledKey = `push.enabled.${staffId}`;
  const enabledRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, enabledKey)))
    .get();

  const enabled = enabledRow ? enabledRow.value !== "false" : true;

  // Categories JSON
  const catKey = `push.categories.${staffId}`;
  const catRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, catKey)))
    .get();

  let categories = { ...DEFAULT_PUSH_CATEGORIES };
  if (catRow?.value) {
    try {
      const parsed = JSON.parse(catRow.value);
      categories = { ...DEFAULT_PUSH_CATEGORIES, ...parsed };
    } catch {
      // Use defaults
    }
  }

  return { enabled, categories };
}

export function setPushEnabled(
  db: AppDb,
  tenantId: string,
  staffId: string,
  enabled: boolean,
): void {
  const enabledKey = `push.enabled.${staffId}`;
  setTenantSetting(db, tenantId, enabledKey, enabled ? "true" : "false");
}

export function updatePushCategory(
  db: AppDb,
  tenantId: string,
  staffId: string,
  category: PushCategoryKey,
  enabled: boolean,
): PushCategories {
  const current = getPushSettings(db, tenantId, staffId);
  const updatedCategories = {
    ...current.categories,
    [category]: enabled,
  };

  const catKey = `push.categories.${staffId}`;
  setTenantSetting(db, tenantId, catKey, JSON.stringify(updatedCategories));
  return updatedCategories;
}
