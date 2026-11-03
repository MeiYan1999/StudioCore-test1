import crypto from "node:crypto";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  customerInteractions,
  customers,
  notifications,
  orders,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
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
  if (!row) return;
  db.insert(customerInteractions)
    .values({
      id: crypto.randomUUID(),
      tenantId: row.order.tenantId,
      customerId: row.order.customerId,
      type: "review_request",
      content:
        "Đã gửi yêu cầu đánh giá sau khi hoàn tất đơn qua local adapter. Phản hồi của khách sẽ được ghi tại đây.",
      occurredAt: new Date(),
      createdBy: actorId,
    })
    .run();
  if (row.order.createdBy) {
    createNotification(db, {
      tenantId: row.order.tenantId,
      userId: row.order.createdBy,
      type: "review_request",
      title: "Đã gửi yêu cầu đánh giá",
      content: `Đơn ${row.order.code} đã hoàn tất. Yêu cầu đánh giá được ghi nhận bằng local adapter, không gửi ra ngoài.`,
      link: `/manage/orders/${row.order.id}`,
    });
  }
  writeAudit(db, {
    tenantId: row.order.tenantId,
    actorId,
    action: "customers.review.request",
    entity: "order",
    entityId: orderId,
    metadata: { channel: "local", customerName: row.customerName },
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
