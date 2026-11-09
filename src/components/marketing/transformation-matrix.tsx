"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransformationItem {
  id: string;
  category: string;
  traditional: {
    title: string;
    description: string;
    painPoint: string;
  };
  studiocore: {
    title: string;
    description: string;
    advantage: string;
  };
}

const COMPARISONS: TransformationItem[] = [
  {
    id: "schedule",
    category: "Lịch chụp & Điều phối",
    traditional: {
      title: "Ghi chép sổ tay & Nhóm chat Zalo",
      description: "Thường xuyên trùng phòng chụp, thợ ảnh nhận ca trùng giờ hoặc quên mang đồ phụ kiện vào mùa cưới cao điểm.",
      painPoint: "Dễ trùng thợ, sót lịch khách",
    },
    studiocore: {
      title: "Lịch thông minh phát hiện xung đột tức thì",
      description: "Thuật toán tự động quét thợ rảnh, phân chia ekip 1 chạm và đẩy thông báo ca chụp trực tiếp lên điện thoại nhân viên.",
      advantage: "0% Trùng lịch, nhắc ca tự động",
    },
  },
  {
    id: "photos",
    category: "Giao ảnh & Lọc file RAW",
    traditional: {
      title: "Gửi link Zalo / Drive nén dung lượng",
      description: "Khách xem ảnh bị vỡ hạt, chụp màn hình gửi lại lộn xộn. Thợ photoshop mất nửa ngày gõ từng mã ảnh vào Lightroom.",
      painPoint: "Mất 4-6 tiếng đối chiếu mã ảnh",
    },
    studiocore: {
      title: "PhotoShare™ Zero-Storage & Lọc 30s",
      description: "Khách thả tim trên điện thoại nét căng 100%. Studio bấm 1 nút chép danh sách mã để lọc file RAW gốc tự động ngay trên máy tính.",
      advantage: "Lọc 500 ảnh RAW trong 30 giây",
    },
  },
  {
    id: "contract",
    category: "Hợp đồng & Tiền cọc",
    traditional: {
      title: "Hợp đồng giấy & Đọc số tài khoản thủ công",
      description: "Khách chuyển khoản dễ nhầm cú pháp, kế toán phải chụp sao kê đối soát từng dòng, hợp đồng giấy dễ thất lạc.",
      painPoint: "Nguy cơ thất thoát công nợ",
    },
    studiocore: {
      title: "Hợp đồng số ký tay & VietQR tự động",
      description: "Khách ký tay trực tiếp trên iPad hoặc điện thoại. QR Code tự điền chính xác số tiền cọc, tự động cập nhật trạng thái đã thanh toán.",
      advantage: "Ký online & Khớp tiền tự động",
    },
  },
  {
    id: "payroll",
    category: "Hoa hồng & Lương Ekip",
    traditional: {
      title: "Tổng hợp sổ sách và file Excel cuối tháng",
      description: "Chủ studio thức trắng đêm cộng điểm thợ chính, thợ phụ, makeup, retouch. Nhân viên hay thắc mắc, nghi ngờ sai lệch.",
      painPoint: "Mất 2-3 ngày chốt lương mỗi tháng",
    },
    studiocore: {
      title: "Bảng tính hoa hồng Realtime tự động",
      description: "Mỗi khi ca chụp hoặc đơn hàng hoàn tất, hoa hồng được ghi nhận minh bạch ngay lập tức. Nhân viên tự xem được thu nhập của mình.",
      advantage: "Minh bạch 100%, 0 giây tính tay",
    },
  },
];

const METRICS = [
  {
    value: "-85%",
    label: "Thời gian lọc & đối chiếu ảnh",
    detail: "Từ 4 giờ xuống còn 30 giây với PhotoShare",
    tone: "violet",
  },
  {
    value: "100%",
    label: "Chấm dứt trùng lịch chụp ekip",
    detail: "Hệ thống cảnh báo xung đột thời gian thực",
    tone: "emerald",
  },
  {
    value: "0 ₫",
    label: "Thất thoát tiền cọc & công nợ",
    detail: "Đối soát VietQR chính xác từng giao dịch",
    tone: "amber",
  },
  {
    value: "30 Giây",
    label: "Tạo hợp đồng số & mã thanh toán",
    detail: "Khách hàng ký tay cảm ứng đa nền tảng",
    tone: "fuchsia",
  },
];

export function TransformationMatrix() {
  const [activeTab, setActiveTab] = useState<string>("all");

  const filteredItems =
    activeTab === "all" ? COMPARISONS : COMPARISONS.filter((item) => item.id === activeTab);

  return (
    <div className="space-y-12">
      {/* 4 Impact Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((metric) => (
          <div
            key={metric.label}
            className="group relative overflow-hidden rounded-2xl border border-border/80 bg-surface/80 p-5 shadow-xs backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
          >
            <div className="absolute top-0 right-0 h-24 w-24 -mr-6 -mt-6 rounded-full bg-primary/5 blur-2xl transition-all group-hover:bg-primary/10" />
            <p className="font-mono text-3xl font-extrabold tracking-tight text-primary">
              {metric.value}
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">{metric.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "all"
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
              : "border border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          }`}
        >
          Tất cả quy trình
        </button>
        {COMPARISONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === item.id
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                : "border border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {item.category}
          </button>
        ))}
      </div>

      {/* Comparison Cards Display */}
      <div className="grid gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="grid overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition-all duration-300 hover:shadow-md lg:grid-cols-2"
          >
            {/* Traditional Method Side */}
            <div className="relative border-b border-border p-6 bg-red-50/20 dark:bg-red-950/10 lg:border-r lg:border-b-0 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200/60 bg-red-100/60 px-3 py-1 text-xs font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  Mô hình Truyền Thống
                </span>
                <span className="text-xs font-medium text-muted-foreground">{item.category}</span>
              </div>

              <h4 className="mt-4 text-lg font-semibold text-foreground/90">
                {item.traditional.title}
              </h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.traditional.description}
              </p>

              <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-200/50 bg-red-50/50 px-3.5 py-2 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>Hệ quả: {item.traditional.painPoint}</span>
              </div>
            </div>

            {/* StudioCore Modern Side */}
            <div className="relative p-6 bg-gradient-to-br from-primary/[0.03] via-violet-500/[0.04] to-surface sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-100/60 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Đột Phá Với StudioCore
                </span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>

              <h4 className="mt-4 text-lg font-semibold text-foreground">
                {item.studiocore.title}
              </h4>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.studiocore.description}
              </p>

              <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200/50 bg-emerald-50/60 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Kết quả: {item.studiocore.advantage}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Button asChild size="lg" className="shadow-lg shadow-primary/20">
          <Link href="/register">
            Bắt đầu số hóa studio của bạn ngay
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
