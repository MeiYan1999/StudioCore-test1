import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  Building,
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Database,
  DoorOpen,
  FileSpreadsheet,
  HardDrive,
  HelpCircle,
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";

export const metadata = {
  title: "Danh mục quản lý - Cài đặt",
  description: "Trung tâm quản lý cấu hình studio, quyền hạn, chi nhánh, AI và tích hợp hệ thống.",
};

type SettingCategoryItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof Building;
  iconBg: string;
  iconColor: string;
  badge?: string;
  external?: boolean;
};

export default async function SettingsHubPage() {
  const actor = await requireActor();
  const canManage =
    hasPermission(actor.permissions, "settings.manage") ||
    hasPermission(actor.permissions, "settings.view");

  if (!canManage) {
    return (
      <ForbiddenState description="Vai trò của bạn không có quyền truy cập Danh mục quản lý." />
    );
  }

  const categories: SettingCategoryItem[] = [
    {
      id: "studio",
      title: "Thông tin Studio",
      description: "Quản lý tên studio, logo, hotline, địa chỉ, subdomain riêng...",
      href: "/manage/settings/studio",
      icon: Building,
      iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "roles",
      title: "Nhóm quyền & Vai trò",
      description: "Quản lý các nhóm quyền truy cập, phân quyền chi tiết cho nhân sự.",
      href: "/manage/settings/roles",
      icon: ShieldCheck,
      iconBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      id: "users",
      title: "Người dùng hệ thống",
      description: "Danh sách tài khoản đăng nhập, trạng thái hoạt động và mật khẩu.",
      href: "/manage/settings/users",
      icon: Users,
      iconBg: "bg-cyan-500/10 dark:bg-cyan-500/20",
      iconColor: "text-cyan-600 dark:text-cyan-400",
    },
    {
      id: "branches",
      title: "Danh sách chi nhánh",
      description: "Quản lý các cơ sở studio, chi nhánh hoạt động và cấu hình riêng.",
      href: "/manage/settings/branches",
      icon: Building2,
      iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      id: "rooms",
      title: "Phòng chụp chuyên biệt",
      description: "Thiết lập các phòng chụp, studio concept và phân bổ lịch chụp.",
      href: "/manage/settings/rooms",
      icon: DoorOpen,
      iconBg: "bg-teal-500/10 dark:bg-teal-500/20",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      id: "drive",
      title: "Kết nối Google Drive",
      description: "Kho lưu trữ dữ liệu studio: ảnh chụp, Google API Key, quét thư mục...",
      href: "/manage/settings/integrations",
      icon: HardDrive,
      iconBg: "bg-sky-500/10 dark:bg-sky-500/20",
      iconColor: "text-sky-600 dark:text-sky-400",
    },
    {
      id: "backup",
      title: "Sao lưu & Khôi phục",
      description: "Tải bản sao lưu toàn bộ dữ liệu studio hàng ngày (JSON backup).",
      href: "/api/exports/demo-backup",
      icon: Database,
      iconBg: "bg-violet-500/10 dark:bg-violet-500/20",
      iconColor: "text-violet-600 dark:text-violet-400",
      external: true,
    },
    {
      id: "ai",
      title: "Quản lý AI (API Keys & Tính năng)",
      description: "Cấu hình OpenAI, Gemini, Local AI Hub và ngân sách hàng tháng.",
      href: "/manage/settings/ai",
      icon: BrainCircuit,
      iconBg: "bg-fuchsia-500/10 dark:bg-fuchsia-500/20",
      iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
    },
    {
      id: "payments",
      title: "Kết nối SePay (Biến động số dư)",
      description: "Nhận biến động số dư ngân hàng qua SePay Webhook tự động.",
      href: "/manage/settings/sepay",
      icon: CreditCard,
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "sessions",
      title: "Phiên đăng nhập & Thiết bị",
      description: "Theo dõi các thiết bị đang đăng nhập, thu hồi phiên làm việc từ xa.",
      href: "/manage/settings/sessions",
      icon: MonitorSmartphone,
      iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
      iconColor: "text-rose-600 dark:text-rose-400",
    },
    {
      id: "calendar",
      title: "Đồng bộ Google Calendar",
      description: "Đồng bộ lịch chụp 2 chiều 24/7 với Google Calendar và Apple Calendar.",
      href: "/manage/calendar",
      icon: CalendarDays,
      iconBg: "bg-blue-500/10 dark:bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "excel",
      title: "Khởi tạo & Xuất dữ liệu Excel",
      description: "Xuất dữ liệu danh sách khách hàng, đơn hàng, hóa đơn kế toán.",
      href: "/api/exports/customers?format=csv",
      icon: FileSpreadsheet,
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      external: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground hover:text-foreground">
            <Link href="/manage/dashboard">
              <ArrowLeft className="h-4 w-4" />
              <span>Trở lại</span>
            </Link>
          </Button>
          <span className="h-4 w-px bg-border" aria-hidden />
          <span className="text-sm font-semibold text-foreground">
            {actor.tenantName || "StudioCore"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/guide" target="_blank">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Hướng dẫn sử dụng</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <Link href="/contact" target="_blank">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Yêu cầu hỗ trợ</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Danh mục quản lý
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground italic">
          *Lưu ý: Các cài đặt liên quan đến nhân viên (chấm công, ca làm, bảng lương, thưởng phạt, hoa hồng) đã được chuyển vào menu &ldquo;Nhân sự&rdquo;.
        </p>
      </div>

      {/* Category Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((item) => {
          const Icon = item.icon;
          const isDownloadOrApi = item.external;

          return (
            <Link
              key={item.id}
              href={item.href}
              {...(isDownloadOrApi ? { target: "_blank", download: true } : {})}
              className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-surface hover:shadow-md hover:ring-1 hover:ring-primary/20"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconBg} ${item.iconColor} transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-primary" />
                </div>

                <div className="mt-3.5">
                  <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
