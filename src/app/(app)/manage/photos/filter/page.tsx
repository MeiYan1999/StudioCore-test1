import { ForbiddenState } from "@/components/shared/forbidden-state";
import { DateTimeText } from "@/components/shared/date-time";
import { Badge } from "@/components/ui/badge";
import { CodeFilterTool } from "@/components/photos/code-filter-tool";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { albumFilterOptions } from "@/lib/services/album-service";
import {
  getAlbumFilterSource,
  listRecentFilterJobs,
} from "@/lib/services/photo-filter-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Phần Mềm Lọc Ảnh — StudioCore",
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

  const selectedAlbumId =
    params.albumId ||
    (options.albums.length > 0 ? options.albums[0]?.id ?? "" : "");

  let source = null;
  if (selectedAlbumId) {
    try {
      source = getAlbumFilterSource(db, actor, selectedAlbumId);
    } catch {
      // Bỏ qua nếu không tải được album mặc định
    }
  }

  const recentJobs = listRecentFilterJobs(db, actor, 5);

  return (
    <div className="space-y-6 pb-12">
      <CodeFilterTool
        albumId={source?.albumId}
        albumTitle={source?.title}
        albumFiles={source?.albumFiles ?? []}
        initialCodes={source?.selectedCodes ?? []}
        albumsList={options.albums}
      />

      {recentJobs.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-5 md:p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-foreground md:text-base">
            Lịch Sử Lọc Gần Đây
          </h2>
          <ul className="mt-3 divide-y divide-border text-xs">
            {recentJobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground">{job.id}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {job.mode === "numeric" ? "Chỉ lấy số" : "Chữ và số"} ·{" "}
                    {job.fileType === "raw" ? "Chỉ RAW" : job.fileType === "standard" ? "Chỉ JPG/PNG" : "Tất cả file"} · <DateTimeText value={job.createdAt} />
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="success">{job.matchedCount} khớp</Badge>
                  {job.missingCount > 0 && <Badge tone="warning">{job.missingCount} thiếu</Badge>}
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
