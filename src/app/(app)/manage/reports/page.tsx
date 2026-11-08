import Link from "next/link";
import {
  BarChart3,
  Download,
  FileText,
  Percent,
  Printer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getDebtReport,
  getPhotographerPerformance,
  getRevenueReport,
  getRoomUtilization,
  getSalesPerformance,
  getTaxReport,
} from "@/lib/services/report-service";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Báo cáo" };

function Summary({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "reports.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem báo cáo." />;
  }
  const params = await searchParams;
  const db = getDb();
  const filters = params;
  const revenue = getRevenueReport(db, actor, filters);
  const tax = getTaxReport(db, actor, filters);
  const debts = getDebtReport(db, actor, filters);
  const rooms = getRoomUtilization(db, actor, filters);
  const photographers = getPhotographerPerformance(db, actor, filters);
  const sales = getSalesPerformance(db, actor, filters);
  const maxMonthly = Math.max(
    1,
    ...revenue.monthly.map((row) => Math.max(row.income, row.expense)),
  );
  const maxService = Math.max(1, ...revenue.byService.map((row) => row.revenue));
  const maxStaff = Math.max(1, ...revenue.byStaff.map((row) => row.revenue));
  const exportQuery = (type: string) => {
    const query = new URLSearchParams({ type });
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (filters.branchId) query.set("branchId", filters.branchId);
    return query.toString();
  };

  return (
    <div>
      <PageHeader
        title="Báo cáo"
        description={`Doanh thu thực thu/đã hoàn so với dự kiến, công nợ, chi phí, lợi nhuận, phòng và hiệu suất photographer (${revenue.from} → ${revenue.to}).`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/exports/reports?${exportQuery("revenue")}`}>
                <Download className="h-4 w-4" aria-hidden />
                CSV doanh thu
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/manage/reports/tax/print?${exportQuery("tax")}`}>
                <Printer className="h-4 w-4" aria-hidden />
                In thuế
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance">
                <Wallet className="h-4 w-4" aria-hidden />
                Sổ quỹ
              </Link>
            </Button>
          </>
        }
      />

      <form method="get" className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
          <div>
            <Label htmlFor="report-from">Từ ngày</Label>
            <Input id="report-from" name="from" type="date" defaultValue={params.from ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="report-to">Đến ngày</Label>
            <Input id="report-to" name="to" type="date" defaultValue={params.to ?? ""} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="report-branch">Chi nhánh</Label>
            <Select id="report-branch" name="branchId" defaultValue={params.branchId ?? ""} className="mt-1.5">
              <option value="">Tất cả được xem</option>
              {actor.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm">Lọc báo cáo</Button>
        </div>
      </form>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary
          label="Thực thu"
          value={formatVnd(revenue.collected - revenue.refunded)}
          hint={`Đã hoàn ${formatVnd(revenue.refunded)}`}
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
        />
        <Summary
          label="Dự kiến"
          value={formatVnd(revenue.expected)}
          hint={`${revenue.orderCount} đơn`}
          icon={<BarChart3 className="h-5 w-5" aria-hidden />}
        />
        <Summary
          label="Chi phí"
          value={formatVnd(revenue.expenses)}
          icon={<Wallet className="h-5 w-5" aria-hidden />}
        />
        <Summary
          label="Lợi nhuận"
          value={formatVnd(revenue.profit)}
          hint="Thực thu − hoàn − chi"
          icon={<Percent className="h-5 w-5" aria-hidden />}
        />
        <Summary
          label="Công nợ"
          value={formatVnd(debts.total)}
          hint={`${debts.rows.length} đơn`}
          icon={<FileText className="h-5 w-5" aria-hidden />}
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Doanh thu theo tháng</h2>
          <p className="text-xs text-muted-foreground">6 tháng gần nhất; bảng bên dưới là dữ liệu thay thế biểu đồ.</p>
          <div className="mt-3 space-y-2">
            {revenue.monthly.map((row) => (
              <div key={row.month}>
                <div className="flex justify-between text-xs">
                  <span>{row.month}</span>
                  <span>
                    Thu {formatVnd(row.income)} · Chi {formatVnd(row.expense)}
                  </span>
                </div>
                <Bar value={row.income} max={maxMonthly} />
              </div>
            ))}
            {revenue.monthly.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Theo chi nhánh</h2>
          <table className="mt-2 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left">Chi nhánh</th>
                <th className="py-1 text-right">Thu</th>
                <th className="py-1 text-right">Chi/hoàn</th>
                <th className="py-1 text-right">Lợi nhuận</th>
              </tr>
            </thead>
            <tbody>
              {revenue.byBranch.map((row) => (
                <tr key={row.branchId} className="border-t border-border">
                  <td className="py-1.5">{row.branchName}</td>
                  <td className="py-1.5 text-right">{formatVnd(row.income)}</td>
                  <td className="py-1.5 text-right">{formatVnd(row.expense)}</td>
                  <td className="py-1.5 text-right">{formatVnd(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Top dịch vụ (giá trị đơn)</h2>
          <div className="mt-2 space-y-2">
            {revenue.byService.slice(0, 6).map((row) => (
              <div key={row.name}>
                <div className="flex justify-between text-xs">
                  <span>{row.name}</span>
                  <span>{formatVnd(row.revenue)}</span>
                </div>
                <Bar value={row.revenue} max={maxService} />
              </div>
            ))}
            {revenue.byService.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Hiệu suất photographer</h2>
          <table className="mt-2 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left">Nhân sự</th>
                <th className="py-1 text-right">Đơn hoàn tất</th>
                <th className="py-1 text-right">Doanh thu</th>
                <th className="py-1 text-right">Hoa hồng duyệt</th>
              </tr>
            </thead>
            <tbody>
              {photographers.map((row) => (
                <tr key={row.staffId} className="border-t border-border">
                  <td className="py-1.5">{row.staffName}</td>
                  <td className="py-1.5 text-right">{row.completedOrders}</td>
                  <td className="py-1.5 text-right">{formatVnd(row.revenue)}</td>
                  <td className="py-1.5 text-right">{formatVnd(row.commissionApproved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 space-y-1">
            {revenue.byStaff.slice(0, 4).map((row) => (
              <div key={row.staffName} className="text-xs text-muted-foreground">
                {row.staffName}: {row.orders} đơn hoàn tất · {formatVnd(row.revenue)}
                <Bar value={row.revenue} max={maxStaff} />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Tỷ lệ lấp đầy phòng</h2>
          <p className="text-xs text-muted-foreground">Giả định 10 giờ/ngày/phòng.</p>
          <div className="mt-2 space-y-2">
            {rooms.map((room) => (
              <div key={room.roomId}>
                <div className="flex justify-between text-xs">
                  <span>{room.roomName} · {room.branchName}</span>
                  <span>{room.utilization}%</span>
                </div>
                <Bar value={room.utilization} max={100} />
                <p className="text-[11px] text-muted-foreground">
                  {room.bookedHours}h / {room.capacityHours}h
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">KPI sale / chăm sóc</h2>
          <table className="mt-2 w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left">Nhân sự</th>
                <th className="py-1 text-right">Lead</th>
                <th className="py-1 text-right">Đơn</th>
                <th className="py-1 text-right">Hoàn tất</th>
                <th className="py-1 text-right">Tỷ lệ chốt</th>
                <th className="py-1 text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((row) => (
                <tr key={row.staffId} className="border-t border-border">
                  <td className="py-1.5">{row.staffName}</td>
                  <td className="py-1.5 text-right">{row.leads}</td>
                  <td className="py-1.5 text-right">{row.orders}</td>
                  <td className="py-1.5 text-right">{row.completedOrders}</td>
                  <td className="py-1.5 text-right">{row.closeRate}%</td>
                  <td className="py-1.5 text-right">{formatVnd(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Tỷ lệ chốt = đơn tạo trong kỳ / khách do nhân sự phụ trách.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold">Công nợ &amp; Thuế (HKD)</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            {Object.entries(debts.buckets).map(([bucket, amount]) => (
              <div key={bucket} className="rounded-lg bg-surface-muted p-2">
                <p className="text-xs text-muted-foreground">{bucket} ngày</p>
                <p className="font-medium">{formatVnd(amount)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {tax.rates.map((row) => (
              <Badge key={row.rate} tone="info">
                VAT {row.rate}% · {row.count} HĐ · {formatVnd(row.vatAmount)}
              </Badge>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/exports/reports?${exportQuery("debt")}`}>CSV công nợ</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/exports/reports?${exportQuery("tax")}`}>CSV thuế</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance/debts">Chi tiết công nợ</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
