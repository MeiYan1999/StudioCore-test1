"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  Banknote,
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  Building2,
  CalendarDays,
  Camera,
  ChevronRight,
  ClipboardList,
  DoorOpen,
  FileText,
  HardDrive,
  Images,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  MonitorSmartphone,
  Package,
  Percent,
  Plug,
  ReceiptText,
  Scale,
  ScrollText,
  Settings,
  Settings2,
  ShieldCheck,
  Shirt,
  Ticket,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { logoutAction, switchBranchAction } from "@/lib/auth/actions";
import { markAllNotificationsReadAction } from "@/lib/actions/notification-actions";
import { cn, initials } from "@/lib/utils";
import { BrandApertureIcon } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";

export type NavIcon =
  | "dashboard"
  | "customers"
  | "orders"
  | "services"
  | "vouchers"
  | "products"
  | "calendar"
  | "rooms"
  | "photos"
  | "drive"
  | "filter"
  | "ai"
  | "integrations"
  | "wardrobe"
  | "equipment"
  | "users"
  | "roles"
  | "sessions"
  | "finance"
  | "invoices"
  | "debts"
  | "commissions"
  | "payroll"
  | "reports"
  | "tasks"
  | "documents"
  | "campaigns"
  | "inbox"
  | "staff"
  | "audit"
  | "studio"
  | "branches"
  | "settings";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export type NotificationView = {
  id: string;
  title: string;
  content: string;
  link: string | null;
  createdAtLabel: string;
  read: boolean;
};

export type ShellActor = {
  staffName: string;
  staffCode: string;
  staffEmail: string | null;
  roleLabel: string;
  tenantName: string;
  activeBranchId: string | null;
  isOwner: boolean;
  readOnly?: boolean;
  branches: { id: string; name: string }[];
};

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  customers: UsersRound,
  orders: ReceiptText,
  services: Package,
  vouchers: Ticket,
  products: Boxes,
  calendar: CalendarDays,
  rooms: DoorOpen,
  photos: Images,
  drive: HardDrive,
  filter: ListFilter,
  ai: BrainCircuit,
  integrations: Plug,
  wardrobe: Shirt,
  equipment: Camera,
  users: Users,
  roles: ShieldCheck,
  sessions: MonitorSmartphone,
  finance: Wallet,
  invoices: ReceiptText,
  debts: Scale,
  commissions: Percent,
  payroll: Banknote,
  reports: BarChart3,
  tasks: ClipboardList,
  documents: FileText,
  campaigns: Megaphone,
  inbox: MessageSquare,
  staff: UserCog,
  audit: ScrollText,
  studio: Settings2,
  branches: Building2,
  settings: Settings,
};

const SEGMENT_LABELS: Record<string, string> = {
  manage: "Quản trị",
  dashboard: "Tổng quan",
  customers: "Khách hàng",
  orders: "Đơn hàng",
  services: "Dịch vụ",
  vouchers: "Voucher",
  products: "Sản phẩm",
  calendar: "Lịch chụp",
  rooms: "Phòng chụp",
  photos: "Album ảnh",
  albums: "Album",
  filter: "Lọc ảnh",
  notes: "Ghi chú ảnh",
  ai: "AI Hub",
  integrations: "Tích hợp",
  share: "PhotoShare",
  drive: "StudioCore Drive",
  finance: "Sổ quỹ",
  invoices: "Hóa đơn",
  debts: "Công nợ",
  commissions: "Hoa hồng",
  payroll: "Bảng lương",
  reports: "Báo cáo",
  tasks: "Công việc",
  documents: "Tài liệu",
  campaigns: "Chiến dịch",
  inbox: "Inbox",
  staff: "Nhân sự",
  attendance: "Chấm công",
  leave: "Nghỉ phép",
  audit: "Nhật ký",
  "activity-log": "Nhật ký hoạt động",
  studio: "Cài đặt studio",
  branches: "Chi nhánh",
  payments: "Thanh toán",
  sandbox: "Sandbox",
  wardrobe: "Kho trang phục",
  rentals: "Phiếu thuê",
  equipment: "Thiết bị",
  contract: "Hợp đồng",
  receipt: "Phiếu thu",
  settings: "Cài đặt",
  users: "Người dùng",
  roles: "Vai trò & quyền",
  sessions: "Phiên đăng nhập",
  forbidden: "Không có quyền",
};

