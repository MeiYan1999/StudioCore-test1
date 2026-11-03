import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { CopyCodesMenu } from "@/components/albums/copy-codes-menu";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import {
  getAlbumDetail,
  type AlbumPhotoView,
} from "@/lib/services/album-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ghi chú & mã ảnh",
};

export default async function AlbumNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "albums.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem ghi chú album." />;
  }
  const { id } = await params;

  let album;
  try {
    album = getAlbumDetail(getDb(), actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    if (error instanceof AuthorizationError) {
      return <ForbiddenState description={error.message} />;
    }
    throw error;
  }

  const selected = album.photos.filter((photo) => photo.selected);
  const copyItems = selected.map((photo) => ({
    code: photo.code,
    filename: photo.filename,
    note: photo.note,
  }));

  const columns: DataTableColumn<AlbumPhotoView>[] = [
    {
      key: "code",
      header: "Mã ảnh",
      cell: (row) => (
        <span className="font-mono text-sm font-semibold text-foreground">
          {row.code}
        </span>
      ),
    },
    {
      key: "file",
      header: "File",
      cell: (row) => (
        <div className="min-w-40">
          <p className="truncate text-sm text-foreground">{row.filename}</p>
          <p className="text-xs text-muted-foreground">
            {row.folderName ?? "Chưa phân thư mục"}
          </p>
        </div>
      ),
    },
    {
      key: "note",
      header: "Ghi chú của khách",
      cell: (row) =>
        row.note ? (
          <p className="max-w-md whitespace-pre-wrap text-sm text-foreground">
            {row.note}
          </p>
        ) : (
          <span className="text-xs text-muted-foreground">Không có ghi chú</span>
        ),
    },
    {
      key: "selectedAt",
      header: "Chọn lúc",
      cell: (row) => <DateTimeText value={row.selectedAt} />,
    },
    {
      key: "fee",
      header: "Phí thêm",
      className: "text-right",
      cell: (row) =>
        row.extraFee > 0 ? (
          <Money value={row.extraFee} className="text-[var(--warning)]" />
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        ),
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={row.status === "ready" ? "success" : "danger"}>
          {row.status === "ready" ? "Sẵn sàng" : "Missing"}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Ghi chú & mã ảnh — ${album.title}`}
        description={`${selected.length} ảnh khách đã chọn. Ghi chú hiển thị đúng nội dung khách nhập và có thể xuất CSV/TXT.`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/manage/albums/${album.id}`}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Về album
              </Link>
            </Button>
            <CopyCodesMenu items={copyItems} label="Copy toàn bộ mã" />
            <Button asChild variant="outline" size="sm">
              <a href={`/api/albums/${album.id}/notes/export?format=csv`}>
                <Download className="h-4 w-4" aria-hidden />
                CSV
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/albums/${album.id}/notes/export?format=txt`}>
                <Download className="h-4 w-4" aria-hidden />
                TXT
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <Badge tone="info">Album: {album.title}</Badge>
        <Badge tone="neutral">Đơn: {album.orderCode ?? "Không gắn"}</Badge>
        <Badge tone="neutral">Khách: {album.customerName ?? "Không gắn"}</Badge>
        {album.stats.extraFee > 0 ? (
          <Badge tone="warning">
            Phí ảnh thêm: {album.stats.extraFee.toLocaleString("vi-VN")}đ
          </Badge>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={selected}
        getRowKey={(row) => row.id}
        caption="Danh sách ảnh khách đã chọn kèm ghi chú"
        empty={
          <EmptyState
            icon={<FileText className="h-6 w-6" aria-hidden />}
            title="Chưa có ảnh khách chọn"
            description="Khi khách gửi lựa chọn qua PhotoShare, mã ảnh và ghi chú sẽ xuất hiện tại đây."
            action={
              <Button asChild variant="outline">
                <Link href={`/manage/albums/${album.id}`}>Về album</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
