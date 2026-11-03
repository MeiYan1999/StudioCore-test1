import Link from "next/link";
import { Download, Scale } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { DebtReminderButton } from "@/components/finance/debt-reminder-button";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listDebtors, type DebtRow } from "@/lib/services/finance-service";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Công nợ" };

export default async function DebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; branchId?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "finance.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem công nợ." />;
  }
  const params = await searchParams;
  const data = listDebtors(getDb(), actor, params);
  const exportParams = new URLSearchParams({ type: "debt" });
  if (params.branchId) exportParams.set("branchId", params.branchId);

  const columns: DataTableColumn<DebtRow>[] = [
    {
      key: "order",
      header: "Đơn hàng",
      cell: (row) => (
        <div>
          <Link
            href={`/manage/orders/${row.orderId}`}
            className="font-mono text-sm font-semibold hover:text-primary"
          >
            {row.orderCode}
          </Link>
          <p className="text-xs text-muted-foreground">{row.branchName}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Khách hàng",
      cell: (row) => (
        <div>
          <p className="text-sm font-medium">{row.customerName}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{row.customerPhone}</p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Tổng",
      className: "text-right",
      cell: (row) => <Money value={row.total} />,
    },
    {
      key: "paid",
      header: "Đã thu",
      className: "text-right",
      cell: (row) => <Money value={row.paid} />,
    },
    {
      key: "remaining",
      header: "Còn nợ",
      className: "text-right",
      cell: (row) => (
        <Money value={row.remaining} className="font-semibold text-[var(--warning)]" />
      ),
    },
    {
      key: "age",
      header: "Tuổi nợ",
      cell: (row) => (
        <Badge
          tone={
            row.bucket === "90+"
              ? "danger"
              : row.bucket === "61-90"
                ? "warning"
                : "neutral"
          }
        >
          {row.ageDays} ngày
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => <DebtReminderButton orderId={row.orderId} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Công nợ khách hàng"
        description="Tuổi nợ theo lịch chụp/ngày tạo đơn; nhắc thu bằng local notification + tương tác khách."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance">
                <Scale className="h-4 w-4" aria-hidden />
                Sổ quỹ
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/exports/reports?${exportParams.toString()}`}>
                <Download className="h-4 w-4" aria-hidden />
                CSV
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(data.buckets).map(([bucket, amount]) => (
          <div key={bucket} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted-foreground">{bucket} ngày</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatVnd(amount)}</p>
          </div>
        ))}
      </div>

      <form method="get" className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr_auto] md:items-end">
          <div>
            <Label htmlFor="debt-q">Tìm kiếm</Label>
            <Input
              id="debt-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Mã đơn, tên, SĐT..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="debt-branch">Chi nhánh</Label>
            <Select id="debt-branch" name="branchId" defaultValue={params.branchId ?? ""} className="mt-1.5">
              <option value="">Tất cả được xem</option>
              {actor.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm">Lọc</Button>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={data.rows}
        getRowKey={(row) => row.orderId}
        caption="Danh sách công nợ"
        empty={
          <EmptyState
            icon={<Scale className="h-6 w-6" aria-hidden />}
            title="Không có công nợ"
            description="Tất cả đơn hàng trong phạm vi xem đã được thu đủ."
          />
        }
      />
    </div>
  );
}
