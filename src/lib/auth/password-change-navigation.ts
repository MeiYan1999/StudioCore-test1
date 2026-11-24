import { hasPermission } from "./permissions";
import type { Permission } from "./roles";
import type { ActorContext } from "./types";

const localOrigin = "https://studiocore.invalid";

const studioDestinations: [Permission, string][] = [
  ["dashboard.view", "/manage/dashboard"],
  ["customers.view", "/manage/customers"],
  ["orders.view", "/manage/orders"],
  ["schedule.view", "/manage/calendar"],
  ["tasks.view", "/manage/tasks"],
  ["staff.view", "/manage/staff"],
  ["finance.view", "/manage/finance"],
  ["payroll.view", "/manage/payroll"],
  ["reports.view", "/manage/reports"],
  ["albums.view", "/manage/photos"],
  ["audit.view", "/manage/activity-log"],
  ["settings.view", "/manage/settings"],
  ["settings.manage", "/manage/settings"],
];

export function passwordChangeReturnTo(
  actor: Pick<ActorContext, "role" | "permissions">,
  returnTo?: string,
): string {
  if (actor.role === "platform_admin" && hasPermission(actor.permissions, "tenants.manage")) {
    return "/platform";
  }

  if (returnTo?.startsWith("/manage/")) {
    const url = new URL(returnTo, localOrigin);
    if (url.origin === localOrigin && url.pathname.startsWith("/manage/")) {
      return url.pathname + url.search;
    }
  }

  return studioDestinations.find(([permission]) => hasPermission(actor.permissions, permission))?.[1] ?? "/";
}
