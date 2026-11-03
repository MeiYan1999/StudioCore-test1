import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { AlbumCreateWizard } from "@/components/albums/album-create-wizard";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  listAlbumCustomerOptions,
  listAlbumOrderOptions,
} from "@/lib/services/album-service";

export const metadata = {
  title: "Tạo album ảnh",
};

export default async function NewAlbumPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "albums.manage")) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền tạo album ảnh." />
    );
  }

  const db = getDb();
  return (
    <div>
      <PageHeader
        title="Tạo album ảnh"
        description="Chọn nguồn ảnh, thông tin khách và quota chọn ảnh. Album demo dùng ảnh synthetic có nhãn."
        actions={
          <Button asChild variant="outline">
            <Link href="/manage/photos">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Danh sách album
            </Link>
          </Button>
        }
      />
      <AlbumCreateWizard
        branches={actor.branches}
        customers={listAlbumCustomerOptions(db, actor)}
        orders={listAlbumOrderOptions(db, actor, "")}
        defaultBranchId={actor.activeBranchId ?? actor.branches[0]?.id ?? ""}
      />
    </div>
  );
}
