import Link from "next/link";
import { Images, ImagePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { DateTimeText } from "@/components/shared/date-time";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  ALBUM_STATUSES,
  ALBUM_STATUS_META,
  SELECTION_STATUS_META,
  isAlbumStatus,
  type SelectionStatus,
} from "@/lib/albums/constants";
import {
  listAlbumCustomerOptions,
  listAlbums,
  type AlbumListItem,
} from "@/lib/services/album-service";
import { formatVnd } from "@/lib/utils";

export const metadata = {
  title: "Album ảnh",
};

type SearchParams = {
  q?: string;
  status?: string;
  branchId?: string;
  customerId?: string;
  page?: string;
};

function buildHref(
  params: SearchParams,
  overrides: Partial<SearchParams> = {},
): string {
  const merged = { ...params, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value && key !== "page") {
      query.set(key, value);
    }
  }
  if (merged.page) query.set("page", merged.page);
  const qs = query.toString();
  return qs ? `/manage/photos?${qs}` : "/manage/photos";
}

export default async function AlbumsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "albums.view")) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền xem album ảnh." />
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const result = listAlbums(getDb(), actor, {
    q: params.q,
    status: params.status,
    branchId: params.branchId,
    customerId: params.customerId,
    page,
    pageSize: 20,
  });
  const canManage = hasPermission(actor.permissions, "albums.manage");
  const customers = listAlbumCustomerOptions(getDb(), actor);
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const columns: DataTableColumn<AlbumListItem>[] = [
    {
      key: "album",
      header: "Album",
      cell: (row) => (
        <div className="min-w-44">
          <Link
            href={`/manage/albums/${row.id}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {row.title}
          </Link>
          <p className="text-xs text-muted-foreground">{row.branchName}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Khách / đơn",
      cell: (row) => (
        <div className="text-sm">
          <p className="text-foreground">{row.customerName ?? "Chưa gắn khách"}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {row.orderCode ?? "Không gắn đơn"}
          </p>
        </div>
      ),
    },
    {
      key: "photos",
      header: "Ảnh",
      className: "text-right",
      cell: (row) => (
        <div className="text-sm tabular-nums">
          <p className="font-medium text-foreground">{row.photoCount}</p>
          <p className="text-xs text-muted-foreground">ảnh sẵn sàng</p>
        </div>
      ),
    },
    {
      key: "selections",
      header: "Khách chọn",
      className: "text-right",
      cell: (row) => (
        <div className="text-sm tabular-nums">
          <p
            className={
              row.selectedCount > row.selectionLimit
                ? "font-medium text-[var(--warning)]"
                : "font-medium text-foreground"
            }
          >
            {row.selectedCount}/{row.selectionLimit}
          </p>
          {row.extraPhotoEnabled && row.selectedCount > row.selectionLimit ? (
            <p className="text-xs text-[var(--warning)]">
              +{formatVnd((row.selectedCount - row.selectionLimit) * row.extraPhotoPrice)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {SELECTION_STATUS_META[row.selectionStatus as SelectionStatus]?.label ?? row.selectionStatus}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => {
        const meta = isAlbumStatus(row.status)
          ? ALBUM_STATUS_META[row.status]
          : { label: row.status, tone: "neutral" as const };
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "share",
      header: "Chia sẻ",
      cell: (row) => (
        <div className="text-xs text-muted-foreground">
          <p>{row.shareRevoked ? "Đã thu hồi" : "Đang bật"}</p>
          <p>
            Hết hạn:{" "}
            {row.expiresAt ? <DateTimeText value={row.expiresAt} /> : "Không"}
          </p>
        </div>
      ),
    },
    {
      key: "created",
      header: "Tạo lúc",
      cell: (row) => <DateTimeText value={row.createdAt} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/manage/albums/${row.id}`}>Mở</Link>
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Album ảnh"
        description={`${result.total} album trong phạm vi xem. Quản lý PhotoShare, lựa chọn của khách và xuất ảnh.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/manage/photos/filter">Lọc ảnh khách chọn</Link>
            </Button>
            {canManage ? (
              <Button asChild>
                <Link href="/manage/photos/albums/new">
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  Tạo album
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <form
        method="get"
        className="mb-5 rounded-xl border border-border bg-surface p-4"
        aria-label="Bộ lọc album"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label htmlFor="album-filter-q">Tìm kiếm</Label>
            <Input
              id="album-filter-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Tiêu đề, khách, mã đơn..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="album-filter-status">Trạng thái</Label>
            <Select
              id="album-filter-status"
              name="status"
              defaultValue={params.status ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {ALBUM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ALBUM_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="album-filter-customer">Khách hàng</Label>
            <Select
              id="album-filter-customer"
              name="customerId"
              defaultValue={params.customerId ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả khách</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} · {customer.phone}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="album-filter-branch">Chi nhánh</Label>
            <Select
              id="album-filter-branch"
              name="branchId"
              defaultValue={params.branchId ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả chi nhánh được xem</option>
              {actor.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            Lọc
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/manage/photos">Xóa bộ lọc</Link>
          </Button>
        </div>
      </form>

      <DataTable
        columns={columns}
        rows={result.items}
        getRowKey={(row) => row.id}
        caption="Danh sách album ảnh"
        empty={
          <EmptyState
            icon={<Images className="h-6 w-6" aria-hidden />}
            title="Chưa có album nào"
            description="Tạo album từ Google Drive hoặc tải thư mục/ZIP để bắt đầu PhotoShare."
            action={
              canManage ? (
                <Button asChild>
                  <Link href="/manage/photos/albums/new">Tạo album đầu tiên</Link>
                </Button>
              ) : null
            }
          />
        }
      />

      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Trang {result.page}/{totalPages} · {result.total} album
          </p>
          <div className="flex gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className={result.page <= 1 ? "pointer-events-none opacity-50" : ""}
            >
              <Link href={buildHref(params, { page: String(result.page - 1) })}>
                Trước
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className={
                result.page >= totalPages ? "pointer-events-none opacity-50" : ""
              }
            >
              <Link href={buildHref(params, { page: String(result.page + 1) })}>
                Sau
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
