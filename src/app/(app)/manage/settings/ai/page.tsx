import Link from "next/link";
import { BrainCircuit, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { DateTimeText } from "@/components/shared/date-time";
import { AiSettingsForm } from "@/components/ai/ai-settings-form";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getAiSettingsView,
  listAiJobLogs,
} from "@/lib/services/ai-service";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Hub",
};

export default async function AiSettingsPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "settings.manage")) {
    return (
      <ForbiddenState description="Chỉ chủ studio được cấu hình AI Hub và API key." />
    );
  }
  const db = getDb();
  const settings = getAiSettingsView(db, actor.tenantId);
  const jobs = listAiJobLogs(db, actor, 10);

  return (
    <div>
      <PageHeader
        title="AI Hub"
        description="Local heuristic mặc định, không gửi ảnh ra ngoài. Provider live cần consent, API key, ngân sách và được ghi log."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/photos">
              <Images className="h-4 w-4" aria-hidden />
              Album ảnh
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BrainCircuit className="h-4 w-4 text-primary" aria-hidden />
            Cấu hình provider & tính năng
          </h2>
          <div className="mt-4">
            <AiSettingsForm settings={settings} />
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">
              Trạng thái hiện tại
            </h2>
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium">{settings.provider}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="max-w-44 truncate text-right">{settings.model}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">API key</dt>
                <dd>
                  <Badge tone={settings.hasApiKey ? "success" : "neutral"}>
                    {settings.hasApiKey ? "Đã cấu hình" : "Chưa cấu hình"}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Consent</dt>
                <dd>{settings.consent ? "Đã đồng ý" : "Chưa đồng ý"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Ngân sách</dt>
                <dd>{formatVnd(settings.budgetVnd)}/tháng</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Giá/ảnh ước tính</dt>
                <dd>{formatVnd(settings.costPerImageVnd)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Ảnh không bao giờ được gửi ra ngoài khi provider là local. Provider
              live chưa được kiểm chứng nếu chưa có credentials thật.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">Job gần đây</h2>
            {jobs.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Chưa có job AI nào. Mở album và chạy phân tích để tạo job.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {jobs.map((job) => (
                  <li key={job.id} className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs">{job.id.slice(0, 8)}</span>
                      <Badge
                        tone={
                          job.status === "completed"
                            ? "success"
                            : job.status === "failed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job.type} · {job.provider} ·{" "}
                      {formatVnd(job.estimatedCost)} ·{" "}
                      <DateTimeText value={job.createdAt} />
                    </p>
                    {job.error ? (
                      <p className="mt-1 text-xs text-[var(--danger)]">{job.error}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
