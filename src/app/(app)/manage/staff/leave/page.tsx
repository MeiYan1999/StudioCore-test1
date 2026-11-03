import Link from "next/link";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { LeaveCreateSheet, LeaveStatusButtons } from "@/components/hr/hr-controls";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listHrStaff } from "@/lib/services/commission-payroll-service";
import { listLeaveRequests, type LeaveView } from "@/lib/services/hr-service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nghỉ phép" };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "staff.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem nghỉ phép." />;
  }
  const params = await searchParams;
  const rows = listLeaveRequests(getDb(), actor, params.status);
  const canApprove = hasPermission(actor.permissions, "staff.manage");
  const staff = listHrStaff(getDb(), actor);
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";

  const columns: DataTableColumn<LeaveView>[] = [
    {
      key: "staff",
      header: "Nhân sự",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.staffName}</p>
          <p className="text-xs text-muted-foreground">{row.branchName}</p>
        </div>
      ),
    },
    { key: "from", header: "Từ", cell: (row) => <DateTimeText value={row.startAt} /> },
    { key: "to", header: "Đến", cell: (row) => <DateTimeText value={row.endAt} /> },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge
          tone={
            row.status === "approved"
              ? "success"
              : row.status === "rejected"
                ? "danger"
                : "warning"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    { key: "reason", header: "Lý do", cell: (row) => row.reason ?? "—" },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        canApprove && row.status === "pending" ? (
          <LeaveStatusButtons leaveId={row.id} />
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Nghỉ phép"
        description="Đơn nghỉ có trạng thái chờ/duyệt/từ chối; duyệt gửi notification cho nhân sự."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/staff">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Nhân sự
              </Link>
            </Button>
            <LeaveCreateSheet
              staff={staff}
              branches={actor.branches}
              defaultBranchId={defaultBranchId}
            />
          </>
        }
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4">
        <div>
          <Label htmlFor="leave-status">Trạng thái</Label>
          <Select id="leave-status" name="status" defaultValue={params.status ?? ""} className="mt-1.5">
            <option value="">Tất cả</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </Select>
        </div>
        <Button type="submit" size="sm">Lọc</Button>
      </form>
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Danh sách đơn nghỉ phép"
        empty={
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" aria-hidden />}
            title="Chưa có đơn nghỉ"
            description="Tạo đơn để gửi owner duyệt."
          />
        }
      />
    </div>
  );
}
