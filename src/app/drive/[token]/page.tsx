import { notFound } from "next/navigation";
import { CloudOff, HardDrive } from "lucide-react";
import { getDb } from "@/lib/db/client";
import {
  getDriveGallery,
  getDriveShareByToken,
  recordDriveView,
} from "@/lib/services/drive-service";
import { hasDriveAccess } from "@/lib/share/drive-access";
import { CustomerGallery, DrivePinForm } from "@/components/drive/customer-gallery";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "StudioCore Drive",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

export default async function DriveCustomerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const share = getDriveShareByToken(db, token);
  if (!share) notFound();
  const gallery = getDriveGallery(db, token, await hasDriveAccess(share));
  if (!gallery) notFound();
  recordDriveView(db, token);
  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-4 border-b border-border pb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <HardDrive className="size-5" />
            StudioCore Drive
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold sm:text-3xl">{gallery.title}</h1>
            <Badge tone={gallery.online ? "success" : "neutral"}>
              {gallery.online ? "Studio đang kết nối" : "Studio ngoại tuyến"}
            </Badge>
          </div>
          {gallery.customerName && (
            <p className="text-sm text-muted-foreground">Dành cho {gallery.customerName}</p>
          )}
        </header>
        {gallery.status === "paused" ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center">
            Link tạm dừng
          </p>
        ) : gallery.expired ? (
          <p className="rounded-xl border border-border bg-surface p-8 text-center">
            Link đã hết hạn
          </p>
        ) : gallery.pinRequired ? (
          <DrivePinForm token={token} />
        ) : (
          <>
            {!gallery.online && (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                <CloudOff className="size-6 shrink-0" />
                <p>Máy tính của studio đang tắt hoặc mất kết nối, vui lòng thử lại sau</p>
              </div>
            )}
            <CustomerGallery gallery={gallery} token={token} />
          </>
        )}
        <footer className="pt-6 text-center text-xs text-muted-foreground">
          Chia sẻ riêng tư cùng StudioCore
        </footer>
      </div>
    </main>
  );
}
