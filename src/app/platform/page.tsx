import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { Building2, Mail, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { getDb } from "@/lib/db/client";
import { branches, contactRequests, staff, tenants } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/utils";
import { TenantPlanSelect, TenantStatusSelect } from "./tenant-row-controls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform admin",
  robots: { index: false, follow: false },
};

export default async function PlatformPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ForbiddenState description="Chỉ platform admin được truy cập khu vực quản lý tenant." />
      </div>
    );
  }
  const db = getDb();
  const tenantRows = db
    .select()
    .from(tenants)
    .orderBy(desc(tenants.createdAt))
    .all();
  const branchCounts = db
    .select({ tenantId: branches.tenantId, value: count() })
    .from(branches)
    .groupBy(branches.tenantId)
    .all();
  const staffCounts = db
    .select({ tenantId: staff.tenantId, value: count() })
    .from(staff)
    .groupBy(staff.tenantId)
    .all();
  const branchMap = new Map(branchCounts.map((row) => [row.tenantId, row.value]));
  const staffMap = new Map(staffCounts.map((row) => [row.tenantId, row.value]));
  const ownerRows = db
    .select({
      tenantId: staff.tenantId,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
    })
    .from(staff)
    .where(eq(staff.role, "owner"))
    .all();
  const ownerMap = new Map(ownerRows.map((o) => [o.tenantId, o]));
  const requests = db
    .select()
    .from(contactRequests)
    .orderBy(desc(contactRequests.createdAt))
    .limit(30)
    .all();
  const newRequests =
    db
      .select({ value: count() })
      .from(contactRequests)
      .where(eq(contactRequests.status, "new"))
      .get()?.value ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              S
            </span>
            <div>
              <p className="text-sm font-semibold">StudioCore Platform</p>
              <p className="text-[11px] text-muted-foreground">
                {actor.staffName} · {actor.staffCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Về website</Link>
            </Button>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Đăng xuất
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Badge tone="info">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Platform admin
          </Badge>
          <h1 className="mt-2 text-2xl font-semibold">Quản lý tenant nền tảng</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chỉ xem dữ liệu tổng hợp và yêu cầu liên hệ; không truy cập dữ liệu
            nghiệp vụ chi tiết của tenant.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">Tenant</p>
            <p className="mt-1 text-2xl font-semibold">{tenantRows.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">Tổng chi nhánh</p>
            <p className="mt-1 text-2xl font-semibold">
              {branchCounts.reduce((sum, row) => sum + row.value, 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-muted-foreground">Yêu cầu liên hệ mới</p>
            <p className="mt-1 text-2xl font-semibold">{newRequests}</p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-primary" aria-hidden />
              Danh sách tenant
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Studio (Tenant)</th>
                  <th className="px-4 py-3">Đại diện (Chủ studio)</th>
                  <th className="px-4 py-3">Gói cước (Kích hoạt)</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Chi nhánh</th>
                  <th className="px-4 py-3 text-right">Nhân sự</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenantRows.map((tenant) => {
                  const owner = ownerMap.get(tenant.id);
                  return (
                    <tr key={tenant.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div>{tenant.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{tenant.slug}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {owner ? (
                          <div>
                            <p className="font-medium text-foreground">{owner.name}</p>
                            <p className="text-muted-foreground">{owner.email || "Chưa có email"}</p>
                            {owner.phone ? <p className="text-muted-foreground">{owner.phone}</p> : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <TenantPlanSelect tenantId={tenant.id} currentPlan={tenant.plan} />
                      </td>
                      <td className="px-4 py-3">
                        <TenantStatusSelect tenantId={tenant.id} currentStatus={tenant.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{branchMap.get(tenant.id) ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium">{staffMap.get(tenant.id) ?? 0}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(tenant.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Mail className="h-4 w-4 text-primary" aria-hidden />
              Yêu cầu liên hệ gần đây
            </h2>
            <Badge tone="warning">{newRequests} mới</Badge>
          </div>
          {requests.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Chưa có yêu cầu.</p>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((request) => (
                <li key={request.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{request.name}</p>
                    <Badge tone={request.status === "new" ? "warning" : "neutral"}>
                      {request.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {request.studioName || "Chưa ghi studio"} · {request.source}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(request.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {request.email} {request.phone ? `· ${request.phone}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{request.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
