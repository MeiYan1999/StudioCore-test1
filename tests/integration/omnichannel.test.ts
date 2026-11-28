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
  assistantReplies,
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
  metaConfig,
  refreshProfiles,
  seal,
  sendFacebook,
  unseal,
  validSignature,
} from "@/lib/omnichannel/meta";
import { addAiHubApiKey, getAiHubData, updateAiHubFeature } from "@/lib/services/ai-hub-service";
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
  it("stores the customer's Messenger name and avatar and schedules a refresh for stale profiles", async () => {
    db.update(facebookPages).set({ status: "connected" }).run();
    const page = db.select().from(facebookPages).get()!;
    const stale = ingestWebhook(db, {
      object: "page",
      entry: [
        {
          id: page.id,
          messaging: [
            {
              sender: { id: "psid-profile" },
              timestamp: Date.now(),
              message: { mid: "mid-profile", text: "Chào studio" },
            },
          ],
        },
      ],
    });
    expect(stale).toHaveLength(1);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          first_name: "Lan",
          last_name: "Nguyễn",
          profile_pic: "https://cdn.example/lan.jpg",
        }),
      ),
    );
    await refreshProfiles(db, stale);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "psid-profile?fields=first_name%2Clast_name%2Cprofile_pic",
    );
    fetchMock.mockRestore();
    const thread = db
      .select()
      .from(facebookThreads)
      .where(eq(facebookThreads.conversationId, stale[0]))
      .get()!;
    expect(thread.avatar).toBe("https://cdn.example/lan.jpg");
    expect(
      db
        .select()
        .from(conversations)
        .where(eq(conversations.id, stale[0]))
        .get()?.subject,
    ).toBe("Nguyễn Lan");
    expect(
      ingestWebhook(db, {
        object: "page",
        entry: [
          {
            id: page.id,
            messaging: [
              {
                sender: { id: "psid-profile" },
                timestamp: Date.now(),
                message: { mid: "mid-profile-2", text: "Còn lịch không ạ" },
              },
            ],
          },
        ],
      }),
    ).toEqual([]);
  });
  it("derives the callback URL and token key when only the Meta app values are set", () => {
    const saved = { ...process.env };
    delete process.env.META_REDIRECT_URI;
    delete process.env.META_TOKEN_KEY;
    process.env.APP_URL = "https://studio.example/";
    process.env.AUTH_SECRET = "auth-secret-for-test";
    const config = metaConfig();
    expect(config.redirect).toBe(
      "https://studio.example/api/facebook/callback",
    );
    expect(config.key).toHaveLength(32);
    expect(unseal(seal("page-token"))).toBe("page-token");
    process.env = saved;
  });
});

