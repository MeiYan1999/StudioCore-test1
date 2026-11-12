import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { createTestDb } from "../helpers/test-db";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import {
  appointments,
  bookingOffers,
  conversations,
  facebookPages,
  facebookThreads,
  inboxBookings,
  messages,
  orders,
  services,
} from "@/lib/db/schema";
import {
  availableSlots,
  authorizeThread,
  book,
  expireHolds,
  updateBooking,
} from "@/lib/omnichannel/booking";
import {
  ingestWebhook,
  seal,
  sendFacebook,
  unseal,
  validSignature,
} from "@/lib/omnichannel/meta";
let db: ReturnType<typeof createTestDb>;
let owner: ActorContext;
let serviceId: string;
let date: string;
beforeAll(async () => {
  db = createTestDb();
  const login = await authenticate(
    db,
    {
      mode: "password",
      identifier: "owner@studiocore.demo",
      secret: "Demo@123",
    },
    { ip: "192.0.2.90", userAgent: "omni-test" },
  );
  if (!login.ok) throw new Error("Login failed");
  owner = (await getActorFromToken(db, login.token))!;
  const service = db
    .select()
    .from(services)
    .where(eq(services.tenantId, owner.tenantId))
    .get()!;
  serviceId = service.id;
  const room = db.get<{ id: string }>(
    sql`SELECT id FROM rooms WHERE branch_id=${service.branchId} LIMIT 1`,
  )!;
  db.insert(bookingOffers)
    .values({
      serviceId,
      tenantId: owner.tenantId,
      roomId: room.id,
      opens: 480,
      closes: 1380,
      closedDays: "",
      createdBy: owner.staffId,
      deposit: 100000,
      holdMinutes: 30,
    })
    .run();
  date = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  process.env.META_APP_ID = "test";
  process.env.META_APP_SECRET = "secret";
  process.env.META_GRAPH_VERSION = "v25.0";
  process.env.META_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.META_VERIFY_TOKEN = "verify";
  process.env.META_REDIRECT_URI = "https://example.test/api/facebook/callback";
  db.insert(facebookPages)
    .values({
      id: "page-test",
      tenantId: owner.tenantId,
      branchId: service.branchId,
      name: "Test page",
      token: seal("secret-token"),
      status: "connected",
    })
    .run();
});
describe("Facebook → booking → deposit", () => {
  it("encrypts tokens and verifies raw webhook signature", () => {
    expect(unseal(seal("abc"))).toBe("abc");
    const body = Buffer.from('{"object":"page"}');
    const sig =
      "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
    expect(validSignature(body, sig, "secret")).toBe(true);
    expect(validSignature(Buffer.from("{}"), sig, "secret")).toBe(false);
  });
  it("deduplicates and preserves last inbound time on out-of-order and echo events", () => {
    const now = Date.now();
    const event = (mid: string, time: number, echo = false) => ({
      object: "page",
      entry: [
        {
          id: "page-test",
          messaging: [
            {
              sender: { id: echo ? "page-test" : "psid" },
              recipient: { id: echo ? "psid" : "page-test" },
              timestamp: time,
              message: { mid, text: "Hi", is_echo: echo },
            },
          ],
        },
      ],
    });
    ingestWebhook(db, event("m1", now));
    ingestWebhook(db, event("m1", now));
    ingestWebhook(db, event("m0", now - 1000));
    ingestWebhook(db, event("echo", now + 1, true));
    const thread = db.select().from(facebookThreads).get()!;
    expect(thread.lastInboundAt).toBe(now);
    expect(
      db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, thread.conversationId))
        .all(),
    ).toHaveLength(3);
    expect(() =>
      authorizeThread(
        db,
        { ...owner, role: "receptionist", staffId: "not-assigned" },
        thread.conversationId,
      ),
    ).toThrow();
    expect(() =>
      authorizeThread(
        db,
        { ...owner, tenantId: "other" },
        thread.conversationId,
      ),
    ).toThrow();
  });
  it("reserves once, blocks competing requests and the original calendar, confirms deposit idempotently", () => {
    const time = availableSlots(db, serviceId, date)[0];
    const input = {
      serviceId,
      date,
      time,
      name: "Booking Test",
      phone: "0901234567",
      key: crypto.randomUUID(),
    };
    const first = book(db, input);
    expect(book(db, input).id).toBe(first.id);
    expect(() =>
      book(db, { ...input, key: crypto.randomUUID(), phone: "0907654321" }),
    ).toThrow();
    const b = db
      .select()
      .from(inboxBookings)
      .where(eq(inboxBookings.id, first.id))
      .get()!;
    const a = db
      .select()
      .from(appointments)
      .where(eq(appointments.id, b.appointmentId))
      .get()!;
    expect(() =>
      db
        .insert(appointments)
        .values({
          ...a,
          id: crypto.randomUUID(),
          idempotencyKey: crypto.randomUUID(),
        })
        .run(),
    ).toThrow();
    const payment = {
      action: "deposit" as const,
      amount: 100000,
      key: crypto.randomUUID(),
      reference: "TEST-BANK",
    };
    expect(() =>
      updateBooking(
        db,
        {
          ...owner,
          permissions: owner.permissions.filter((p) => p !== "finance.manage"),
        },
        b.id,
        payment,
      ),
    ).toThrow();
    updateBooking(db, owner, b.id, payment);
    updateBooking(db, owner, b.id, payment);
    expect(
      db.select().from(orders).where(eq(orders.id, b.orderId)).get()?.paid,
    ).toBe(100000);
    expect(
      db.select().from(inboxBookings).where(eq(inboxBookings.id, b.id)).get()
        ?.status,
    ).toBe("confirmed");
    updateBooking(db, owner, b.id, {
      action: "cancel",
      key: crypto.randomUUID(),
    });
    expect(availableSlots(db, serviceId, date)).toContain(time);
  });
  it("expires holds and frees the slot", () => {
    const time = availableSlots(db, serviceId, date)[0];
    const b = book(db, {
      serviceId,
      date,
      time,
      name: "Expiry",
      phone: "0901234567",
      key: crypto.randomUUID(),
    });
    db.update(inboxBookings)
      .set({ expiresAt: Date.now() - 1 })
      .where(eq(inboxBookings.id, b.id))
      .run();
    expireHolds(db);
    expect(availableSlots(db, serviceId, date)).toContain(time);
    expect(() =>
      updateBooking(db, owner, b.id, {
        action: "confirm",
        key: crypto.randomUUID(),
      }),
    ).toThrow();
  });
  it("persists Meta failures, flags lost page permission and blocks sends outside 24h", async () => {
    const t = db.select().from(facebookThreads).get()!;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 190, message: "Token expired" } }),
          { status: 400 },
        ),
      );
    const result = await sendFacebook(
      db,
      t.conversationId,
      "Hello",
      crypto.randomUUID(),
    );
    expect(result?.status).toBe("failed");
    expect(db.select().from(facebookPages).get()?.status).toBe("reauth");
    fetchMock.mockRestore();
    db.update(facebookPages).set({ status: "connected" }).run();
    db.update(facebookThreads)
      .set({ lastInboundAt: Date.now() - 86400001 })
      .run();
    await expect(
      sendFacebook(db, t.conversationId, "No", crypto.randomUUID()),
    ).rejects.toThrow("24 giờ");
  });
});