function getBreadcrumbs(pathname: string): string[] {
  if (pathname === "/manage/dashboard") {
    return ["Tổng quan"];
  }

  const parts = pathname.split("/").filter(Boolean);
  return parts.map((part) => {
    const known = SEGMENT_LABELS[part];
    if (known) {
      return known;
    }
    if (part.length > 20) {
      return "Chi tiết";
    }
    return part;
  });
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BranchSwitcher({
  actor,
  compact = false,
}: {
  actor: ShellActor;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);

  if (actor.branches.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Chưa gán chi nhánh</span>
    );
  }

  return (
    <form
      key={actor.activeBranchId ?? "all-branches"}
      ref={formRef}
      action={switchBranchAction}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="returnTo" value={pathname} />
      <Building2
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <label htmlFor={compact ? "branch-switcher-mobile" : "branch-switcher"} className="sr-only">
        Chọn chi nhánh
      </label>
      <select
        id={compact ? "branch-switcher-mobile" : "branch-switcher"}
        name="branchId"
        defaultValue={actor.activeBranchId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className={cn(
          "h-8 rounded-lg border border-[var(--input-border)] bg-surface px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
          compact ? "w-full" : "w-36 sm:w-44",
        )}
      >
        {actor.isOwner ? <option value="">Tất cả chi nhánh</option> : null}
        {actor.branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-xs underline">
          Áp dụng
        </button>
      </noscript>
    </form>
  );
}

function NotificationsMenu({
  notifications,
  unreadCount,
}: {
  notifications: NotificationView[];
  unreadCount: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Thông báo, ${unreadCount} chưa đọc`}
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">Thông báo</p>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button
                type="submit"
                className="text-xs font-medium text-primary hover:underline"
              >
                Đọc tất cả
              </button>
            </form>
          ) : null}
        </div>
        {notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Chưa có thông báo nào.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1">
            {notifications.map((notification) => {
              const content = (
                <div className="flex items-start gap-2">
                  {!notification.read ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      aria-label="Chưa đọc"
                    />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {notification.content}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {notification.createdAtLabel}
                    </p>
                  </div>
                </div>
              );

              return notification.link ? (
                <DropdownMenuItem key={notification.id} asChild>
                  <Link href={notification.link}>{content}</Link>
                </DropdownMenuItem>
              ) : (
                <div key={notification.id} className="rounded-md px-3 py-2">
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({ actor }: { actor: ShellActor }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Mở menu tài khoản">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {initials(actor.staffName)}
          </span>
          <span className="hidden max-w-28 truncate text-sm font-medium md:block">
            {actor.staffName}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block text-sm font-semibold text-foreground">
            {actor.staffName}
          </span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {actor.roleLabel} · {actor.tenantName}
          </span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {actor.staffCode}
            {actor.staffEmail ? ` · ${actor.staffEmail}` : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Đăng xuất
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({
  actor,
  nav,
  onNavigate,
}: {
  actor: ShellActor;
  nav: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 ring-1 ring-white/20">
          <BrandApertureIcon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">StudioCore</p>
          <p className="truncate text-xs text-muted-foreground">{actor.tenantName}</p>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3 lg:hidden">
        <BranchSwitcher actor={actor} compact />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Điều hướng chính">
        {nav.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="text-xs font-medium text-foreground">{actor.roleLabel}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Phase 1 · Nền tảng</p>
      </div>
    </div>
  );
}

export function AppShell({
  actor,
  nav,
  notifications,
  unreadCount,
  children,
}: {
  actor: ShellActor;
  nav: NavGroup[];
  notifications: NotificationView[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <TooltipProvider delayDuration={200}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Bỏ qua điều hướng
      </a>

      <div className="min-h-screen lg:flex">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <SidebarContent actor={actor} nav={nav} />
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Điều hướng StudioCore</SheetTitle>
              <SheetDescription>Menu điều hướng và chọn chi nhánh.</SheetDescription>
            </SheetHeader>
            <SidebarContent
              actor={actor}
              nav={nav}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:px-5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu điều hướng"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>

            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm sm:flex">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  ) : null}
                  <span
                    className={cn(
                      "truncate",
                      index === breadcrumbs.length - 1
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <div className="hidden md:block">
                <BranchSwitcher actor={actor} />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <ThemeToggle />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Đổi giao diện sáng/tối</TooltipContent>
              </Tooltip>
              <NotificationsMenu
                notifications={notifications}
                unreadCount={unreadCount}
              />
              <UserMenu actor={actor} />
            </div>
          </header>

          {actor.readOnly ? (
            <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-[var(--warning)] sm:px-6 lg:px-8 dark:border-amber-900 dark:bg-amber-950/40">
              <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
                <span>
                  Đây là dữ liệu demo. Chế độ chỉ xem: mọi thao tác ghi đều bị chặn ở server.
                </span>
                <span className="flex gap-3">
                  <a href="/register" className="font-semibold underline">
                    Đăng ký dùng thử
                  </a>
                  <a href="/pricing" className="underline">
                    Xem gói cước
                  </a>
                </span>
              </div>
            </div>
          ) : null}
          <main
            id="main-content"
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8"
          >
            {children}
          </main>

          <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
              <span>StudioCore · Dữ liệu demo, không dùng thông tin khách thật.</span>
              <span>Asia/Ho_Chi_Minh · VND</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
