import crypto from "node:crypto";
import { and, desc, eq, gte, lte, inArray, ne, type SQL } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { branches, campaigns, orders } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission, getBranchScope } from "../auth/permissions";
import { NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { parseVietnamDateTimeLocal } from "../utils";
import {
  CAMPAIGN_SOURCES,
  CAMPAIGN_STATUSES,
} from "../campaigns/constants";

export type CampaignView = {
  id: string;
  name: string;
  source: string;
  branchId: string;
  branchName: string;
  budget: number;
  spend: number;
  leads: number;
  ordersCount: number;
  revenue: number;
  roas: number;
  cpl: number;
  startAt: Date | null;
  endAt: Date | null;
  status: string;
  notes: string | null;
  attributedOrders: { id: string; code: string; total: number }[];
};

function computeMetrics(row: {
  spend: number;
  leads: number;
  revenue: number;
}): { roas: number; cpl: number } {
  return {
    roas: row.spend > 0 ? Math.round((row.revenue / row.spend) * 100) / 100 : 0,
    cpl: row.leads > 0 ? Math.round(row.spend / row.leads) : 0,
  };
}

export function listCampaigns(
  db: AppDb,
  actor: ActorContext,
  filters: { branchId?: string; status?: string; from?: string; to?: string } = {},
): CampaignView[] {
  assertPermission(actor, "customers.view");
  const scope = getBranchScope(actor);
  if (scope.mode === "none") return [];
  const conditions: SQL[] = [eq(campaigns.tenantId, actor.tenantId)];
  if (scope.mode === "branch") conditions.push(eq(campaigns.branchId, scope.branchId));
  else if (filters.branchId) conditions.push(eq(campaigns.branchId, filters.branchId));
  if (filters.status && (CAMPAIGN_STATUSES as readonly string[]).includes(filters.status)) {
    conditions.push(eq(campaigns.status, filters.status));
  }
  const rows = db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      source: campaigns.source,
      branchId: campaigns.branchId,
      branchName: branches.name,
      budget: campaigns.budget,
      spend: campaigns.spend,
      leads: campaigns.leads,
      ordersCount: campaigns.ordersCount,
      revenue: campaigns.revenue,
      startAt: campaigns.startAt,
      endAt: campaigns.endAt,
      status: campaigns.status,
      notes: campaigns.notes,
    })
    .from(campaigns)
    .innerJoin(branches, eq(campaigns.branchId, branches.id))
    .where(and(...conditions))
    .orderBy(desc(campaigns.createdAt))
    .limit(200)
    .all();
  const from = filters.from && parseVietnamDateTimeLocal(filters.from + "T00:00:00");
  const to = filters.to && parseVietnamDateTimeLocal(filters.to + "T23:59:59.999");
  const linked = rows.length && actor.permissions.includes("orders.view") ? db.select({
    id: orders.id, code: orders.code, total: orders.total, campaignId: orders.campaignId,
  }).from(orders).innerJoin(campaigns, eq(campaigns.id, orders.campaignId))
    .where(and(inArray(campaigns.id, rows.map(row => row.id)), eq(orders.tenantId, actor.tenantId),
      eq(orders.branchId, campaigns.branchId), ne(orders.status, "cancelled"),
      from ? gte(orders.createdAt, from) : undefined, to ? lte(orders.createdAt, to) : undefined))
    .orderBy(desc(orders.createdAt)).all() : [];
  const grouped = new Map<string, typeof linked>();
  for (const order of linked) {
    const group = grouped.get(order.campaignId!) || [];
    group.push(order);
    grouped.set(order.campaignId!, group);
  }
  return rows.map(row => ({ ...row, ...computeMetrics(row), attributedOrders: grouped.get(row.id) || [] }));
}

export type CampaignInput = {
  id?: string;
  name: string;
  source: string;
  branchId: string;
  budget: number;
  spend: number;
  leads: number;
  ordersCount: number;
  revenue: number;
  startAt: string;
  endAt: string;
  status: string;
  notes: string;
};

