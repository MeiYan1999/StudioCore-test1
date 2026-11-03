import Link from "next/link";
import { ArrowLeft, PackageOpen } from "lucide-react";
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
import { ReturnRentalSheet } from "@/components/wardrobe/rental-sheets";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listRentals, type RentalView } from "@/lib/services/wardrobe-service";
import {
  RENTAL_STATUSES,
  RENTAL_STATUS_LABELS,
} from "@/lib/wardrobe/constants";

export const metadata = {
  title: "Phiếu thuê trang phục",
};

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem phiếu thuê." />;
  }

  const params = await searchParams;
  const rentals = listRentals(getDb(), actor, {
    q: params.q,
    status: params.status,
  });
  const canManage = hasPermission(actor.permissions, "schedule.manage");

  const columns: DataTableColumn<RentalView>[] = [
    {
      key: "item",
      header: "Trang phục",
      cell: (row) => (
        <div>
          <Link
            href={`/manage/wardrobe/${row.wardrobeItemId}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {row.itemName}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{row.itemQr}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Đơn / khách",
      cell: (row) => (
        <div className="text-sm">
          <p className="font-mono text-xs">{row.orderCode ?? "Không gắn đơn"}</p>
          <p className="text-muted-foreground">{row.customerName ?? "Không gắn khách"}</p>
        </div>
      ),
    },
    {
      key: "due",
      header: "Hạn trả",
      cell: (row) => (
        <div>
          <DateTimeText value={row.dueAt} />
          {row.overdue ? <p className="text-xs text-[var(--danger)]">Quá hạn</p> : null}
        </div>
      ),
    },
    {
      key: "returned",
      header: "Đã trả",
      cell: (row) => <DateTimeText value={row.returnedAt} />,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.status === "active" ? "info" : row.status === "returned" ? "success" : "neutral"}>
          {RENTAL_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "fees",
      header: "Phí",
      className: "text-right",
      cell: (row) => <Money value={row.cleaningFee + row.damageFee} />,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (row: RentalView) =>
              row.status === "active" ? <ReturnRentalSheet rental={row} /> : null,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Phiếu thuê trang phục"
        description="Theo dõi xuất kho, hạn trả, phí giặt/đền bù và lịch sử nhận lại."
        actions={
          <Button asChild variant="outline">
            <Link href="/manage/wardrobe">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Kho trang phục
            </Link>
          </Button>
        }
      />

      <form method="get" className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.6fr_auto] md:items-end">
          <div>
            <Label htmlFor="rental-filter-q">Tìm / quét QR</Label>
            <Input
              id="rental-filter-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Mã QR, tên trang phục, mã đơn, khách..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="rental-filter-status">Trạng thái</Label>
            <Select
              id="rental-filter-status"
              name="status"
              defaultValue={params.status ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {RENTAL_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Lọc</Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/manage/wardrobe/rentals">Xóa lọc</Link>
            </Button>
          </div>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={rentals}
        getRowKey={(row) => row.id}
        caption="Danh sách phiếu thuê"
        empty={
          <EmptyState
            icon={<PackageOpen className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có phiếu thuê"
            description="Tạo phiếu thuê từ trang chi tiết trang phục đang sẵn sàng."
          />
        }
      />
    </div>
  );
}
