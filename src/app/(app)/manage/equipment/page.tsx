import Link from "next/link";
import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { EquipmentSheet } from "@/components/wardrobe/equipment-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listEquipment, type EquipmentItem } from "@/lib/services/equipment-service";
import { EQUIPMENT_STATUSES, EQUIPMENT_STATUS_LABELS } from "@/lib/wardrobe/constants";

export const metadata = {
  title: "Thiết bị",
};

function statusTone(status: string): "success" | "info" | "warning" | "neutral" {
  if (status === "available") return "success";
  if (status === "in_use") return "info";
  if (status === "maintenance") return "warning";
  return "neutral";
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem thiết bị." />;
  }

  const params = await searchParams;
  const items = listEquipment(getDb(), actor, {
    q: params.q,
    status: params.status,
  });
  const canManage = hasPermission(actor.permissions, "schedule.manage");

  const columns: DataTableColumn<EquipmentItem>[] = [
    {
      key: "name",
      header: "Thiết bị",
      cell: (row) => (
        <div>
          <Link
            href={`/manage/equipment/${row.id}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {row.name}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{row.serialNumber}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Danh mục",
      cell: (row) => <Badge tone="neutral">{row.category}</Badge>,
    },
    {
      key: "branch",
      header: "Chi nhánh",
      cell: (row) => <span className="text-sm text-muted-foreground">{row.branchName}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={statusTone(row.status)}>
          {EQUIPMENT_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "notes",
      header: "Ghi chú",
      cell: (row) => (
        <span className="line-clamp-2 max-w-sm text-sm text-muted-foreground">
          {row.notes ?? "Chưa có"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/manage/equipment/${row.id}`}>Lịch sử</Link>
          </Button>
          {canManage ? <EquipmentSheet equipment={row} branches={actor.branches} /> : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Thiết bị"
        description="Máy ảnh, ống kính, đèn và phụ kiện theo chi nhánh; lịch sử sử dụng được lưu cùng đơn/buổi chụp."
        actions={canManage ? <EquipmentSheet branches={actor.branches} /> : null}
      />

      <form method="get" className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-[1.5fr_0.6fr_auto] md:items-end">
          <div>
            <Label htmlFor="equipment-filter-q">Tìm kiếm</Label>
            <Input
              id="equipment-filter-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Tên hoặc serial..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="equipment-filter-status">Trạng thái</Label>
            <Select
              id="equipment-filter-status"
              name="status"
              defaultValue={params.status ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {EQUIPMENT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">Lọc</Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/manage/equipment">Xóa lọc</Link>
            </Button>
          </div>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={items}
        getRowKey={(row) => row.id}
        caption="Danh sách thiết bị"
        empty={
          <EmptyState
            icon={<Camera className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có thiết bị"
            description="Thêm máy ảnh, ống kính hoặc phụ kiện đầu tiên."
          />
        }
      />
    </div>
  );
}
