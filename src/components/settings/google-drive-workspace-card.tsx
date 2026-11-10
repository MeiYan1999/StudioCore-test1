"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Folder,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import type { GoogleDriveWorkspaceInfo } from "@/lib/services/drive-connection-service";
import { refreshGoogleDriveTokenAction, disconnectGoogleAction } from "@/lib/actions/integration-actions";

function GoogleGIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.04c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.28 21.43 7.34 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28c-.25-.72-.38-1.49-.38-2.28s.13-1.56.38-2.28V6.59H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.41l4.03-3.13z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.28 2.57 1.25 6.59l4.03 3.13c.95-2.83 3.6-4.97 6.72-4.97z"
      />
    </svg>
  );
}

function GoogleDriveBrandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" aria-hidden="true">
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.9 2.5 3.2 3.3l12.3-21.3H7.2c-.6 0-1.2.1-1.8.4-.6.2-1.1.6-1.5 1.1-.8.9-1.2 2-1.2 3.2 0 1.2.4 2.3 1.2 3.2.5.5 1 .9 1.7 1.2.6.3 1.3.4 2 .4z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-12.3-21.3c-1.3.8-2.4 1.9-3.2 3.3L2.4 51.5c-.8 1.4-1.2 2.9-1.2 4.5 0 .6.1 1.2.3 1.8.2.6.6 1.1 1 1.6.4.5 1 .9 1.6 1.2.6.3 1.2.4 1.9.4h18.75z"
        fill="#00ac47"
      />
      <path
        d="M73.55 76.8c1.3-.8 2.4-1.9 3.2-3.3l1.6-2.75 6.4-11.1c.8-1.4 1.2-2.9 1.2-4.5 0-1.2-.4-2.3-1.2-3.2-.8-.9-1.9-1.5-3.1-1.6H56.05l5.2 9H73.55c.7 0 1.4.2 2 .5.6.3 1.1.8 1.5 1.4.4.6.6 1.3.6 2 0 .7-.2 1.4-.6 2-.4.6-.9 1.1-1.5 1.4-.7.4-1.4.5-2.1.5H39.25l-4.5 7.8 4.5 7.8h34.3z"
        fill="#ea4335"
      />
      <path
        d="M43.65 25 56 46.3h24.75c1.2 0 2.3-.4 3.2-1.2.9-.8 1.5-1.9 1.6-3.1 0-1.6-.4-3.1-1.2-4.5L66.75 7c-.8-1.4-1.9-2.5-3.2-3.3z"
        fill="#ffba00"
      />
      <path
        d="m26 55.45 9.3 16.15 4.5-7.8-9.3-16.15z"
        fill="#00832d"
      />
      <path
        d="M60.6 25 43.65 25l12.4 21.3 4.55-7.8z"
        fill="#2684fc"
      />
    </svg>
  );
}

