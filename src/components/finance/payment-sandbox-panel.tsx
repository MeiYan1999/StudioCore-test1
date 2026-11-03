"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Loader2, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { prepareMockPaymentAction } from "@/lib/actions/finance-actions";
import { formatVnd } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils/clipboard";

type OrderOption = {
  id: string;
  code: string;
  total: number;
  remaining: number;
  customerName: string;
};

type Prepared = {
  payload: string;
  content: string;
  imageUrl: string;
  amount: number;
  orderCode: string;
  provider: string;
  webhook: {
    body: string;
    signature: string;
    timestamp: number;
    eventId: string;
    amount: number;
    orderId: string;
  };
};

export function PaymentSandboxPanel({
  orders,
  webhookEnabled,
}: {
  orders: OrderOption[];
  webhookEnabled: boolean;
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [amount, setAmount] = useState(String(orders[0]?.remaining ?? 0));
  const [content, setContent] = useState(
    orders[0] ? `Thanh toan ${orders[0].code}` : "",
  );
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOrder = orders.find((order) => order.id === orderId);

  const prepare = async () => {
    setBusy(true);
    setError(null);
    setPrepared(null);
    const result = await prepareMockPaymentAction({
      orderId,
      amount: Number(amount) || 0,
      content,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPrepared(result);
  };

  const sendWebhook = async () => {
    if (!prepared) return;
    setSending(true);
    setLastResult(null);
    try {
      const response = await fetch("/api/mock/webhook/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-payment-timestamp": String(prepared.webhook.timestamp),
          "x-payment-signature": prepared.webhook.signature,
        },
        body: prepared.webhook.body,
      });
      const payload = (await response.json()) as {
        status?: string;
        error?: string;
        paymentId?: string;
      };
      if (!response.ok) {
        setError(payload.error ?? "Webhook thất bại.");
        return;
      }
      setLastResult(
        payload.status === "duplicate"
          ? "Webhook trùng event: đã no-op, không tạo payment mới."
          : `Đã xử lý thanh toán${payload.paymentId ? ` (payment ${payload.paymentId.slice(0, 8)})` : ""}.`,
      );
      toast.success(
        payload.status === "duplicate"
          ? "Event trùng đã được bỏ qua."
          : "Đã xác nhận thanh toán sandbox.",
      );
      router.refresh();
    } catch {
      setError("Không gọi được webhook nội bộ.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {!webhookEnabled ? (
        <Alert tone="danger">
          Mock webhook bị tắt ở production. Trang chỉ hoạt động trong development.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            1. Tạo giao dịch sandbox
          </h2>
          <div className="mt-3 space-y-3">
            <div>
              <Label htmlFor="sandbox-order">Đơn hàng còn công nợ</Label>
              <Select
                id="sandbox-order"
                value={orderId}
                onChange={(event) => {
                  const next = orders.find((order) => order.id === event.target.value);
                  setOrderId(event.target.value);
                  setAmount(String(next?.remaining ?? 0));
                  setContent(next ? `Thanh toan ${next.code}` : "");
                  setPrepared(null);
                }}
                className="mt-1.5"
              >
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.code} · {order.customerName} · còn{" "}
                    {formatVnd(order.remaining)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sandbox-amount">Số tiền</Label>
                <Input
                  id="sandbox-amount"
                  type="number"
                  min={1}
                  max={selectedOrder?.remaining}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="sandbox-content">Nội dung</Label>
                <Input
                  id="sandbox-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={50}
                  className="mt-1.5"
                />
              </div>
            </div>
            <Button onClick={() => void prepare()} disabled={busy || !orderId}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <QrCode className="h-4 w-4" aria-hidden />
              )}
              Tạo VietQR & payload
            </Button>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {lastResult ? <Alert tone="success">{lastResult}</Alert> : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-base font-semibold text-foreground">
            2. Kiểm tra & xác nhận
          </h2>
          {!prepared ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Tạo VietQR trước để xem payload, sau đó gửi webhook nội bộ có chữ ký.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">{prepared.orderCode}</Badge>
                <Badge tone="success">{formatVnd(prepared.amount)}</Badge>
                <Badge tone="neutral">{prepared.content}</Badge>
              </div>
              <div className="flex justify-center rounded-lg border border-border bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={prepared.imageUrl}
                  alt={`VietQR ${prepared.orderCode}`}
                  width={220}
                  height={260}
                />
              </div>
              <div className="rounded-lg bg-surface-muted p-2">
                <p className="break-all font-mono text-[11px] text-muted-foreground">
                  {prepared.payload}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    const copied = await copyToClipboard(prepared.payload);
                    toast[copied ? "success" : "error"](
                      copied ? "Đã copy payload NAPAS." : "Không copy được payload.",
                    );
                  }}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy payload
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void sendWebhook()} disabled={sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  )}
                  Xác nhận thanh toán
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void sendWebhook()}
                  disabled={sending}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Gửi lại (test idempotency)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Lần gửi thứ hai dùng cùng eventId; server trả duplicate/no-op và
                không tạo thêm payment/transaction.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
