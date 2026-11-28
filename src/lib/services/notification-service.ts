import crypto from "node:crypto";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  customerInteractions,
  reviewRequests,
  conversations,
  facebookThreads,
  customers,
  notifications,
  orders,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import { getTenantSettings } from "./settings-service";
import { writeAudit } from "../audit";

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationSummary = {
  items: NotificationItem[];
  unreadCount: number;
};

export function createNotification(
  db: AppDb,
  input: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    content: string;
    link?: string | null;
  },
): void {
  db.insert(notifications)
    .values({
      id: crypto.randomUUID(),
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      content: input.content,
      link: input.link ?? null,
    })
    .run();
}

export function markNotificationRead(
  db: AppDb,
  actor: ActorContext,
  notificationId: string,
): void {
  db.update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.tenantId, actor.tenantId),
        eq(notifications.userId, actor.staffId),
      ),
    )
    .run();
}

export function markAllNotificationsRead(db: AppDb, actor: ActorContext): void {
  db.update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.tenantId, actor.tenantId),
        eq(notifications.userId, actor.staffId),
        isNull(notifications.readAt),
      ),
    )
    .run();
}

export function queueReviewRequest(
  db: AppDb,
  orderId: string,
  actorId: string | null,
): void {
  const row = db
    .select({
      order: orders,
      customerName: customers.name,
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, orderId))
    .get();
  if (!row || row.order.status !== "completed") return;
  const config = getTenantSettings(db, row.order.tenantId);
  const channel = config["notification.reviewChannel"] === "messenger" ? "messenger" : "manual";
  const delay = Number(config["notification.reviewDelayHours"] || 0);
  const dueAt = new Date(Date.now() + delay * 3_600_000);
  const content = (config["notification.reviewTemplate"] || "Cảm ơn {khach} đã chọn studio. Bạn có thể chia sẻ đánh giá về đơn {don} không?")
    .replaceAll("{khach}", () => row.customerName).replaceAll("{don}", () => row.order.code);
  const threads = channel === "messenger" ? db.select({ id: conversations.id }).from(conversations)
    .innerJoin(facebookThreads, eq(facebookThreads.conversationId, conversations.id))
    .where(and(eq(conversations.customerId, row.order.customerId), eq(conversations.tenantId, row.order.tenantId),
      eq(conversations.branchId, row.order.branchId))).limit(2).all() : [];
  const recipient = threads.length === 1 ? threads[0].id : null;
  const error = channel === "messenger" && !recipient ? "Cần một hội thoại Messenger duy nhất đã liên kết đúng khách và chi nhánh." : null;
  db.transaction(tx => {
    const inserted = tx.insert(reviewRequests).values({ orderId, tenantId: row.order.tenantId, channel, content,
      recipient, dueAt, status: error ? "failed" : "pending", error }).onConflictDoNothing().run();
    if (!inserted.changes) return;
    tx.insert(customerInteractions).values({ id: crypto.randomUUID(), tenantId: row.order.tenantId,
      customerId: row.order.customerId, type: "review_request", content: `Đơn ${row.order.code} · ${error || "Chờ gửi"} · ${content}`,
      occurredAt: new Date(), createdBy: actorId }).run();
    createNotification(tx, { tenantId: row.order.tenantId, userId: row.order.createdBy, type: "review_request",
      title: "Yêu cầu đánh giá đơn hàng", content: error || `Đơn ${row.order.code} đang chờ gửi yêu cầu đánh giá.`,
      link: `/manage/orders/${orderId}` });
    writeAudit(tx, { tenantId: row.order.tenantId, actorId, action: "customers.review.request", entity: "order",
      entityId: orderId, metadata: { channel } });
  });

}

export function getNotificationsForActor(
  db: AppDb,
  actor: ActorContext,
): NotificationSummary {
  const rows = db
    .select({
      id: notifications.id,
      title: notifications.title,
      content: notifications.content,
      link: notifications.link,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, actor.tenantId),
        eq(notifications.userId, actor.staffId),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(8)
    .all();

  const unreadCount =
    db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.tenantId, actor.tenantId),
          eq(notifications.userId, actor.staffId),
          isNull(notifications.readAt),
        ),
      )
      .get()?.value ?? 0;

  return { items: rows, unreadCount };
}

export function confirmManualReview(db:AppDb,actor:ActorContext,orderId:string) {
  assertPermission(actor,"orders.manage");
  const order=db.select().from(orders).where(and(eq(orders.tenantId,actor.tenantId),eq(orders.id,orderId))).get();
  if(!order || order.status!=="completed") throw new Error("Đơn chưa hoàn tất.");
  assertBranchAccess(actor,order.branchId);
  db.transaction(tx=>{
    const changed=tx.update(reviewRequests).set({status:"sent",sentAt:new Date()}).where(and(eq(reviewRequests.tenantId,actor.tenantId),
      eq(reviewRequests.orderId,orderId),eq(reviewRequests.channel,"manual"),eq(reviewRequests.status,"pending"))).run();
    if(changed.changes) writeAudit(tx,{tenantId:actor.tenantId,actorId:actor.staffId,action:"customers.review.confirm",entity:"order",entityId:orderId});
  });
}
