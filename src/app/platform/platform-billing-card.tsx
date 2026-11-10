"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  CreditCard,
  Crown,
  History,
  KeyRound,
  Loader2,
  QrCode,
  Save,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatVnd } from "@/lib/utils";
import { DateTimeText } from "@/components/shared/date-time";
import { savePlatformBillingConfigAction } from "@/lib/actions/subscription-actions";
import type { PlatformBillingConfig } from "@/lib/services/subscription-service";

const POPULAR_BANKS = [
  { bin: "970422", name: "MBBank (Ngân hàng Quân Đội)" },
  { bin: "970436", name: "Vietcombank (Ngoại Thương Việt Nam)" },
  { bin: "970407", name: "Techcombank (Kỹ Thương Việt Nam)" },
  { bin: "970416", name: "ACB (Á Châu)" },
  { bin: "970423", name: "TPBank (Tiên Phong)" },
  { bin: "970432", name: "VPBank (Việt Nam Thịnh Vượng)" },
  { bin: "970418", name: "BIDV (Đầu tư và Phát triển VN)" },
  { bin: "970415", name: "VietinBank (Công Thương VN)" },
  { bin: "970405", name: "Agribank (Nông nghiệp và PTNT)" },
  { bin: "970448", name: "OCB (Phương Đông)" },
  { bin: "970403", name: "Sacombank (Sài Gòn Thương Tín)" },
];

export interface PlatformBillingTransaction {
  id: string;
  tenantId: string;
  tenantName?: string;
  plan: string;
  billingCycle: string;
  amount: number;
  code: string;
  status: string;
  createdAt: Date | string | null;
  paidAt: Date | string | null;
}

interface PlatformBillingCardProps {
  platformConfig: PlatformBillingConfig;
  recentTransactions?: PlatformBillingTransaction[];
}

