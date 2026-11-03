import Link from "next/link";
import { Shirt } from "lucide-react";
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
import { WardrobeItemSheet } from "@/components/wardrobe/wardrobe-item-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listWardrobeItems, type WardrobeItemView } from "@/lib/services/wardrobe-service";
import { WARDROBE_STATUSES, WARDROBE_STATUS_LABELS } from "@/lib/wardrobe/constants";

export const metadata = {
  title: "Kho trang phục",
};

function statusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "available") return "success";
  if (status === "rented") return "info";
  if (status === "cleaning") return "warning";
  return "neutral";
}

export default async function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem kho trang phục." />;
  }

  const params = await searchParams;
  const items = listWardrobeItems(getDb(), actor, {
    q: params.q,
    status: params.status,
  });
  const canManage = hasPermission(actor.permissions, "schedule.manage");

  const columns: DataTableColumn<WardrobeItemView>[] = [
    {
      key: "item",
      header: "Trang phục",
      cell: (row) => (
        <div className="min-w-40">
          <Link
            href={`/manage/wardrobe/${row.id}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {row.name}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">
            {row.sku} · {row.qrCode}
          </p>
        </div>
      ),
    },
    {
      key: "branch",
      header: "Chi nhánh",
      cell: (row) => <span className="text-sm text-muted-foreground">{row.branchName}</span>,
    },
    {
      key: "size",
      header: "Size / màu",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.size} · {row.color}
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={statusTone(row.status)}>
          {WARDROBE_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "price",
      header: "Thuê / cọc",
      className: "text-right",
      cell: (row) => (
        <div className="text-sm">
          <p><Money value={row.rentalPrice} /></p>
          <p className="text-xs text-muted-foreground">Cọc <Money value={row.depositPrice} /></p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/manage/wardrobe/${row.id}`}>Mở</Link>
          </Button>
          {canManage ? <WardrobeItemSheet item={row} branches={actor.branches} /> : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Kho trang phục"
        description="Quản lý SKU, mã QR, tình trạng và lịch sử thuê/trả."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/manage/wardrobe/rentals">Phiếu thuê</Link>
            </Button>
            {canManage ? <WardrobeItemSheet branches={actor.branches} /> : null}
          </>
        }
      />

      <form method="get" className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.6fr_auto] md:items-end">
          <div>
            <Label htmlFor="wardrobe-filter-q">Tìm / quét QR</Label>
            <Input
              id="wardrobe-filter-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Tên, SKU hoặc mã QR..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="wardrobe-filter-status">Trạng thái</Label>
            <Select
              id="wardrobe-filter-status"
              name="status"
              defaultValue={params.status ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {WARDROBE_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Lọc</Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/manage/wardrobe">Xóa lọc</Link>
            </Button>
          </div>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(row) => row.id}
        caption="Danh sách trang phục"
        empty={
          <EmptyState
            icon={<Shirt className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có trang phục phù hợp"
            description="Thử xóa bộ lọc hoặc thêm trang phục mới."
          />
        }
      />
    </div>
  );
}
