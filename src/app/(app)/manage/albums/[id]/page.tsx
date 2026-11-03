import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  ImagePlus,
  Images,
  Link2,
  ListFilter,
  ShieldCheck,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { Money } from "@/components/shared/money";
import { DateTimeText } from "@/components/shared/date-time";
import { CopyCodesMenu } from "@/components/albums/copy-codes-menu";
import { AlbumSettingsSheet } from "@/components/albums/album-settings-sheet";
import { AlbumSharePanel } from "@/components/albums/album-share-panel";
import { AlbumUploadSheet } from "@/components/albums/album-upload-sheet";
import { AlbumStatusActions } from "@/components/albums/album-status-actions";
import {
  AlbumRescanButton,
  AlbumSelectionLockButton,
} from "@/components/albums/album-detail-actions";
import { StudioPhotoGallery } from "@/components/albums/studio-photo-gallery";
import { AlbumAiPanel } from "@/components/ai/album-ai-panel";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import {
  ALBUM_STATUS_META,
  SELECTION_STATUS_META,
  isAlbumStatus,
  type SelectionStatus,
} from "@/lib/albums/constants";
import { driveProviderLabel } from "@/lib/adapters/drive";
import { storageEnvSummary } from "@/lib/adapters/storage";
import {
  getAlbumDetail,
  listAlbumCustomerOptions,
  listAlbumOrderOptions,
  type AlbumDetail,
} from "@/lib/services/album-service";
import { getAiJobsForAlbum } from "@/lib/services/ai-service";
import { formatDateTime, formatVnd } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlbumDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "albums.view")) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền xem album ảnh." />
    );
  }
  const { id } = await params;
  const query = await searchParams;
  const db = getDb();

  let album: AlbumDetail;
  try {
    album = getAlbumDetail(db, actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    if (error instanceof AuthorizationError) {
      return <ForbiddenState description={error.message} />;
    }
    throw error;
  }

  const canManage = hasPermission(actor.permissions, "albums.manage");
  const customers = listAlbumCustomerOptions(db, actor);
  const orders = listAlbumOrderOptions(db, actor, "");
  const latestAiJob = getAiJobsForAlbum(db, actor, album.id, 1)[0] ?? null;
  const storage = storageEnvSummary();
  const selectedCodes = album.photos
    .filter((photo) => photo.selected)
    .map((photo) => ({
      code: photo.code,
      filename: photo.filename,
      note: photo.note,
    }));
  const statusMeta = isAlbumStatus(album.status)
    ? ALBUM_STATUS_META[album.status]
    : { label: album.status, tone: "neutral" as const };
  const selectionMeta =
    SELECTION_STATUS_META[album.selectionStatus as SelectionStatus];

  return (
    <div>
      <PageHeader
        title={album.title}
        description={`${album.customerName ?? "Chưa gắn khách"} · ${album.branchName} · ${album.orderCode ?? "Không gắn đơn"} · Tạo bởi ${album.createdByName}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/manage/photos">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Album
              </Link>
            </Button>
            {canManage ? (
              <>
                <AlbumSettingsSheet
                  album={album}
                  customers={customers}
                  orders={orders}
                />
                <AlbumUploadSheet
                  albumId={album.id}
                  maxUploadMb={storage.maxUploadMb}
                />
                {album.sources.some(
                  (source) =>
                    source.provider === "local_demo" ||
                    source.provider === "google",
                ) ? (
                  <AlbumRescanButton albumId={album.id} />
                ) : null}
              </>
            ) : null}
          </>
        }
      />

      {query.created ? (
        <Alert tone="success" className="mb-4">
          Album đã được tạo. Copy link PhotoShare bên dưới và gửi khách; mật khẩu
          và hạn dùng có thể chỉnh trong Cấu hình album.
        </Alert>
      ) : null}

      {album.id === "album-demo-01" ? (
        <Alert tone="warning" className="mb-4">
          <strong>Đây là album demo.</strong> Ảnh được sinh synthetic có nhãn,
          không dùng ảnh hay PII thật. Storage hiện là{" "}
          {storage.demoPublic
            ? "local demo tại /public/uploads"
            : storage.provider.toUpperCase()}
          .
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
        <Badge tone={selectionMeta?.tone ?? "neutral"}>
          {selectionMeta?.label ?? album.selectionStatus}
        </Badge>
        <Badge tone={album.shareRevokedAt ? "danger" : "success"}>
          {album.shareRevokedAt ? "Link đã thu hồi" : "Link đang bật"}
        </Badge>
        {album.hasPassword ? <Badge tone="info">Có mật khẩu</Badge> : null}
        <span className="text-xs text-muted-foreground">
          Tạo lúc {formatDateTime(album.createdAt)}
        </span>
      </div>

      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Ảnh sẵn sàng</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{album.stats.photoCount}</p>
          {album.stats.missingCount > 0 ? (
            <p className="text-xs text-[var(--danger)]">
              {album.stats.missingCount} ảnh missing
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Khách đã chọn</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {album.stats.selectedCount}/{album.selectionLimit}
          </p>
          {album.stats.extraCount > 0 ? (
            <p className="text-xs text-[var(--warning)]">
              Vượt {album.stats.extraCount} ảnh
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Yêu thích / ghi chú</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {album.stats.favoriteCount}/{album.stats.noteCount}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Phí ảnh thêm</p>
          <p
            className={
              album.stats.extraFee > 0
                ? "mt-1 text-xl font-semibold tabular-nums text-[var(--warning)]"
                : "mt-1 text-xl font-semibold tabular-nums"
            }
          >
            {formatVnd(album.stats.extraFee)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Lượt tải ảnh gốc</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {album.downloadCount}
            {album.downloadLimit !== null ? `/${album.downloadLimit}` : ""}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-muted-foreground">Hết hạn link</p>
          <p className="mt-1 text-sm font-medium">
            {album.expiresAt ? formatDateTime(album.expiresAt) : "Không đặt"}
          </p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <AlbumSharePanel
            albumId={album.id}
            shareLink={album.shareLink}
            expiresAt={album.expiresAt}
            hasPassword={album.hasPassword}
            allowDownloads={album.allowDownloads}
            downloadLimit={album.downloadLimit}
            downloadCount={album.downloadCount}
            shareRevoked={album.shareRevokedAt !== null}
          />

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Lựa chọn của khách
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {album.selectionSubmittedAt
                    ? `Gửi lúc ${formatDateTime(album.selectionSubmittedAt)}`
                    : "Khách chưa gửi lựa chọn."}
                  {album.selectionLockedAt
                    ? ` · Khóa lúc ${formatDateTime(album.selectionLockedAt)}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyCodesMenu items={selectedCodes} label="Copy mã khách chọn" />
                <Button asChild variant="outline" size="sm">
                  <Link href={`/manage/albums/${album.id}/notes`}>
                    <FileText className="h-4 w-4" aria-hidden />
                    Ghi chú & mã
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className={
                    selectedCodes.length === 0 ? "pointer-events-none opacity-50" : ""
                  }
                >
                  <a href={`/api/albums/${album.id}/zip`}>
                    <Download className="h-4 w-4" aria-hidden />
                    ZIP + manifest
                  </a>
                </Button>
                {canManage ? (
                  <AlbumSelectionLockButton
                    albumId={album.id}
                    locked={album.selectionStatus === "locked"}
                    canLock={album.selectionStatus === "submitted"}
                  />
                ) : null}
              </div>
            </div>

            {album.stats.extraFee > 0 ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-[var(--warning)] dark:border-amber-900 dark:bg-amber-950/40">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Khách vượt {album.stats.extraCount} ảnh · phí{" "}
                {formatVnd(album.stats.extraFee)} đã ghi nhận vào yêu cầu thanh
                toán bên dưới (chưa thu tiền).
              </div>
            ) : null}

            <div className="mt-3">
              <h3 className="text-sm font-medium text-foreground">
                Yêu cầu thanh toán ảnh thêm
              </h3>
              {album.paymentRequests.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Chưa có yêu cầu thanh toán nào.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {album.paymentRequests.map((request) => (
                    <li
                      key={request.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <div>
                        <p className="font-mono text-xs text-foreground">
                          {request.code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.note ?? "Ảnh thêm"} · {formatDateTime(request.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Money value={request.amount} className="font-medium" />
                        <Badge tone={request.status === "pending" ? "warning" : "neutral"}>
                          {request.status === "pending" ? "Chờ thu" : request.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Ảnh trong album
                </h2>
                <p className="text-sm text-muted-foreground">
                  Xem tab theo thư mục, lựa chọn và ghi chú của khách. Ảnh hiển
                  thị là preview có watermark.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/manage/albums/${album.id}/filter`}>
                    <ListFilter className="h-4 w-4" aria-hidden />
                    Lọc ảnh theo mã
                  </Link>
                </Button>
              </div>
            </div>
            {album.stats.photoCount === 0 && canManage ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-surface-muted p-4">
                <ImagePlus className="h-5 w-5 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  Album chưa có ảnh. Tải thư mục/ZIP hoặc quét lại Drive demo.
                </p>
                <AlbumUploadSheet
                  albumId={album.id}
                  maxUploadMb={storage.maxUploadMb}
                />
              </div>
            ) : null}
            <div className="mt-3">
              <StudioPhotoGallery photos={album.photos} folders={album.folders} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Link2 className="h-4 w-4 text-primary" aria-hidden />
              Nguồn ảnh
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {storage.note}
            </p>
            <ul className="mt-3 space-y-3 text-sm">
              {album.sources.length === 0 ? (
                <li className="text-muted-foreground">Album tạo từ upload local.</li>
              ) : (
                album.sources.map((source) => (
                  <li key={source.id} className="rounded-lg bg-surface-muted p-2.5">
                    <p className="font-medium text-foreground">
                      {driveProviderLabel(source.provider)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {source.displayName ?? "Không tên"} · {source.status}
                    </p>
                    <p className="mt-1 break-all text-[11px] text-muted-foreground">
                      {source.externalFolderId ?? source.sourceUrl ?? "Local upload"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Đồng bộ:{" "}
                      {source.lastSyncedAt ? (
                        <DateTimeText value={source.lastSyncedAt} />
                      ) : (
                        "Chưa quét"
                      )}
                    </p>
                    {source.error ? (
                      <p className="mt-1 text-[11px] text-[var(--danger)]">
                        {source.error}
                      </p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {canManage ? (
              <div className="mt-3">
                {album.sources.some(
                  (source) =>
                    source.provider === "local_demo" ||
                    source.provider === "google",
                ) ? (
                  <AlbumRescanButton albumId={album.id} />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Album tạo từ upload local không có nguồn Drive để quét lại.
                  </p>
                )}
              </div>
            ) : null}
          </section>

          <AlbumAiPanel
            albumId={album.id}
            canRun={canManage}
            latest={latestAiJob}
          />

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Trạng thái album
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Chuyển trạng thái có kiểm tra luồng hợp lệ và ghi audit.
            </p>
            {canManage ? (
              <div className="mt-3">
                <AlbumStatusActions albumId={album.id} status={album.status} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Bạn chỉ có quyền xem album.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 text-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Images className="h-4 w-4 text-primary" aria-hidden />
              Liên kết nhanh
            </h2>
            <div className="mt-2 space-y-2">
              {album.orderId ? (
                <Link
                  href={`/manage/orders/${album.orderId}`}
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Mở đơn {album.orderCode}
                </Link>
              ) : null}
              {album.customerId ? (
                <Link
                  href={`/manage/customers/${album.customerId}`}
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Hồ sơ {album.customerName}
                </Link>
              ) : null}
              <Link
                href={`/manage/albums/${album.id}/notes`}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Ghi chú & danh sách mã
              </Link>
              <Link
                href={`/manage/albums/${album.id}/filter`}
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Lọc ảnh theo mã khách chọn
              </Link>
            </div>
            {album.notes ? (
              <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Ghi chú nội bộ</p>
                <p className="mt-1 whitespace-pre-wrap">{album.notes}</p>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
