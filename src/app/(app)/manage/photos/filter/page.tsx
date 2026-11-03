import Link from "next/link";
import { Images, ListFilter } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { DateTimeText } from "@/components/shared/date-time";
import { CodeFilterTool } from "@/components/photos/code-filter-tool";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { albumFilterOptions } from "@/lib/services/album-service";
import {
  getAlbumFilterSource,
  listRecentFilterJobs,
} from "@/lib/services/photo-filter-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lọc ảnh khách chọn",
};

type SearchParams = { q?: string; albumId?: string };

export default async function PhotosFilterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "albums.view")) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền lọc ảnh khách chọn." />
    );
  }
  const params = await searchParams;
  const db = getDb();
  const options = albumFilterOptions(db, actor);
  const term = params.q?.trim().toLowerCase() ?? "";
  const filteredOptions = options.albums.filter((album) => {
    if (!term) return true;
    return [album.title, album.customerName ?? "", album.orderCode ?? ""].some(
      (value) => value.toLowerCase().includes(term),
    );
  });

  const selectedAlbumId =
    params.albumId ||
    (filteredOptions.length > 0 ? filteredOptions[0]?.id ?? "" : "");

  let source = null;
  let sourceError: string | null = null;
  if (selectedAlbumId) {
    try {
      source = getAlbumFilterSource(db, actor, selectedAlbumId);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AuthorizationError) {
        sourceError = error.message;
      } else {
        throw error;
      }
    }
  }

  const recentJobs = listRecentFilterJobs(db, actor, 5);

  return (
    <div>
      <PageHeader
        title="Lọc ảnh khách chọn"
        description="Chọn nguồn album/khách/đơn, dán mã hoặc nạp mã khách đã chọn, rồi lọc file gốc trên máy tính."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/photos">
              <Images className="h-4 w-4" aria-hidden />
              Album ảnh
            </Link>
          </Button>
        }
      />

      <form
        method="get"
        className="mb-5 rounded-xl border border-border bg-surface p-4"
        aria-label="Chọn nguồn mã ảnh"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
          <div>
            <Label htmlFor="filter-source-q">Tìm nguồn</Label>
            <Input
              id="filter-source-q"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Tên album, khách, mã đơn..."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="filter-source-album">Chọn nguồn khách hàng / album / hợp đồng</Label>
            <Select
              id="filter-source-album"
              name="albumId"
              defaultValue={selectedAlbumId}
              className="mt-1.5"
            >
              {filteredOptions.length === 0 ? (
                <option value="">Không có album phù hợp</option>
              ) : null}
              {filteredOptions.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                  {album.customerName ? ` · ${album.customerName}` : ""}
                  {album.orderCode ? ` · ${album.orderCode}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Chọn nguồn</Button>
        </div>
      </form>

      {options.albums.length === 0 ? (
        <EmptyState
          icon={<ListFilter className="h-6 w-6" aria-hidden />}
          title="Chưa có album để lọc"
          description="Tạo album và nhận lựa chọn từ khách trước, hoặc dán mã trực tiếp sau khi có album."
          action={
            hasPermission(actor.permissions, "albums.manage") ? (
              <Button asChild>
                <Link href="/manage/photos/albums/new">Tạo album</Link>
              </Button>
            ) : null
          }
        />
      ) : sourceError ? (
        <Alert tone="danger">{sourceError}</Alert>
      ) : source ? (
        <CodeFilterTool
          albumId={source.albumId}
          albumTitle={source.title}
          albumFiles={source.albumFiles}
          initialCodes={source.selectedCodes}
        />
      ) : (
        <Alert tone="warning">
          Chưa chọn album nguồn. Chọn một album ở trên để nạp mã khách đã chọn và
          hiển thị badge mã hợp lệ.
        </Alert>
      )}

      {recentJobs.length > 0 ? (
        <section className="mt-6 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            Lần lọc gần đây
          </h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {recentJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-mono text-xs text-foreground">{job.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.mode === "numeric" ? "Chỉ số" : "Chữ và số"} ·{" "}
                    {job.fileType} · <DateTimeText value={job.createdAt} />
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Badge tone="success">{job.matchedCount} khớp</Badge>
                  <Badge tone="warning">{job.missingCount} missing</Badge>
                  <Badge tone="neutral">{job.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
