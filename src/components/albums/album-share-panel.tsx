"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  ExternalLink,
  Link2,
  LockKeyhole,
  RotateCw,
  ShieldOff,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import {
  rotateShareLinkAction,
  setShareRevokedAction,
  type AlbumShareLinkState,
} from "@/lib/actions/album-actions";
import { formatDateTime } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils/clipboard";

const initialShareState: AlbumShareLinkState = { ...initialActionState };

export function AlbumSharePanel({
  albumId,
  shareLink,
  expiresAt,
  hasPassword,
  allowDownloads,
  downloadLimit,
  downloadCount,
  shareRevoked,
}: {
  albumId: string;
  shareLink: string | null;
  expiresAt: Date | null;
  hasPassword: boolean;
  allowDownloads: boolean;
  downloadLimit: number | null;
  downloadCount: number;
  shareRevoked: boolean;
}) {
  const router = useRouter();
  const [rotateState, rotateAction] = useActionState(
    async (previousState: AlbumShareLinkState, formData: FormData) => {
      const result = await rotateShareLinkAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã tạo link mới.");
        router.refresh();
      }
      return result;
    },
    initialShareState,
  );
  const [revokeState, revokeAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await setShareRevokedAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật link chia sẻ.");
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const activeLink = rotateState.shareLink ?? shareLink;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Link2 className="h-4 w-4 text-primary" aria-hidden />
            Link PhotoShare
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Khách không cần đăng nhập. Link dùng token khó đoán; xem ảnh có
            watermark.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={shareRevoked ? "danger" : "success"}>
            {shareRevoked ? "Đã thu hồi" : "Đang hoạt động"}
          </Badge>
          <Badge tone={hasPassword ? "info" : "neutral"}>
            <LockKeyhole className="h-3 w-3" aria-hidden />
            {hasPassword ? "Có mật khẩu" : "Không mật khẩu"}
          </Badge>
        </div>
      </div>

      {activeLink ? (
        <div className="mt-3 rounded-lg border border-border bg-surface-muted p-2">
          <p className="break-all font-mono text-xs text-foreground">{activeLink}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const copied = await copyToClipboard(activeLink);
                toast[copied ? "success" : "error"](
                  copied ? "Đã copy link chia sẻ." : "Không copy được link.",
                );
              }}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy link
            </Button>
            {!shareRevoked ? (
              <Button asChild variant="outline" size="sm">
                <a href={activeLink.replace(/^https?:\/\/[^/]+/, "")} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Mở PhotoShare
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Alert tone="warning" className="mt-3">
          Không giải mã được token hiện tại (khóa mã hóa có thể đã thay đổi). Tạo
          link mới để tiếp tục chia sẻ; link cũ sẽ không còn hiệu lực.
        </Alert>
      )}

      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <dt>Hết hạn</dt>
          <dd className="text-foreground">
            {expiresAt ? formatDateTime(expiresAt) : "Không đặt"}
          </dd>
        </div>
        <div>
          <dt>Tải ảnh gốc</dt>
          <dd className="text-foreground">
            {allowDownloads
              ? downloadLimit !== null
                ? `${downloadCount}/${downloadLimit} lượt`
                : `${downloadCount} lượt (không giới hạn)`
              : "Đang chặn"}
          </dd>
        </div>
        <div>
          <dt>Bảo vệ</dt>
          <dd className="text-foreground">
            {hasPassword ? "Mật khẩu album" : "Chỉ token"}
          </dd>
        </div>
      </dl>

      {rotateState.status === "error" ? (
        <Alert tone="danger" className="mt-3">
          {rotateState.message}
        </Alert>
      ) : null}
      {rotateState.status === "success" && rotateState.shareLink ? (
        <Alert tone="success" className="mt-3">
          {rotateState.message} Link mới đã hiển thị ở trên; link cũ đã bị vô hiệu.
        </Alert>
      ) : null}
      {revokeState.status === "error" ? (
        <Alert tone="danger" className="mt-3">
          {revokeState.message}
        </Alert>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={rotateAction}>
          <input type="hidden" name="albumId" value={albumId} />
          <SubmitButton
            variant="outline"
            size="sm"
            pendingLabel="Đang tạo..."
          >
            <RotateCw className="h-4 w-4" aria-hidden />
            Tạo link mới
          </SubmitButton>
        </form>
        <form action={revokeAction}>
          <input type="hidden" name="albumId" value={albumId} />
          <input type="hidden" name="revoked" value={shareRevoked ? "off" : "on"} />
          <SubmitButton
            variant={shareRevoked ? "outline" : "destructive"}
            size="sm"
            pendingLabel="Đang cập nhật..."
          >
            {shareRevoked ? (
              <>
                <Undo2 className="h-4 w-4" aria-hidden />
                Mở lại link
              </>
            ) : (
              <>
                <ShieldOff className="h-4 w-4" aria-hidden />
                Thu hồi link
              </>
            )}
          </SubmitButton>
        </form>
        <span className="flex items-center text-xs text-muted-foreground">
          Mọi thao tác nhạy cảm đều ghi audit.
        </span>
      </div>
    </section>
  );
}
