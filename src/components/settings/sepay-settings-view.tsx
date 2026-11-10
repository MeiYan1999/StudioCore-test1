"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { SepaySettings } from "@/lib/services/sepay-service";
import {
  regenerateSepayApiKeyAction,
  resetSepayConfigAction,
  sendTestSepayWebhookAction,
  toggleSepayWebhookAction,
} from "@/lib/actions/sepay-actions";

function formatVNDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

type Props = {
  initialSettings: SepaySettings;
};

export function SepaySettingsView({ initialSettings }: Props) {
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [stats, setStats] = useState(initialSettings.stats);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleToggleEnabled = async (nextState: boolean) => {
    setIsToggling(true);
    setFeedback(null);
    try {
      const res = await toggleSepayWebhookAction(nextState);
      if (res.ok) {
        setEnabled(nextState);
        setFeedback({ tone: "success", text: res.message });
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi chuyển trạng thái.",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (
      !confirm(
        "Bạn có chắc muốn làm mới API Key SePay không? Sau khi đổi, bạn cần dán API Key mới vào cấu hình trên SePay.",
      )
    ) {
      return;
    }
    setIsRegenerating(true);
    setFeedback(null);
    try {
      const res = await regenerateSepayApiKeyAction();
      if (res.ok && res.newApiKey) {
        setApiKey(res.newApiKey);
        setFeedback({ tone: "success", text: res.message });
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi làm mới API Key.",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleResetConfig = async () => {
    if (
      !confirm(
        "Bạn có chắc muốn xoá và đặt lại cấu hình SePay không? Khóa API Key cũ sẽ bị vô hiệu.",
      )
    ) {
      return;
    }
    setIsResetting(true);
    setFeedback(null);
    try {
      const res = await resetSepayConfigAction();
      if (res.ok) {
        setFeedback({ tone: "success", text: res.message });
        window.location.reload();
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi xoá cấu hình.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendTestWebhook = async () => {
    setIsSendingTest(true);
    setFeedback(null);
    try {
      const res = await sendTestSepayWebhookAction();
      if (res.ok) {
        setFeedback({
          tone: "success",
          text: "Đã gửi thử giao dịch SePay 10.000đ thành công. Hệ thống đã nhận tín hiệu!",
        });
        setStats((prev) => ({
          ...prev,
          totalCalls: prev.totalCalls + 1,
          recordedCount: prev.recordedCount + 1,
          lastCallAt: new Date().toISOString(),
          lastTransactionText: "+10.000đ",
          hasSignals: true,
        }));
      } else {
        setFeedback({ tone: "danger", text: res.message });
      }
    } catch (err) {
      setFeedback({
        tone: "danger",
        text: err instanceof Error ? err.message : "Lỗi gửi thử webhook.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-lg text-xs font-medium"
        >
          <Link href="/manage/settings">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại</span>
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Kết nối SePay – Biến động số dư
        </h1>
      </div>

      {feedback ? (
        <Alert tone={feedback.tone} className="mt-2">
          {feedback.text}
        </Alert>
      ) : null}

      {/* Card 1: Tự động ghi nhận thu tiền đơn hàng */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">
          Tự động ghi nhận thu tiền đơn hàng
        </h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm leading-relaxed">
          Công tắc này đã chuyển sang từng ví: vào{" "}
          <strong className="text-foreground">Ví cửa hàng → Cài đặt ví</strong>{" "}
          và bật cho từng tài khoản ngân hàng muốn tự động ghi nhận thu tiền theo
          nội dung chuyển khoản in từ hóa đơn.
        </p>
        <div className="mt-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-lg text-xs font-medium"
          >
            <Link href="/manage/finance">Mở Cài đặt ví</Link>
          </Button>
        </div>
      </section>

      {/* Card 2: Trạng thái kết nối */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
            <h2 className="text-base font-semibold text-foreground">
              Trạng thái kết nối
            </h2>
          </div>
          {stats.hasSignals ? (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ● Đang hoạt động
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Chưa nhận tín hiệu nào
            </span>
          )}
        </div>

        {/* 4 Stats Boxes */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/80 bg-muted/15 p-3.5">
            <p className="text-xs font-medium text-muted-foreground">
              Tổng lần SePay gọi
            </p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">
              {stats.totalCalls}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/15 p-3.5">
            <p className="text-xs font-medium text-muted-foreground">
              GD đã ghi nhận
            </p>
            <p className="mt-1.5 text-2xl font-bold text-foreground">
              {stats.recordedCount}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/15 p-3.5">
            <p className="text-xs font-medium text-muted-foreground">
              Lần gọi gần nhất
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              {formatVNDateTime(stats.lastCallAt)}
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-muted/15 p-3.5">
            <p className="text-xs font-medium text-muted-foreground">
              GD gần nhất
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground truncate">
              {stats.lastTransactionText}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            Quay lại SePay, bấm &quot;Gửi thử&quot; hoặc thực hiện 1 giao dịch nhỏ
            để hệ thống nhận được tín hiệu đầu tiên.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSendTestWebhook}
            disabled={isSendingTest}
            className="h-7 text-xs text-primary hover:text-primary gap-1"
          >
            {isSendingTest ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            <span>Gửi thử tín hiệu test</span>
          </Button>
        </div>
      </section>

      {/* Card 3: Webhook URL & API Key */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold text-foreground">
            Webhook URL &amp; API Key
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Kết nối SePay để hệ thống tự nhận giao dịch tiền vào/ra của các tài
          khoản ngân hàng đã liên kết với ví cửa hàng.
        </p>

        {/* Webhook URL Input */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-foreground">
            Webhook URL (dán vào SePay)
          </label>
          <div className="relative mt-1.5 flex items-center">
            <input
              type="text"
              readOnly
              value={initialSettings.webhookUrl}
              className="w-full rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 text-xs font-mono text-foreground pr-10 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() =>
                copyToClipboard(initialSettings.webhookUrl, "webhook")
              }
              className="absolute right-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Sao chép Webhook URL"
              aria-label="Sao chép Webhook URL"
            >
              {copiedField === "webhook" ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* API Key Input */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-foreground">
            API Key (hệ thống tự sinh – copy và dán vào ô &quot;API Key&quot; ở
            bước &quot;Bảo mật&quot; trong SePay)
          </label>
          <div className="relative mt-1.5 flex items-center">
            <input
              type={showApiKey ? "text" : "password"}
              readOnly
              value={apiKey}
              className="w-full rounded-xl border border-border bg-muted/20 px-3.5 py-2.5 text-xs font-mono text-foreground pr-28 focus:outline-hidden"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {showApiKey ? "Ẩn" : "Hiện"}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(apiKey, "apikey")}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Sao chép API Key"
                aria-label="Sao chép API Key"
              >
                {copiedField === "apikey" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleRegenerateKey}
                disabled={isRegenerating}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Làm mới key"
                aria-label="Làm mới key"
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Key đã được tạo sẵn riêng cho studio của bạn. Không cần nhập tay. Nếu
            rò rỉ, bấm nút làm mới để tạo key khác (nhớ cập nhật lại trong SePay).
          </p>
        </div>

        {/* Switch: Bật nhận webhook */}
        <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Bật nhận webhook
            </p>
            <p className="text-xs text-muted-foreground">
              Tắt để tạm dừng ghi nhận biến động (không xoá cấu hình)
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={isToggling}
            onClick={() => handleToggleEnabled(!enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              enabled ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Delete config button */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleResetConfig}
            disabled={isResetting}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline dark:text-rose-400"
          >
            {isResetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span>Xoá cấu hình</span>
          </button>
        </div>
      </section>

      {/* Card 4: Hướng dẫn cấu hình SePay (4 bước) */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">
          Hướng dẫn cấu hình SePay (4 bước)
        </h2>
        <div className="mt-3 space-y-2.5 text-xs sm:text-sm text-foreground/90 leading-relaxed">
          <p>
            <strong>1.</strong> Truy cập{" "}
            <a
              href="https://my.sepay.vn/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5 font-medium"
            >
              my.sepay.vn/webhooks
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            và nhấn <strong>+ Thêm webhook</strong>.
          </p>
          <p>
            <strong>2. Thông tin cơ bản:</strong> đặt tên (ví dụ
            &quot;StudioCore&quot;), chọn sự kiện <strong>&quot;Cả hai&quot;</strong> (tiền
            vào &amp; tiền ra), dán Webhook URL ở trên.
          </p>
          <p>
            <strong>3. Tài khoản và bộ lọc:</strong> chọn các tài khoản ngân hàng đã
            được liên kết với ví cửa hàng trong hệ thống của bạn. Tài khoản nào
            chưa liên kết sẽ bị hệ thống bỏ qua.
          </p>
          <p>
            <strong>4. Bảo mật:</strong> chọn phương thức{" "}
            <strong>API Key</strong>, đặt key trùng với <strong>API Key</strong> bạn
            nhập ở trên rồi <strong>Lưu</strong>.
          </p>
        </div>

        <div className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          Sau khi cấu hình xong, mỗi khi có giao dịch ngân hàng, hệ thống sẽ hiện
          ra ở tab &quot;Lịch sử biến động&quot; bên trong Ví cửa hàng để kế toán
          đối chiếu.
        </div>
      </section>
    </div>
  );
}
