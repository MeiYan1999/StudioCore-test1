export const ROLES = [
  "platform_admin",
  "owner",
  "manager",
  "receptionist",
  "photographer",
  "makeup",
  "retoucher",
  "accountant",
] as const;

export type Role = (typeof ROLES)[number];

export const TENANT_ROLES = [
  "owner",
  "manager",
  "receptionist",
  "photographer",
  "makeup",
  "retoucher",
  "accountant",
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export const ASSIGNABLE_ROLES = TENANT_ROLES.filter(
  (role): role is Exclude<TenantRole, "owner"> => role !== "owner",
);

export const PERMISSIONS = [
  "dashboard.view",
  "orders.view",
  "orders.manage",
  "catalog.manage",
  "schedule.view",
  "schedule.manage",
  "customers.view",
  "customers.manage",
  "albums.view",
  "albums.manage",
  "finance.view",
  "finance.manage",
  "staff.view",
  "staff.manage",
  "tasks.view",
  "tasks.manage",
  "reports.view",
  "settings.view",
  "settings.manage",
  "payroll.view",
  "payroll.manage",
  "audit.view",
  "integrations.manage",
  "tenants.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard.view": "Xem dashboard",
  "orders.view": "Xem đơn hàng",
  "orders.manage": "Quản lý đơn hàng",
  "catalog.manage": "Quản lý dịch vụ, sản phẩm, voucher",
  "schedule.view": "Xem lịch chụp",
  "schedule.manage": "Quản lý lịch chụp",
  "customers.view": "Xem khách hàng",
  "customers.manage": "Quản lý khách hàng",
  "albums.view": "Xem album",
  "albums.manage": "Quản lý album",
  "finance.view": "Xem tài chính",
  "finance.manage": "Quản lý tài chính",
  "staff.view": "Xem nhân sự",
  "staff.manage": "Quản lý nhân sự",
  "tasks.view": "Xem công việc",
  "tasks.manage": "Quản lý công việc",
  "reports.view": "Xem báo cáo",
  "settings.view": "Xem cấu hình",
  "settings.manage": "Quản lý cấu hình",
  "payroll.view": "Xem lương",
  "payroll.manage": "Quản lý lương",
  "audit.view": "Xem nhật ký",
  "integrations.manage": "Quản lý tích hợp",
  "tenants.manage": "Quản lý tenant nền tảng",
};

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  {
    label: "Tổng quan",
    permissions: ["dashboard.view"],
  },
  {
    label: "Kinh doanh",
    permissions: [
      "orders.view",
      "orders.manage",
      "catalog.manage",
      "customers.view",
      "customers.manage",
      "tasks.view",
      "tasks.manage",
    ],
  },
  {
    label: "Sản xuất",
    permissions: ["schedule.view", "schedule.manage", "albums.view", "albums.manage"],
  },
  {
    label: "Tài chính",
    permissions: ["finance.view", "finance.manage", "payroll.view", "payroll.manage", "reports.view"],
  },
  {
    label: "Hệ thống",
    permissions: [
      "staff.view",
      "staff.manage",
      "settings.view",
      "settings.manage",
      "audit.view",
      "integrations.manage",
      "tenants.manage",
    ],
  },
];

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Quản trị nền tảng",
  owner: "Chủ studio",
  manager: "Quản lý chi nhánh",
  receptionist: "Lễ tân / Sale",
  photographer: "Photographer",
  makeup: "Makeup artist",
  retoucher: "Retoucher / Editor",
  accountant: "Kế toán",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  platform_admin: "Quản lý vòng đời tenant và gói dịch vụ ở cấp nền tảng.",
  owner: "Toàn quyền trong tenant, chuyển chi nhánh và cấu hình studio.",
  manager: "Quản lý vận hành chi nhánh được giao, không quản lý lương.",
  receptionist: "Tiếp nhận khách, đơn hàng và lịch chụp tại chi nhánh.",
  photographer: "Xem lịch, đơn hàng, khách hàng và album được phân công.",
  makeup: "Xem lịch và thông tin khách phục vụ makeup.",
  retoucher: "Xem đơn hàng, lịch và quản lý album hậu kỳ.",
  accountant: "Quản lý tài chính, hóa đơn, lương và báo cáo.",
};

const OWNER_PERMISSIONS = PERMISSIONS.filter((permission) => permission !== "tenants.manage");

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  platform_admin: ["tenants.manage"],
  owner: OWNER_PERMISSIONS,
  manager: [
    "dashboard.view",
    "orders.view",
    "orders.manage",
    "catalog.manage",
    "schedule.view",
    "schedule.manage",
    "customers.view",
    "customers.manage",
    "albums.view",
    "finance.view",
    "staff.view",
    "tasks.view",
    "tasks.manage",
    "reports.view",
    "settings.view",
  ],
  receptionist: [
    "dashboard.view",
    "orders.view",
    "orders.manage",
    "schedule.view",
    "schedule.manage",
    "customers.view",
    "customers.manage",
    "albums.view",
    "tasks.view",
    "tasks.manage",
  ],
  photographer: [
    "dashboard.view",
    "orders.view",
    "schedule.view",
    "customers.view",
    "albums.view",
    "albums.manage",
    "tasks.view",
    "tasks.manage",
  ],
  makeup: [
    "dashboard.view",
    "orders.view",
    "schedule.view",
    "customers.view",
    "albums.view",
    "tasks.view",
    "tasks.manage",
  ],
  retoucher: [
    "dashboard.view",
    "orders.view",
    "schedule.view",
    "albums.view",
    "albums.manage",
    "tasks.view",
    "tasks.manage",
  ],
  accountant: [
    "dashboard.view",
    "orders.view",
    "customers.view",
    "finance.view",
    "finance.manage",
    "staff.view",
    "tasks.view",
    "tasks.manage",
    "reports.view",
    "settings.view",
    "payroll.view",
    "payroll.manage",
    "audit.view",
  ],
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isTenantRole(value: string): value is TenantRole {
  return (TENANT_ROLES as readonly string[]).includes(value);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
