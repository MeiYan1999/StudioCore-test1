import Link from "next/link";
import { FileText, Printer } from "lucide-react";
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
  InvoiceCreateSheet,
  InvoiceStatusActions,
} from "@/components/finance/invoice-sheets";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "@/lib/finance/constants";
import {
  listInvoiceOrderOptions,
  listInvoices,
  type InvoiceView,
} from "@/lib/services/finance-service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hóa đơn" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; branchId?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "finance.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem hóa đơn." />;
  }
  const params = await searchParams;
  const db = getDb();
  const invoices = listInvoices(db, actor, params);
  const canManage = hasPermission(actor.permissions, "finance.manage");
  const orders = canManage ? listInvoiceOrderOptions(db, actor) : [];

  const columns: DataTableColumn<InvoiceView>[] = [
    {
      key: "no",
      header: "Hóa đơn",
      cell: (row) => (
        <div>
          <Link
            href={`/manage/reports/invoices/${row.id}/print`}
            className="font-mono text-sm font-semibold text-foreground hover:text-primary"
          >
            {row.invoiceNo}
          </Link>
          <p className="text-xs text-muted-foreground">{row.orderCode}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Khách hàng",
      cell: (row) => (
        <div>
          <p className="text-sm">{row.customerName ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.branchName}</p>
        </div>
      ),
    },
    {
      key: "amounts",
      header: "Trước VAT / VAT",
      className: "text-right",
      cell: (row) => (
        <div className="text-xs">
          <p>{row.subtotal.toLocaleString("vi-VN")}đ</p>
          <p className="text-muted-foreground">
            VAT {row.vatRate}% · {row.vatAmount.toLocaleString("vi-VN")}đ
          </p>
        </div>
      ),
    },
    {
      key: "total",
      header: "Tổng",
      className: "text-right",
      cell: (row) => <Money value={row.total} className="font-medium" />,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge
          tone={
            row.status === "paid"
              ? "success"
              : row.status === "cancelled"
                ? "neutral"
                : row.status === "issued"
                  ? "info"
                  : "warning"
          }
        >
          {INVOICE_STATUS_LABELS[row.status as InvoiceStatus] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "issued",
      header: "Phát hành",
      cell: (row) => <DateTimeText value={row.issuedAt} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/manage/reports/invoices/${row.id}/print`}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              In
            </Link>
          </Button>
          {canManage ? (
            <InvoiceStatusActions invoiceId={row.id} status={row.status} />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Hóa đơn"
        description="Hóa đơn dịch vụ có VAT, trạng thái phát hành/đã thu/hủy và bản in chuẩn tiếng Việt."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/finance">
                <FileText className="h-4 w-4" aria-hidden />
                Sổ quỹ
              </Link>
            </Button>
            {canManage && orders.length > 0 ? <InvoiceCreateSheet orders={orders} /> : null}
          </>
        }
      />

      <form method="get" className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-4 md:items-end">
          <div>
            <Label htmlFor="invoice-q">Tìm kiếm</Label>
            <Input
              id="invoice-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Số hóa đơn, đơn, khách..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="invoice-status">Trạng thái</Label>
            <Select id="invoice-status" name="status" defaultValue={params.status ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="invoice-branch">Chi nhánh</Label>
            <Select id="invoice-branch" name="branchId" defaultValue={params.branchId ?? ""} className="mt-1.5">
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
        rows={invoices}
        getRowKey={(row) => row.id}
        caption="Danh sách hóa đơn"
        empty={
          <EmptyState
            icon={<FileText className="h-6 w-6" aria-hidden />}
            title="Chưa có hóa đơn"
            description="Tạo hóa đơn từ một đơn hàng đã có để in hoặc đối soát VAT."
          />
        }
      />
    </div>
  );
}
