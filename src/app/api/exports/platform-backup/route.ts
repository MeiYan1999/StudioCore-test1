import { getActorContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import {
  branches,
  contactRequests,
  platformSubscriptions,
  settings,
  staff,
  tenants,
} from "@/lib/db/schema";
import { attachmentHeader } from "@/lib/http/download";
import { desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    return new Response("Forbidden: Chỉ SuperAdmin mới có quyền sao lưu toàn nền tảng.", {
      status: 403,
    });
  }

  const db = getDb();
  const allTenants = db.select().from(tenants).orderBy(desc(tenants.createdAt)).all();
  const allBranches = db.select().from(branches).all();
  const allStaff = db
    .select({
      id: staff.id,
      tenantId: staff.tenantId,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      active: staff.active,
      createdAt: staff.createdAt,
    })
    .from(staff)
    .all();

  const allSubscriptions = db
    .select()
    .from(platformSubscriptions)
    .orderBy(desc(platformSubscriptions.createdAt))
    .all();

  const allContactRequests = db
    .select()
    .from(contactRequests)
    .orderBy(desc(contactRequests.createdAt))
    .all();

  const platformSettings = db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .all()
    .filter((s) => s.key.startsWith("platform."));

  const fullPlatformBackup = {
    exportedAt: new Date().toISOString(),
    exportedBy: {
      staffId: actor.staffId,
      name: actor.staffName,
      role: actor.role,
    },
    version: "StudioCore-Platform-v2",
    summary: {
      totalTenants: allTenants.length,
      totalBranches: allBranches.length,
      totalStaff: allStaff.length,
      totalSubscriptions: allSubscriptions.length,
      totalLeads: allContactRequests.length,
    },
    tenants: allTenants,
    branches: allBranches,
    staff: allStaff,
    subscriptions: allSubscriptions,
    contactRequests: allContactRequests,
    platformSettings: Object.fromEntries(platformSettings.map((s) => [s.key, s.value])),
  };

  const filename = `studiocore-full-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(fullPlatformBackup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": attachmentHeader(filename),
      "Cache-Control": "private, no-store",
    },
  });
}
