import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Megaphone } from "lucide-react";
import { requireActor } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getDb } from "@/lib/db/client";
import { adsAccounts, adsPeriods, aiJobs, facebookPages, pageAssistants, pagePosts } from "@/lib/db/schema";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { PageHeader } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { formatDateTime } from "@/lib/utils";
import { marketingForm } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fanpage và quảng cáo" };

const POST_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Nháp", tone: "neutral" },
  scheduled: { label: "Đã duyệt", tone: "info" },
  sending: { label: "Đang đăng", tone: "warning" },
  published: { label: "Đã đăng", tone: "success" },
  failed: { label: "Lỗi", tone: "danger" },
  unknown: { label: "Cần đối chiếu trên Fanpage", tone: "warning" },
};

const JOB_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  processing: { label: "Đang xử lý", tone: "warning" },
  completed: { label: "Hoàn tất", tone: "success" },
  failed: { label: "Lỗi", tone: "danger" },
};

type PostRow = typeof pagePosts.$inferSelect;
type JobRow = typeof aiJobs.$inferSelect;

function jobInfo(job: JobRow): { model?: string; costUsd?: number } {
  try {
    return JSON.parse(job.inputRef ?? "{}");
  } catch {
    return {};
  }
}

function JobStatus({ status }: { status: string }) {
  const meta = JOB_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "customers.manage")) return <ForbiddenState />;
  const db = getDb();
  const owner = actor.role === "owner";
  const pages = db
    .select({ id: facebookPages.id, name: facebookPages.name })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.tenantId, actor.tenantId),
        inArray(facebookPages.branchId, actor.activeBranchId ? [actor.activeBranchId] : actor.branches.map((b) => b.id)),
      ),
    )
    .all();
  const pageIds = pages.map((p) => p.id);
  const posts = db
    .select()
    .from(pagePosts)
    .where(and(eq(pagePosts.tenantId, actor.tenantId), inArray(pagePosts.pageId, pageIds)))
    .orderBy(desc(pagePosts.publishAt))
    .limit(100)
    .all();
  const agents = db
    .select()
    .from(pageAssistants)
    .where(and(eq(pageAssistants.tenantId, actor.tenantId), inArray(pageAssistants.pageId, pageIds)))
    .all();
  const accounts = owner
    ? db
        .select({ id: adsAccounts.id, name: adsAccounts.name, currency: adsAccounts.currency, timezone: adsAccounts.timezone })
        .from(adsAccounts)
        .where(eq(adsAccounts.tenantId, actor.tenantId))
        .all()
    : [];
  const periods = owner
    ? db.select().from(adsPeriods).where(eq(adsPeriods.tenantId, actor.tenantId)).orderBy(desc(adsPeriods.syncedAt)).limit(100).all()
    : [];
  const history = owner
    ? db
        .select()
        .from(aiJobs)
        .where(and(eq(aiJobs.tenantId, actor.tenantId), eq(aiJobs.type, "ads_analysis")))
        .orderBy(desc(aiJobs.createdAt))
        .limit(20)
        .all()
    : [];
  const writing = db
    .select()
    .from(aiJobs)
    .where(and(eq(aiJobs.tenantId, actor.tenantId), eq(aiJobs.type, "post_writing")))
    .orderBy(desc(aiJobs.createdAt))
    .limit(20)
    .all();
  const result = (await searchParams).result;
  const pageName = (id: string) => pages.find((p) => p.id === id)?.name ?? "Chưa có";
  const connectLink = owner ? (
    <Button asChild variant="outline">
      <Link href="/api/facebook/oauth?publish=1">Kết nối trang với quyền đăng bài</Link>
    </Button>
  ) : null;

  const postColumns: DataTableColumn<PostRow>[] = [
    {
      key: "select",
      header: "Chọn",
      cell: (post) =>
        owner && post.status === "draft" ? (
          <input type="checkbox" name="post" value={post.id} aria-label={"Chọn bài " + post.content.slice(0, 40)} className="h-4 w-4" />
        ) : null,
    },
    {
      key: "content",
      header: "Nội dung",
      cell: (post) => (
        <p className="line-clamp-3 max-w-md whitespace-pre-line" title={post.content}>
          {post.content}
        </p>
      ),
    },
    { key: "page", header: "Fanpage", cell: (post) => pageName(post.pageId) },
    { key: "publishAt", header: "Giờ đăng", cell: (post) => <DateTimeText value={post.publishAt} /> },
    {
      key: "status",
      header: "Trạng thái",
      cell: (post) => {
        const meta = POST_STATUS[post.status] ?? { label: post.status, tone: "neutral" as const };
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "note",
      header: "Ghi chú",
      cell: (post) => (
        <span className="text-xs text-muted-foreground">{[post.remoteId, post.error].filter(Boolean).join(" · ") || "—"}</span>
      ),
    },
  ];

  const writingColumns: DataTableColumn<JobRow>[] = [
    { key: "time", header: "Thời gian", cell: (job) => <DateTimeText value={job.createdAt} /> },
    { key: "status", header: "Trạng thái", cell: (job) => <JobStatus status={job.status} /> },
    { key: "model", header: "Mô hình", cell: (job) => jobInfo(job).model ?? "Chưa có" },
    {
      key: "cost",
      header: "Chi phí",
      className: "text-right",
      cell: (job) => {
        const cost = jobInfo(job).costUsd;
        return cost === undefined ? "Chưa xác nhận" : cost + " USD";
      },
    },
    { key: "error", header: "Ghi chú", cell: (job) => <span className="text-xs text-muted-foreground">{job.error ?? "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fanpage và quảng cáo"
        description="Soạn và duyệt bài đăng, huấn luyện trợ lý Messenger, đồng bộ số liệu Meta Ads."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/campaigns">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Chiến dịch
            </Link>
          </Button>
        }
      />
      {result ? <Alert tone="info" role="status">{result}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Lịch đăng Fanpage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {pages.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-6 w-6" aria-hidden />}
              title="Chưa có Fanpage được kết nối"
              description="Cần kết nối một Fanpage trước khi soạn và đặt lịch bài đăng."
              action={connectLink}
            />
          ) : (
            <>
              {connectLink}
              <div className="grid gap-5 md:grid-cols-2">
                <form action={marketingForm} className="space-y-3">
                  <input type="hidden" name="action" value="draft" />
                  <h3 className="text-sm font-semibold">Soạn thủ công</h3>
                  <div>
                    <Label htmlFor="draft-page">Fanpage</Label>
                    <Select id="draft-page" name="page" className="mt-1.5">
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="draft-batch">Bài đăng theo giờ Việt Nam, mỗi bài một dòng</Label>
                    <Textarea id="draft-batch" name="batch" required placeholder="2026-12-20T09:00 | Nội dung bài đăng" className="mt-1.5" />
                  </div>
                  <SubmitButton pendingLabel="Đang lưu...">Lưu bản nháp</SubmitButton>
                </form>
                <form action={marketingForm} className="space-y-3">
                  <input type="hidden" name="action" value="write" />
                  <h3 className="text-sm font-semibold">Viết nháp bằng AI</h3>
                  <div>
                    <Label htmlFor="write-page">Fanpage</Label>
                    <Select id="write-page" name="page" className="mt-1.5">
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="write-publish-at">Giờ đăng</Label>
                    <Input id="write-publish-at" name="publishAt" type="datetime-local" required className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="write-brief">Yêu cầu nội dung</Label>
                    <Textarea id="write-brief" name="brief" required minLength={5} maxLength={1000} className="mt-1.5" />
                  </div>
                  <SubmitButton pendingLabel="Đang viết...">Viết nháp bằng AI Hub</SubmitButton>
                </form>
              </div>
              <form action={marketingForm} className="space-y-3">
                <input type="hidden" name="action" value="approve" />
                <DataTable
                  columns={postColumns}
                  rows={posts}
                  getRowKey={(post) => post.id}
                  caption="Danh sách bài đăng Fanpage"
                  empty={
                    <EmptyState
                      title="Chưa có bài đăng"
                      description="Soạn bản nháp ở trên, chủ studio duyệt rồi hệ thống sẽ đăng đúng giờ."
                    />
                  }
                />
                {owner && posts.some((p) => p.status === "draft") ? (
                  <SubmitButton pendingLabel="Đang duyệt...">Duyệt bài đã chọn</SubmitButton>
                ) : null}
              </form>
            </>
          )}
        </CardContent>
      </Card>

      {writing.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử viết bài AI Hub</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={writingColumns} rows={writing} getRowKey={(job) => job.id} caption="Lịch sử viết bài AI Hub" />
          </CardContent>
        </Card>
      ) : null}

      {owner
        ? pages.map((p) => {
            const agent = agents.find((a) => a.pageId === p.id);
            return (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle>Trợ lý Messenger · {p.name}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-5 md:grid-cols-2">
                  <form action={marketingForm} className="space-y-3">
                    <input type="hidden" name="page" value={p.id} />
                    <input type="hidden" name="action" value="assistant" />
                    <div>
                      <Label htmlFor={"assistant-name-" + p.id}>Tên nhân viên</Label>
                      <Input id={"assistant-name-" + p.id} name="name" defaultValue={agent?.name} required className="mt-1.5" />
                    </div>
                    <div>
                      <Label htmlFor={"assistant-knowledge-" + p.id}>Kiến thức đã duyệt, mỗi dòng một câu hỏi | trả lời</Label>
                      <Textarea
                        id={"assistant-knowledge-" + p.id}
                        name="knowledge"
                        required
                        defaultValue={agent?.knowledge.map((k) => k.question + " | " + k.answer).join("\n")}
                        className="mt-1.5"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="enabled" defaultChecked={agent?.enabled} className="h-4 w-4" />
                      Bật trả lời cho hội thoại mới
                    </label>
                    <SubmitButton pendingLabel="Đang lưu...">Lưu trợ lý</SubmitButton>
                  </form>
                  <form action={marketingForm} className="space-y-3">
                    <input type="hidden" name="page" value={p.id} />
                    <input type="hidden" name="action" value="preview" />
                    <div>
                      <Label htmlFor={"assistant-question-" + p.id}>Câu hỏi chạy thử</Label>
                      <Input id={"assistant-question-" + p.id} name="question" required className="mt-1.5" />
                    </div>
                    <SubmitButton variant="outline" pendingLabel="Đang thử...">Thử câu trả lời</SubmitButton>
                  </form>
                </CardContent>
              </Card>
            );
          })
        : null}

      {owner ? (
        <Card>
          <CardHeader>
            <CardTitle>Tài khoản Meta Ads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <form action={marketingForm} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="action" value="account" />
              <div>
                <Label htmlFor="ads-account">Mã tài khoản</Label>
                <Input id="ads-account" name="account" placeholder="act_…" required className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="ads-token">Token có quyền ads_read</Label>
                <Input id="ads-token" type="password" name="token" autoComplete="off" required className="mt-1.5" />
              </div>
              <div className="md:col-span-2">
                <SubmitButton pendingLabel="Đang kết nối...">Kết nối tài khoản</SubmitButton>
              </div>
            </form>
            {accounts.length > 0 ? (
              <form action={marketingForm} className="grid gap-3 border-t border-border pt-5 md:grid-cols-3">
                <input type="hidden" name="action" value="sync" />
                <div className="md:col-span-3">
                  <Label htmlFor="sync-account">Tài khoản</Label>
                  <Select id="sync-account" name="account" className="mt-1.5">
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} · {a.id} · {a.currency} · {a.timezone}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sync-since">Từ ngày</Label>
                  <Input id="sync-since" name="since" type="date" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="sync-until">Đến ngày</Label>
                  <Input id="sync-until" name="until" type="date" required className="mt-1.5" />
                </div>
                <div className="flex items-end">
                  <SubmitButton pendingLabel="Đang đồng bộ...">Đồng bộ kỳ</SubmitButton>
                </div>
              </form>
            ) : null}
            {periods.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có kỳ đã đồng bộ.</p>
            ) : null}
            {periods.map((p) => (
              <article key={p.id} className="space-y-3 border-t border-border pt-5">
                <div>
                  <h3 className="text-sm font-semibold">{p.accountId} · {p.since} – {p.until}</h3>
                  <p className="text-xs text-muted-foreground">
                    Cập nhật {formatDateTime(p.syncedAt)} · {p.currency} · {p.timezone}
                  </p>
                </div>
                {!p.rows.length ? <p className="text-sm">Đã đồng bộ · Tổng chi tiêu 0 {p.currency}</p> : null}
                {p.rows.map((r) => (
                  <p key={r.campaign_id} className="text-sm">
                    {r.campaign_name} ({r.campaign_id}) · {r.spend} {p.currency} · {r.impressions} lượt hiển thị · {r.clicks} lượt nhấp
                  </p>
                ))}
                {p.rows.length ? (
                  <form action={marketingForm} className="grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="period" value={p.id} />
                    <div>
                      <Label htmlFor={"analysis-campaign-" + p.id}>Chiến dịch</Label>
                      <Select id={"analysis-campaign-" + p.id} name="campaign" className="mt-1.5">
                        {p.rows.map((r) => (
                          <option key={r.campaign_id} value={r.campaign_id}>{r.campaign_name}</option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={"analysis-compare-" + p.id}>Kỳ so sánh</Label>
                      <Select id={"analysis-compare-" + p.id} name="compare" className="mt-1.5">
                        <option value="">Chỉ xem kỳ này</option>
                        {periods
                          .filter((o) => o.accountId === p.accountId && o.id !== p.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.since} – {o.until}</option>
                          ))}
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <Button type="submit" name="action" value="analyze" variant="outline">Phân tích theo số liệu</Button>
                      <Button type="submit" name="action" value="model">Phân tích bằng AI Hub · OpenRouter</Button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
            {history.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-5">
                <h3 className="text-sm font-semibold">Lịch sử phân tích</h3>
                {history.map((job) => {
                  const cost = jobInfo(job).costUsd;
                  return (
                    <details key={job.id} className="rounded-lg border border-border p-3 text-sm">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                        <DateTimeText value={job.createdAt} />
                        {job.provider === "local" ? (
                          <Badge tone="neutral">Phân tích tại studio · Chi phí 0đ</Badge>
                        ) : (
                          <>
                            <span>AI Hub</span>
                            <JobStatus status={job.status} />
                            <span>{cost === undefined ? "Chưa xác nhận" : cost + " USD"}</span>
                          </>
                        )}
                      </summary>
                      <p className="mt-2">{job.outputRef || job.error}</p>
                      <pre className="mt-2 overflow-auto text-xs">{job.inputRef}</pre>
                    </details>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
