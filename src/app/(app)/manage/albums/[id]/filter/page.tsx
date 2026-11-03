import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { CodeFilterTool } from "@/components/photos/code-filter-tool";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { getAlbumFilterSource } from "@/lib/services/photo-filter-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lọc ảnh theo mã khách chọn",
};

export default async function AlbumFilterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "albums.view")) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền lọc ảnh album." />
    );
  }
  const { id } = await params;

  let source;
  try {
    source = getAlbumFilterSource(getDb(), actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof AuthorizationError) {
      return <ForbiddenState description={error.message} />;
    }
    throw error;
  }

  return (
    <div>
      <PageHeader
        title={`Lọc ảnh theo mã — ${source.title}`}
        description={`${source.selectedCodes.length} mã khách đã chọn · ${source.albumFiles.length} ảnh trong album. Chỉ copy file trên máy, không upload toàn bộ ảnh.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/manage/albums/${source.albumId}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Về album
            </Link>
          </Button>
        }
      />
      <CodeFilterTool
        albumId={source.albumId}
        albumTitle={source.title}
        albumFiles={source.albumFiles}
        initialCodes={source.selectedCodes}
      />
    </div>
  );
}
