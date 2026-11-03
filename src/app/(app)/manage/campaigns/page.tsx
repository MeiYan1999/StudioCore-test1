import { Megaphone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { CampaignSheet } from "@/components/campaigns/campaign-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_SOURCE_LABELS,
  getCampaignAdapterStatus,
} from "@/lib/campaigns/constants";
import { listCampaigns, type CampaignView } from "@/lib/services/campaign-service";
import { formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chiến dịch" };

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; branchId?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "customers.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem chiến dịch." />;
  }
  const params = await searchParams;
  const campaigns = listCampaigns(getDb(), actor, params);
  const adapter = getCampaignAdapterStatus();
  const canManage = hasPermission(actor.permissions, "customers.manage");
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";
  const totalSpend = campaigns.reduce((sum, row) => sum + row.spend, 0);
  const totalRevenue = campaigns.reduce((sum, row) => sum + row.revenue, 0);
  const totalLeads = campaigns.reduce((sum, row) => sum + row.leads, 0);

  const columns: DataTableColumn<CampaignView>[] = [
    {
      key: "name",
      header: "Chiến dịch",
      cell: (row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {CAMPAIGN_SOURCE_LABELS[row.source] ?? row.source} · {row.branchName}
          </p>
        </div>
      ),
    },
    {
      key: "budget",
      header: "Ngân sách / chi",
      className: "text-right",
      cell: (row) => (
        <div className="text-xs">
          <p>{formatVnd(row.budget)}</p>
          <p className="text-muted-foreground">{formatVnd(row.spend)}</p>
        </div>
      ),
    },
    {
      key: "leads",
      header: "Lead / đơn",
      className: "text-right",
      cell: (row) => `${row.leads} / ${row.ordersCount}`,
    },
    {
      key: "revenue",
      header: "Doanh thu",
      className: "text-right",
      cell: (row) => formatVnd(row.revenue),
    },
    {
      key: "roas",
      header: "ROAS / CPL",
      className: "text-right",
      cell: (row) => (
        <div className="text-xs">
          <p className={row.roas >= 1 ? "text-[var(--success)]" : "text-[var(--warning)]"}>
            {row.roas}x
          </p>
          <p className="text-muted-foreground">CPL {formatVnd(row.cpl)}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.status === "active" ? "success" : row.status === "paused" ? "warning" : "neutral"}>
          {CAMPAIGN_STATUS_LABELS[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key: "period",
      header: "Thời gian",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          <DateTimeText value={row.startAt} /> → <DateTimeText value={row.endAt} />
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        canManage ? (
          <CampaignSheet campaign={row} branches={actor.branches} defaultBranchId={defaultBranchId} />
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Chiến dịch"
        description={`${campaigns.length} chiến dịch · ngân sách chi ${formatVnd(totalSpend)} · doanh thu ${formatVnd(totalRevenue)} · ${totalLeads} lead.`}
        actions={
          canManage ? (
            <CampaignSheet branches={actor.branches} defaultBranchId={defaultBranchId} />
          ) : null
        }
      />
      <Alert tone="warning" className="mb-4">
        {adapter.label}. {adapter.detail}
      </Alert>
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-4">
        <div>
          <Label htmlFor="campaign-filter-status">Trạng thái</Label>
          <Select id="campaign-filter-status" name="status" defaultValue={params.status ?? ""} className="mt-1.5">
            <option value="">Tất cả</option>
            {CAMPAIGN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CAMPAIGN_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" size="sm">Lọc</Button>
      </form>
      <DataTable
        columns={columns}
        rows={campaigns}
        getRowKey={(row) => row.id}
        caption="Danh sách chiến dịch"
        empty={
          <EmptyState
            icon={<Megaphone className="h-6 w-6" aria-hidden />}
            title="Chưa có chiến dịch"
            description="Tạo chiến dịch và nhập số liệu thủ công để tính ROAS/CPL."
          />
        }
      />
    </div>
  );
}
