import type { TenantRole } from "./auth/roles";

export type DemoBranchKey = "q1" | "thu-duc";

export type DemoAccount = {
  role: TenantRole;
  name: string;
  email: string;
  code: string;
  pin: string;
  password: string;
  branchKeys: DemoBranchKey[];
};

export const DEMO_TENANT = {
  id: "tenant-demo",
  name: "Studio Ánh Dương",
  slug: "studio-anh-duong",
  plan: "pro",
  branches: [
    {
      key: "q1" as const,
      id: "branch-demo-q1",
      name: "Chi nhánh Quận 1",
      address: "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
      phone: "028 0000 0001",
    },
    {
      key: "thu-duc" as const,
      id: "branch-demo-thu-duc",
      name: "Chi nhánh Thủ Đức",
      address: "88 Võ Văn Ngân, Phường Linh Chiểu, Thủ Đức, TP.HCM",
      phone: "028 0000 0002",
    },
  ],
} as const;

export const DEMO_SECONDARY_TENANT = {
  id: "tenant-secondary",
  name: "Studio Bình Minh",
  slug: "studio-binh-minh",
  plan: "trial",
  branchId: "branch-secondary",
  branchName: "Chi nhánh Bình Thạnh",
  branchAddress: "25 Đinh Bộ Lĩnh, Phường 24, Bình Thạnh, TP.HCM",
  branchPhone: "028 0000 0003",
  owner: {
    id: "staff-secondary-owner",
    name: "Phan Gia Huy",
    email: "owner@studiobinhminh.demo",
    code: "BM-OWNER",
    pin: "999999",
    password: "Demo@123",
  },
} as const;

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: "owner",
    name: "Nguyễn Minh Anh",
    email: "owner@studiocore.demo",
    code: "SC-OWNER",
    pin: "111111",
    password: "Demo@123",
    branchKeys: ["q1", "thu-duc"],
  },
  {
    role: "manager",
    name: "Trần Thu Hà",
    email: "manager@studiocore.demo",
    code: "SC-MANAGER",
    pin: "222222",
    password: "Demo@123",
    branchKeys: ["q1"],
  },
  {
    role: "receptionist",
    name: "Lê Ngọc Mai",
    email: "letan@studiocore.demo",
    code: "SC-LETAN",
    pin: "333333",
    password: "Demo@123",
    branchKeys: ["q1"],
  },
  {
    role: "photographer",
    name: "Phạm Quốc Bảo",
    email: "photo@studiocore.demo",
    code: "SC-PHOTO",
    pin: "444444",
    password: "Demo@123",
    branchKeys: ["q1"],
  },
  {
    role: "photographer",
    name: "Đỗ Hoàng Nam",
    email: "photo2@studiocore.demo",
    code: "SC-PHOTO2",
    pin: "555555",
    password: "Demo@123",
    branchKeys: ["thu-duc"],
  },
  {
    role: "makeup",
    name: "Vũ Khánh Linh",
    email: "makeup@studiocore.demo",
    code: "SC-MAKEUP",
    pin: "666666",
    password: "Demo@123",
    branchKeys: ["q1"],
  },
  {
    role: "retoucher",
    name: "Ngô Thanh Tùng",
    email: "retouch@studiocore.demo",
    code: "SC-RETOUCH",
    pin: "777777",
    password: "Demo@123",
    branchKeys: ["q1"],
  },
  {
    role: "accountant",
    name: "Bùi Thị Hồng",
    email: "ketoan@studiocore.demo",
    code: "SC-KETOAN",
    pin: "888888",
    password: "Demo@123",
    branchKeys: ["q1", "thu-duc"],
  },
];

export const DEMO_PLATFORM_ACCOUNT = {
  role: "platform_admin" as const,
  name: "Quản trị nền tảng Demo",
  email: "platform@studiocore.demo",
  code: "SC-PLATFORM",
  pin: "000000",
  password: "Demo@123",
} as const;
