import Link from "next/link";
import { ArrowLeft, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { RoomSheet } from "@/components/scheduling/room-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listRooms, type RoomItem } from "@/lib/services/room-service";

export const metadata = {
  title: "Phòng chụp",
};

export default async function RoomsPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem phòng chụp." />;
  }

  const rooms = listRooms(getDb(), actor);
  const canManage = hasPermission(actor.permissions, "schedule.manage");
  const columns: DataTableColumn<RoomItem>[] = [
    {
      key: "name",
      header: "Phòng",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.branchName}</p>
        </div>
      ),
    },
    {
      key: "capacity",
      header: "Sức chứa",
      className: "text-right",
      cell: (row) => <span className="tabular-nums">{row.capacity}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.status === "active" ? "success" : "neutral"}>
          {row.status === "active" ? "Đang dùng" : "Ngưng dùng"}
        </Badge>
      ),
    },
    {
      key: "notes",
      header: "Ghi chú",
      cell: (row) => (
        <span className="line-clamp-2 max-w-md text-sm text-muted-foreground">
          {row.notes ?? "Chưa có"}
        </span>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            cell: (row: RoomItem) => <RoomSheet room={row} branches={actor.branches} />,
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Phòng chụp"
        description="Phòng thuộc chi nhánh và tham gia kiểm tra xung đột lịch."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Cài đặt
              </Link>
            </Button>
            {canManage ? <RoomSheet branches={actor.branches} /> : null}
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={rooms}
        getRowKey={(row) => row.id}
        caption="Danh sách phòng chụp"
        empty={
          <EmptyState
            icon={<DoorOpen className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có phòng chụp"
            description="Thêm phòng để có thể kiểm tra xung đột khi xếp lịch."
          />
        }
      />
    </div>
  );
}
