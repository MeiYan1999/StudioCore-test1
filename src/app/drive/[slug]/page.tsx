import type { Metadata } from "next";
import { HardDrive } from "lucide-react";
import { DriveGallery } from "@/components/drive/drive-gallery";
import { DrivePinForm } from "@/components/drive/drive-pin-form";
import { resolveDrivePublicAccess } from "@/lib/drive/public-access";
import {
  getTenantName,
  incrementDriveShareViews,
  isDriveDeviceOnline,
  listDrivePublicFiles,
} from "@/lib/services/drive-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "StudioCore Drive",
  robots: { index: false, follow: false },
};

function Notice({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HardDrive className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </main>
  );
}

export default async function DriveSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, state, share, device } = await resolveDrivePublicAccess(slug);

  if (state === "not_found" || !share) {
    return <Notice title="Không tìm thấy link" description="Link không tồn tại hoặc đã bị xóa." />;
  }
  if (state === "paused") {
    return <Notice title="Link đang tạm dừng" description="Studio đã tạm dừng link này. Vui lòng liên hệ studio." />;
  }
  if (state === "expired") {
    return <Notice title="Link đã hết hạn" description="Vui lòng liên hệ studio để được gia hạn." />;
  }
  const studioName = getTenantName(db, share.tenantId);
  if (state === "locked") {
    return <DrivePinForm slug={slug} title={share.title} studioName={studioName} />;
  }

  incrementDriveShareViews(db, share.id);
  return (
    <DriveGallery
      slug={slug}
      title={share.title}
      clientName={share.clientName}
      studioName={studioName}
      kind={share.kind === "deliver" ? "deliver" : "select"}
      maxSelect={share.maxSelect}
      allowOriginal={share.allowOriginal}
      submittedAt={share.submittedAt?.getTime() ?? null}
      online={!!device && isDriveDeviceOnline(device)}
      files={listDrivePublicFiles(db, share.id)}
    />
  );
}
