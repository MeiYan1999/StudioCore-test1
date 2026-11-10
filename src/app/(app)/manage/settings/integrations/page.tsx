import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  HardDrive,
  Images,
  Layers,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getGoogleDriveWorkspaceInfo,
  getGoogleOAuthConfig,
} from "@/lib/services/drive-connection-service";
import { GoogleDriveWorkspaceCard } from "@/components/settings/google-drive-workspace-card";
import { storageEnvSummary } from "@/lib/adapters/storage";
import { getPaymentSettings } from "@/lib/services/finance-service";
import { getMockWebhookPublicInfo } from "@/lib/finance/webhook";
import { messagingAdapterStatus } from "@/lib/inbox/constants";
import { getCampaignAdapterStatus } from "@/lib/campaigns/constants";
import { getNotificationAdapterStatus } from "@/lib/adapters/notification";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kết nối Google Drive",
  description:
    "Kho lưu trữ dữ liệu của studio: ảnh/tệp trong chat, tệp đính kèm đơn hàng & chi phí, ảnh checklist, sao lưu tự động",
};

const STATUS_MESSAGES: Record<
  string,
  { tone: "success" | "danger" | "warning"; text: string }
> = {
  connected: {
    tone: "success",
    text: "Đã kết nối thành công Google Drive. Thư mục kho lưu trữ studio và phân vùng sao lưu đã được thiết lập.",
  },
  disconnected: { tone: "warning", text: "Đã ngắt kết nối Google Drive." },
  unconfigured: {
    tone: "warning",
    text: "Google OAuth chưa được cấu hình. Đặt GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI trước khi kết nối.",
  },
  forbidden: { tone: "danger", text: "Bạn không có quyền quản lý tích hợp." },
  error: { tone: "danger", text: "Kết nối Google Drive thất bại." },
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; message?: string }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "integrations.manage")) {
    return (
      <ForbiddenState description="Chỉ chủ studio được quản lý kết nối Google Drive và tích hợp lưu trữ." />
    );
  }

  const query = await searchParams;
  const db = getDb();
  const config = getGoogleOAuthConfig();
  const workspaceInfo = getGoogleDriveWorkspaceInfo(db, actor.tenantId);
  const status = query.google ? STATUS_MESSAGES[query.google] : null;

  // Secondary adapters info
  const storage = storageEnvSummary();
  const payment = getPaymentSettings(db, actor.tenantId);
  const webhook = getMockWebhookPublicInfo();
  const messaging = messagingAdapterStatus();
  const campaignAdapter = getCampaignAdapterStatus();
  const notificationAdapter = getNotificationAdapterStatus();

  return (
    <div className="space-y-6">
      {/* Header matching StudioBase: Back arrow + Title + Subtitle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-0.5 h-8 w-8 p-0 rounded-lg shrink-0"
          >
            <Link href="/manage/settings" aria-label="Trở lại Cài đặt">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Kết nối Google Drive
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm max-w-2xl">
              Kho lưu trữ dữ liệu của studio: ảnh/tệp trong chat, tệp đính kèm đơn
              hàng &amp; chi phí, ảnh checklist, sao lưu tự động
            </p>
          </div>
        </div>
      </div>

      {status ? (
        <Alert tone={status.tone}>
          {status.text}
          {query.message ? ` ${query.message}` : ""}
        </Alert>
      ) : null}

      {/* Main Google Drive Connection Card (Exact UI of Image 1) */}
      <div className="max-w-2xl">
        <GoogleDriveWorkspaceCard
          info={workspaceInfo}
          configured={config.configured}
        />
      </div>

      {/* Secondary storage & integration channels */}
      <div className="max-w-2xl pt-6 border-t border-border">
        <details className="group rounded-xl border border-border bg-surface p-4 transition-all">
          <summary className="flex cursor-pointer items-center justify-between font-semibold text-foreground text-sm select-none">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Các hạ tầng lưu trữ &amp; tích hợp khác (Local Storage, NAS, Thanh toán)
            </span>
            <span className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

          <div className="mt-4 space-y-4 pt-2 border-t border-border/60">
            <div className="rounded-lg border border-border p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <HardDrive className="h-4 w-4 text-primary" />
                  Lưu trữ cục bộ / Local Storage
                </span>
                <Badge tone="success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Sẵn sàng
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tải lên và xử lý tệp tin trực tiếp trên máy chủ.
              </p>
              <div className="mt-2 flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/manage/photos/albums/new">Tạo album ảnh mới</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/manage/photos">
                    <Images className="h-4 w-4 mr-1" />
                    Danh sách album
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-[var(--warning)]" />
                  NAS / Ổ mạng nội bộ
                </span>
                <Badge tone="warning">Chưa cấu hình</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Chưa có connector kết nối máy chủ NAS nội bộ.
              </p>
            </div>

            <div className="rounded-lg border border-border p-3.5 bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Cổng thanh toán &amp; Webhook
              </h3>
              <ul className="space-y-1.5 text-xs">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Phương thức:</span>
                  <span className="font-medium text-foreground">{payment.provider}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Tài khoản VietQR:</span>
                  <span className="font-medium text-foreground">
                    {payment.bankBin && payment.accountNumber
                      ? `${payment.bankBin} - ${payment.accountNumber}`
                      : "Chưa cấu hình"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Mock Webhook:</span>
                  <span className="font-medium text-foreground">
                    {webhook.enabled ? "Bật (Development)" : "Tắt"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Fanpage / Zalo:</span>
                  <span className="font-medium text-foreground">
                    {messaging.facebook || messaging.zalo ? "Đã kết nối" : "Chưa cấu hình"}
                  </span>
                </li>
              </ul>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/manage/settings/payments/sandbox">Sandbox thanh toán</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/manage/inbox">Hộp thoại tin nhắn</Link>
                </Button>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}