export function PlatformBillingCard({
  platformConfig,
  recentTransactions = [],
}: PlatformBillingCardProps) {
  const [isPending, startTransition] = useTransition();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [selectedBankBin, setSelectedBankBin] = useState(
    platformConfig.bankBin || "970422",
  );
  const [bankAccount, setBankAccount] = useState(
    platformConfig.accountNumber || "",
  );
  const [accountName, setAccountName] = useState(
    platformConfig.accountName || "",
  );
  const [sepayApiKey, setSepayApiKey] = useState(
    platformConfig.sepayApiKey || "studiocore_platform_secret",
  );

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const bankObj = POPULAR_BANKS.find((b) => b.bin === selectedBankBin);
    formData.set("bankBin", selectedBankBin);
    formData.set("bankName", bankObj?.name || "MBBank");
    formData.set("sepayApiKey", sepayApiKey);

    startTransition(async () => {
      try {
        const res = await savePlatformBillingConfigAction(formData);
        if (res.success) {
          setSuccessMsg(res.message || "Đã lưu tài khoản nhận tiền thành công!");
          setTimeout(() => setSuccessMsg(null), 4000);
        } else {
          setErrorMsg(res.error || "Không thể lưu cấu hình.");
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Lỗi lưu cấu hình.");
      }
    });
  };

  return (
    <section className="mt-8 rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/60 via-surface to-purple-50/40 p-6 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/30 dark:via-surface dark:to-slate-900 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100/80 pb-4 dark:border-indigo-900/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">
                Cấu hình SePay &amp; Tài khoản nhận tiền Nền tảng
              </h2>
              <Badge tone="info">Dành riêng cho Chủ web</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Số tài khoản này sẽ nhận tiền khi các chủ studio thanh toán mua gói cước (399k, 499k...). Webhook sẽ tự động đối soát và kích hoạt gói ngay lập tức.
            </p>
          </div>
        </div>

        {successMsg && (
          <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 animate-in fade-in">
            {successMsg}
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* 1. Webhook URL & Secret */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Webhook URL */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              1. URL nhận Webhook Nền tảng
            </span>
            <span className="text-[11px] text-muted-foreground">Dán vào SePay bước 1</span>
          </div>
          <div className="relative mt-2 flex items-center">
            <input
              type="text"
              readOnly
              value={platformConfig.webhookUrl}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-mono text-foreground pr-10 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(platformConfig.webhookUrl, "webhook")}
              className="absolute right-1.5 rounded p-1.5 text-muted-foreground hover:text-primary transition-colors"
              title="Sao chép"
            >
              {copiedField === "webhook" ? (
                <Check className="h-4 w-4 text-[var(--success)]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Endpoint xử lý giao dịch nạp tiền mua gói SaaS NAPAS247 tự động 24/7.
          </p>
        </div>

        {/* API Key */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
              2. API Key Bảo mật Nền tảng
            </span>
            <span className="text-[11px] text-muted-foreground">Dán vào SePay bước 3</span>
          </div>
          <div className="relative mt-2 flex items-center">
            <input
              type="text"
              readOnly
              value={sepayApiKey}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-mono text-foreground pr-10 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(sepayApiKey, "apiKey")}
              className="absolute right-1.5 rounded p-1.5 text-muted-foreground hover:text-primary transition-colors"
              title="Sao chép"
            >
              {copiedField === "apiKey" ? (
                <Check className="h-4 w-4 text-[var(--success)]" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Trên SePay chọn phương thức xác thực &quot;API Key&quot; và dán mã này.
          </p>
        </div>
      </div>

      {/* Note for Step 2 on SePay */}
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Lưu ý khi tạo Webhook trên SePay (Bước 2: Tài khoản &amp; Bộ lọc):</p>
          <p className="mt-0.5 text-[11px] leading-relaxed">
            Mã thanh toán gói cước của StudioCore có định dạng <strong className="font-mono">SCxxxxx</strong> (ví dụ: SC73920).
            Bạn nên <strong>TẮT</strong> công tắc <em>&quot;Chỉ gửi khi có mã thanh toán&quot;</em> trên SePay để StudioCore tự lọc giao dịch chuẩn xác, hoặc điền mã <strong className="font-mono">SC</strong> vào ô bộ lọc nếu bật.
          </p>
        </div>
      </div>

      {/* 2. Bank Account Setup Form */}
      <form onSubmit={handleSaveConfig} className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
          <CreditCard className="h-4 w-4 text-indigo-600" />
          Tài khoản ngân hàng của bạn (Nơi tiền mua gói sẽ chảy về)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="platformBankBin" className="text-xs">
              Ngân hàng của bạn
            </Label>
            <select
              id="platformBankBin"
              value={selectedBankBin}
              onChange={(e) => setSelectedBankBin(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {POPULAR_BANKS.map((b) => (
                <option key={b.bin} value={b.bin}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="platformAccountNumber" className="text-xs">
              Số tài khoản nhận tiền
            </Label>
            <Input
              id="platformAccountNumber"
              name="accountNumber"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Ví dụ: 0987654321..."
              required
              className="mt-1.5 h-9 text-xs font-mono"
            />
          </div>

          <div>
            <Label htmlFor="platformAccountName" className="text-xs">
              Tên chủ tài khoản (In hoa không dấu)
            </Label>
            <Input
              id="platformAccountName"
              name="accountName"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value.toUpperCase())}
              placeholder="Ví dụ: NGUYEN VAN A"
              required
              className="mt-1.5 h-9 text-xs uppercase"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            type="submit"
            disabled={isPending}
            size="sm"
            className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Lưu tài khoản nhận tiền nền tảng
          </Button>
        </div>
      </form>

      {/* 3. Recent Platform Subscription Orders */}
      {recentTransactions.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <History className="h-4 w-4 text-primary" />
              Nhật ký đơn mua gói cước gần đây ({recentTransactions.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Mã nạp (Nội dung)</th>
                  <th className="py-2 pr-3 font-semibold">Studio</th>
                  <th className="py-2 pr-3 font-semibold">Gói cước</th>
                  <th className="py-2 pr-3 font-semibold">Chu kỳ</th>
                  <th className="py-2 pr-3 font-semibold">Số tiền</th>
                  <th className="py-2 pr-3 font-semibold">Trạng thái</th>
                  <th className="py-2 font-semibold">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-accent/20 transition-colors">
                    <td className="py-2.5 pr-3 font-mono font-bold text-foreground">
                      {tx.code}
                    </td>
                    <td className="py-2.5 pr-3 text-foreground font-medium">
                      {tx.tenantName || tx.tenantId}
                    </td>
                    <td className="py-2.5 pr-3 uppercase font-semibold text-primary">
                      {tx.plan}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {tx.billingCycle === "yearly" ? "Theo năm" : "Theo tháng"}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-foreground">
                      {formatVnd(tx.amount)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={tx.status === "completed" ? "success" : "warning"}>
                        {tx.status === "completed" ? "Đã duyệt" : "Chờ chuyển khoản"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {tx.paidAt ? (
                        <DateTimeText value={tx.paidAt} />
                      ) : tx.createdAt ? (
                        <DateTimeText value={tx.createdAt} />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
