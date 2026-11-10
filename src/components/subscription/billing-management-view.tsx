"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  CreditCard,
  Crown,
  History,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatVnd } from "@/lib/utils";
import { DateTimeText } from "@/components/shared/date-time";
import { createSubscriptionInvoiceAction } from "@/lib/actions/subscription-actions";
import { SubscriptionCheckoutModal } from "./subscription-checkout-modal";
import {
  SUBSCRIPTION_PLANS,
  type BillingCycle,
  type CreateSubscriptionResult,
  type SubscriptionPlanKey,
} from "@/lib/services/subscription-service";

interface BillingManagementViewProps {
  currentPlanData: {
    tenant: {
      id: string;
      name: string;
      plan: string;
      planExpiresAt: Date | null;
      status: string;
    };
    planInfo: {
      key: string;
      name: string;
      monthly: number;
      yearly: number;
    };
    latestSub: any;
    isTrial: boolean;
  };
  subscriptionHistory: any[];
  initialPlan?: string;
}

export function BillingManagementView({
  currentPlanData,
  subscriptionHistory,
  initialPlan,
}: BillingManagementViewProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkoutData, setCheckoutData] = useState<CreateSubscriptionResult | null>(null);
  const [isCreating, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (
      !autoOpenedRef.current &&
      initialPlan &&
      (initialPlan === "basic" || initialPlan === "pro" || initialPlan === "enterprise")
    ) {
      autoOpenedRef.current = true;
      handleSelectPlan(initialPlan as SubscriptionPlanKey);
    }
  }, [initialPlan]);

  const handleSelectPlan = (planKey: SubscriptionPlanKey) => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await createSubscriptionInvoiceAction(planKey, billingCycle);
        if (res.success && res.data) {
          setCheckoutData(res.data);
        } else {
          setErrorMsg(res.error || "Không thể tạo mã thanh toán.");
        }
      } catch (err: any) {
        setErrorMsg(err?.message || "Lỗi hệ thống.");
      }
    });
  };

  const daysRemaining = currentPlanData.tenant.planExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (currentPlanData.tenant.planExpiresAt.getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/manage/settings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Cài đặt
          </Link>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Quản lý gói cước &amp; Dịch vụ
          </h1>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Card 1: Gói cước hiện tại của Studio */}
      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-white p-6 shadow-xs dark:border-blue-900/50 dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Gói dịch vụ đang kích hoạt
            </span>
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {currentPlanData.planInfo.name}
              </h2>
              <Badge tone={currentPlanData.isTrial ? "warning" : "success"}>
                {currentPlanData.isTrial ? "Dùng thử" : "Đang hoạt động"}
              </Badge>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Studio: <strong>{currentPlanData.tenant.name}</strong>
            </p>
          </div>

          <div className="rounded-xl bg-white/80 dark:bg-slate-800/80 p-3.5 border border-slate-200/70 dark:border-slate-700/70 text-right min-w-44">
            <span className="text-xs text-slate-500">Thời hạn sử dụng</span>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {currentPlanData.tenant.planExpiresAt
                ? new Date(currentPlanData.tenant.planExpiresAt).toLocaleDateString("vi-VN")
                : "Không giới hạn"}
            </p>
            {daysRemaining !== null && (
              <span className="inline-block mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                (Còn {daysRemaining} ngày)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Card 2: Chọn gói cước nâng cấp / gia hạn */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Bảng giá nâng cấp & gia hạn
            </h3>
            <p className="text-xs text-slate-500">
              Tự động duyệt gói qua VietQR NAPAS 24/7 chỉ trong 2 giây
            </p>
          </div>

          {/* Billing Cycle Switcher */}
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Theo tháng
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all flex items-center gap-1 ${
                billingCycle === "yearly"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              }`}
            >
              Theo năm
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] text-emerald-700 font-bold">
                -2 tháng
              </span>
            </button>
          </div>
        </div>

        {/* 3 Paid Plans Grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Plan 1: Cơ bản */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Vận hành cơ bản
                </h4>
              </div>
              <p className="text-xs text-slate-500 min-h-8">
                Cho studio vừa & nhỏ cần số hóa đơn hàng, lịch chụp và tài chính.
              </p>
              <div className="pt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {formatVnd(billingCycle === "yearly" ? 3990000 : 399000)}
                </span>
                <span className="text-xs text-slate-400 ml-1">
                  /{billingCycle === "yearly" ? "năm" : "tháng"}
                </span>
              </div>
              <ul className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  1 chi nhánh
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  10 nhân sự
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  CRM & Quản lý đơn hàng
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  Lịch chụp thông minh chống trùng
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  Sổ quỹ thu chi & Công nợ
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSelectPlan("basic")}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Chọn gói Cơ bản
              </Button>
            </div>
          </div>

          {/* Plan 2: Pro (Phổ biến nhất) */}
          <div className="relative rounded-2xl border-2 border-blue-600 bg-white p-5 shadow-md dark:bg-slate-900 flex flex-col justify-between">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-xs">
              Phổ biến nhất
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Crown className="h-4 w-4" />
                  Chuyên nghiệp (Pro)
                </h4>
              </div>
              <p className="text-xs text-slate-500 min-h-8">
                Gói được hơn 85% studio lựa chọn — đầy đủ sức mạnh bứt phá vận hành.
              </p>
              <div className="pt-1">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {formatVnd(billingCycle === "yearly" ? 4990000 : 499000)}
                </span>
                <span className="text-xs text-slate-400 ml-1">
                  /{billingCycle === "yearly" ? "năm" : "tháng"}
                </span>
              </div>
              <ul className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  3 chi nhánh
                </li>
                <li className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  30 nhân sự
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  Tất cả tính năng gói Cơ bản
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  Hợp đồng điện tử ký tay iPad/Mobile
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  Kho váy cưới & Đạo cụ mã QR
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  Tự động tính hoa hồng & Lương ekip
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-600 shrink-0" />
                  PhotoShare không giới hạn album
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Button
                type="button"
                onClick={() => handleSelectPlan("pro")}
                disabled={isCreating}
                className="w-full bg-blue-600 text-white hover:bg-blue-700 font-bold"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Chọn gói Pro (Khuyên dùng)
              </Button>
            </div>
          </div>

          {/* Plan 3: Doanh nghiệp */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Doanh nghiệp
                </h4>
              </div>
              <p className="text-xs text-slate-500 min-h-8">
                Cho chuỗi studio lớn, thương hiệu áo cưới nhiều cơ sở.
              </p>
              <div className="pt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {formatVnd(billingCycle === "yearly" ? 6990000 : 699000)}
                </span>
                <span className="text-xs text-slate-400 ml-1">
                  /{billingCycle === "yearly" ? "năm" : "tháng"}
                </span>
              </div>
              <ul className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  Không giới hạn chi nhánh
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  Không giới hạn nhân sự
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  Tùy chỉnh tên miền riêng theo yêu cầu
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  Báo cáo tổng hợp chuỗi đa chi nhánh
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  Đào tạo trực tiếp & Ưu tiên hỗ trợ 24/7
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSelectPlan("enterprise")}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Chọn gói Doanh nghiệp
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Lịch sử nạp / thanh toán gói */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          Lịch sử giao dịch gói cước
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Nhật ký các lần thanh toán và gia hạn dịch vụ của studio.
        </p>

        {subscriptionHistory.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Chưa có giao dịch thanh toán gói cước nào.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 pr-4 font-semibold">Mã chuyển khoản</th>
                  <th className="py-2.5 pr-4 font-semibold">Gói cước</th>
                  <th className="py-2.5 pr-4 font-semibold">Chu kỳ</th>
                  <th className="py-2.5 pr-4 font-semibold">Số tiền</th>
                  <th className="py-2.5 pr-4 font-semibold">Trạng thái</th>
                  <th className="py-2.5 font-semibold">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {subscriptionHistory.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850">
                    <td className="py-3 pr-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {sub.code}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-slate-800 dark:text-slate-200 uppercase">
                      {sub.plan}
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {sub.billingCycle === "yearly" ? "1 năm" : "1 tháng"}
                    </td>
                    <td className="py-3 pr-4 font-bold text-slate-900 dark:text-slate-100">
                      {formatVnd(sub.amount)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={sub.status === "completed" ? "success" : "warning"}>
                        {sub.status === "completed" ? "Đã kích hoạt" : "Đang chờ"}
                      </Badge>
                    </td>
                    <td className="py-3 text-slate-500">
                      <DateTimeText value={sub.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP THANH TOÁN VIETQR NẾU ĐANG CÓ HÓA ĐƠN ĐƯỢC CHỌN */}
      {checkoutData && (
        <SubscriptionCheckoutModal
          data={checkoutData}
          onClose={() => setCheckoutData(null)}
          onSuccess={() => {
            // refresh data
          }}
        />
      )}
    </div>
  );
}
