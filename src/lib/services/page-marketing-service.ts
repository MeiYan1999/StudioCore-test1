import { and, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import type { ActorContext } from "../auth/types";
import type { AppDb } from "../db/client";
import { adsAccounts, adsPeriods, aiJobs, assistantReplies, conversations, facebookPages, facebookThreads, messages, pageAssistants, pagePosts } from "../db/schema";
import { MetaError, graph, seal, sendFacebook, unseal } from "../omnichannel/meta";
import { decryptSecret } from "../security/secret-crypto";
import { getAiHubData, updateAiHubFeature } from "./ai-hub-service";

export function ownerAccess(actor: ActorContext) {
  if (actor.role !== "owner" || actor.readOnly || actor.planLapsed) throw new Error("Chủ studio có quyền chỉnh sửa mới thực hiện được thao tác này.");
}

function studioPage(db: AppDb, actor: ActorContext, pageId: string) {
  const page = db.select().from(facebookPages).where(and(eq(facebookPages.id, pageId), eq(facebookPages.tenantId, actor.tenantId))).get();
  if (!page) throw new Error("Không tìm thấy Fanpage trong studio.");
  assertBranchAccess(actor, page.branchId);
  return page;
}

export function draftPosts(db: AppDb, actor: ActorContext, pageId: string, drafts: { content: string; publishAt: Date }[]) {
  assertPermission(actor, "customers.manage");
  studioPage(db, actor, pageId);
  const rows = z.array(z.object({ content: z.string().trim().min(1).max(10000), publishAt: z.date() })).min(1).max(50).parse(drafts);
  db.transaction(tx => {
    for (const row of rows) tx.insert(pagePosts).values({ ...row, id: crypto.randomUUID(), pageId, tenantId: actor.tenantId, createdBy: actor.staffId }).run();
  });
}

export function approvePosts(db: AppDb, actor: ActorContext, ids: string[]) {
  ownerAccess(actor);
  db.transaction(tx => {
    for (const id of new Set(ids)) {
      const row = tx.select().from(pagePosts).where(and(eq(pagePosts.id, id), eq(pagePosts.tenantId, actor.tenantId))).get();
      if (!row) throw new Error("Bài không thuộc studio.");
      const page = studioPage(db, actor, row.pageId);
      if (page.status !== "connected") throw new Error("Fanpage cần kết nối lại trước khi duyệt.");
      tx.update(pagePosts).set({ status: "scheduled", approvedBy: actor.staffId }).where(and(eq(pagePosts.id, id), eq(pagePosts.status, "draft"))).run();
    }
  }, { behavior: "immediate" });
}

export async function publishDuePosts(db: AppDb) {
  const now = new Date();
  db.update(pagePosts).set({ status: "unknown", error: "Kiểm tra bài đã xuất hiện trên Fanpage." })
    .where(and(eq(pagePosts.status, "sending"), lte(pagePosts.updatedAt, new Date(now.getTime()-300000)))).run();
  const rows = db.select().from(pagePosts).where(and(eq(pagePosts.status, "scheduled"), lte(pagePosts.publishAt, now))).orderBy(pagePosts.publishAt).limit(20).all();
  for (const post of rows) {
    if (!db.update(pagePosts).set({ status: "sending", updatedAt: now }).where(and(eq(pagePosts.id, post.id), eq(pagePosts.status, "scheduled"))).run().changes) continue;
    const page = db.select().from(facebookPages).where(and(eq(facebookPages.tenantId, post.tenantId), eq(facebookPages.id, post.pageId))).get();
    let dispatched = false;
    try {
      if (!page?.token || page.status !== "connected") throw new Error("Fanpage cần kết nối lại.");
      const token = unseal(page.token);
      dispatched = true;
      const result = await graph<{ id: string }>(page.id + "/feed", token, { message: post.content });
      if (!result.id) throw new Error("Thiếu mã bài của Meta.");
      db.update(pagePosts).set({ status: "published", remoteId: result.id, updatedAt: new Date() }).where(eq(pagePosts.id, post.id)).run();
    } catch (err) {
      db.update(pagePosts).set({ status: dispatched && !(err instanceof MetaError) ? "unknown" : "failed",
        error: err instanceof Error ? err.message : "Lỗi đăng bài.", updatedAt: new Date() }).where(eq(pagePosts.id, post.id)).run();
    }
  }
}

export async function connectAds(db: AppDb, actor: ActorContext, id: string, token: string) {
  ownerAccess(actor);
  if (!/^act_\d+$/.test(id) || !token.trim()) throw new Error("Nhập mã act_ và token có quyền ads_read.");
  const account = z.object({ id: z.literal(id), name: z.string(), currency: z.string().length(3), timezone_name: z.string().min(1) })
    .parse(await graph(id + "?fields=id,name,currency,timezone_name", token));
  const values = { tenantId: actor.tenantId, id, name: account.name, currency: account.currency, timezone: account.timezone_name, token: seal(token) };
  db.insert(adsAccounts).values(values).onConflictDoUpdate({target: [adsAccounts.tenantId, adsAccounts.id], set: values}).run();
}

const metric = z.object({ campaign_id: z.string().min(1), campaign_name: z.string(), spend: z.string().regex(/^\d+(\.\d+)?$/), impressions: z.string().regex(/^\d+$/), clicks: z.string().regex(/^\d+$/) });
export async function syncAds(db: AppDb, actor: ActorContext, id: string, since: string, until: string) {
  ownerAccess(actor);
  if (!z.iso.date().safeParse(since).success || !z.iso.date().safeParse(until).success || since > until) throw new Error("Kỳ đồng bộ không hợp lệ.");
  const account = db.select().from(adsAccounts).where(and(eq(adsAccounts.tenantId, actor.tenantId), eq(adsAccounts.id, id))).get();
  if (!account) throw new Error("Chưa kết nối tài khoản này.");
  const params = new URLSearchParams({ fields: "campaign_id,campaign_name,spend,impressions,clicks",level:"campaign",time_range: JSON.stringify({since, until}),limit:"100" });
  const rows: z.infer<typeof metric>[] = [];
  const token = unseal(account.token);
  const cursors = new Set<string>();
  for (;;) {
    const page = z.object({ data: z.array(metric), paging: z.object({ next: z.string().optional(), cursors: z.object({after: z.string().optional()}).optional() }).optional() })
      .parse(await graph(id + "/insights?" + params, token));
    rows.push(...page.data);
    if (!page.paging?.next) break;
    const after = page.paging.cursors?.after;
    if (!after || cursors.has(after)) throw new Error("Meta trả thiếu trang dữ liệu. Chưa cập nhật kỳ này.");
    cursors.add(after);
    params.set("after", after);
  }
  const values = {rows, syncedAt: new Date(), currency: account.currency, timezone: account.timezone};
  db.insert(adsPeriods).values({ ...values, id: crypto.randomUUID(), accountId: id, since, until, tenantId: actor.tenantId })
    .onConflictDoUpdate({target:[adsPeriods.tenantId,adsPeriods.accountId,adsPeriods.since,adsPeriods.until],set:values}).run();
}

export function savePageAssistant(db: AppDb, actor: ActorContext, pageId: string, name: string, knowledge: {question:string; answer:string}[], enabled: boolean) {
  ownerAccess(actor);
  studioPage(db, actor, pageId);
  const values = z.object({name:z.string().trim().min(1).max(80),knowledge:z.array(z.object({question:z.string().trim().min(2).max(300),answer:z.string().trim().min(1).max(1900)})).min(1).max(100),enabled:z.boolean()}).parse({name, knowledge, enabled});
  db.insert(pageAssistants).values({...values,tenantId:actor.tenantId,pageId}).onConflictDoUpdate({target:pageAssistants.pageId,set:values,setWhere:eq(pageAssistants.tenantId,actor.tenantId)}).run();
}

export function knowledgeReply(content: string, facts: {question:string;answer:string}[]) {
  const normalize = (v:string) => v.normalize("NFC").toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const matched = facts.filter(fact => normalize(fact.question) === normalize(content));
  return matched.length === 1 ? matched[0].answer : null;
}

export async function deliverAssistantReplies(db: AppDb) {
  const jobs = db.select().from(assistantReplies).where(eq(assistantReplies.status,"pending")).limit(30).all();
  for (const job of jobs) {
    const prepared = db.transaction(tx => {
      if (!tx.update(assistantReplies).set({status:"processing"}).where(and(eq(assistantReplies.messageId,job.messageId),eq(assistantReplies.status,"pending"))).run().changes) return;
      const row = tx.select({ thread:conversations, message:messages.content, config:pageAssistants }).from(conversations)
        .innerJoin(messages, and(eq(messages.conversationId, conversations.id),eq(messages.id,job.messageId)))
        .innerJoin(facebookThreads,eq(facebookThreads.conversationId, conversations.id))
        .innerJoin(pageAssistants,and(eq(pageAssistants.pageId,facebookThreads.pageId),eq(pageAssistants.tenantId,conversations.tenantId)))
        .where(eq(conversations.id,job.conversationId)).get();
      if (!row?.thread.aiAutoReply || row.thread.assignedTo || !row.config.enabled || !getAiHubData(db,row.thread.tenantId).features.find(f=>f.id==="messenger_assistant")?.enabled) {
        tx.update(assistantReplies).set({status:"cancelled"}).where(eq(assistantReplies.messageId,job.messageId)).run();
        return;
      }
      const reply = knowledgeReply(row.message,row.config.knowledge);
      if (!reply) {
        tx.update(conversations).set({aiAutoReply:false,status:"unanswered"}).where(eq(conversations.id,job.conversationId)).run();
        tx.update(assistantReplies).set({status:"handoff"}).where(eq(assistantReplies.messageId,job.messageId)).run();
      }
      return reply;
    }, {behavior:"immediate"});
    if (!prepared) continue;
    let status = "failed";
    try {
      const delivery = await sendFacebook(db,job.conversationId,prepared,"assistant:"+job.messageId,undefined,true);
      status = delivery?.status ?? "unknown";
    } catch { /* Leave this request visible for human follow-up. */ }
    db.update(assistantReplies).set({status}).where(eq(assistantReplies.messageId,job.messageId)).run();
  }
}

function factsForPeriod(db: AppDb, actor: ActorContext, periodId: string, campaignId: string, compareId?: string) {
  ownerAccess(actor);
  if (!getAiHubData(db,actor.tenantId).features.find(f=>f.id==="ads_analysis")?.enabled) throw new Error("Tính năng phân tích Ads đang tắt trong AI Hub.");
  const ids = [periodId, ...(compareId ? [compareId] : [])];
  const periods = db.select().from(adsPeriods).where(and(eq(adsPeriods.tenantId,actor.tenantId),inArray(adsPeriods.id,ids))).all();
  const selected = periods.find(p=>p.id===periodId);
  const previous = periods.find(p=>p.id===compareId);
  if (!selected || (compareId && (!previous || previous.id===periodId || previous.accountId!==selected.accountId || previous.currency!==selected.currency || previous.timezone!==selected.timezone))) throw new Error("Chọn hai kỳ đã đồng bộ của cùng tài khoản, tiền tệ và múi giờ.");
  const row = selected.rows.find(r=>r.campaign_id===campaignId);
  if (!row) throw new Error("Kỳ chọn chưa có dòng dữ liệu của chiến dịch.");
  const prior = previous?.rows.find(r=>r.campaign_id===campaignId);
  const note = [`Chi tiêu ${row.spend} ${selected.currency}, ${row.impressions} lượt hiển thị, ${row.clicks} lượt nhấp.`,
    Number(row.impressions) ? `CTR ${(100*Number(row.clicks)/Number(row.impressions)).toFixed(2)}%.` : "Chưa tính được CTR vì lượt hiển thị bằng 0.",
    compareId ? (!prior ? "Kỳ so sánh thiếu dòng chiến dịch." : Number(prior.spend) ? `Chi tiêu thay đổi ${(100*(Number(row.spend)/Number(prior.spend)-1)).toFixed(2)}%.` : "Chi tiêu kỳ so sánh bằng 0, chưa tính tỷ lệ thay đổi.") : ""].filter(Boolean).join(" ");
  return {note,source:{periodId,campaignId,compareId,rows:[row,prior??null],syncedAt:selected.syncedAt, currency:selected.currency,timezone:selected.timezone,
    period:[selected.since,selected.until],previousPeriod:previous?[previous.since,previous.until]:null}};

}

export function analyzeAdsPeriod(db:AppDb,actor:ActorContext,periodId:string,campaignId:string,compareId?:string) {
  const {note,source}=factsForPeriod(db,actor,periodId,campaignId,compareId);
  db.insert(aiJobs).values({id:crypto.randomUUID(),tenantId:actor.tenantId,type:"ads_analysis",provider:"local",status:"completed",
    inputRef:JSON.stringify(source),outputRef:note,estimatedCost:0,createdBy:actor.staffId}).run();
  return note;
}

// The model ranks verified observations. Rendering the numeric claims from the
// stored snapshot keeps every number tied to a campaign and a completed sync.
export async function analyzeAdsWithHub(db:AppDb,actor:ActorContext,periodId:string,campaignId:string,compareId?:string) {
  const {note,source}=factsForPeriod(db,actor,periodId,campaignId,compareId);
  const hub=getAiHubData(db,actor.tenantId);
  const config=hub.features.find(f=>f.id==="ads_analysis")!;
  if(config.usedUsd>=config.budgetUsd) throw new Error("Đã đạt ngân sách phân tích Ads trong AI Hub.");
  const key=hub.apiKeys.filter(k=>k.provider==="openrouter" && k.status==="active").sort((a,b)=>a.priority-b.priority)[0];
  const secret=key?.keyEncrypted ? decryptSecret(key.keyEncrypted) : null;
  if(!secret) throw new Error("Thêm khóa OpenRouter đang hoạt động trong AI Hub để chạy phân tích bằng mô hình.");
  const modelIds: Record<string,string>={"GPT-4o Mini (rẻ, nhanh)":"openai/gpt-4o-mini","GPT-4o (mạnh, đa năng)":"openai/gpt-4o","DeepSeek V3":"deepseek/deepseek-chat",
    "Claude 3.5 Sonnet":"anthropic/claude-3.5-sonnet","Claude 3.5 Haiku":"anthropic/claude-3.5-haiku","Gemini 1.5 Pro (mạnh)":"google/gemini-pro-1.5","Gemini 1.5 Flash (nhanh)":"google/gemini-flash-1.5","GPT-4.5 Preview":"openai/gpt-4.5-preview"};
  const model=modelIds[config.model];
  if(!model) throw new Error("Mô hình Ads trong AI Hub chưa có bộ kết nối.");
  const facts=note.split(/(?<=\.) (?=[A-ZÀ-Ỹ])/u);
  const id=crypto.randomUUID();
  db.insert(aiJobs).values({id,tenantId:actor.tenantId,type:"ads_analysis",provider:"openrouter",status:"processing",inputRef:JSON.stringify({...source,model}),createdBy:actor.staffId}).run();
  try {
    const response=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json"},
      body:JSON.stringify({model,temperature:0,max_tokens:100,messages:[{role:"system",content:"Hãy chọn các nhận xét quan trọng nhất theo thứ tự ưu tiên cho chủ studio. Chỉ trả mảng JSON số nguyên là chỉ mục của nhận xét đã cung cấp."},{role:"user",content:JSON.stringify(facts.map((fact,index)=>({index,fact})))}]}),signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw new Error("Nhà cung cấp AI trả lỗi "+response.status+".");
    const result=await response.json();
    const cost=result.usage?.cost,tokens=result.usage?.total_tokens;
    if(typeof cost!=="number"||!Number.isFinite(cost)||cost<0 || !Number.isSafeInteger(tokens)||tokens<0) throw new Error("Nhà cung cấp chưa xác nhận chi phí. Kiểm tra lịch sử OpenRouter.");
    let indices:number[]=[];
    try {indices=z.array(z.number().int().min(0).max(facts.length-1)).min(1).parse(JSON.parse(result.choices[0].message.content));} catch { /* Bill known usage even when the output is invalid. */ }
    const output=Array.from(new Set(indices)).map(i=>facts[i]).join(" ");
    db.transaction(tx=>{
      const latest=getAiHubData(tx,actor.tenantId).features.find(f=>f.id==="ads_analysis")!;
      updateAiHubFeature(tx,actor.tenantId,"ads_analysis",{callsCount:latest.callsCount+1,tokensUsed:latest.tokensUsed+tokens,usedUsd:latest.usedUsd+cost});
      tx.update(aiJobs).set({status:output?"completed":"failed",inputRef:JSON.stringify({...source,model,providerRequestId:result.id,costUsd:cost,tokens}),
        outputRef:output||"Đầu ra của mô hình không hợp lệ.",updatedAt:new Date()}).where(eq(aiJobs.id,id)).run();
    },{behavior:"immediate"});
    return output||"Mô hình trả sai định dạng. Đã ghi nhận chi phí thực tế.";
  } catch(err) {
    db.update(aiJobs).set({status:"failed",error:err instanceof Error?err.message:"Lỗi AI",updatedAt:new Date()}).where(eq(aiJobs.id,id)).run();
    throw err;
  }
}
