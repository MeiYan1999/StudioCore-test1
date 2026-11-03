import Link from "next/link";
import { Download, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { CustomerFormSheet } from "@/components/crm/customer-form-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SOURCES,
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TIER_LABELS,
  CUSTOMER_TIERS,
} from "@/lib/crm/constants";
import { getDb } from "@/lib/db/client";
import {
  listCustomers,
  type CustomerListItem,
} from "@/lib/services/customer-service";
import { listStaffOptions } from "@/lib/services/staff-options";

export const metadata = {
  title: "Khách hàng",
};

type SearchParams = {
  q?: string;
  status?: string;
  tier?: string;
  source?: string;
  ownerId?: string;
  branchId?: string;
  segment?: string;
  page?: string;
};

function buildHref(
  base: string,
  searchParams: SearchParams,
  overrides: Partial<SearchParams> = {},
): string {
  const params = new URLSearchParams();
  const merged = { ...searchParams, ...overrides };

  for (const [key, value] of Object.entries(merged)) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }

  if (merged.page) {
    params.set("page", merged.page);
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

function statusTone(status: string): "success" | "info" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "lead") return "info";
  if (status === "inactive") return "warning";
  return "neutral";
}

function tierTone(tier: string): "warning" | "info" | "neutral" {
  if (tier === "vvip") return "warning";
  if (tier === "vip") return "info";
  return "neutral";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireActor();

  if (!hasPermission(actor.permissions, "customers.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem khách hàng." />;
  }

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filters = {
    q: params.q,
    status: params.status,
    tier: params.tier,
    source: params.source,
    ownerId: params.ownerId,
    branchId: params.branchId,
    segment: params.segment,
    page,
    pageSize: 20,
  };

  const result = listCustomers(getDb(), actor, filters);
  const staffOptions = listStaffOptions(getDb(), actor, "customers.view");
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const canManage = hasPermission(actor.permissions, "customers.manage");
  const defaultBranchId =
    actor.activeBranchId ?? actor.branches[0]?.id ?? "";
  const exportHref = buildHref("/api/exports/customers", {
    q: params.q,
    status: params.status,
    tier: params.tier,
    source: params.source,
    ownerId: params.ownerId,
    branchId: params.branchId,
    segment: params.segment,
  });

  const columns: DataTableColumn<CustomerListItem>[] = [
    {
      key: "name",
      header: "Khách hàng",
      cell: (row) => (
        <div className="min-w-40">
          <Link
            href={`/manage/customers/${row.id}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {row.name}
          </Link>
          <p className="text-xs tabular-nums text-muted-foreground">{row.phone}</p>
          {row.tags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {row.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} tone="neutral" className="px-1.5 py-0 text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Liên hệ",
      cell: (row) => (
        <div className="text-sm">
          <p className="text-foreground">{row.email ?? "Chưa có email"}</p>
          <p className="text-xs text-muted-foreground">{row.branchName}</p>
        </div>
      ),
    },
    {
      key: "segment",
      header: "Hạng / Trạng thái",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={tierTone(row.tier)}>{CUSTOMER_TIER_LABELS[row.tier] ?? row.tier}</Badge>
          <Badge tone={statusTone(row.status)}>
            {CUSTOMER_STATUS_LABELS[row.status] ?? row.status}
          </Badge>
        </div>
      ),
    },
    {
      key: "source",
      header: "Nguồn",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {CUSTOMER_SOURCE_LABELS[row.source] ?? row.source}
        </span>
      ),
    },
    {
      key: "owner",
      header: "Phụ trách",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.ownerName ?? "Chưa phân công"}
        </span>
      ),
    },
    {
      key: "followUp",
      header: "Follow-up",
      cell: (row) => (
        <div className="text-sm">
          <DateText value={row.followUpAt} />
          {row.followUpOverdue ? (
            <p className="text-xs text-[var(--danger)]">Quá hạn</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Hành động",
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/manage/customers/${row.id}`}>Xem hồ sơ</Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Khách hàng"
        description={`${result.total} khách trong phạm vi xem. Tìm theo tên, SĐT, email, tag hoặc ghi chú.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={exportHref}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Xuất CSV
              </Link>
            </Button>
            {canManage ? (
              <CustomerFormSheet
                mode="create"
                branches={actor.branches}
                staffOptions={staffOptions}
                defaultBranchId={defaultBranchId}
              />
            ) : null}
          </>
        }
      />

      <form
        method="get"
        className="mb-5 rounded-xl border border-border bg-surface p-4"
        aria-label="Bộ lọc khách hàng"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Label htmlFor="filter-q">Tìm kiếm</Label>
            <Input
              id="filter-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Tên, SĐT, email, tag..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="filter-status">Trạng thái</Label>
            <Select
              id="filter-status"
              name="status"
              defaultValue={params.status ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {CUSTOMER_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-tier">Hạng</Label>
            <Select id="filter-tier" name="tier" defaultValue={params.tier ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              {CUSTOMER_TIERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-source">Nguồn</Label>
            <Select
              id="filter-source"
              name="source"
              defaultValue={params.source ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {CUSTOMER_SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-segment">Phân khúc</Label>
            <Select
              id="filter-segment"
              name="segment"
              defaultValue={params.segment ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {CUSTOMER_SEGMENTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filter-owner">Phụ trách</Label>
            <Select
              id="filter-owner"
              name="ownerId"
              defaultValue={params.ownerId ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {staffOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          {actor.branches.length > 1 ? (
            <div>
              <Label htmlFor="filter-branch">Chi nhánh</Label>
              <Select
                id="filter-branch"
                name="branchId"
                defaultValue={params.branchId ?? ""}
                className="mt-1.5"
              >
                <option value="">Tất cả được xem</option>
                {actor.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            Lọc
          </Button>
          <Button asChild type="button" size="sm" variant="ghost">
            <Link href="/manage/customers">Xóa bộ lọc</Link>
          </Button>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={result.items}
        getRowKey={(row) => row.id}
        caption="Danh sách khách hàng"
        empty={
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title="Chưa có khách hàng phù hợp"
            description="Thử xóa bộ lọc hoặc thêm khách hàng mới."
            action={
              canManage ? (
                <CustomerFormSheet
                  mode="create"
                  branches={actor.branches}
                  staffOptions={staffOptions}
                  defaultBranchId={defaultBranchId}
                />
              ) : null
            }
          />
        }
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          Trang {result.page} / {totalPages} · {result.total} khách
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={buildHref("/manage/customers", params, {
                page: String(Math.max(1, result.page - 1)),
              })}
              aria-disabled={result.page <= 1}
              className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}
            >
              Trước
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={buildHref("/manage/customers", params, {
                page: String(Math.min(totalPages, result.page + 1)),
              })}
              aria-disabled={result.page >= totalPages}
              className={
                result.page >= totalPages ? "pointer-events-none opacity-50" : undefined
              }
            >
              Sau
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
