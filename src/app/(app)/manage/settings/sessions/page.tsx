import Link from "next/link";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import { revokeSessionAction } from "@/lib/actions/staff-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listActiveSessions, type SessionListItem } from "@/lib/services/staff-service";
import { truncate } from "@/lib/utils";

export const metadata = {
  title: "Phiên đăng nhập",
};

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ revoked?: string; error?: string }>;
}) {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "settings.manage")) {
    return (
      <ForbiddenState description="Chỉ chủ studio có quyền quản lý phiên đăng nhập." />
    );
  }

  const { revoked, error } = await searchParams;
  const sessions = listActiveSessions(getDb(), actor);

  const columns: DataTableColumn<SessionListItem>[] = [
    {
      key: "staff",
      header: "Nhân sự",
      cell: (row) => (
        <div className="min-w-40">
          <p className="font-medium text-foreground">{row.staffName}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.staffCode}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Vai trò",
      cell: (row) => <Badge tone="info">{row.roleLabel}</Badge>,
    },
    {
      key: "device",
      header: "Thiết bị / IP",
      cell: (row) => (
        <div className="max-w-72">
          <p className="font-mono text-xs text-foreground">{row.ip || "Không xác định"}</p>
          <p className="text-xs text-muted-foreground">
            {row.userAgent ? truncate(row.userAgent, 64) : "Không có user agent"}
          </p>
        </div>
      ),
    },
    {
      key: "created",
      header: "Bắt đầu",
      cell: (row) => <DateTimeText value={row.createdAt} />,
    },
    {
      key: "expires",
      header: "Hết hạn",
      cell: (row) => <DateTimeText value={row.expiresAt} />,
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) =>
        row.isCurrent ? (
          <Badge tone="success">Phiên hiện tại</Badge>
        ) : (
          <Badge tone="neutral">Đang hoạt động</Badge>
        ),
    },
    {
      key: "actions",
      header: "Hành động",
      className: "text-right",
      cell: (row) =>
        row.isCurrent ? (
          <span className="text-xs text-muted-foreground">Dùng đăng xuất</span>
        ) : (
          <ConfirmActionButton
            action={revokeSessionAction}
            fields={{ sessionId: row.id }}
            title="Thu hồi phiên đăng nhập?"
            description={`Phiên của ${row.staffName} sẽ bị đăng xuất ngay. Người dùng cần đăng nhập lại để tiếp tục.`}
            triggerLabel="Thu hồi"
            confirmLabel="Thu hồi phiên"
          />
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Phiên đăng nhập"
        description="Chỉ hiển thị các phiên còn hiệu lực. Phiên hết hạn tự động không còn trong danh sách."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/settings">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Cài đặt
            </Link>
          </Button>
        }
      />

      {revoked ? (
        <Alert tone="success" className="mb-4">
          Đã thu hồi phiên đăng nhập.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        rows={sessions}
        getRowKey={(row) => row.id}
        caption="Danh sách phiên đăng nhập đang hoạt động"
        empty={
          <EmptyState
            icon={<MonitorSmartphone className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có phiên nào"
            description="Các phiên đăng nhập còn hiệu lực sẽ xuất hiện tại đây."
          />
        }
      />
    </div>
  );
}
