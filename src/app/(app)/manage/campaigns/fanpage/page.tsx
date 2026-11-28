import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { adsAccounts, adsPeriods, aiJobs, facebookPages, pageAssistants, pagePosts } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { formatDateTime } from "@/lib/utils";
import { marketingForm } from "./actions";

const labels: Record<string,string> = { draft:"Nháp", scheduled:"Đã duyệt", sending:"Đang đăng", published:"Đã đăng", failed:"Lỗi", unknown:"Cần đối chiếu trên Fanpage" };
export default async function Page({searchParams}:{searchParams:Promise<{result?:string}>}) {
  const actor=await requireActor();
  if(!hasPermission(actor.permissions,"customers.manage")) return <ForbiddenState/>;
  const db=getDb();
  const owner=actor.role==="owner";
  const pages=db.select({id:facebookPages.id,name:facebookPages.name}).from(facebookPages).where(and(eq(facebookPages.tenantId,actor.tenantId), inArray(facebookPages.branchId,actor.activeBranchId?[actor.activeBranchId]:actor.branches.map(b=>b.id)))).all();
  const pageIds=pages.map(p=>p.id);
  const posts=db.select().from(pagePosts).where(and(eq(pagePosts.tenantId,actor.tenantId),inArray(pagePosts.pageId,pageIds))).orderBy(desc(pagePosts.publishAt)).limit(100).all();
  const agents=db.select().from(pageAssistants).where(and(eq(pageAssistants.tenantId,actor.tenantId),inArray(pageAssistants.pageId,pageIds))).all();
  const accounts=owner?db.select({id:adsAccounts.id,name:adsAccounts.name,currency:adsAccounts.currency,timezone:adsAccounts.timezone}).from(adsAccounts).where(eq(adsAccounts.tenantId,actor.tenantId)).all():[];
  const periods=owner?db.select().from(adsPeriods).where(eq(adsPeriods.tenantId,actor.tenantId)).orderBy(desc(adsPeriods.syncedAt)).limit(100).all():[];
  const history=owner?db.select().from(aiJobs).where(and(eq(aiJobs.tenantId,actor.tenantId),eq(aiJobs.type,"ads_analysis"))).orderBy(desc(aiJobs.createdAt)).limit(20).all():[];
  const writing=db.select().from(aiJobs).where(and(eq(aiJobs.tenantId,actor.tenantId),eq(aiJobs.type,"post_writing"))).orderBy(desc(aiJobs.createdAt)).limit(20).all();
  const result=(await searchParams).result;
  const panel="space-y-3 rounded-xl border bg-card p-4";
  return <main className="mx-auto max-w-4xl space-y-5"><Link href="/manage/campaigns">← Chiến dịch</Link><h1 className="text-2xl font-bold">Fanpage và quảng cáo</h1>
    {result && <p role="status" className={panel}>{result}</p>}
    <section className={panel}><h2 className="font-semibold">Lịch đăng Fanpage</h2>
    {owner && <Link href="/api/facebook/oauth?publish=1">Kết nối trang với quyền đăng bài</Link>}
    {pages.length>0 && <form action={marketingForm} className="space-y-2"><input type="hidden" name="action" value="draft"/><label>Fanpage<Select name="page">{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></label>
    <label>Bài đăng theo giờ Việt Nam, mỗi bài một dòng<textarea name="batch" className="block min-h-20 w-full rounded border p-2" required placeholder="2026-12-20T09:00 | Nội dung bài đăng"/></label><Button type="submit">Lưu bản nháp</Button></form>}
    {pages.length>0 && <form action={marketingForm} className="space-y-2"><input type="hidden" name="action" value="write"/><label>Fanpage<Select name="page">{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</Select></label>
    <label>Giờ đăng<Input name="publishAt" type="datetime-local" required/></label>
    <label>Yêu cầu nội dung<textarea name="brief" className="block min-h-20 w-full rounded border p-2" required minLength={5} maxLength={1000}/></label><Button type="submit">Viết nháp bằng AI Hub</Button></form>}
    <form action={marketingForm}><input type="hidden" name="action" value="approve"/>{posts.map(p=><label key={p.id} className="block border-t py-2">{owner && p.status==="draft" && <input type="checkbox" name="post" value={p.id}/>} {p.content} · {pages.find(page=>page.id===p.pageId)?.name} · {formatDateTime(p.publishAt)} · {labels[p.status]} {p.remoteId} {p.error}</label>)}
    {owner && posts.some(p=>p.status==="draft") && <Button type="submit">Duyệt bài đã chọn</Button>}</form>
    {writing.map(job=>{const info=JSON.parse(job.inputRef??"{}");return <p key={job.id} className="border-t py-2 text-sm">{formatDateTime(job.createdAt)} · Viết bài AI Hub · {job.status} · {info.model??"Chưa có mô hình"} · {info.costUsd??"Chưa xác nhận"}{info.costUsd!==undefined&&" USD"} {job.error}</p>})}</section>
    {owner && pages.map(p=>{const agent=agents.find(a=>a.pageId===p.id);return <section className={panel} key={p.id}><h2 className="font-semibold">Trợ lý Messenger · {p.name}</h2>
      <form action={marketingForm} className="space-y-2"><input type="hidden" name="page" value={p.id}/><input type="hidden" name="action" value="assistant"/>
      <label>Tên nhân viên<Input name="name" defaultValue={agent?.name} required/></label><label>Kiến thức đã duyệt, mỗi dòng một câu hỏi | trả lời<textarea name="knowledge" className="block w-full rounded border p-2" required defaultValue={agent?.knowledge.map(k=>k.question+" | "+k.answer).join("\n")}/></label>
      <label className="block"><input type="checkbox" name="enabled" defaultChecked={agent?.enabled}/> Bật trả lời cho hội thoại mới</label><Button type="submit">Lưu trợ lý</Button></form>
      <form action={marketingForm}><input type="hidden" name="page" value={p.id}/><input type="hidden" name="action" value="preview"/><label>Câu hỏi chạy thử<Input name="question" required/></label><Button type="submit" variant="outline">Thử câu trả lời</Button></form></section>})}
    {owner && <section className={panel}><h2 className="font-semibold">Tài khoản Meta Ads</h2><form action={marketingForm} className="space-y-2"><input type="hidden" name="action" value="account"/><label>Mã tài khoản<Input name="account" placeholder="act_…" required/></label><label>Token có quyền ads_read<Input type="password" name="token" autoComplete="off" required/></label><Button type="submit">Kết nối tài khoản</Button></form>
    {accounts.length>0 && <form action={marketingForm}><input type="hidden" name="action" value="sync"/><label>Tài khoản<Select name="account">{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.id} · {a.currency} · {a.timezone}</option>)}</Select></label><label>Từ ngày<Input name="since" type="date" required/></label><label>Đến ngày<Input name="until" type="date" required/></label><Button type="submit">Đồng bộ kỳ</Button></form>}
    {!periods.length && <p>Chưa có kỳ đã đồng bộ.</p>}
    {periods.map(p=><article key={p.id} className="border-t py-3"><h3>{p.accountId} · {p.since} – {p.until}</h3><p>Cập nhật {formatDateTime(p.syncedAt)} · {p.currency} · {p.timezone}</p>
      {!p.rows.length && <p>Đã đồng bộ · Tổng chi tiêu 0 {p.currency}</p>}
      {p.rows.map(r=><p key={r.campaign_id}>{r.campaign_name} ({r.campaign_id}) · {r.spend} {p.currency} · {r.impressions} lượt hiển thị · {r.clicks} lượt nhấp</p>)}
      {!!p.rows.length && <form action={marketingForm}><input type="hidden" name="period" value={p.id}/>
      <label>Chiến dịch<Select name="campaign">{p.rows.map(r=><option key={r.campaign_id} value={r.campaign_id}>{r.campaign_name}</option>)}</Select></label>
      <label>Kỳ so sánh<Select name="compare"><option value="">Chỉ xem kỳ này</option>{periods.filter(o=>o.accountId===p.accountId&&o.id!==p.id).map(o=><option key={o.id} value={o.id}>{o.since} – {o.until}</option>)}</Select></label>
      <Button type="submit" name="action" value="analyze" variant="outline">Phân tích theo số liệu</Button> <Button type="submit" name="action" value="model">Phân tích bằng AI Hub · OpenRouter</Button></form>}</article>)}
      {history.map(job=><details key={job.id}><summary>{formatDateTime(job.createdAt)} · {job.provider==="local"?"Phân tích tại studio · Chi phí 0đ":"AI Hub · "+job.status+" · "+(JSON.parse(job.inputRef??"{}").costUsd??"Chưa xác nhận")+" USD"}</summary><p>{job.outputRef||job.error}</p><pre className="overflow-auto text-xs">{job.inputRef}</pre></details>)}</section>}
    </main>;
}
