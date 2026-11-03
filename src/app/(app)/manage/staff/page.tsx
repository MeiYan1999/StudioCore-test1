import Link from "next/link";
import { CalendarClock, LogIn, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { StaffSalarySheet } from "@/components/hr/hr-controls";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listHrStaff, type HrStaffView } from "@/lib/services/commission-payroll-service";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nhân sự" };

export default async function StaffPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "staff.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem nhân sự." />;
  }
  const rows = listHrStaff(getDb(), actor);
  const canManage = hasPermission(actor.permissions, "staff.manage");
  const columns: DataTableColumn<HrStaffView>[] = [
    {
      key: "staff",
      header: "Nhân sự",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Vai trò",
      cell: (row) => ROLE_LABELS[row.role as Role] ?? row.role,
    },
    {
      key: "branches",
      header: "Chi nhánh",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.branches.join(", ") || "—"}</span>
      ),
    },
    {
      key: "contact",
      header: "Liên hệ",
      cell: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>{row.email ?? "—"}</p>
          <p>{row.phone ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "salary",
      header: "Lương cơ bản",
      className: "text-right",
      cell: (row) =>
        hasPermission(actor.permissions, "payroll.view") ? (
          formatVnd(row.baseSalary)
        ) : (
          <span className="text-xs text-muted-foreground">Không có quyền</span>
        ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.active ? "success" : "neutral"}>
          {row.active ? "Đang làm" : "Tạm khóa"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        canManage ? (
          <StaffSalarySheet
            staffId={row.id}
            staffName={row.name}
            baseSalary={row.baseSalary}
          />
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        description="Hồ sơ nhân sự, vai trò, chi nhánh, lương cơ bản; chấm công và nghỉ phép liên kết."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/staff/attendance">
                <LogIn className="h-4 w-4" aria-hidden />
                Chấm công
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/staff/leave">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Nghỉ phép
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/payroll">
                <Users className="h-4 w-4" aria-hidden />
                Bảng lương
              </Link>
            </Button>
          </>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Danh sách nhân sự"
        empty={<EmptyState title="Chưa có nhân sự" description="Thêm tài khoản trong Cài đặt người dùng." />}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Tài khoản/mật khẩu/PIN được quản lý trong{" "}
        {hasPermission(actor.permissions, "staff.manage") ? (
          <Link href="/manage/settings/users" className="text-primary hover:underline">
            Cài đặt người dùng
          </Link>
        ) : (
          "Cài đặt người dùng"
        )}
        ; lương cơ bản snapshot vào bảng lương khi tạo kỳ mới.
      </p>
    </div>
  );
}
