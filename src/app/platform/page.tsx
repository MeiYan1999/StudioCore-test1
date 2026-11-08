import Link from "next/link";
import { count, desc, eq, like, or, and } from "drizzle-orm";
import { Building2, DollarSign, Mail, Phone, Search, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
import { getDb } from "@/lib/db/client";
import { branches, contactRequests, staff, tenants } from "@/lib/db/schema";
import { formatDateTime, formatVnd } from "@/lib/utils";
import {
  TenantPlanSelect,
  TenantStatusSelect,
  ContactRequestStatusSelect,
  ResetOwnerPasswordModal,
} from "./tenant-row-controls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Quản trị nền tảng SaaS — StudioCore Platform",
  robots: { index: false, follow: false },
};

const PLAN_PRICES: Record<string, number> = {
  trial: 0,
  basic: 399_000,
  pro: 499_000,
  business: 699_000,
};

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tenants.manage")) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ForbiddenState description="Chỉ platform admin được truy cập khu vực quản lý tenant." />
      </div>
    );
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const filterPlan = params.plan ?? "";
  const filterStatus = params.status ?? "";

  const db = getDb();

  // All tenants for metrics
  const allTenants = db.select().from(tenants).all();

  const totalStudios = allTenants.length;
  const activeTenants = allTenants.filter((t) => t.status === "active").length;
  const trialTenants = allTenants.filter((t) => t.status === "trial").length;
  const suspendedTenants = allTenants.filter((t) => t.status === "suspended").length;

  const estimatedMrr = allTenants
    .filter((t) => t.status === "active")
    .reduce((sum, t) => sum + (PLAN_PRICES[t.plan] ?? 0), 0);

  // Filtered tenants for display
  const conditions = [];
  if (query) {
    conditions.push(or(like(tenants.name, `%${query}%`), like(tenants.slug, `%${query}%`)));
  }
  if (filterPlan) {
    conditions.push(eq(tenants.plan, filterPlan));
  }
  if (filterStatus) {
    conditions.push(eq(tenants.status, filterStatus));
  }

  const tenantRows = db
    .select()
    .from(tenants)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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
    .limit(50)
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
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              S
            </span>
            <div>
              <p className="text-sm font-semibold">StudioCore SuperAdmin</p>
              <p className="text-[11px] text-muted-foreground">
                Quản lý hệ sinh thái khách hàng B2B · {actor.staffName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Xem website</Link>
            </Button>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Đăng xuất
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge tone="info">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" aria-hidden />
              Trung tâm kiểm soát Studio SaaS
            </Badge>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Quản lý Studio Khách hàng &amp; Gói cước</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Phê duyệt tài khoản, nâng cấp gói dịch vụ, kích hoạt trạng thái và tiếp nhận yêu cầu tư vấn trực tiếp từ web.
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-accent/40 p-3 text-right">
            <span className="text-xs text-muted-foreground">Doanh thu định kỳ (Ước tính MRR)</span>
            <p className="text-xl font-bold text-primary">{formatVnd(estimatedMrr)}/tháng</p>
          </div>
        </div>

        {/* Metric Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">Tổng Studio</span>
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{totalStudios}</p>
            <p className="text-xs text-muted-foreground">Toàn hệ thống</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">Đang trả phí</span>
              <DollarSign className="h-4 w-4 text-[var(--success)]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[var(--success)]">{activeTenants}</p>
            <p className="text-xs text-muted-foreground">Active studio</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">Đang dùng thử</span>
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-blue-500">{trialTenants}</p>
            <p className="text-xs text-muted-foreground">Trial 30 ngày</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">Tạm khóa</span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-500">{suspendedTenants}</p>
            <p className="text-xs text-muted-foreground">Hết hạn / Khóa</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-muted-foreground">Yêu cầu tư vấn</span>
              <Mail className="h-4 w-4 text-rose-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-500">{newRequests} mới</p>
            <p className="text-xs text-muted-foreground">{requests.length} tổng lead</p>
          </div>
        </section>

        {/* Search & Filter Toolbar */}
        <section className="mt-8 rounded-xl border border-border bg-surface p-4">
          <form method="get" className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Tìm theo tên studio hoặc slug..."
                className="pl-9"
              />
            </div>
            <select
              name="plan"
              defaultValue={filterPlan}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tất cả gói cước</option>
              <option value="trial">Gói Dùng thử (Trial)</option>
              <option value="basic">Gói Cơ bản (399k)</option>
              <option value="pro">Gói Pro (499k)</option>
              <option value="business">Gói Doanh nghiệp (699k)</option>
            </select>
            <select
              name="status"
              defaultValue={filterStatus}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động (Active)</option>
              <option value="trial">Dùng thử (Trial)</option>
              <option value="suspended">Tạm khóa (Suspended)</option>
            </select>
            <Button type="submit" size="sm">
              Lọc danh sách
            </Button>
            {query || filterPlan || filterStatus ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/platform">Đặt lại</Link>
              </Button>
            ) : null}
          </form>
        </section>

        {/* Tenant Table */}
        <section className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-primary" aria-hidden />
              Danh sách Studio đối tác ({tenantRows.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Studio (Tenant)</th>
                  <th className="px-4 py-3">Chủ Studio (Owner)</th>
                  <th className="px-4 py-3">Gói dịch vụ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Chi nhánh</th>
                  <th className="px-4 py-3 text-right">Nhân sự</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tenantRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Không tìm thấy studio nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  tenantRows.map((tenant) => {
                    const owner = ownerMap.get(tenant.id);
                    return (
                      <tr key={tenant.id} className="transition-colors hover:bg-accent/30">
                        <td className="px-4 py-3 font-medium">
                          <div className="font-semibold text-foreground">{tenant.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">slug: {tenant.slug}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {owner ? (
                            <div>
                              <p className="font-medium text-foreground">{owner.name}</p>
                              {owner.email ? (
                                <p className="text-muted-foreground">
                                  <a href={`mailto:${owner.email}`} className="hover:text-primary">
                                    {owner.email}
                                  </a>
                                </p>
                              ) : null}
                              {owner.phone ? (
                                <p className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  <a href={`tel:${owner.phone}`} className="hover:text-primary">
                                    {owner.phone}
                                  </a>
                                </p>
                              ) : null}
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
                        <td className="px-4 py-3 text-center">
                          {owner ? (
                            <ResetOwnerPasswordModal tenantId={tenant.id} ownerName={owner.name} />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Contact Requests (Inbound CRM Leads) */}
        <section className="mt-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Mail className="h-4 w-4 text-primary" aria-hidden />
              Yêu cầu tư vấn &amp; Khách hàng tiềm năng ({requests.length})
            </h2>
            <Badge tone="warning">{newRequests} yêu cầu mới</Badge>
          </div>
          {requests.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Chưa có yêu cầu liên hệ nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3">Tên Studio</th>
                    <th className="px-4 py-3">Liên hệ</th>
                    <th className="px-4 py-3">Nội dung nhu cầu</th>
                    <th className="px-4 py-3">Nguồn</th>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Trạng thái xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((request) => (
                    <tr key={request.id} className="transition-colors hover:bg-accent/20">
                      <td className="px-4 py-3 font-medium text-foreground">{request.name}</td>
                      <td className="px-4 py-3 text-foreground">{request.studioName || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>
                          <a href={`mailto:${request.email}`} className="text-primary hover:underline">
                            {request.email}
                          </a>
                        </div>
                        {request.phone ? (
                          <div className="mt-0.5">
                            <a href={`tel:${request.phone}`} className="font-semibold text-foreground hover:underline">
                              {request.phone}
                            </a>
                          </div>
                        ) : null}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs leading-5 text-muted-foreground">
                        <p className="line-clamp-2" title={request.message}>
                          {request.message}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Badge tone="neutral">{request.source}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(request.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <ContactRequestStatusSelect requestId={request.id} currentStatus={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
