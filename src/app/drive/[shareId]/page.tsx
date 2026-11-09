import Link from "next/link";
import { Link2Off } from "lucide-react";
import { getDriveShareById } from "@/lib/services/drive-service";
import { ClientDriveView } from "@/components/drive/client-drive-view";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = getDriveShareById(shareId);

  if (!share) {
    return {
      title: "Không tìm thấy link — StudioCore Drive",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${share.title} — StudioCore Drive`,
    description: `Xem và tải ảnh trực tiếp từ máy Studio: ${share.totalSizeLabel} · ${share.totalFiles} files.`,
    robots: { index: false, follow: false },
  };
}

export default async function DrivePublicSharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = getDriveShareById(shareId);

  if (!share) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground">
            <Link2Off className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">Không tìm thấy link chia sẻ</h1>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Link này có thể đã hết hạn, bị thu hồi hoặc máy tính studio đang tạm tắt. Vui lòng liên hệ
            studio để được cấp lại link truy cập.
          </p>
          <Button asChild className="mt-6 w-full" variant="outline">
            <Link href="/studiocore-drive">Tìm hiểu về StudioCore Drive</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <ClientDriveView initialShare={share} />;
}
