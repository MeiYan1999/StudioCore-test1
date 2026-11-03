import Link from "next/link";
import { ArrowLeft, ClipboardClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import {
  AttendanceCheckInSheet,
  CheckOutButton,
} from "@/components/hr/hr-controls";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listAttendance, type AttendanceView } from "@/lib/services/hr-service";
import { listHrStaff } from "@/lib/services/commission-payroll-service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chấm công" };

const METHOD_LABELS: Record<string, string> = {
  manual: "Thủ công",
  gps: "GPS",
  qr: "QR",
};

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "staff.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem chấm công." />;
  }
  const params = await searchParams;
  const rows = listAttendance(getDb(), actor, params);
  const canManage =
    hasPermission(actor.permissions, "staff.manage") ||
    hasPermission(actor.permissions, "schedule.manage");
  const staff = listHrStaff(getDb(), actor);
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";

  const columns: DataTableColumn<AttendanceView>[] = [
    {
      key: "staff",
      header: "Nhân sự",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.staffName}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.staffCode}</p>
        </div>
      ),
    },
    { key: "branch", header: "Chi nhánh", cell: (row) => row.branchName },
    {
      key: "in",
      header: "Check-in",
      cell: (row) => <DateTimeText value={row.checkInAt} />,
    },
    {
      key: "out",
      header: "Check-out",
      cell: (row) =>
        row.checkOutAt ? (
          <DateTimeText value={row.checkOutAt} />
        ) : (
          <Badge tone="warning">Đang mở</Badge>
        ),
    },
    {
      key: "method",
      header: "Phương thức",
      cell: (row) => (
        <div className="text-xs">
          <p>{METHOD_LABELS[row.method] ?? row.method}</p>
          {row.latitude ? (
            <p className="text-muted-foreground">
              {row.latitude}, {row.longitude}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        canManage && !row.checkOutAt ? (
          <CheckOutButton attendanceId={row.id} />
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Chấm công"
        description="Check-in/out thủ công, GPS hoặc QR; lưu vị trí/thiết bị và audit."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/staff">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Nhân sự
              </Link>
            </Button>
            {canManage ? (
              <AttendanceCheckInSheet
                staff={staff}
                branches={actor.branches}
                defaultBranchId={defaultBranchId}
              />
            ) : null}
          </>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4">
        <div>
          <Label htmlFor="attendance-from">Từ ngày</Label>
          <Input id="attendance-from" name="from" type="date" defaultValue={params.from ?? ""} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="attendance-to">Đến ngày</Label>
          <Input id="attendance-to" name="to" type="date" defaultValue={params.to ?? ""} className="mt-1.5" />
        </div>
        <Button type="submit" size="sm">Lọc</Button>
      </form>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Danh sách chấm công"
        empty={
          <EmptyState
            icon={<ClipboardClock className="h-6 w-6" aria-hidden />}
            title="Chưa có bản ghi chấm công"
            description="Check-in cho nhân sự để bắt đầu tính ngày công."
          />
        }
      />
    </div>
  );
}
