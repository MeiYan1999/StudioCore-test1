import { and, eq, isNull } from "drizzle-orm";
import { getActorContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import {
  activityLogs,
  branches,
  campaigns,
  commissions,
  customers,
  documents,
  invoices,
  orderItems,
  orders,
  payments,
  payrolls,
  settings,
  staff,
  tasks,
  transactions,
} from "@/lib/db/schema";
import { attachmentHeader } from "@/lib/http/download";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const actor = await getActorContext();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  if (!hasPermission(actor.permissions, "settings.manage")) {
    return new Response("Forbidden", { status: 403 });
  }
  const db = getDb();
  const tenantId = actor.tenantId;
  const tenantSettings = db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), isNull(settings.branchId)))
    .all()
    .filter(
      (row) =>
        !row.key.includes("apiKey") &&
        !row.key.includes("Encrypted") &&
        !row.key.includes("token"),
    );
  const staffRows = db
    .select({
      id: staff.id,
      code: staff.code,
      name: staff.name,
      role: staff.role,
      email: staff.email,
      phone: staff.phone,
      baseSalary: staff.baseSalary,
      active: staff.active,
    })
    .from(staff)
    .where(eq(staff.tenantId, tenantId))
    .all();
  const backup = {
    exportedAt: new Date().toISOString(),
    exportedBy: actor.staffId,
    tenantId,
    settings: Object.fromEntries(tenantSettings.map((row) => [row.key, row.value])),
    branches: db.select().from(branches).where(eq(branches.tenantId, tenantId)).all(),
    staff: staffRows,
    customers: db.select().from(customers).where(eq(customers.tenantId, tenantId)).all(),
    orders: db.select().from(orders).where(eq(orders.tenantId, tenantId)).all(),
    orderItems: db.select().from(orderItems).where(eq(orderItems.tenantId, tenantId)).all(),
    payments: db.select().from(payments).where(eq(payments.tenantId, tenantId)).all(),
    transactions: db.select().from(transactions).where(eq(transactions.tenantId, tenantId)).all(),
    invoices: db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).all(),
    commissions: db.select().from(commissions).where(eq(commissions.tenantId, tenantId)).all(),
    payrolls: db.select().from(payrolls).where(eq(payrolls.tenantId, tenantId)).all(),
    tasks: db.select().from(tasks).where(eq(tasks.tenantId, tenantId)).all(),
    documents: db
      .select({
        id: documents.id,
        name: documents.name,
        category: documents.category,
        visibility: documents.visibility,
        version: documents.version,
      })
      .from(documents)
      .where(eq(documents.tenantId, tenantId))
      .all(),
    campaigns: db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId)).all(),
    activityLogs: db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.tenantId, tenantId))
      .all(),
  };
  writeAudit(db, {
    tenantId,
    actorId: actor.staffId,
    action: "settings.backup.export",
    entity: "tenant",
    entityId: tenantId,
  });
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": attachmentHeader(
        `studiocore-backup-${tenantId}-${new Date().toISOString().slice(0, 10)}.json`,
      ),
      "Cache-Control": "private, no-store",
    },
  });
}
