import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getActorContext } from "@/lib/auth/session";
import { assertPermission } from "@/lib/auth/permissions";
import {
  getDb,
  bookingLinks,
  bookingOffers,
  conversations,
  customers,
  facebookPages,
  facebookThreads,
  inboxNotes,
  inboxReplies,
  rooms,
  services,
  staff,
} from "@/lib/db/client";
import {
  authorizeThread,
  book,
  expireHolds,
  updateBooking,
} from "@/lib/omnichannel/booking";
import {
  digest,
  graph,
  metaConfig,
  sendBlockReason,
  sendFacebook,
  unseal,
} from "@/lib/omnichannel/meta";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const actor = await getActorContext();
  if (!actor)
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  try {
    assertPermission(actor, "customers.view");
    const db = getDb();
    expireHolds(db);
    const pageRows = db
      .select()
      .from(facebookPages)
      .where(eq(facebookPages.tenantId, actor.tenantId))
      .all();
    const pages = pageRows.map(({ token, ...page }) => ({
      ...page,
      hasToken: Boolean(token),
    }));
    const threads =
      db.all(sql`SELECT c.*, f.page_id, f.label, f.last_inbound_at, f.read_at, p.name AS page_name, u.name AS customer_name, u.phone,
      (SELECT content FROM messages WHERE conversation_id=c.id ORDER BY sent_at DESC LIMIT 1) AS preview
      FROM conversations c LEFT JOIN facebook_threads f ON f.conversation_id=c.id LEFT JOIN facebook_pages p ON p.id=f.page_id LEFT JOIN customers u ON u.id=c.customer_id
      WHERE c.tenant_id=${actor.tenantId} AND (${Number(actor.role === "owner")} OR c.assigned_to=${actor.staffId})
      AND c.branch_id IN (${sql.join(
        actor.branches.map((b) => sql`${b.id}`),
        sql`,`,
      )}) ORDER BY c.last_message_at DESC LIMIT 200`);
    const id = new URL(request.url).searchParams.get("id");
    let detail = null;
    if (id) {
      const conversation = authorizeThread(db, actor, id);
      const thread = db
        .select()
        .from(facebookThreads)
        .where(eq(facebookThreads.conversationId, id))
        .get();
      const page = pageRows.find((p) => p.id === thread?.pageId);
      detail = {
        conversation,
        blocked:
          page && thread
            ? sendBlockReason(page, thread.lastInboundAt)
            : "Hội thoại local chưa có kết nối gửi Messenger.",
        messages: db.all(
          sql`SELECT m.*, d.status AS delivery_status, d.error, d.attachment FROM messages m LEFT JOIN facebook_deliveries d ON d.id=m.id WHERE m.conversation_id=${id} AND m.tenant_id=${actor.tenantId} ORDER BY m.sent_at LIMIT 500`,
        ),
        notes: db.all(
          sql`SELECT n.*, s.name AS staff_name FROM inbox_notes n JOIN staff s ON s.id=n.staff_id WHERE n.conversation_id=${id} ORDER BY n.created_at DESC LIMIT 50`,
        ),
        bookings: db.all(
          sql`SELECT b.*, o.code, o.total, o.paid, o.remaining, o.deposit, o.location, s.name AS package_name, a.start_at, a.end_at FROM inbox_bookings b JOIN orders o ON o.id=b.order_id JOIN services s ON s.id=b.service_id JOIN appointments a ON a.id=b.appointment_id WHERE b.tenant_id=${actor.tenantId} AND (b.conversation_id=${id} OR (${conversation.customerId} IS NOT NULL AND o.customer_id=${conversation.customerId})) ORDER BY a.start_at DESC`,
        ),
        history: conversation.customerId
          ? db.all(
              sql`SELECT id,code,total,paid,remaining,scheduled_at,status FROM orders WHERE tenant_id=${actor.tenantId} AND customer_id=${conversation.customerId} ORDER BY created_at DESC LIMIT 30`,
            )
          : [],
      };
    }
    let readiness = "Sẵn sàng kết nối Meta";
    try {
      metaConfig();
    } catch (e) {
      readiness = (e as Error).message;
    }
    return NextResponse.json(
      {
        pages,
        threads,
        detail,
        readiness,
        owner: actor.role === "owner",
        canDeposit: actor.permissions.includes("finance.manage"),
        branches: actor.branches,
        offers: db
          .select({ offer: bookingOffers, service: services })
          .from(bookingOffers)
          .innerJoin(services, eq(services.id, bookingOffers.serviceId))
          .where(eq(bookingOffers.tenantId, actor.tenantId))
          .all(),
        services: db
          .select()
          .from(services)
          .where(eq(services.tenantId, actor.tenantId))
          .all(),
        rooms: db
          .select({ id: rooms.id, name: rooms.name, branchId: rooms.branchId })
          .from(rooms)
          .where(eq(rooms.tenantId, actor.tenantId))
          .all(),
        staff: db
          .select({ id: staff.id, name: staff.name })
          .from(staff)
          .where(
            and(eq(staff.tenantId, actor.tenantId), eq(staff.active, true)),
          )
          .all(),
        customers: db
          .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
          })
          .from(customers)
          .where(eq(customers.tenantId, actor.tenantId))
          .limit(300)
          .all(),
        replies: db
          .select()
          .from(inboxReplies)
          .where(eq(inboxReplies.tenantId, actor.tenantId))
          .all(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
const text = z.string().max(2000);
const commands = z.discriminatedUnion("action", [
  z.object({ action: z.literal("page"), id: text, connect: z.boolean() }),
  z.object({
    action: z.literal("send"),
    id: text,
    content: text,
    key: z.string().uuid(),
    attachment: z.string().url().optional(),
  }),
  z.object({ action: z.literal("read"), id: text }),
  z.object({ action: z.literal("note"), id: text, content: text.min(1) }),
  z.object({ action: z.literal("reply"), content: text.min(1) }),
  z.object({ action: z.literal("assign"), id: text, staffId: text }),
  z.object({
    action: z.literal("label"),
    id: text,
    label: z.enum(["Khách mới", "Đang tư vấn", "Chờ cọc", "Đã chốt"]),
  }),
  z.object({
    action: z.literal("status"),
    id: text,
    status: z.enum(["unanswered", "processing", "replied"]),
  }),
  z.object({ action: z.literal("linkCustomer"), id: text, customerId: text }),
  z.object({ action: z.literal("link"), id: text, serviceId: text }),
  z.object({
    action: z.literal("offer"),
    serviceId: text,
    roomId: text,
    photographerId: text,
    opens: z.number().int().min(0).max(1439),
    closes: z.number().int().min(1).max(1440),
    closedDays: z.string().regex(/^[0-6,]*$/),
    holidays: z.string().regex(/^[0-9,\-]*$/),
    buffer: z.number().int().min(0).max(240),
    holdMinutes: z.number().int().min(5).max(10080),
    deposit: z.number().int().min(0),
    active: z.number().int().min(0).max(1),
  }),
  z.object({
    action: z.literal("book"),
    id: text,
    serviceId: text,
    date: text,
    time: text,
    name: text.min(1),
    phone: text,
    notes: text,
    key: z.string().uuid(),
    surcharge: z.number().int().min(0),
    discount: z.number().int().min(0),
    deposit: z.number().int().min(0),
  }),
  z.object({
    action: z.literal("booking"),
    id: text,
    operation: z.enum([
      "deposit",
      "confirm",
      "cancel",
      "reschedule",
      "complete",
    ]),
    amount: z.number().int().min(0).optional(),
    reference: text.optional(),
    key: z.string().uuid(),
    date: text.optional(),
    time: text.optional(),
  }),
]);
export async function POST(request: Request) {
  const actor = await getActorContext();
  if (!actor)
    return NextResponse.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  if (!request.headers.get("origin") || new URL(request.headers.get("origin")!).host !== request.headers.get("host"))
    return NextResponse.json(
      { error: "Origin không hợp lệ." },
      { status: 403 },
    );
  try {
    if (actor.readOnly) throw new Error("Tài khoản chỉ đọc.");
    const input = commands.parse(await request.json());
    const db = getDb();
    if (input.action === "page") {
      if (actor.role !== "owner")
        throw new Error("Chỉ chủ studio được quản lý Fanpage.");
      const page = db
        .select()
        .from(facebookPages)
        .where(
          and(
            eq(facebookPages.id, input.id),
            eq(facebookPages.tenantId, actor.tenantId),
          ),
        )
        .get();
      if (!page) throw new Error("Không tìm thấy Fanpage.");
      if (input.connect) {
        if (!page.token) throw new Error("Cần đăng nhập lại Facebook.");
        await graph(`${page.id}/subscribed_apps`, unseal(page.token), {
          subscribed_fields:
            "messages,messaging_postbacks,message_echoes,message_deliveries,message_reads",
        });
        db.update(facebookPages)
          .set({ status: "connected" })
          .where(eq(facebookPages.id, page.id))
          .run();
      } else {
        if (page.token) {
          try {
            await graph(
              `${page.id}/subscribed_apps`,
              unseal(page.token),
              undefined,
              "DELETE",
            );
          } catch {
            /* Local disconnection still immediately revokes app access to this page token. */
          }
        }
        db.update(facebookPages)
          .set({ token: null, status: "disconnected" })
          .where(eq(facebookPages.id, page.id))
          .run();
      }
      writeAudit(db, {
        tenantId: actor.tenantId,
        actorId: actor.staffId,
        action: input.connect ? "facebook.connect" : "facebook.disconnect",
        entity: "facebook_page",
        entityId: page.id,
      });
    } else if (input.action === "offer") {
      if (actor.role !== "owner")
        throw new Error("Chỉ chủ studio được cấu hình lịch.");
      const service = db
        .select()
        .from(services)
        .where(
          and(
            eq(services.id, input.serviceId),
            eq(services.tenantId, actor.tenantId),
          ),
        )
        .get();
      if (
        !service ||
        input.opens >= input.closes ||
        input.deposit > service.price
      )
        throw new Error("Cấu hình gói hoặc giờ làm không hợp lệ.");
      if (!input.roomId && !input.photographerId)
        throw new Error(
          "Chọn ít nhất phòng hoặc photographer để giữ tài nguyên.",
        );
      if (
        input.roomId &&
        !db
          .select()
          .from(rooms)
          .where(
            and(
              eq(rooms.id, input.roomId),
              eq(rooms.tenantId, actor.tenantId),
              eq(rooms.branchId, service.branchId),
            ),
          )
          .get()
      )
        throw new Error("Phòng không thuộc chi nhánh.");
      if (
        input.photographerId &&
        !db.get(
          sql`SELECT s.id FROM staff s JOIN staff_branches b ON b.staff_id=s.id WHERE s.id=${input.photographerId} AND s.tenant_id=${actor.tenantId} AND b.branch_id=${service.branchId} AND s.active=1`,
        )
      )
        throw new Error("Photographer không thuộc chi nhánh.");
      const data = input;
      const values = {
        ...data,
        roomId: data.roomId || null,
        photographerId: data.photographerId || null,
        tenantId: actor.tenantId,
        createdBy: actor.staffId,
      };
      db.insert(bookingOffers)
        .values(values)
        .onConflictDoUpdate({ target: bookingOffers.serviceId, set: values })
        .run();
      writeAudit(db, {
        tenantId: actor.tenantId,
        actorId: actor.staffId,
        action: "booking.configure",
        entity: "service",
        entityId: service.id,
      });
    } else if (input.action === "reply") {
      assertPermission(actor, "customers.manage");
      db.insert(inboxReplies)
        .values({
          id: crypto.randomUUID(),
          tenantId: actor.tenantId,
          content: input.content,
        })
        .run();
    } else if (input.action === "booking") {
      updateBooking(db, actor, input.id, { ...input, action: input.operation });
    } else {
      const conversation = authorizeThread(db, actor, input.id, true);
      if (input.action === "send")
        return NextResponse.json(
          await sendFacebook(
            db,
            input.id,
            input.content,
            input.key,
            input.attachment,
          ),
        );
      if (input.action === "read")
        db.update(facebookThreads)
          .set({ readAt: Date.now() })
          .where(eq(facebookThreads.conversationId, input.id))
          .run();
      if (input.action === "note")
        db.insert(inboxNotes)
          .values({
            id: crypto.randomUUID(),
            conversationId: input.id,
            staffId: actor.staffId,
            content: input.content,
            createdAt: Date.now(),
          })
          .run();
      if (input.action === "label")
        db.update(facebookThreads)
          .set({ label: input.label })
          .where(eq(facebookThreads.conversationId, input.id))
          .run();
      if (input.action === "status")
        db.update(conversations)
          .set({ status: input.status })
          .where(eq(conversations.id, input.id))
          .run();
      if (input.action === "assign") {
        if (actor.role !== "owner")
          throw new Error("Chủ studio thực hiện phân công.");
        if (
          !db.get(
            sql`SELECT s.id FROM staff s JOIN staff_branches b ON b.staff_id=s.id WHERE s.id=${input.staffId} AND s.tenant_id=${actor.tenantId} AND b.branch_id=${conversation.branchId} AND s.active=1`,
          )
        )
          throw new Error("Nhân sự không thuộc chi nhánh.");
        db.update(conversations)
          .set({ assignedTo: input.staffId })
          .where(eq(conversations.id, input.id))
          .run();
      }
      if (input.action === "linkCustomer") {
        const c = db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.id, input.customerId),
              eq(customers.tenantId, actor.tenantId),
              eq(customers.branchId, conversation.branchId),
            ),
          )
          .get();
        if (!c) throw new Error("Khách không thuộc chi nhánh.");
        db.update(conversations)
          .set({ customerId: c.id })
          .where(eq(conversations.id, input.id))
          .run();
      }
      if (input.action === "link") {
        const offer = db
          .select({ id: services.id })
          .from(bookingOffers)
          .innerJoin(services, eq(services.id, bookingOffers.serviceId))
          .where(
            and(
              eq(bookingOffers.serviceId, input.serviceId),
              eq(bookingOffers.tenantId, actor.tenantId),
              eq(services.branchId, conversation.branchId),
              eq(bookingOffers.active, 1),
            ),
          )
          .get();
        if (!offer) throw new Error("Gói chưa mở đặt lịch tại chi nhánh này.");
        if (
          !db
            .select()
            .from(facebookThreads)
            .where(eq(facebookThreads.conversationId, input.id))
            .get()
        )
          throw new Error("Chọn hội thoại Facebook.");
        const token = randomBytes(32).toString("hex");
        db.insert(bookingLinks)
          .values({
            tokenHash: digest(token),
            conversationId: input.id,
            serviceId: input.serviceId,
            expiresAt: Date.now() + 86400000,
          })
          .run();
        return NextResponse.json({
          url: `${process.env.APP_URL || new URL(request.url).origin}/book/${input.serviceId}?token=${token}`,
        });
      }
      if (input.action === "book")
        return NextResponse.json(
          book(db, { ...input, conversationId: input.id }, actor),
        );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
