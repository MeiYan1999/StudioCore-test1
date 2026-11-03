import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { ActiveStatusBadge } from "@/components/shared/status-badge";
import { StaffCreateSheet } from "@/components/manage/staff-create-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listStaff, type StaffListItem } from "@/lib/services/staff-service";

export const metadata = {
  title: "Người dùng",
};

export default async function UsersPage() {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "settings.manage")) {
    return (
      <ForbiddenState description="Chỉ chủ studio có quyền quản lý người dùng và phân quyền." />
    );
  }

  const staff = listStaff(getDb(), actor);
  const roleOptions = ASSIGNABLE_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  const columns: DataTableColumn<StaffListItem>[] = [
    {
      key: "name",
      header: "Nhân sự",
      cell: (row) => (
        <div className="min-w-40">
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.code}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Vai trò",
      cell: (row) => <Badge tone="info">{row.roleLabel}</Badge>,
    },
    {
      key: "branches",
      header: "Chi nhánh",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.branches.length > 0
            ? row.branches.map((branch) => branch.name).join(", ")
            : "Chưa gán"}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Liên hệ",
      cell: (row) => (
        <div className="text-sm">
          <p className="text-foreground">{row.email ?? "Chưa có email"}</p>
          <p className="text-xs text-muted-foreground">{row.phone ?? "Chưa có SĐT"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => <ActiveStatusBadge active={row.active} />,
    },
    {
      key: "actions",
      header: "Hành động",
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/manage/settings/users/${row.id}`}>Sửa</Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Người dùng"
        description={`${staff.length} tài khoản trong studio. Quyền được kiểm tra ở server, không dựa vào menu.`}
        actions={
          <StaffCreateSheet branches={actor.branches} roleOptions={roleOptions} />
        }
      />

      <DataTable
        columns={columns}
        rows={staff}
        getRowKey={(row) => row.id}
        caption="Danh sách nhân sự"
        empty={
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có nhân sự"
            description="Dùng nút “Thêm nhân sự” ở góc trên để tạo tài khoản đầu tiên."
          />
        }
      />
    </div>
  );
}
