import { cookies } from "next/headers";
import { Images, Link2Off, ShieldAlert } from "lucide-react";
import { ShareGallery } from "@/components/share/share-gallery";
import { SharePasswordGate } from "@/components/share/share-password-gate";
import { getDb } from "@/lib/db/client";
import {
  evaluateShareAccess,
  getShareAlbumByToken,
  getShareGalleryPage,
} from "@/lib/services/share-service";
import {
  shareAccessCookieName,
  verifyShareAccess,
} from "@/lib/share/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Album ảnh",
  robots: { index: false, follow: false },
};

function ShareUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
          {title.includes("hết hạn") || title.includes("thu hồi") ? (
            <Link2Off className="h-6 w-6" aria-hidden />
          ) : (
            <ShieldAlert className="h-6 w-6" aria-hidden />
          )}
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Images className="h-3.5 w-3.5" aria-hidden />
          StudioCore PhotoShare
        </p>
      </div>
    </div>
  );
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const album = getShareAlbumByToken(db, token);

  if (!album) {
    return (
      <ShareUnavailable
        title="Không tìm thấy album"
        description="Link không đúng hoặc album đã bị xóa. Vui lòng kiểm tra lại link studio đã gửi."
      />
    );
  }

  const cookieStore = await cookies();
  const passwordVerified = await verifyShareAccess(
    cookieStore.get(shareAccessCookieName(album.id))?.value ?? null,
    album.id,
    album.token,
  );
  const access = evaluateShareAccess(db, token, passwordVerified);

  if (!access.ok) {
    if (access.reason === "password_required") {
      return <SharePasswordGate token={token} />;
    }
    if (access.reason === "expired") {
      return (
        <ShareUnavailable
          title="Link đã hết hạn"
          description="Vui lòng liên hệ studio để gia hạn link chia sẻ album."
        />
      );
    }
    if (access.reason === "revoked") {
      return (
        <ShareUnavailable
          title="Link đã bị thu hồi"
          description="Studio đã thu hồi link này. Liên hệ studio nếu bạn vẫn cần xem ảnh."
        />
      );
    }
    if (access.reason === "archived") {
      return (
        <ShareUnavailable
          title="Album đã lưu trữ"
          description="Album không còn chia sẻ công khai. Vui lòng liên hệ studio."
        />
      );
    }
    return (
      <ShareUnavailable
        title="Không tìm thấy album"
        description="Link không đúng hoặc album đã bị xóa. Vui lòng kiểm tra lại link studio đã gửi."
      />
    );
  }

  const page = getShareGalleryPage(db, access, { page: 1, pageSize: 24 });
  return <ShareGallery token={token} initial={page} />;
}
