import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { PaymentSandboxPanel } from "@/components/finance/payment-sandbox-panel";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  getPaymentSettings,
  listInvoiceOrderOptions,
} from "@/lib/services/finance-service";
import { getMockWebhookPublicInfo } from "@/lib/finance/webhook";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sandbox thanh toán",
};

export default async function PaymentSandboxPage() {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "finance.view")) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền xem sandbox thanh toán." />
    );
  }
  const db = getDb();
  const orders = listInvoiceOrderOptions(db, actor).filter(
    (order) => order.remaining > 0,
  );
  const settings = getPaymentSettings(db, actor.tenantId);
  const webhook = getMockWebhookPublicInfo();

  return (
    <div>
      <PageHeader
        title="Sandbox thanh toán"
        description="Tạo VietQR NAPAS, kiểm tra payload và gửi mock webhook có chữ ký để xác nhận thanh toán gắn đơn."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/finance">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Sổ quỹ
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={webhook.enabled ? "success" : "danger"}>
          {webhook.enabled ? "Mock webhook bật" : "Mock webhook tắt"}
        </Badge>
        <Badge tone="info">Provider: {settings.provider}</Badge>
        <Badge tone={settings.bankBin && settings.accountNumber ? "success" : "warning"}>
          {settings.bankBin && settings.accountNumber
            ? "Đã có tài khoản ngân hàng"
            : "Thiếu cấu hình ngân hàng"}
        </Badge>
        <Badge tone="neutral">
          {webhook.secretConfigured ? "Webhook secret env" : "Secret dev mặc định"}
        </Badge>
      </div>

      {!webhook.enabled ? (
        <Alert tone="danger" className="mb-4">
          Endpoint mock trả 404 ở production; chỉ dùng cho development.
        </Alert>
      ) : null}
      {!settings.bankBin || !settings.accountNumber ? (
        <Alert tone="warning" className="mb-4">
          Chưa cấu hình BIN/tài khoản ngân hàng trong Cài đặt studio. VietQR sẽ
          báo lỗi validate thay vì tạo mã giả.
        </Alert>
      ) : null}

      {orders.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-6 w-6" aria-hidden />}
          title="Không có đơn còn công nợ"
          description="Tạo hoặc thu một phần đơn hàng trước, sau đó quay lại sandbox để test webhook."
          action={
            <Button asChild variant="outline">
              <Link href="/manage/orders">Mở đơn hàng</Link>
            </Button>
          }
        />
      ) : (
        <PaymentSandboxPanel orders={orders} webhookEnabled={webhook.enabled} />
      )}

      <section className="mt-5 rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
        <h2 className="text-base font-semibold text-foreground">Thông tin tài khoản nhận tiền</h2>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs">Ngân hàng</dt>
            <dd className="text-foreground">{settings.bankName || "Chưa cấu hình"}</dd>
          </div>
          <div>
            <dt className="text-xs">Số tài khoản</dt>
            <dd className="font-mono text-foreground">
              {settings.accountNumber || "Chưa cấu hình"}
            </dd>
          </div>
          <div>
            <dt className="text-xs">Chủ tài khoản</dt>
            <dd className="text-foreground">{settings.accountName || "Chưa cấu hình"}</dd>
          </div>
          <div>
            <dt className="text-xs">BIN</dt>
            <dd className="font-mono text-foreground">{settings.bankBin || "Chưa cấu hình"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs">
          Thông tin tài khoản ngân hàng cấu hình cho studio. Webhook thanh toán tự động được bảo vệ bằng mã khóa bí mật HMAC.
        </p>
      </section>
    </div>
  );
}