function formatVNDateTime(iso: string | null | undefined): string {
  if (!iso) return "11:30 10/11/2026";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "11:30 10/11/2026";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

type Props = {
  info: GoogleDriveWorkspaceInfo;
  configured: boolean;
};

export function GoogleDriveWorkspaceCard({ info, configured }: Props) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    setFeedback(null);
    try {
      const res = await refreshGoogleDriveTokenAction();
      if (res.ok) {
        setFeedback({ tone: "success", text: res.message });
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi làm mới token.",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {/* Card Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <GoogleDriveBrandIcon className="h-6 w-6 shrink-0" />
        <div>
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            Google Drive
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Quản lý kết nối Google Drive để lưu trữ ảnh
          </p>
        </div>
      </div>

      {feedback ? (
        <Alert tone={feedback.tone} className="mb-4">
          {feedback.text}
        </Alert>
      ) : null}

      {info.connected ? (
        <div className="space-y-4">
          {/* Box 1: Status box (green) */}
          <div className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  Đã kết nối
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  Cập nhật: {formatVNDateTime(info.refreshedAt)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full bg-[#0284c7] px-3 py-1 text-xs font-semibold text-white shadow-xs">
              Hoạt động
            </span>
          </div>

          {/* Box 2: Token expiration box (slate) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/90 p-3.5 dark:border-border dark:bg-muted/30">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 sm:text-sm">
              Token hết hạn lúc: {formatVNDateTime(info.expiresAt)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefreshToken}
              disabled={isRefreshing}
              className="h-8 rounded-lg bg-white px-3 text-xs font-medium text-foreground shadow-xs hover:bg-slate-50 dark:bg-surface dark:hover:bg-muted"
            >
              {isRefreshing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Làm mới token
            </Button>
          </div>

          {/* Box 3: Storage Quota */}
          <div className="pt-1">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground sm:text-sm">
              <span>Dung lượng đã sử dụng</span>
              <span>
                {info.storageUsageText} / {info.storageLimitText}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/60">
              <div
                className="h-full rounded-full bg-slate-500 transition-all duration-500 dark:bg-slate-400"
                style={{
                  width: `${Math.min(100, Math.max(0.2, info.percentNumber))}%`,
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {info.percentUsed} dung lượng đã sử dụng
            </p>
          </div>

          {/* Box 4: Folder info in Drive */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <Folder className="h-4 w-4 fill-current" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                  {info.folderName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {info.accountEmail
                    ? `Tài khoản: ${info.accountEmail}`
                    : "Kho lưu trữ thư mục gốc tự động trên Drive"}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {info.subfolders.map((sub) => (
                <span
                  key={sub}
                  className="inline-flex items-center rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border"
                >
                  📁 {sub}
                </span>
              ))}
            </div>
          </div>

          {/* Action buttons matching Image 1 */}
          <div className="space-y-2 pt-1">
            <Button
              asChild
              variant="outline"
              className="w-full rounded-full border-slate-300 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-border dark:hover:bg-muted"
            >
              <a href="/api/integrations/google/connect">
                <GoogleGIcon className="mr-2 h-4 w-4" />
                Kết nối lại Google Drive
              </a>
            </Button>

            <Button
              asChild
              variant="ghost"
              className="w-full rounded-full py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <a
                href={info.folderUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Mở Google Drive
              </a>
            </Button>
          </div>

          <div className="flex justify-end pt-1">
            <form action={disconnectGoogleAction}>
              <button
                type="submit"
                className="text-xs text-muted-foreground hover:text-red-600 hover:underline transition-colors"
              >
                Ngắt kết nối Google Drive
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* When NOT connected */
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <GoogleDriveBrandIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-2 text-sm font-semibold text-foreground">
              Chưa kết nối Google Drive
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
              Kho lưu trữ dữ liệu của studio: ảnh/tệp trong chat, tệp đính kèm
              đơn hàng & chi phí, ảnh checklist, sao lưu tự động...
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Khi bạn kết nối Google Drive:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Tự động tạo thư mục gốc:{" "}
                <strong className="text-foreground">{info.folderName}</strong>
              </li>
              <li>
                Tự động tạo sẵn 3 thư mục con: <em>Sao lưu tự động</em>,{" "}
                <em>Đơn hàng & Chi phí</em>, <em>Tệp tin & Tài liệu</em>
              </li>
              <li>
                Toàn bộ dữ liệu nằm an toàn trong Drive cá nhân của bạn, không lo
                mất mát.
              </li>
            </ul>
          </div>

          <div className="pt-2">
            {configured ? (
              <Button
                asChild
                className="w-full rounded-full py-2.5 text-sm font-medium shadow-xs"
              >
                <a href="/api/integrations/google/connect">
                  <GoogleGIcon className="mr-2 h-4 w-4" />
                  Kết nối Google Drive
                </a>
              </Button>
            ) : (
              <div className="space-y-2">
                <Button
                  disabled
                  className="w-full rounded-full py-2.5 text-sm font-medium"
                >
                  <GoogleGIcon className="mr-2 h-4 w-4" />
                  Kết nối Google Drive
                </Button>
                <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                  Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trong biến
                  môi trường máy chủ.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes section matching Image 1 */}
      <div className="mt-5 border-t border-border/60 pt-4">
        <p className="text-xs font-semibold text-foreground mb-1.5">Lưu ý:</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            • Token Google thường hết hạn sau 1 giờ và sẽ tự động làm mới
          </li>
          <li>
            • Nếu bạn thay đổi mật khẩu Google hoặc thu hồi quyền, cần kết nối lại
          </li>
          <li>• Ảnh được lưu trữ an toàn trong Google Drive cá nhân của bạn</li>
        </ul>
      </div>
    </div>
  );
}