import { ForbiddenState } from "@/components/shared/forbidden-state";
import { PageHeader } from "@/components/shared/page-header";
import { DriveManager } from "@/components/drive/drive-manager";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { listDriveDevices, listDriveSharesForTenant } from "@/lib/services/drive-service";

export const metadata = {
  title: "StudioCore Drive",
};

export const dynamic = "force-dynamic";

export default async function DrivePage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "albums.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem StudioCore Drive." />;
  }
  const db = getDb();
  return (
    <div className="space-y-6">
      <PageHeader
        title="StudioCore Drive"
        description="Gửi ảnh và video cho khách thẳng từ máy tính studio: không upload, khách xem, chọn và tải ngay trên link."
      />
      <DriveManager
        devices={listDriveDevices(db, actor)}
        shares={listDriveSharesForTenant(db, actor)}
        canManage={hasPermission(actor.permissions, "albums.manage") && !actor.readOnly}
        siteUrl={getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}
      />
    </div>
  );
}
