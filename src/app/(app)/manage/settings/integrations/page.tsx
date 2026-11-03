import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  HardDrive,
  Images,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { DateTimeText } from "@/components/shared/date-time";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getGoogleConnection, getGoogleOAuthConfig } from "@/lib/services/drive-connection-service";
import { storageEnvSummary } from "@/lib/adapters/storage";
import { disconnectGoogleAction } from "@/lib/actions/integration-actions";
import { getPaymentSettings } from "@/lib/services/finance-service";
import { getMockWebhookPublicInfo } from "@/lib/finance/webhook";
import { messagingAdapterStatus } from "@/lib/inbox/constants";
import { getCampaignAdapterStatus } from "@/lib/campaigns/constants";
import { getNotificationAdapterStatus } from "@/lib/adapters/notification";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tích hợp Drive/NAS",
};

const STATUS_MESSAGES: Record<string, { tone: "success" | "danger" | "warning"; text: string }> = {
  connected: { tone: "success", text: "Đã kết nối Google Drive." },
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
      <ForbiddenState description="Chỉ chủ studio được quản lý kết nối Drive/NAS." />
    );
  }
  const query = await searchParams;
  const config = getGoogleOAuthConfig();
  const connection = getGoogleConnection(getDb(), actor.tenantId);
  const storage = storageEnvSummary();
  const status = query.google ? STATUS_MESSAGES[query.google] : null;
  const payment = getPaymentSettings(getDb(), actor.tenantId);
  const webhook = getMockWebhookPublicInfo();
  const messaging = messagingAdapterStatus();
  const campaignAdapter = getCampaignAdapterStatus();
  const notificationAdapter = getNotificationAdapterStatus();

  return (
    <div>
      <PageHeader
        title="Tích hợp Drive/NAS"
        description="Google Drive dùng OAuth scope tối thiểu; refresh token được mã hóa. NAS chưa cấu hình sẽ hiển thị trung thực, không giả đọc ổ đĩa."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/photos">
              <Images className="h-4 w-4" aria-hidden />
              Album ảnh
            </Link>
          </Button>
        }
      />

      {status ? (
        <Alert tone={status.tone} className="mb-4">
          {status.text}
          {query.message ? ` ${query.message}` : ""}
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Cloud className="h-4 w-4 text-primary" aria-hidden />
                Google Drive
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Scope <code>drive.readonly</code>; dùng refresh token để quét
                folder và metadata ảnh.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={config.configured ? "success" : "warning"}>
                {config.configured ? "OAuth đã cấu hình" : "OAuth chưa cấu hình"}
              </Badge>
              <Badge tone={connection ? "success" : "neutral"}>
                {connection ? "Đã kết nối" : "Chưa kết nối"}
              </Badge>
            </div>
          </div>

          <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div>
              <dt>Client ID</dt>
              <dd className="text-foreground">
                {config.configured ? "Đã đặt qua biến môi trường" : "Chưa đặt"}
              </dd>
            </div>
            <div>
              <dt>Redirect URI</dt>
              <dd className="break-all text-foreground">
                {config.configured ? config.redirectUri : "Chưa đặt"}
              </dd>
            </div>
            <div>
              <dt>Lần đồng bộ gần nhất</dt>
              <dd className="text-foreground">
                {connection?.lastSyncedAt ? (
                  <DateTimeText value={connection.lastSyncedAt} />
                ) : (
                  "Chưa có"
                )}
              </dd>
            </div>
            <div>
              <dt>Trạng thái token</dt>
              <dd className="flex items-center gap-1 text-foreground">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Mã hóa AES-GCM
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {config.configured ? (
              <Button asChild size="sm">
                <a href="/api/integrations/google/connect">
                  <Plug className="h-4 w-4" aria-hidden />
                  {connection ? "Kết nối lại Google" : "Kết nối Google Drive"}
                </a>
              </Button>
            ) : (
              <Button size="sm" disabled>
                <Plug className="h-4 w-4" aria-hidden />
                Kết nối Google Drive
              </Button>
            )}
            {connection ? (
              <form action={disconnectGoogleAction}>
                <Button type="submit" variant="outline" size="sm">
                  Ngắt kết nối
                </Button>
              </form>
            ) : null}
          </div>

          {!config.configured ? (
            <Alert tone="warning" className="mt-3">
              Đặt <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>{" "}
              và <code>GOOGLE_REDIRECT_URI</code> trong <code>.env.local</code>{" "}
              để bật OAuth. Không có cấu hình thì nút kết nối bị khóa, không giả
              lập thành công.
            </Alert>
          ) : !connection ? (
            <Alert tone="info" className="mt-3">
              OAuth đã cấu hình nhưng chưa có refresh token. Bấm kết nối để cấp
              quyền Drive; sau đó album có thể quét folder thật.
            </Alert>
          ) : (
            <Alert tone="warning" className="mt-3">
              Live Google Drive chưa được kiểm chứng trong môi trường này nếu
              không có credentials thật. Báo cáo Phase 4 ghi rõ mức kiểm chứng.
            </Alert>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <HardDrive className="h-4 w-4 text-primary" aria-hidden />
                Local demo Drive
              </h2>
              <Badge tone="success">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Sẵn sàng
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Adapter local đọc <code>demo-data/drive/demo-folder-1</code> với 3
              thư mục con và 12 ảnh synthetic. Đây là nguồn mặc định để thử
              PhotoShare mà không cần OAuth.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/manage/photos/albums/new">Tạo album từ Drive demo</Link>
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-[var(--warning)]" aria-hidden />
                NAS / ổ mạng nội bộ
              </h2>
              <Badge tone="warning">Chưa cấu hình</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Chưa có desktop helper/connector NAS. Browser không được phép giả
              vờ đọc đường dẫn NAS; server cũng không đọc ổ đĩa của máy khách.
              Khi cần, cấu hình connector hoặc dùng desktop helper trước khi bật.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">
              Thanh toán, Fanpage, Zalo & quảng cáo
            </h2>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>Payment adapter</span>
                <Badge tone="info">{payment.provider}</Badge>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>Ngân hàng/VietQR</span>
                <Badge tone={payment.bankBin && payment.accountNumber ? "success" : "warning"}>
                  {payment.bankBin && payment.accountNumber ? "Đã cấu hình" : "Chưa cấu hình"}
                </Badge>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>Mock webhook</span>
                <Badge tone={webhook.enabled ? "success" : "neutral"}>
                  {webhook.enabled ? "Development" : "Tắt ở production"}
                </Badge>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>Fanpage/Zalo</span>
                <Badge tone="warning">
                  {messaging.facebook || messaging.zalo ? "Đã cấu hình" : "Chưa cấu hình"}
                </Badge>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>Meta/TikTok Ads</span>
                <Badge tone="warning">{campaignAdapter.configured ? "Đã cấu hình" : "Chưa cấu hình"}</Badge>
              </li>
              <li className="flex flex-wrap items-center justify-between gap-2">
                <span>Email / Zalo / SMS</span>
                <Badge tone={notificationAdapter.liveConfigured ? "success" : "warning"}>
                  {notificationAdapter.liveConfigured ? "Đã cấu hình một phần" : "Local only"}
                </Badge>
              </li>
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">{notificationAdapter.note}</p>
            <p className="mt-2 text-xs text-muted-foreground">{messaging.note}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/manage/settings/payments/sandbox">Sandbox thanh toán</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/manage/inbox">Local inbox</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/manage/campaigns">Chiến dịch</Link>
              </Button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">Storage adapter</h2>
            <p className="mt-1 text-sm text-muted-foreground">{storage.note}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium">{storage.provider}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Upload tối đa</dt>
                <dd className="font-medium">{storage.maxUploadMb}MB/ảnh</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Production cần private storage + signed URL; không dùng public
              uploads cho ảnh khách thật.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
