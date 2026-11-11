import Link from "next/link";
import { FileText, ReceiptText } from "lucide-react";
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
import { OrderCreateSheet } from "@/components/orders/order-create-sheet";
import { ContractCreateModal } from "@/components/orders/contract-create-modal";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ORDER_STATUSES, ORDER_STATUS_META, isOrderStatus } from "@/lib/orders/status";
import { listCatalogOptions, listServices } from "@/lib/services/catalog-service";
import { listCustomerOptions } from "@/lib/services/customer-service";
import { listOrders, orderAssigneeOptions, type OrderListItem } from "@/lib/services/order-service";
import { listRooms } from "@/lib/services/room-service";
import { getTenantSettings } from "@/lib/services/settings-service";

export const metadata = {
  title: "Đơn hàng",
};

type SearchParams = {
  q?: string;
  status?: string;
  branchId?: string;
  page?: string;
};

function buildHref(
  searchParams: SearchParams,
  overrides: Partial<SearchParams> = {},
): string {
  const params = new URLSearchParams();
  const merged = { ...searchParams, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }
  if (merged.page) params.set("page", merged.page);
  const query = params.toString();
  return query ? `/manage/orders?${query}` : "/manage/orders";
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "orders.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem đơn hàng." />;
  }

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filters = {
    q: params.q,
    status: params.status,
    branchId: params.branchId,
    page,
    pageSize: 20,
  };

  const result = listOrders(getDb(), actor, filters);
  const canManage = hasPermission(actor.permissions, "orders.manage");
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";

  const services = listServices(getDb(), actor);
  const rooms = listRooms(getDb(), actor);
  const tenantSettings = getTenantSettings(getDb(), actor.tenantId);
  const studioBankConfig = {
    bankBin: tenantSettings["payment.bankBin"] || "970422",
    bankName: tenantSettings["payment.bankName"] || "MBBank",
    accountNumber: tenantSettings["payment.bankAccountNumber"] || "",
    accountName: tenantSettings["payment.bankAccountName"] || actor.tenantName,
  };

  const createContractModal = canManage ? (
    <ContractCreateModal
      branches={actor.branches}
      services={services}
      rooms={rooms}
      assignees={orderAssigneeOptions(getDb(), actor)}
      defaultBranchId={defaultBranchId}
      studioBankConfig={studioBankConfig}
      trigger={
        <Button variant="primary">
          <FileText className="h-4 w-4 mr-1.5" />
          Thêm hợp đồng mới
        </Button>
      }
    />
  ) : null;

  const createSheet = canManage ? (
    <OrderCreateSheet
      branches={actor.branches}
      customers={listCustomerOptions(getDb(), actor)}
      catalog={listCatalogOptions(getDb(), actor)}
      assignees={orderAssigneeOptions(getDb(), actor)}
      defaultBranchId={defaultBranchId}
    />
  ) : null;

  const columns: DataTableColumn<OrderListItem>[] = [
    {
      key: "code",
      header: "Đơn hàng",
      cell: (row) => (
        <div className="min-w-36">
          <Link
            href={`/manage/orders/${row.id}`}
            className="font-mono text-sm font-semibold text-foreground hover:text-primary"
          >
            {row.code}
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
          <p className="font-medium text-foreground">{row.customerName}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{row.customerPhone}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const meta = isOrderStatus(row.status)
          ? ORDER_STATUS_META[row.status]
          : { label: row.status, tone: "neutral" as const };
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "schedule",
      header: "Lịch chụp",
      cell: (row) => <DateTimeText value={row.scheduledAt} />,
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
      header: "Còn lại",
      className: "text-right",
      cell: (row) => (
        <span className={row.remaining > 0 ? "font-medium text-[var(--warning)]" : ""}>
          <Money value={row.remaining} />
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/manage/orders/${row.id}`}>Xem</Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Đơn hàng"
        description={`${result.total} đơn trong phạm vi xem. Tìm theo mã đơn, tên hoặc SĐT khách.`}
        actions={
          <div className="flex items-center gap-2">
            {createContractModal}
            {createSheet}
          </div>
        }
      />

      <form
        method="get"
        className="mb-5 rounded-xl border border-border bg-surface p-4"
        aria-label="Bộ lọc đơn hàng"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label htmlFor="order-filter-q">Tìm kiếm</Label>
            <Input
              id="order-filter-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Mã đơn, tên, SĐT..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="order-filter-status">Trạng thái</Label>
            <Select
              id="order-filter-status"
              name="status"
              defaultValue={params.status ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </div>
          {actor.branches.length > 1 ? (
            <div>
              <Label htmlFor="order-filter-branch">Chi nhánh</Label>
              <Select
                id="order-filter-branch"
                name="branchId"
                defaultValue={params.branchId ?? ""}
                className="mt-1.5"
              >
                <option value="">Tất cả được xem</option>
                {actor.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            Lọc
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/manage/orders">Xóa bộ lọc</Link>
          </Button>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={result.items}
        getRowKey={(row) => row.id}
        caption="Danh sách đơn hàng"
        empty={
          <EmptyState
            icon={<ReceiptText className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có đơn hàng phù hợp"
            description="Thử xóa bộ lọc hoặc tạo đơn hàng mới."
            action={createSheet}
          />
        }
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          Trang {result.page} / {totalPages} · {result.total} đơn
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={buildHref(params, { page: String(Math.max(1, result.page - 1)) })}
              aria-disabled={result.page <= 1}
              className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
            >
              Trước
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={buildHref(params, {
                page: String(Math.min(totalPages, result.page + 1)),
              })}
              aria-disabled={result.page >= totalPages}
              className={
                result.page >= totalPages ? "pointer-events-none opacity-50" : undefined
              }
            >
              Sau
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
