import Link from "next/link";
import { Activity, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { activityActionLabel } from "@/lib/audit";
import {
  listActivityLogs,
  listAuditActions,
  type AuditView,
} from "@/lib/services/audit-service";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nhật ký hoạt động" };

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    action?: string;
    entity?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "audit.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem nhật ký." />;
  }
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const result = listActivityLogs(getDb(), actor, {
    q: params.q,
    action: params.action,
    entity: params.entity,
    from: params.from,
    to: params.to,
    page,
    pageSize: 30,
  });
  const actions = listAuditActions(getDb(), actor);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const canBackup = hasPermission(actor.permissions, "settings.manage");

  const columns: DataTableColumn<AuditView>[] = [
    {
      key: "action",
      header: "Hành động",
      cell: (row) => (
        <div>
          <p className="font-medium">{activityActionLabel(row.action)}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{row.action}</p>
        </div>
      ),
    },
    {
      key: "entity",
      header: "Đối tượng",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {row.entity}
          {row.entityId ? ` · ${row.entityId.slice(0, 12)}` : ""}
        </span>
      ),
    },
    { key: "actor", header: "Người thực hiện", cell: (row) => row.actorName ?? "Hệ thống" },
    {
      key: "metadata",
      header: "Metadata",
      cell: (row) => (
        <span className="block max-w-64 truncate font-mono text-[11px] text-muted-foreground">
          {row.metadata}
        </span>
      ),
    },
    { key: "time", header: "Thời điểm", cell: (row) => <DateTimeText value={row.createdAt} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Nhật ký hoạt động"
        description={`${result.total} bản ghi audit. Lọc đăng nhập, đổi quyền, thanh toán, hoa hồng, lương, hủy/hoàn và PhotoShare.`}
        actions={
          canBackup ? (
            <Button asChild variant="outline" size="sm">
              <a href="/api/exports/demo-backup">
                <Download className="h-4 w-4" aria-hidden />
                Backup demo JSON
              </a>
            </Button>
          ) : null
        }
      />
      <form method="get" className="mb-4 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-3 xl:grid-cols-6 xl:items-end">
        <div>
          <Label htmlFor="audit-q">Tìm kiếm</Label>
          <Input id="audit-q" name="q" defaultValue={params.q ?? ""} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="audit-action">Hành động</Label>
          <Select id="audit-action" name="action" defaultValue={params.action ?? ""} className="mt-1.5">
            <option value="">Tất cả</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="audit-entity">Entity</Label>
          <Input id="audit-entity" name="entity" defaultValue={params.entity ?? ""} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="audit-from">Từ ngày</Label>
          <Input id="audit-from" name="from" type="date" defaultValue={params.from ?? ""} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="audit-to">Đến ngày</Label>
          <Input id="audit-to" name="to" type="date" defaultValue={params.to ?? ""} className="mt-1.5" />
        </div>
        <Button type="submit" size="sm">Lọc</Button>
      </form>
      <DataTable
        columns={columns}
        rows={result.items}
        getRowKey={(row) => row.id}
        caption="Nhật ký hoạt động"
        empty={
          <EmptyState
            icon={<Activity className="h-6 w-6" aria-hidden />}
            title="Chưa có bản ghi"
            description="Các thao tác nhạy cảm sẽ được ghi audit."
          />
        }
      />
      {totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Trang {result.page}/{totalPages}</span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/manage/activity-log?${new URLSearchParams({
                  ...params,
                  page: String(Math.max(1, result.page - 1)),
                }).toString()}`}
              >
                Trước
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/manage/activity-log?${new URLSearchParams({
                  ...params,
                  page: String(Math.min(totalPages, result.page + 1)),
                }).toString()}`}
              >
                Sau
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
      {canBackup ? (
        <Badge tone="warning" className="mt-4">
          Backup JSON chỉ chứa dữ liệu demo của tenant hiện tại; không gồm hash mật khẩu/API key/token.
        </Badge>
      ) : null}
    </div>
  );
}
