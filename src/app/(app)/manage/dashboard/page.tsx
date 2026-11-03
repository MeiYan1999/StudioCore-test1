import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Camera,
  ClipboardList,
  Package,
  Shirt,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getDashboardData } from "@/lib/services/dashboard-service";
import { getDashboardOverview } from "@/lib/services/report-service";
import { ORDER_STATUS_META, isOrderStatus } from "@/lib/orders/status";
import { formatDateTime, formatVnd } from "@/lib/utils";

export const metadata = {
  title: "Tổng quan",
};

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 pt-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function ChartBar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function DashboardPage() {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "dashboard.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem dashboard." />;
  }

  const db = getDb();
  const data = getDashboardData(db, actor);
  const overview = getDashboardOverview(db, actor);
  const canFinance =
    hasPermission(actor.permissions, "finance.view") &&
    hasPermission(actor.permissions, "reports.view");
  const canTasks = hasPermission(actor.permissions, "tasks.view");
  const canOrders = hasPermission(actor.permissions, "orders.view");
  const canCalendar = hasPermission(actor.permissions, "schedule.view");
  const maxMonthly = Math.max(
    1,
    ...overview.monthlyRevenue.map((row) => Math.max(row.income, row.expense)),
  );
  const maxService = Math.max(1, ...overview.topServices.map((row) => row.revenue));
  const revenueDelta =
    overview.previousMonthRevenue > 0
      ? Math.round(
          ((overview.monthRevenue - overview.previousMonthRevenue) /
            overview.previousMonthRevenue) *
            100,
        )
      : null;

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description={`Xin chào ${actor.staffName}. Dữ liệu theo phạm vi ${data.scopeLabel.toLowerCase()}.`}
        actions={<Badge tone="info">{data.activeBranchName}</Badge>}
      />

      <section aria-label="Chỉ số vận hành" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Khách hàng"
          value={data.counts.customers}
          hint={`${overview.leads} lead · ${overview.followUpsDue} follow-up quá hạn`}
          icon={<Users className="h-5 w-5" aria-hidden />}
        />
        <MetricCard
          label="Lịch hôm nay / 7 ngày"
          value={`${overview.todayAppointments} / ${overview.weekAppointments}`}
          hint="Buổi chụp trong lịch"
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
        />
        <MetricCard
          label="Sinh nhật tháng này"
          value={overview.birthdaysThisMonth}
          hint="Khách có ngày sinh trong tháng"
          icon={<UserCheck className="h-5 w-5" aria-hidden />}
        />
        <MetricCard
          label="Trang phục sẵn sàng"
          value={data.counts.availableWardrobe}
          hint={`${data.counts.activeServices} dịch vụ đang bán`}
          icon={<Shirt className="h-5 w-5" aria-hidden />}
        />
      </section>

      {canFinance ? (
        <section aria-label="Chỉ số tài chính" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Doanh thu hôm nay"
            value={formatVnd(overview.todayRevenue)}
            hint="Giao dịch thu thực tế"
            icon={<Wallet className="h-5 w-5" aria-hidden />}
          />
          <MetricCard
            label="Doanh thu tháng"
            value={formatVnd(overview.monthRevenue)}
            hint={
              revenueDelta === null
                ? "Chưa có kỳ trước để so sánh"
                : `${revenueDelta >= 0 ? "Tăng" : "Giảm"} ${Math.abs(revenueDelta)}% so với tháng trước`
            }
            icon={
              revenueDelta !== null && revenueDelta < 0 ? (
                <TrendingDown className="h-5 w-5" aria-hidden />
              ) : (
                <TrendingUp className="h-5 w-5" aria-hidden />
              )
            }
          />
          <MetricCard
            label="Lợi nhuận tạm tính"
            value={formatVnd(overview.monthProfit)}
            hint={`Chi phí ${formatVnd(overview.monthExpense)}`}
            icon={<BarChart3 className="h-5 w-5" aria-hidden />}
          />
          <MetricCard
            label="Công nợ"
            value={formatVnd(overview.debtTotal)}
            hint="Đơn chưa thu đủ"
            icon={<Package className="h-5 w-5" aria-hidden />}
          />
        </section>
      ) : null}

      <section className="mt-4 flex flex-wrap gap-2">
        {canOrders ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/orders">Đơn hàng</Link>
          </Button>
        ) : null}
        {canCalendar ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/calendar">Lịch chụp</Link>
          </Button>
        ) : null}
        {canTasks ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/tasks">
              <ClipboardList className="h-4 w-4" aria-hidden />
              Công việc
            </Link>
          </Button>
        ) : null}
        {canFinance ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/reports">Báo cáo</Link>
          </Button>
        ) : null}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Doanh thu 6 tháng</CardTitle>
              <CardDescription>
                Thu/chi thực tế; bảng là dữ liệu thay thế cho biểu đồ.
              </CardDescription>
            </div>
            <Badge tone="info">VND</Badge>
          </CardHeader>
          <CardContent>
            {overview.monthlyRevenue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>
            ) : (
              <div className="space-y-3">
                {overview.monthlyRevenue.map((row) => (
                  <div key={row.month}>
                    <div className="flex justify-between text-xs">
                      <span>{row.month}</span>
                      <span>
                        Thu {formatVnd(row.income)} · Chi {formatVnd(row.expense)}
                      </span>
                    </div>
                    <ChartBar value={row.income} max={maxMonthly} />
                  </div>
                ))}
                <table className="mt-3 w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left">Tháng</th>
                      <th className="text-right">Thu</th>
                      <th className="text-right">Chi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.monthlyRevenue.map((row) => (
                      <tr key={row.month} className="border-t border-border">
                        <td className="py-1">{row.month}</td>
                        <td className="py-1 text-right">{formatVnd(row.income)}</td>
                        <td className="py-1 text-right">{formatVnd(row.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đơn theo trạng thái</CardTitle>
            <CardDescription>Dữ liệu thật trong phạm vi xem.</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(overview.ordersByStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có đơn.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(overview.ordersByStatus).map(([status, total]) => (
                  <li key={status} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {isOrderStatus(status)
                        ? ORDER_STATUS_META[status].label
                        : status}
                    </span>
                    <Badge tone="neutral">{total}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top dịch vụ</CardTitle>
            <CardDescription>Theo giá trị đơn trong kỳ.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
            ) : (
              <div className="space-y-2">
                {overview.topServices.map((row) => (
                  <div key={row.name}>
                    <div className="flex justify-between text-xs">
                      <span>{row.name}</span>
                      <span>{formatVnd(row.revenue)}</span>
                    </div>
                    <ChartBar value={row.revenue} max={maxService} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nguồn khách</CardTitle>
            <CardDescription>Phân bổ khách trong hệ thống.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.sourceBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có khách.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overview.sourceBreakdown.map((row) => (
                  <li key={row.source} className="flex justify-between">
                    <span className="text-muted-foreground">{row.source}</span>
                    <span>{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Hiệu suất photographer</CardTitle>
              <CardDescription>Đơn hoàn tất/doanh thu.</CardDescription>
            </div>
            <Camera className="h-5 w-5 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            {overview.photographerPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {canFinance ? "Chưa có dữ liệu." : "Cần quyền báo cáo tài chính."}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overview.photographerPerformance.map((row) => (
                  <li key={row.staffName} className="flex justify-between gap-2">
                    <span>{row.staffName}</span>
                    <span className="text-right text-xs text-muted-foreground">
                      {row.completedOrders} đơn · {formatVnd(row.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Hoạt động gần đây</CardTitle>
              <CardDescription>Nhật ký thao tác thật từ hệ thống.</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState title="Chưa có hoạt động" description="Thao tác trên hệ thống sẽ xuất hiện tại đây." />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentActivity.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{item.actionLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.entity} · {item.actorName}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lấp đầy phòng</CardTitle>
            <CardDescription>Giả định 10 giờ/ngày/phòng.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.roomUtilization.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {canFinance ? "Chưa có dữ liệu." : "Cần quyền báo cáo."}
              </p>
            ) : (
              <ul className="space-y-3 text-sm">
                {overview.roomUtilization.map((room) => (
                  <li key={room.roomId}>
                    <div className="flex justify-between text-xs">
                      <span>{room.roomName}</span>
                      <span>{room.utilization}%</span>
                    </div>
                    <ChartBar value={room.utilization} max={100} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
