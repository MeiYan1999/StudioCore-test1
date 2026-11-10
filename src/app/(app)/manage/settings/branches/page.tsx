import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { BranchSheet } from "@/components/settings/studio-settings-form";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  listBranchesForSettings,
  type BranchSettingsView,
} from "@/lib/services/settings-write-service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chi nhánh" };

export default async function BranchesSettingsPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "settings.manage")) {
    return <ForbiddenState description="Chỉ chủ studio được quản lý chi nhánh." />;
  }
  const rows = listBranchesForSettings(getDb(), actor);
  const columns: DataTableColumn<BranchSettingsView>[] = [
    {
      key: "name",
      header: "Chi nhánh",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.address}</p>
        </div>
      ),
    },
    { key: "phone", header: "SĐT", cell: (row) => row.phone },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.status === "active" ? "success" : "neutral"}>
          {row.status === "active" ? "Hoạt động" : "Tạm khóa"}
        </Badge>
      ),
    },
    {
      key: "hours",
      header: "Giờ làm",
      cell: (row) => (
        <span className="max-w-64 truncate text-xs text-muted-foreground">
          {row.workingHours}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => <BranchSheet branch={row} />,
    },
  ];
  return (
    <div>
      <PageHeader
        title="Chi nhánh"
        description="Tên, địa chỉ, SĐT, trạng thái chi nhánh; phòng chụp và dịch vụ quản lý ở màn hình riêng."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/settings">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Cài đặt
              </Link>
            </Button>
            <BranchSheet />
          </div>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="Danh sách chi nhánh"
        empty={
          <EmptyState
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            title="Chưa có chi nhánh"
            description="Thêm chi nhánh đầu tiên cho studio."
          />
        }
      />
    </div>
  );
}
