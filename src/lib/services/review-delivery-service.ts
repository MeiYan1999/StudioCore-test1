import { and, eq, lte, inArray } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { conversations, facebookDeliveries, orders, reviewRequests } from "../db/schema";
import { digest, sendFacebook } from "../omnichannel/meta";

export async function deliverDueReviews(db: AppDb) {
  const due = db.select().from(reviewRequests).where(and(eq(reviewRequests.channel, "messenger"),
    eq(reviewRequests.status, "pending"), lte(reviewRequests.dueAt, new Date()))).orderBy(reviewRequests.dueAt).limit(20).all();
  for (const request of due) {
    const matches = db.select({ id: conversations.id }).from(conversations)
      .innerJoin(orders, and(eq(orders.customerId, conversations.customerId), eq(orders.branchId, conversations.branchId)))
      .where(and(eq(conversations.tenantId, request.tenantId), eq(conversations.id, request.recipient ?? ""),
        eq(orders.tenantId, request.tenantId), eq(orders.id, request.orderId), eq(orders.status, "completed"))).get();
    const claim = db.update(reviewRequests).set({ status: "sending" }).where(and(eq(reviewRequests.orderId, request.orderId),
      eq(reviewRequests.status, "pending"))).run();
    if (!claim.changes) continue;
    try {
      if (!matches) throw new Error("Hội thoại không còn liên kết với khách của đơn.");
      const result = await sendFacebook(db, matches.id, request.content, "review:" + request.orderId);
      const status = result?.status === "sent" ? "sent" : result?.status === "failed" ? "failed" : "unknown";
      db.update(reviewRequests).set({ status, error: result?.error || null, sentAt: status === "sent" ? new Date() : null })
        .where(eq(reviewRequests.orderId, request.orderId)).run();
    } catch (error) {
      db.update(reviewRequests).set({ status: "failed", error: error instanceof Error ? error.message : "Gửi thất bại." })
        .where(eq(reviewRequests.orderId, request.orderId)).run();
    }
  }
}

// A delivery echo can confirm a timed-out send after the original worker stops.
export function recoverReviewDeliveries(db: AppDb) {
  const rows = db.select().from(reviewRequests).where(inArray(reviewRequests.status, ["sending","unknown"])).all();
  for (const row of rows) {
    if (!row.recipient) continue;
    const delivery = db.select().from(facebookDeliveries)
      .where(eq(facebookDeliveries.id, digest(row.recipient+":review:"+row.orderId))).get();
    if (delivery && ["sent","delivered","read"].includes(delivery.status)) {
      db.update(reviewRequests).set({status:"sent",sentAt:row.sentAt??new Date(),error:null}).where(eq(reviewRequests.orderId,row.orderId)).run();
    } else if (delivery?.status==="failed") {
      db.update(reviewRequests).set({status:"failed",error:delivery.error}).where(eq(reviewRequests.orderId,row.orderId)).run();
    } else if (row.status==="sending") {
      db.update(reviewRequests).set({status:"unknown",error:"Vui lòng kiểm tra lịch sử Messenger."}).where(eq(reviewRequests.orderId,row.orderId)).run();
    }
  }
}
