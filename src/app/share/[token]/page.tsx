import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ShareGallery } from "@/components/share/share-gallery";
import { SharePasswordGate } from "@/components/share/share-password-gate";
import { ShareUnavailable } from "@/components/share/share-unavailable";
import { getDb } from "@/lib/db/client";
import { getTenantName } from "@/lib/services/drive-service";
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
  referrer: "no-referrer",
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = getDb();
  const album = getShareAlbumByToken(db, token);

  if (!album) {
    notFound();
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
  return (
    <ShareGallery
      token={token}
      studioName={getTenantName(db, album.tenantId)}
      initial={page}
    />
  );
}
