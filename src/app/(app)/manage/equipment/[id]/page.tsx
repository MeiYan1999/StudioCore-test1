import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { EquipmentSheet } from "@/components/wardrobe/equipment-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getEquipmentDetail,
  type EquipmentUsageView,
} from "@/lib/services/equipment-service";
import {
  EQUIPMENT_STATUS_LABELS,
} from "@/lib/wardrobe/constants";

export const metadata = {
  title: "Chi tiết thiết bị",
};

function statusTone(status: string): "success" | "info" | "warning" | "neutral" {
  if (status === "available") return "success";
  if (status === "in_use") return "info";
  if (status === "maintenance") return "warning";
  return "neutral";
}

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem thiết bị." />;
  }

  const { id } = await params;
  const equipment = getEquipmentDetail(getDb(), actor, id);
  if (!equipment) notFound();
  const canManage = hasPermission(actor.permissions, "schedule.manage");

  const columns: DataTableColumn<EquipmentUsageView>[] = [
    {
      key: "order",
      header: "Đơn / nhân sự",
      cell: (row) => (
        <div>
          <p className="font-mono text-xs text-foreground">{row.orderCode ?? "Không gắn đơn"}</p>
          <p className="text-sm text-muted-foreground">{row.staffName ?? "Không có nhân sự"}</p>
        </div>
      ),
    },
    {
      key: "checkout",
      header: "Xuất",
      cell: (row) => <DateTimeText value={row.checkedOutAt} />,
    },
    {
      key: "return",
      header: "Nhận lại",
      cell: (row) => <DateTimeText value={row.returnedAt} />,
    },
    {
      key: "condition",
      header: "Tình trạng",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.conditionOut} → {row.conditionIn ?? "chưa trả"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={equipment.name}
        description={`${equipment.serialNumber} · ${equipment.branchName}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/manage/equipment">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Danh sách thiết bị
              </Link>
            </Button>
            {canManage ? <EquipmentSheet equipment={equipment} branches={actor.branches} /> : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.6fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Trạng thái</span>
              <Badge tone={statusTone(equipment.status)}>
                {EQUIPMENT_STATUS_LABELS[equipment.status] ?? equipment.status}
              </Badge>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Danh mục</span>
              <span>{equipment.category}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Chi nhánh</span>
              <span>{equipment.branchName}</span>
            </div>
            {equipment.notes ? (
              <p className="rounded-lg bg-surface-muted p-3 text-xs text-muted-foreground">
                {equipment.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lịch sử sử dụng</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              rows={equipment.usages}
              getRowKey={(row) => row.id}
              caption="Lịch sử sử dụng thiết bị"
              empty={
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Chưa có lịch sử sử dụng.
                </p>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