describe("Fanpage et Ads sandbox", () => {
  it("duyệt nhiều bài, worker mất phản hồi không đăng lại", async () => {
    const {draftPosts,approvePosts,publishDuePosts}=await import("@/lib/services/page-marketing-service");
    const {pagePosts}=await import("@/lib/db/schema");
    db.update(facebookPages).set({status:"connected",token:seal("fake")}).where(eq(facebookPages.id,"page-test")).run();
    draftPosts(db,owner,"page-test",["bài một","bài hai"].map(content=>({content,publishAt:new Date(0)})));
    const ids=db.select().from(pagePosts).all().map(p=>p.id);
    expect(()=>approvePosts(db,{...owner,role:"receptionist"},ids)).toThrow();
    approvePosts(db,owner,ids);
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(Response.json({id:"meta-post"})).mockRejectedValueOnce(new Error("timeout"));
    try {
      await publishDuePosts(db);await publishDuePosts(db);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(db.select().from(pagePosts).all().map(p=>p.status).sort()).toEqual(["published","unknown"]);
    } finally {fetchMock.mockRestore();}
  });
  it("Ads conserve le zéro, la devise, le fuseau et la trace de comparaison", async()=>{
    const {connectAds,syncAds,analyzeAdsPeriod}=await import("@/lib/services/page-marketing-service");
    const {adsPeriods,aiJobs}=await import("@/lib/db/schema");
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(Response.json({id:"act_22",name:"Studio",currency:"USD",timezone_name:"America/New_York"}));
    try {
      await connectAds(db,owner,"act_22","token-test");
      expect(db.select().from(adsPeriods).all()).toHaveLength(0);
      for(const [month,spend] of [["01","0"],["02","12.50"]]){
        fetchMock.mockResolvedValueOnce(Response.json({data:[{campaign_id:"44",campaign_name:"Cưới",spend,impressions:"100",clicks:"5"}]}));
        await syncAds(db,owner,"act_22","2026-"+month+"-01","2026-"+month+"-28");
      }
      const [previous,current]=db.select().from(adsPeriods).orderBy(adsPeriods.since).all();
      expect(current).toMatchObject({currency:"USD",timezone:"America/New_York"});
      expect(analyzeAdsPeriod(db,owner,current.id,"44",previous.id)).toMatch(/12.50 USD.*5.00%.*bằng 0/);
      expect(()=>analyzeAdsPeriod(db,{...owner,tenantId:"test-other"},current.id,"44")).toThrow();
      expect(db.select().from(aiJobs).all().find(j=>j.inputRef?.includes(current.id))).toMatchObject({tenantId:owner.tenantId,estimatedCost:0});
    } finally { fetchMock.mockRestore(); }
  });
  it("trả lời từ kiến thức của trang, bàn giao và webhook lặp đều không gửi thêm",async()=>{
    const {savePageAssistant,deliverAssistantReplies}=await import("@/lib/services/page-marketing-service");
    const {assistantReplies}=await import("@/lib/db/schema");
    savePageAssistant(db,owner,"page-test","Lễ tân",[{question:"Địa chỉ?",answer:"Số 12, đường Hoa."}],true);
    const inbound=(psid:string,text:string,mid:string)=>ingestWebhook(db,{object:"page",entry:[{id:"page-test",messaging:[{sender:{id:psid},timestamp:Date.now(),message:{mid,text}}]}]});
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue(Response.json({message_id:"reply-known"}));
    try {
      inbound("qa-known","Địa chỉ?","qa-1");inbound("qa-known","Địa chỉ?","qa-1");
      inbound("qa-unknown","Còn váy tím?","qa-2");inbound("qa-handoff","Địa chỉ?","qa-3");
      const handed=db.select().from(facebookThreads).where(eq(facebookThreads.psid,"qa-handoff")).get()!;
      db.update(conversations).set({assignedTo:owner.staffId,aiAutoReply:false}).where(eq(conversations.id,handed.conversationId)).run();
      await deliverAssistantReplies(db);await deliverAssistantReplies(db);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1]?.body).toContain("Số 12, đường Hoa.");
      expect(db.select().from(assistantReplies).all().map(r=>r.status).sort()).toEqual(["cancelled","handoff","sent"]);
    } finally {fetchMock.mockRestore();}
  });
  describe("AI Hub", () => {
    const openRouter=(content:string,usage:object|null={cost:0.0002,total_tokens:120})=>Response.json({id:"gen-1",choices:[{message:{content}}],...(usage?{usage}:{})});
    const feature=(id:"messenger_assistant"|"social_content")=>getAiHubData(db,owner.tenantId).features.find(f=>f.id===id)!;
    const inbound=(psid:string,text:string,mid:string)=>ingestWebhook(db,{object:"page",entry:[{id:"page-test",messaging:[{sender:{id:psid},timestamp:Date.now(),message:{mid,text}}]}]});
    const job=(psid:string)=>db.select().from(assistantReplies).where(eq(assistantReplies.conversationId,db.select().from(facebookThreads).where(eq(facebookThreads.psid,psid)).get()!.conversationId)).get()!;
    beforeAll(async()=>{
      const {savePageAssistant}=await import("@/lib/services/page-marketing-service");
      savePageAssistant(db,owner,"page-test","Lễ tân",[{question:"Địa chỉ?",answer:"Số 12, đường Hoa."}],true);
      addAiHubApiKey(db,owner.tenantId,{name:"Test",provider:"openrouter",apiKey:"sk-or-test-key"});
    });
    it("câu hỏi diễn đạt khác được mô hình chọn đúng câu trả lời đã duyệt",async()=>{
      const {deliverAssistantReplies}=await import("@/lib/services/page-marketing-service");
      const before=feature("messenger_assistant");
      const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(openRouter('{"index":0}')).mockResolvedValueOnce(Response.json({message_id:"reply-model"}));
      try {
        inbound("ai-para","Studio nằm ở đâu vậy?","ai-1");
        await deliverAssistantReplies(db);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(String(fetchMock.mock.calls[0][0])).toContain("openrouter.ai");
        expect(fetchMock.mock.calls[0][1]?.body).not.toContain("Số 12, đường Hoa.");
        expect(fetchMock.mock.calls[1][1]?.body).toContain("Số 12, đường Hoa.");
        expect(job("ai-para").status).toBe("sent");
        const after=feature("messenger_assistant");
        expect(after.usedUsd-before.usedUsd).toBeCloseTo(0.0002,10);
        expect(after.tokensUsed-before.tokensUsed).toBe(120);
        expect(after.callsCount-before.callsCount).toBe(1);
      } finally {fetchMock.mockRestore();}
    });
    it("mô hình không chắc thì bàn giao nhân viên và vẫn ghi chi phí",async()=>{
      const {deliverAssistantReplies}=await import("@/lib/services/page-marketing-service");
      const before=feature("messenger_assistant");
      const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(openRouter('{"index":null}'));
      try {
        inbound("ai-none","Còn váy cưới màu tím không?","ai-2");
        await deliverAssistantReplies(db);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(job("ai-none").status).toBe("handoff");
        const thread=db.select().from(facebookThreads).where(eq(facebookThreads.psid,"ai-none")).get()!;
        expect(db.select().from(conversations).where(eq(conversations.id,thread.conversationId)).get()!.aiAutoReply).toBe(false);
        expect(feature("messenger_assistant").callsCount-before.callsCount).toBe(1);
      } finally {fetchMock.mockRestore();}
    });
    it("nhân viên tiếp quản trong lúc gọi mô hình thì không gửi tin",async()=>{
      const {deliverAssistantReplies}=await import("@/lib/services/page-marketing-service");
      const fetchMock=vi.spyOn(globalThis,"fetch").mockImplementationOnce(async()=>{
        const thread=db.select().from(facebookThreads).where(eq(facebookThreads.psid,"ai-take")).get()!;
        db.update(conversations).set({assignedTo:owner.staffId,aiAutoReply:false}).where(eq(conversations.id,thread.conversationId)).run();
        return openRouter('{"index":0}');
      });
      try {
        inbound("ai-take","Studio ở chỗ nào?","ai-3");
        await deliverAssistantReplies(db);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(job("ai-take").status).toBe("cancelled");
      } finally {fetchMock.mockRestore();}
    });
    it("phản hồi mô hình thiếu chi phí thì bàn giao và không đổi bộ đếm",async()=>{
      const {deliverAssistantReplies}=await import("@/lib/services/page-marketing-service");
      const before=feature("messenger_assistant");
      const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(openRouter('{"index":0}',null));
      try {
        inbound("ai-nocost","Cho hỏi studio ở đâu?","ai-4");
        await deliverAssistantReplies(db);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(job("ai-nocost").status).toBe("handoff");
        expect(feature("messenger_assistant")).toMatchObject({usedUsd:before.usedUsd,tokensUsed:before.tokensUsed,callsCount:before.callsCount});
      } finally {fetchMock.mockRestore();}
    });
    it("viết bài bằng AI Hub tạo bản nháp, ghi chi phí và chặn người không đủ quyền",async()=>{
      const {writePostDraft}=await import("@/lib/services/page-marketing-service");
      const {aiJobs,pagePosts}=await import("@/lib/db/schema");
      const posts=()=>db.select().from(pagePosts).all().length;
      const before=feature("social_content");
      const count=posts();
      const fetchMock=vi.spyOn(globalThis,"fetch");
      try {
        fetchMock.mockResolvedValueOnce(openRouter("Ưu đãi chụp ảnh cưới tháng 12."));
        await expect(writePostDraft(db,owner,"page-test","Giới thiệu gói chụp ảnh cưới",new Date(Date.now()+86400000))).resolves.toContain("0.0002 USD");
        const post=db.select().from(pagePosts).all().find(p=>p.content==="Ưu đãi chụp ảnh cưới tháng 12.")!;
        expect(posts()).toBe(count+1);
        expect(post.status).toBe("draft");
        const written=db.select().from(aiJobs).all().find(j=>j.type==="post_writing")!;
        expect(written.status).toBe("completed");
        expect(JSON.parse(written.inputRef!)).toMatchObject({postId:post.id,costUsd:0.0002,tokens:120});
        expect(feature("social_content").callsCount-before.callsCount).toBe(1);
        fetchMock.mockClear();
        await expect(writePostDraft(db,{...owner,permissions:[]},"page-test","Giới thiệu gói chụp ảnh cưới",new Date())).rejects.toThrow();
        await expect(writePostDraft(db,{...owner,tenantId:"test-other"},"page-test","Giới thiệu gói chụp ảnh cưới",new Date())).rejects.toThrow();
        updateAiHubFeature(db,owner.tenantId,"social_content",{enabled:false});
        await expect(writePostDraft(db,owner,"page-test","Giới thiệu gói chụp ảnh cưới",new Date())).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(posts()).toBe(count+1);
      } finally {fetchMock.mockRestore();updateAiHubFeature(db,owner.tenantId,"social_content",{enabled:true});}
    });
  });
});
