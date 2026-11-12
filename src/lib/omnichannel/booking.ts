import { and, eq, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  appointments,
  bookingLinks,
  bookingOffers,
  conversations,
  customers,
  facebookThreads,
  inboxBookings,
  inboxReceipts,
  orders,
  services,
} from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import { createContractWithAppointments } from "../services/contract-service";
import { recordOrderPayment } from "../services/order-service";
import { writeAudit } from "../audit";
import { digest } from "./meta";

export function authorizeThread(
  db: AppDb,
  actor: ActorContext,
  id: string,
  write = false,
) {
  assertPermission(actor, write ? "customers.manage" : "customers.view");
  if (write && actor.readOnly)
    throw new Error("Tài khoản đang ở chế độ chỉ đọc.");
  const row = db
    .select()
    .from(conversations)
    .where(
      and(eq(conversations.id, id), eq(conversations.tenantId, actor.tenantId)),
    )
    .get();
  if (!row) throw new Error("Không tìm thấy hội thoại.");
  assertBranchAccess(actor, row.branchId);
  if (actor.role !== "owner" && row.assignedTo !== actor.staffId)
    throw new Error("Hội thoại chưa được phân công cho bạn.");
  return row;
}
export function expireHolds(db: AppDb) {
  db.transaction(
    (tx) => {
      const expired = tx
        .select()
        .from(inboxBookings)
        .where(
          sql`${inboxBookings.status}='held' AND ${inboxBookings.expiresAt} <= ${Date.now()}`,
        )
        .all();
      for (const item of expired) {
        tx.update(appointments)
          .set({ status: "cancelled", cancelReason: "Hết thời hạn giữ chỗ" })
          .where(eq(appointments.id, item.appointmentId))
          .run();
        tx.update(inboxBookings)
          .set({ status: "expired" })
          .where(eq(inboxBookings.id, item.id))
          .run();
        tx.update(orders)
          .set({ status: "cancelled", cancelReason: "Hết thời hạn giữ chỗ" })
          .where(eq(orders.id, item.orderId))
          .run();
        writeAudit(tx, {
          tenantId: item.tenantId,
          actorId: null,
          action: "booking.expired",
          entity: "appointment",
          entityId: item.appointmentId,
        });
      }
    },
    { behavior: "immediate" },
  );
}
export function getOffer(db: AppDb, serviceId: string) {
  const row = db
    .select({ offer: bookingOffers, service: services })
    .from(bookingOffers)
    .innerJoin(services, eq(services.id, bookingOffers.serviceId))
    .where(
      and(
        eq(bookingOffers.serviceId, serviceId),
        eq(bookingOffers.active, 1),
        eq(services.active, true),
      ),
    )
    .get();
  if (!row) throw new Error("Gói chụp chưa mở đặt lịch công khai.");
  return row;
}
export function availableSlots(
  db: AppDb,
  serviceId: string,
  date: string,
  exclude?: string,
) {
  const { offer, service } = getOffer(db, serviceId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Ngày không hợp lệ.");
  const day = new Date(`${date}T00:00:00+07:00`);
  if (!Number.isFinite(day.getTime())) throw new Error("Ngày không hợp lệ.");
  const weekday = new Date(`${date}T12:00:00+07:00`).getUTCDay();
  if (
    offer.closedDays.split(",").includes(String(weekday)) ||
    offer.holidays.split(",").includes(date)
  )
    return [];
  const result: string[] = [];
  for (
    let minute = offer.opens;
    minute + service.durationMinutes + offer.buffer <= offer.closes;
    minute += 30
  ) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const start = new Date(`${date}T${time}:00+07:00`).getTime();
    if (start <= Date.now() || start > Date.now() + 180 * 86400000) continue;
    const end = start + (service.durationMinutes + offer.buffer) * 60000;
    if (
      offer.photographerId &&
      db.get(
        sql`SELECT id FROM leave_requests WHERE tenant_id=${offer.tenantId} AND staff_id=${offer.photographerId} AND status='approved' AND start_at<${end} AND end_at>${start} LIMIT 1`,
      )
    )
      continue;
    const conflict =
      db.get(sql`SELECT id FROM appointments a WHERE a.tenant_id=${offer.tenantId} AND a.id != ${exclude ?? ""}
      AND a.status != 'cancelled' AND a.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM inbox_bookings b WHERE b.appointment_id=a.id AND b.status='held' AND b.expires_at<=${Date.now()})
      AND ((${offer.roomId} IS NOT NULL AND a.room_id=${offer.roomId}) OR (${offer.photographerId} IS NOT NULL AND a.photographer_id=${offer.photographerId}))
      AND a.start_at < ${end} AND (a.end_at + a.buffer_minutes*60000) > ${start} LIMIT 1`);
    if (!conflict) result.push(time);
  }
  return result;
}
export type BookingInput = {
  serviceId: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  notes?: string;
  token?: string;
  key: string;
  conversationId?: string;
  surcharge?: number;
  discount?: number;
  deposit?: number;
};
export function book(db: AppDb, input: BookingInput, actor?: ActorContext) {
  return db.transaction(
    (tx) => {
      expireHolds(tx);
      const { offer, service } = getOffer(tx, input.serviceId);
      const key = digest(`${offer.tenantId}:${input.key}`);
      const previous = tx
        .select()
        .from(inboxBookings)
        .where(
          and(
            eq(inboxBookings.tenantId, offer.tenantId),
            eq(inboxBookings.requestKey, key),
          ),
        )
        .get();
      if (previous)
        return {
          id: previous.id,
          orderId: previous.orderId,
          status: previous.status,
        };
      let conversationId: string | null = null;
      if (input.token) {
        const link = tx
          .select()
          .from(bookingLinks)
          .where(eq(bookingLinks.tokenHash, digest(input.token)))
          .get();
        if (
          !link ||
          link.serviceId !== input.serviceId ||
          link.expiresAt <= Date.now()
        )
          throw new Error("Link đặt lịch đã hết hạn hoặc không hợp lệ.");
        if (link.bookingId)
          throw new Error(
            "Link này đã có lịch. Vui lòng nhắn studio để đổi lịch.",
          );
        conversationId = link.conversationId;
      } else if (actor && input.conversationId) {
        authorizeThread(tx, actor, input.conversationId, true);
        conversationId = input.conversationId;
      }
      if (actor) {
        assertPermission(actor, "schedule.manage");
        assertPermission(actor, "orders.manage");
        if (actor.tenantId !== offer.tenantId)
          throw new Error("Gói chụp không thuộc studio.");
        assertBranchAccess(actor, service.branchId);
      }
      if (conversationId) {
        const conversation = tx
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.tenantId, offer.tenantId),
              eq(conversations.branchId, service.branchId),
            ),
          )
          .get();
        if (!conversation)
          throw new Error("Hội thoại và gói chụp khác chi nhánh.");
      }
      if (!availableSlots(tx, input.serviceId, input.date).includes(input.time))
        throw new Error(
          "Khung giờ vừa được giữ hoặc ngoài lịch làm việc. Vui lòng chọn giờ khác.",
        );
      const start = new Date(`${input.date}T${input.time}:00+07:00`);
      const end = new Date(start.getTime() + service.durationMinutes * 60000);
      const endLocal = new Date(end.getTime() + 7 * 3600000).toISOString();
      const surcharge = actor ? (input.surcharge ?? 0) : 0;
      const discount = actor ? (input.discount ?? 0) : 0;
      const total = service.price + surcharge - discount;
      const deposit = actor ? (input.deposit ?? offer.deposit) : offer.deposit;
      if (
        ![total, deposit, surcharge, discount].every(
          (n) => Number.isSafeInteger(n) && n >= 0,
        ) ||
        deposit > total
      )
        throw new Error("Giá trị đơn hoặc cọc không hợp lệ.");
      // Public bookings act on the owner's explicitly published offer, with no collected payment.
      const creator =
        actor ??
        ({
          tenantId: offer.tenantId,
          staffId: offer.createdBy,
          role: "owner",
          permissions: ["orders.manage"],
          branches: [{ id: service.branchId, name: "" }],
        } as ActorContext);
      if (
        input.phone.length > 20 ||
        input.name.length > 120 ||
        (input.notes?.length ?? 0) > 2000
      )
        throw new Error("Thông tin đặt lịch quá dài.");
      const contract = createContractWithAppointments(tx, creator, {
        customerName: input.name,
        customerPhone: input.phone,
        branchId: service.branchId,
        serviceId: service.id,
        packageName: service.name,
        total,
        deposit: 0,
        surcharge,
        notes: input.notes,
        sessions: [
          {
            date: input.date,
            startTime: input.time,
            endTime: endLocal.slice(11, 16),
            roomId: offer.roomId,
            photographerId: offer.photographerId,
          },
        ],
      });
      const appointmentId = contract.appointmentIds[0];
      tx.update(appointments)
        .set({ bufferMinutes: offer.buffer })
        .where(eq(appointments.id, appointmentId))
        .run();
      tx.update(orders)
        .set({
          subtotal: service.price,
          surcharge,
          discount,
          total,
          deposit,
          remaining: total,
        })
        .where(eq(orders.id, contract.orderId))
        .run();
      tx.update(customers)
        .set({ source: conversationId ? "facebook" : "website" })
        .where(eq(customers.id, contract.customerId))
        .run();
      const thread = conversationId
        ? tx
            .select()
            .from(facebookThreads)
            .where(eq(facebookThreads.conversationId, conversationId))
            .get()
        : null;
      const id = crypto.randomUUID();
      tx.insert(inboxBookings)
        .values({
          id,
          tenantId: offer.tenantId,
          conversationId,
          pageId: thread?.pageId,
          serviceId: service.id,
          orderId: contract.orderId,
          appointmentId,
          status: "held",
          expiresAt: Date.now() + offer.holdMinutes * 60000,
          source: conversationId ? "Facebook" : "Website",
          requestKey: key,
        })
        .run();
      if (input.token)
        tx.update(bookingLinks)
          .set({ bookingId: id })
          .where(eq(bookingLinks.tokenHash, digest(input.token)))
          .run();
      writeAudit(tx, {
        tenantId: offer.tenantId,
        actorId: actor?.staffId ?? null,
        action: "booking.hold",
        entity: "appointment",
        entityId: appointmentId,
        metadata: { source: conversationId ? "Facebook" : "Website" },
      });
      return { id, orderId: contract.orderId, status: "held" };
    },
    { behavior: "immediate" },
  );
}
export function updateBooking(
  db: AppDb,
  actor: ActorContext,
  id: string,
  input: {
    action: "deposit" | "confirm" | "cancel" | "reschedule" | "complete";
    amount?: number;
    reference?: string;
    key: string;
    date?: string;
    time?: string;
  },
) {
  return db.transaction(
    (tx) => {
      expireHolds(tx);
      const b = tx
        .select()
        .from(inboxBookings)
        .where(
          and(
            eq(inboxBookings.id, id),
            eq(inboxBookings.tenantId, actor.tenantId),
          ),
        )
        .get();
      if (!b) throw new Error("Không tìm thấy lịch.");
      const order = tx
        .select()
        .from(orders)
        .where(eq(orders.id, b.orderId))
        .get()!;
      assertBranchAccess(actor, order.branchId);
      if (actor.readOnly) throw new Error("Tài khoản chỉ đọc.");
      if (b.conversationId) authorizeThread(tx, actor, b.conversationId, true);
      assertPermission(actor, "schedule.manage");
      if (input.action === "deposit") {
        assertPermission(actor, "finance.manage");
        const receiptKey = digest(
          `${actor.tenantId}:${input.reference?.trim() || input.key}`,
        );
        if (
          tx
            .select()
            .from(inboxReceipts)
            .where(eq(inboxReceipts.key, receiptKey))
            .get()
        )
          return;
        if (!["held", "confirmed"].includes(b.status))
          throw new Error("Lịch đã hết hạn hoặc kết thúc.");
        const paymentId = recordOrderPayment(tx, actor, order.id, {
          amount: input.amount ?? 0,
          reference: input.reference ?? "",
          method: "bank_transfer",
          paidAt: "",
        });
        tx.insert(inboxReceipts)
          .values({ key: receiptKey, bookingId: b.id, paymentId })
          .run();
        if (order.paid + (input.amount ?? 0) >= order.deposit)
          tx.update(inboxBookings)
            .set({ status: "confirmed" })
            .where(eq(inboxBookings.id, id))
            .run();
      } else if (input.action === "confirm") {
        if (b.status !== "held" || order.paid < order.deposit)
          throw new Error("Lịch chưa đủ cọc hoặc đã hết hạn.");
        tx.update(inboxBookings)
          .set({ status: "confirmed" })
          .where(eq(inboxBookings.id, id))
          .run();
      } else if (input.action === "cancel") {
        assertPermission(actor, "orders.manage");
        if (b.status === "completed") throw new Error("Lịch đã hoàn thành.");
        tx.update(inboxBookings)
          .set({ status: "cancelled" })
          .where(eq(inboxBookings.id, id))
          .run();
        tx.update(appointments)
          .set({
            status: "cancelled",
            cancelReason: input.reference || "Hủy từ Inbox",
          })
          .where(eq(appointments.id, b.appointmentId))
          .run();
        tx.update(orders)
          .set({
            status: "cancelled",
            cancelReason: input.reference || "Hủy từ Inbox",
          })
          .where(eq(orders.id, order.id))
          .run();
      } else if (input.action === "complete") {
        if (b.status !== "confirmed")
          throw new Error("Chỉ hoàn thành lịch đã xác nhận.");
        tx.update(inboxBookings)
          .set({ status: "completed" })
          .where(eq(inboxBookings.id, id))
          .run();
        tx.update(appointments)
          .set({ status: "completed" })
          .where(eq(appointments.id, b.appointmentId))
          .run();
      } else {
        if (!["held", "confirmed"].includes(b.status))
          throw new Error("Lịch đã hết hạn hoặc kết thúc.");
        const { service, offer } = getOffer(tx, b.serviceId);
        if (
          !availableSlots(
            tx,
            b.serviceId,
            input.date ?? "",
            b.appointmentId,
          ).includes(input.time ?? "")
        )
          throw new Error("Giờ mới không còn trống.");
        const start = new Date(`${input.date}T${input.time}:00+07:00`);
        tx.update(appointments)
          .set({
            startAt: start,
            endAt: new Date(start.getTime() + service.durationMinutes * 60000),
            bufferMinutes: offer.buffer,
          })
          .where(eq(appointments.id, b.appointmentId))
          .run();
        tx.update(orders)
          .set({ scheduledAt: start })
          .where(eq(orders.id, order.id))
          .run();
      }
      writeAudit(tx, {
        tenantId: actor.tenantId,
        actorId: actor.staffId,
        action: `booking.${input.action}`,
        entity: "appointment",
        entityId: b.appointmentId,
        metadata: {
          amount: input.amount,
          reference: input.reference,
          date: input.date,
          time: input.time,
        },
      });
    },
    { behavior: "immediate" },
  );
}
