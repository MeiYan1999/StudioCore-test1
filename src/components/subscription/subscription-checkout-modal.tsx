"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatVnd } from "@/lib/utils";
import {
  checkSubscriptionStatusAction,
  simulateSubscriptionPaymentAction,
} from "@/lib/actions/subscription-actions";
import type { CreateSubscriptionResult } from "@/lib/services/subscription-service";

interface SubscriptionCheckoutModalProps {
  data: CreateSubscriptionResult;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SubscriptionCheckoutModal({
  data,
  onClose,
  onSuccess,
}: SubscriptionCheckoutModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [newExpiry, setNewExpiry] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30 * 60); // 30 phút tính bằng giây
  const [isPending, startTransition] = useTransition();

  // Copy helper
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Countdown timer
  useEffect(() => {
    if (status === "completed") return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Polling check payment status every 3 seconds
  useEffect(() => {
    if (status === "completed") return;

    const interval = setInterval(async () => {
      try {
        const res = await checkSubscriptionStatusAction(data.subscriptionId);
        if (res.success && res.status === "completed") {
          setStatus("completed");
          if (res.planExpiresAt) {
            setNewExpiry(new Date(res.planExpiresAt).toLocaleDateString("vi-VN"));
          }
          if (onSuccess) {
            onSuccess();
          }
        }
      } catch {
        // network retry
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [data.subscriptionId, status, onSuccess]);

  // Test mode simulator
  const handleSimulatePayment = () => {
    startTransition(async () => {
      try {
        const res = await simulateSubscriptionPaymentAction(data.subscriptionId);
        if (res.success) {
          setStatus("completed");
          setNewExpiry(new Date(Date.now() + 30 * 86400000).toLocaleDateString("vi-VN"));
          if (onSuccess) {
            onSuccess();
          }
        }
      } catch (err: any) {
        alert(err?.message || "Lỗi giả lập thanh toán.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Thanh toán Gói {data.plan === "pro" ? "Chuyên nghiệp (Pro)" : data.plan === "enterprise" ? "Doanh nghiệp" : "Cơ bản"}
              </h2>
              <p className="text-xs text-slate-500">
                Hệ thống tự động duyệt và kích hoạt gói sau 2–5 giây
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* COMPLETED SUCCESS STATE */}
        {status === "completed" ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 animate-in zoom-in-75 duration-300">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Thanh toán thành công! 🎉
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Gói cước của studio đã được nâng cấp lên{" "}
                <strong className="text-blue-600 uppercase font-bold">{data.plan}</strong>.
                {newExpiry && (
                  <span>
                    {" "}Hạn dùng mới đến ngày: <strong>{newExpiry}</strong>.
                  </span>
                )}
              </p>
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <Button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="bg-blue-600 text-white hover:bg-blue-700 px-6"
              >
                Bắt đầu sử dụng ngay
              </Button>
            </div>
          </div>
        ) : (
          /* PENDING PAYMENT STATE */
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: VietQR Code */}
              <div className="md:col-span-5 flex flex-col items-center text-center">
                <div className="relative rounded-2xl border-2 border-blue-500/20 bg-white p-3 shadow-md dark:bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.vietQr.imageUrl}
                    alt="VietQR Thanh toan"
                    className="w-48 h-48 object-contain rounded-lg"
                  />
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    VietQR · NAPAS 24/7
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900">
                  <Clock className="h-3.5 w-3.5 animate-spin" />
                  Mã hết hạn sau: {formatTimer(timeLeft)}
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  Đang lắng nghe chuyển khoản...
                </div>
              </div>

              {/* Right Column: Bank Details with 1-click Copy */}
              <div className="md:col-span-7 space-y-3">
                {/* Amount card */}
                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3.5 dark:bg-blue-950/30 dark:border-blue-900/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Số tiền cần thanh toán
                    </span>
                    <Badge tone="info">
                      {data.billingCycle === "yearly" ? "Theo năm (-2 tháng)" : "Theo tháng"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                      {formatVnd(data.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(data.amount), "amount")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-300"
                    >
                      {copiedField === "amount" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Sao chép
                    </button>
                  </div>
                </div>

                {/* Transfer Content (Most Important) */}
                <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5 dark:bg-amber-950/30 dark:border-amber-900/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Nội dung chuyển khoản (Bắt buộc)
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700">
                    <span className="font-mono text-base font-bold text-amber-900 dark:text-amber-200 tracking-wider">
                      {data.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(data.code, "code")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-300"
                    >
                      {copiedField === "code" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Sao chép
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-400 leading-tight">
                    *Vui lòng giữ nguyên nội dung <strong>{data.code}</strong> để hệ thống nhận diện và duyệt gói tự động.
                  </p>
                </div>

                {/* Bank Account Info */}
                <div className="rounded-xl border border-slate-200 p-3 text-xs space-y-2 dark:border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Ngân hàng:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {data.bank.bankName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Số tài khoản:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {data.bank.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(data.bank.accountNumber, "acc")}
                        className="text-blue-600 hover:text-blue-700"
                        title="Sao chép STK"
                      >
                        {copiedField === "acc" ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Chủ tài khoản:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                      {data.bank.accountName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Test Simulation Tool in Footer (Helpful for demo/testing) */}
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">
                Mã đơn: <strong className="font-mono text-slate-600">{data.code}</strong>
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSimulatePayment}
                disabled={isPending}
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800"
                title="Bấm để mô phỏng Webhook ngân hàng bắn về tự động duyệt"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Zap className="h-3 w-3 mr-1 text-emerald-600" />
                )}
                ⚡ Thử nghiệm duyệt tự động (Test Mode)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
