import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import { getNotificationsForActor } from "@/lib/services/notification-service";
import { formatDateTime } from "@/lib/utils";
import {
  AppShell,
  type NavGroup,
  type NotificationView,
} from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor();
  const notificationSummary = getNotificationsForActor(getDb(), actor);

  const groups: NavGroup[] = [];

  if (hasPermission(actor.permissions, "dashboard.view")) {
    groups.push({
      label: "Tổng quan",
      items: [
        { href: "/manage/dashboard", label: "Dashboard", icon: "dashboard" },
      ],
    });
  }

  if (hasPermission(actor.permissions, "customers.view")) {
    groups.push({
      label: "Kinh doanh",
      items: [
        { href: "/manage/customers", label: "Khách hàng", icon: "customers" },
        { href: "/manage/campaigns", label: "Chiến dịch", icon: "campaigns" },
        { href: "/manage/inbox", label: "Inbox", icon: "inbox" },
      ],
    });
  }

  if (hasPermission(actor.permissions, "orders.view")) {
    const businessItems = [
      { href: "/manage/orders", label: "Đơn hàng", icon: "orders" as const },
      { href: "/manage/services", label: "Dịch vụ", icon: "services" as const },
      { href: "/manage/vouchers", label: "Voucher", icon: "vouchers" as const },
      { href: "/manage/products", label: "Sản phẩm", icon: "products" as const },
    ];

    const businessGroup = groups.find((group) => group.label === "Kinh doanh");
    if (businessGroup) {
      businessGroup.items.push(...businessItems);
    } else {
      groups.push({ label: "Kinh doanh", items: businessItems });
    }
  }

  if (hasPermission(actor.permissions, "schedule.view")) {
    groups.push({
      label: "Sản xuất",
      items: [
        { href: "/manage/calendar", label: "Lịch chụp", icon: "calendar" },
        ...(hasPermission(actor.permissions, "schedule.manage")
          ? [
              {
                href: "/manage/settings/rooms",
                label: "Phòng chụp",
                icon: "rooms" as const,
              },
            ]
          : []),
      ],
    });

    groups.push({
      label: "Vận hành",
      items: [
        { href: "/manage/wardrobe", label: "Kho trang phục", icon: "wardrobe" },
        { href: "/manage/equipment", label: "Thiết bị", icon: "equipment" },
      ],
    });
  }

  if (hasPermission(actor.permissions, "tasks.view")) {
    let operationsGroup = groups.find((group) => group.label === "Vận hành");
    if (!operationsGroup) {
      operationsGroup = { label: "Vận hành", items: [] };
      groups.push(operationsGroup);
    }
    operationsGroup.items.push(
      { href: "/manage/tasks", label: "Công việc", icon: "tasks" },
      { href: "/manage/documents", label: "Tài liệu", icon: "documents" },
    );
  }

  if (hasPermission(actor.permissions, "staff.view")) {
    let operationsGroup = groups.find((group) => group.label === "Vận hành");
    if (!operationsGroup) {
      operationsGroup = { label: "Vận hành", items: [] };
      groups.push(operationsGroup);
    }
    operationsGroup.items.push({
      href: "/manage/staff",
      label: "Nhân sự",
      icon: "staff",
    });
  }

  if (hasPermission(actor.permissions, "finance.view")) {
    groups.push({
      label: "Tài chính",
      items: [
        { href: "/manage/finance", label: "Sổ quỹ", icon: "finance" },
        { href: "/manage/finance/invoices", label: "Hóa đơn", icon: "invoices" },
        { href: "/manage/finance/debts", label: "Công nợ", icon: "debts" },
        {
          href: "/manage/finance/commissions",
          label: "Hoa hồng",
          icon: "commissions",
        },
        ...(hasPermission(actor.permissions, "payroll.view")
          ? [{ href: "/manage/payroll", label: "Bảng lương", icon: "payroll" as const }]
          : []),
        ...(hasPermission(actor.permissions, "reports.view")
          ? [{ href: "/manage/reports", label: "Báo cáo", icon: "reports" as const }]
          : []),
      ],
    });
  } else if (hasPermission(actor.permissions, "payroll.view")) {
    groups.push({
      label: "Tài chính",
      items: [{ href: "/manage/payroll", label: "Bảng lương", icon: "payroll" }],
    });
  }

  if (hasPermission(actor.permissions, "albums.view")) {
    let productionGroup = groups.find((group) => group.label === "Sản xuất");
    if (!productionGroup) {
      productionGroup = { label: "Sản xuất", items: [] };
      groups.push(productionGroup);
    }
    productionGroup.items.push(
      { href: "/manage/photos", label: "Album ảnh", icon: "photos" },
      { href: "/manage/drive", label: "StudioCore Drive", icon: "drive" as const },
      { href: "/manage/photos/filter", label: "Lọc ảnh khách chọn", icon: "filter" },
    );
  }

  if (hasPermission(actor.permissions, "settings.manage")) {
    groups.push({
      label: "Hệ thống",
      items: [
        { href: "/manage/settings/users", label: "Người dùng", icon: "users" },
        { href: "/manage/settings/roles", label: "Vai trò & quyền", icon: "roles" },
        {
          href: "/manage/settings/sessions",
          label: "Phiên đăng nhập",
          icon: "sessions",
        },
        { href: "/manage/settings/ai", label: "AI Hub", icon: "ai" },
        {
          href: "/manage/settings/integrations",
          label: "Tích hợp",
          icon: "integrations",
        },
        { href: "/manage/settings/studio", label: "Cài đặt studio", icon: "studio" },
        { href: "/manage/settings/branches", label: "Chi nhánh", icon: "branches" },
      ],
    });
  }

  if (hasPermission(actor.permissions, "audit.view")) {
    let systemGroup = groups.find((group) => group.label === "Hệ thống");
    if (!systemGroup) {
      systemGroup = { label: "Hệ thống", items: [] };
      groups.push(systemGroup);
    }
    systemGroup.items.push({
      href: "/manage/activity-log",
      label: "Nhật ký hoạt động",
      icon: "audit",
    });
  }

  const notifications: NotificationView[] = notificationSummary.items.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    link: item.link,
    createdAtLabel: formatDateTime(item.createdAt),
    read: item.readAt !== null,
  }));

  return (
    <AppShell
      actor={{
        staffName: actor.staffName,
        staffCode: actor.staffCode,
        staffEmail: actor.staffEmail,
        roleLabel: ROLE_LABELS[actor.role],
        tenantName: actor.tenantName,
        activeBranchId: actor.activeBranchId,
        isOwner: actor.role === "owner",
        readOnly: actor.readOnly,
        branches: actor.branches,
      }}
      nav={groups}
      notifications={notifications}
      unreadCount={notificationSummary.unreadCount}
    >
      {children}
    </AppShell>
  );
}
