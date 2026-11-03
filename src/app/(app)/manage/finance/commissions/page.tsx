import Link from "next/link";
import { Percent, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import {
  CommissionActions,
  CommissionRuleSheet,
} from "@/components/finance/commission-controls";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  listCommissionRules,
  listCommissions,
  type CommissionView,
} from "@/lib/services/commission-payroll-service";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hoa hồng" };

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; period?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "finance.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem hoa hồng." />;
  }
  const params = await searchParams;
  const db = getDb();
  const rules = listCommissionRules(db, actor);
  const commissions = listCommissions(db, actor, params);
  const canManage = hasPermission(actor.permissions, "finance.manage");
  const pending = commissions.filter((row) => row.status === "pending");
  const approved = commissions.filter((row) => row.status === "approved");
  const paid = commissions.filter((row) => row.status === "paid");

  const columns: DataTableColumn<CommissionView>[] = [
    {
      key: "staff",
      header: "Nhân sự",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.staffName}</p>
          <p className="text-xs text-muted-foreground">{row.role}</p>
        </div>
      ),
    },
    {
      key: "order",
      header: "Đơn",
      cell: (row) => (
        <Link
          href={`/manage/orders/${row.orderId}`}
          className="font-mono text-sm hover:text-primary"
        >
          {row.orderCode}
        </Link>
      ),
    },
    {
      key: "rule",
      header: "Rule snapshot",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.ruleType === "percent" ? `${row.ruleValue}%` : formatVnd(row.ruleValue)}
          {" · "}base {formatVnd(row.baseAmount)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Hoa hồng",
      className: "text-right",
      cell: (row) => <Money value={row.amount} className="font-medium" />,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge
          tone={
            row.status === "paid"
              ? "success"
              : row.status === "approved"
                ? "info"
                : "warning"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "payroll",
      header: "Bảng lương",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.payrollId ? "Đã gắn kỳ lương" : "Chưa"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Ngày tạo",
      cell: (row) => <DateTimeText value={row.createdAt} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        canManage ? (
          <CommissionActions
            commissionId={row.id}
            status={row.status}
            payrollId={row.payrollId}
          />
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Hoa hồng"
        description="Rule snapshot theo vai trò; commission chờ duyệt → đã duyệt → đã trả hoặc gắn kỳ lương."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance">
                <Wallet className="h-4 w-4" aria-hidden />
                Sổ quỹ
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/payroll">Bảng lương</Link>
            </Button>
            {canManage ? <CommissionRuleSheet /> : null}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Chờ duyệt</p>
          <p className="mt-1 text-lg font-semibold">{formatVnd(pending.reduce((s, r) => s + r.amount, 0))}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Đã duyệt</p>
          <p className="mt-1 text-lg font-semibold">{formatVnd(approved.reduce((s, r) => s + r.amount, 0))}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Đã trả</p>
          <p className="mt-1 text-lg font-semibold">{formatVnd(paid.reduce((s, r) => s + r.amount, 0))}</p>
        </div>
      </div>

      <form method="get" className="mb-4 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <Label htmlFor="commission-status">Trạng thái</Label>
            <Select id="commission-status" name="status" defaultValue={params.status ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="paid">Đã trả</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="commission-period">Kỳ</Label>
            <Input id="commission-period" name="period" type="month" defaultValue={params.period ?? ""} className="mt-1.5" />
          </div>
          <Button type="submit" size="sm">Lọc</Button>
        </div>
      </form>

      <section className="mb-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Percent className="h-4 w-4 text-primary" aria-hidden />
          Rule hiện có
        </h2>
        {rules.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Chưa có rule.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{rule.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.role} · {rule.type === "percent" ? `${rule.value}%` : formatVnd(rule.value)} · hiệu lực <DateTimeText value={rule.effectiveFrom} />
                  </p>
                </div>
                <Badge tone={rule.active ? "success" : "neutral"}>
                  {rule.active ? "Đang bật" : "Tắt"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DataTable
        columns={columns}
        rows={commissions}
        getRowKey={(row) => row.id}
        caption="Danh sách hoa hồng"
        empty={
          <EmptyState
            icon={<Percent className="h-6 w-6" aria-hidden />}
            title="Chưa có hoa hồng"
            description="Đơn hoàn tất sẽ tự tính theo rule đang hiệu lực."
          />
        }
      />
    </div>
  );
}