export function saveCampaign(
  db: AppDb,
  actor: ActorContext,
  input: CampaignInput,
): string {
  assertPermission(actor, "customers.manage");
  assertBranchAccess(actor, input.branchId);
  if (!input.name.trim()) throw new ValidationError("Tên chiến dịch là bắt buộc.");
  if (!(CAMPAIGN_SOURCES as readonly string[]).includes(input.source)) {
    throw new ValidationError("Nguồn chiến dịch không hợp lệ.");
  }
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(input.status)) {
    throw new ValidationError("Trạng thái chiến dịch không hợp lệ.");
  }
  for (const value of [input.budget, input.spend, input.leads, input.ordersCount, input.revenue]) {
    if (!Number.isInteger(value) || value < 0) {
      throw new ValidationError("Số liệu chiến dịch phải là số nguyên không âm.");
    }
  }
  if (input.spend > input.budget) {
    throw new ValidationError("Chi phí không được vượt ngân sách.");
  }
  const startAt = input.startAt ? parseVietnamDateTimeLocal(input.startAt) : null;
  const endAt = input.endAt ? parseVietnamDateTimeLocal(input.endAt) : null;
  if (input.startAt && !startAt) throw new ValidationError("Ngày bắt đầu không hợp lệ.");
  if (input.endAt && !endAt) throw new ValidationError("Ngày kết thúc không hợp lệ.");
  if (startAt && endAt && endAt < startAt) {
    throw new ValidationError("Ngày kết thúc phải sau ngày bắt đầu.");
  }
  if (input.id) {
    const existing = db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, input.id), eq(campaigns.tenantId, actor.tenantId)))
      .get();
    if (!existing) throw new NotFoundError("Không tìm thấy chiến dịch.");
    assertBranchAccess(actor, existing.branchId);
    db.update(campaigns)
      .set({
        name: input.name.trim(),
        source: input.source,
        branchId: input.branchId,
        budget: input.budget,
        spend: input.spend,
        leads: input.leads,
        ordersCount: input.ordersCount,
        revenue: input.revenue,
        startAt,
        endAt,
        status: input.status,
        notes: input.notes.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, input.id))
      .run();
    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "campaigns.update",
      entity: "campaign",
      entityId: input.id,
    });
    return input.id;
  }
  const id = crypto.randomUUID();
  db.insert(campaigns)
    .values({
      id,
      tenantId: actor.tenantId,
      branchId: input.branchId,
      name: input.name.trim(),
      source: input.source,
      budget: input.budget,
      spend: input.spend,
      leads: input.leads,
      ordersCount: input.ordersCount,
      revenue: input.revenue,
      startAt,
      endAt,
      status: input.status,
      notes: input.notes.trim() || null,
      createdBy: actor.staffId,
    })
    .run();
  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "campaigns.create",
    entity: "campaign",
    entityId: id,
  });
  return id;
}


export function attributeOrder(db: AppDb, actor: ActorContext, orderId: string, campaignId: string) {
  assertPermission(actor, "orders.manage");
  const order = db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.tenantId))).get();
  if (!order) throw new NotFoundError("Không tìm thấy đơn.");
  assertBranchAccess(actor, order.branchId);
  if (campaignId && !db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, campaignId),
    eq(campaigns.tenantId, actor.tenantId), eq(campaigns.branchId, order.branchId))).get()) {
    throw new ValidationError("Chiến dịch không thuộc chi nhánh của đơn.");
  }
  db.update(orders).set({ campaignId: campaignId || null, updatedAt: new Date() }).where(eq(orders.id, orderId)).run();
  writeAudit(db, { tenantId: actor.tenantId, actorId: actor.staffId, entity: "order", entityId: orderId,
    action: "orders.campaign", metadata: { campaignId } });
}
