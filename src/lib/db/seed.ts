import type { AppDb } from "./client";
import {
  activityLogs,
  albumFolders,
  albums,
  albumSources,
  appointments,
  attendance,
  branches,
  budgets,
  campaigns,
  commissionRules,
  commissions,
  conversations,
  customerInteractions,
  customers,
  documents,
  equipment,
  equipmentUsages,
  expenses,
  invoices,
  leaveRequests,
  messages,
  orderItems,
  orderStatusHistory,
  orders,
  payments,
  payrolls,
  photos,
  products,
  rolePermissions,
  rooms,
  serviceAddons,
  services,
  settings,
  staff,
  staffBranches,
  staffShifts,
  taskComments,
  tasks,
  tenants,
  transactions,
  vouchers,
  wardrobeItems,
  wardrobeRentals,
} from "./schema";
import { DEFAULT_ROLE_PERMISSIONS, ROLES } from "../auth/roles";
import { hashSecret } from "../auth/password";
import type { OrderStatus } from "../orders/status";
import {
  DEMO_ACCOUNTS,
  DEMO_PLATFORM_ACCOUNT,
  DEMO_SECONDARY_TENANT,
  DEMO_TENANT,
} from "../demo-accounts";
import {
  DEMO_ALBUM,
  demoPhotoPreviewKey,
  demoPhotoStorageKey,
  demoPhotoThumbnailKey,
} from "../demo-album";
import { createShareTokenRecord } from "../share/token";
import { normalizeVietnamesePhone } from "../utils/phone";

function demoStaffId(code: string): string {
  return `staff-${code.toLowerCase()}`;
}

function permissionId(tenantId: string, role: string, permission: string): string {
  return `rp-${tenantId}-${role}-${permission}`;
}

export type SeedSummary = {
  tenants: number;
  branches: number;
  staff: number;
  customers: number;
  customerInteractions: number;
  services: number;
  serviceAddons: number;
  products: number;
  vouchers: number;
  orders: number;
  orderItems: number;
  payments: number;
  rooms: number;
  staffShifts: number;
  leaveRequests: number;
  appointments: number;
  wardrobeRentals: number;
  equipment: number;
  equipmentUsages: number;
  wardrobeItems: number;
  rolePermissions: number;
  settings: number;
  albums: number;
  albumSources: number;
  albumFolders: number;
  photos: number;
  transactions: number;
  expenses: number;
  budgets: number;
  invoices: number;
  commissionRules: number;
  commissions: number;
  payrolls: number;
  attendance: number;
  tasks: number;
  taskComments: number;
  documents: number;
  campaigns: number;
  conversations: number;
  messages: number;
};

export function seedDatabase(db: AppDb): SeedSummary {
  const branchIdByKey = {
    q1: DEMO_TENANT.branches[0].id,
    "thu-duc": DEMO_TENANT.branches[1].id,
  };

  const summary: SeedSummary = {
    tenants: 2,
    branches: 3,
    staff: DEMO_ACCOUNTS.length + 2,
    customers: 10,
    customerInteractions: 10,
    services: 5,
    serviceAddons: 6,
    products: 5,
    vouchers: 3,
    orders: 6,
    orderItems: 13,
    payments: 5,
    rooms: 4,
    staffShifts: 0,
    leaveRequests: 2,
    appointments: 6,
    wardrobeRentals: 2,
    equipment: 5,
    equipmentUsages: 1,
    wardrobeItems: 15,
    rolePermissions: 0,
    settings: 0,
    albums: 1,
    albumSources: 1,
    albumFolders: DEMO_ALBUM.folders.length,
    photos: DEMO_ALBUM.photos.length,
    transactions: 8,
    expenses: 3,
    budgets: 2,
    invoices: 2,
    commissionRules: 3,
    commissions: 3,
    payrolls: 1,
    attendance: 6,
    tasks: 4,
    taskComments: 2,
    documents: 2,
    campaigns: 2,
    conversations: 2,
    messages: 4,
  };

  db.transaction((tx) => {
    tx.insert(tenants)
      .values([
        {
          id: DEMO_TENANT.id,
          name: DEMO_TENANT.name,
          slug: DEMO_TENANT.slug,
          status: "active",
          plan: DEMO_TENANT.plan,
        },
        {
          id: DEMO_SECONDARY_TENANT.id,
          name: DEMO_SECONDARY_TENANT.name,
          slug: DEMO_SECONDARY_TENANT.slug,
          status: "active",
          plan: DEMO_SECONDARY_TENANT.plan,
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(branches)
      .values([
        {
          id: DEMO_TENANT.branches[0].id,
          tenantId: DEMO_TENANT.id,
          name: DEMO_TENANT.branches[0].name,
          address: DEMO_TENANT.branches[0].address,
          phone: DEMO_TENANT.branches[0].phone,
          workingHours: JSON.stringify({
            monday: "08:00-18:00",
            tuesday: "08:00-18:00",
            wednesday: "08:00-18:00",
            thursday: "08:00-18:00",
            friday: "08:00-18:00",
            saturday: "08:00-17:00",
            sunday: "closed",
          }),
        },
        {
          id: DEMO_TENANT.branches[1].id,
          tenantId: DEMO_TENANT.id,
          name: DEMO_TENANT.branches[1].name,
          address: DEMO_TENANT.branches[1].address,
          phone: DEMO_TENANT.branches[1].phone,
          workingHours: JSON.stringify({
            monday: "08:00-18:00",
            tuesday: "08:00-18:00",
            wednesday: "08:00-18:00",
            thursday: "08:00-18:00",
            friday: "08:00-18:00",
            saturday: "08:00-17:00",
            sunday: "closed",
          }),
        },
        {
          id: DEMO_SECONDARY_TENANT.branchId,
          tenantId: DEMO_SECONDARY_TENANT.id,
          name: DEMO_SECONDARY_TENANT.branchName,
          address: DEMO_SECONDARY_TENANT.branchAddress,
          phone: DEMO_SECONDARY_TENANT.branchPhone,
          workingHours: JSON.stringify({
            monday: "08:00-18:00",
            tuesday: "08:00-18:00",
            wednesday: "08:00-18:00",
            thursday: "08:00-18:00",
            friday: "08:00-18:00",
            saturday: "08:00-17:00",
            sunday: "closed",
          }),
        },
      ])
      .onConflictDoNothing()
      .run();

    const baseSalaryByRole: Record<string, number> = {
      owner: 25_000_000,
      manager: 18_000_000,
      receptionist: 9_000_000,
      photographer: 12_000_000,
      makeup: 9_000_000,
      retoucher: 10_000_000,
      accountant: 11_000_000,
    };

    const staffRows: (typeof staff.$inferInsert)[] = DEMO_ACCOUNTS.map((account) => ({
      id: demoStaffId(account.code),
      tenantId: DEMO_TENANT.id,
      code: account.code,
      name: account.name,
      role: account.role,
      pinHash: hashSecret(account.pin),
      passwordHash: hashSecret(account.password),
      email: account.email,
      phone: null,
      baseSalary: baseSalaryByRole[account.role] ?? 0,
      active: true,
    }));

    staffRows.push({
      id: "staff-sc-platform",
      tenantId: DEMO_TENANT.id,
      code: DEMO_PLATFORM_ACCOUNT.code,
      name: DEMO_PLATFORM_ACCOUNT.name,
      role: DEMO_PLATFORM_ACCOUNT.role,
      pinHash: hashSecret(DEMO_PLATFORM_ACCOUNT.pin),
      passwordHash: hashSecret(DEMO_PLATFORM_ACCOUNT.password),
      email: DEMO_PLATFORM_ACCOUNT.email,
      phone: null,
      baseSalary: 0,
      active: true,
    });

    staffRows.push({
      id: DEMO_SECONDARY_TENANT.owner.id,
      tenantId: DEMO_SECONDARY_TENANT.id,
      code: DEMO_SECONDARY_TENANT.owner.code,
      name: DEMO_SECONDARY_TENANT.owner.name,
      role: "owner",
      pinHash: hashSecret(DEMO_SECONDARY_TENANT.owner.pin),
      passwordHash: hashSecret(DEMO_SECONDARY_TENANT.owner.password),
      email: DEMO_SECONDARY_TENANT.owner.email,
      phone: null,
      baseSalary: 20_000_000,
      active: true,
    });

    tx.insert(staff).values(staffRows).onConflictDoNothing().run();

    const staffBranchRows: (typeof staffBranches.$inferInsert)[] = DEMO_ACCOUNTS.flatMap((account) =>
      account.branchKeys.map((branchKey) => ({
        staffId: demoStaffId(account.code),
        branchId: branchIdByKey[branchKey],
        tenantId: DEMO_TENANT.id,
      })),
    );

    staffBranchRows.push({
      staffId: DEMO_SECONDARY_TENANT.owner.id,
      branchId: DEMO_SECONDARY_TENANT.branchId,
      tenantId: DEMO_SECONDARY_TENANT.id,
    });

    tx.insert(staffBranches).values(staffBranchRows).onConflictDoNothing().run();

    const rolePermissionRows = [DEMO_TENANT.id, DEMO_SECONDARY_TENANT.id].flatMap(
      (tenantId) =>
        ROLES.flatMap((role) =>
          DEFAULT_ROLE_PERMISSIONS[role].map((permission) => ({
            id: permissionId(tenantId, role, permission),
            tenantId,
            role,
            permission,
          })),
        ),
    );

    tx.insert(rolePermissions).values(rolePermissionRows).onConflictDoNothing().run();
    summary.rolePermissions = rolePermissionRows.length;

    const customerNames = [
      "Nguyễn Thu Trang",
      "Trần Quốc Hưng",
      "Lê Mai Phương",
      "Phạm Đức Anh",
      "Hoàng Ngọc Hân",
      "Võ Minh Khoa",
      "Đặng Thanh Thảo",
      "Bùi Quang Huy",
      "Đỗ Kim Ngân",
      "Ngô Bảo Châu",
    ];

    const customerSources = ["facebook", "tiktok", "google", "referral", "walk_in"];
    const customerTiers = ["standard", "vip", "standard", "vvip", "standard"];
    const customerStatuses = ["active", "lead", "active", "active", "inactive"];

    const customerRows = customerNames.map((name, index) => {
      const phone = normalizeVietnamesePhone(`09000000${String(index + 1).padStart(2, "0")}`);
      if (!phone) {
        throw new Error("Số điện thoại seed không hợp lệ");
      }

      const branchId = index % 2 === 0 ? branchIdByKey.q1 : branchIdByKey["thu-duc"];
      const ownerId = index % 3 === 0 ? demoStaffId("SC-MANAGER") : demoStaffId("SC-OWNER");

      return {
        id: `customer-demo-${String(index + 1).padStart(2, "0")}`,
        tenantId: DEMO_TENANT.id,
        branchId,
        name,
        phone,
        email: `khach${String(index + 1).padStart(2, "0")}@example.demo`,
        address: index % 2 === 0 ? "Quận 1, TP.HCM" : "Thủ Đức, TP.HCM",
        birthday: `${1988 + (index % 8)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`,
        measurements: JSON.stringify({
          heightCm: 155 + (index % 10),
          dressSize: ["S", "M", "L"][index % 3],
          shoeSize: 35 + (index % 5),
        }),
        source: customerSources[index % customerSources.length] ?? "walk_in",
        tier: customerTiers[index % customerTiers.length] ?? "standard",
        status: customerStatuses[index % customerStatuses.length] ?? "lead",
        tags: JSON.stringify(index % 2 === 0 ? ["cưới", "quan tâm"] : ["gia đình"]),
        ownerId,
        followUpAt: new Date(`2026-11-${String(10 + (index % 12)).padStart(2, "0")}T09:00:00+07:00`),
        lastContactAt: new Date(`2026-10-${String(20 + (index % 8)).padStart(2, "0")}T15:30:00+07:00`),
        notes: "Khách demo, dữ liệu hư cấu phục vụ kiểm thử.",
      };
    });

    tx.insert(customers).values(customerRows).onConflictDoNothing().run();

    tx.insert(services)
      .values([
        {
          id: "service-demo-wedding",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Gói Cưới Premium",
          category: "wedding",
          price: 12_000_000,
          durationMinutes: 240,
          description: "Chụp cưới trọn gói tại studio và ngoại cảnh.",
          active: true,
        },
        {
          id: "service-demo-baby",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Gói Baby 1 Tuổi",
          category: "baby",
          price: 3_500_000,
          durationMinutes: 90,
          description: "Chụp baby tại studio với đạo cụ và trang phục.",
          active: true,
        },
        {
          id: "service-demo-family",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Gói Gia Đình",
          category: "family",
          price: 4_800_000,
          durationMinutes: 120,
          description: "Chụp gia đình 4-6 người, hỗ trợ trang phục cơ bản.",
          active: true,
        },
        {
          id: "service-demo-lookbook",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Lookbook Doanh Nghiệp",
          category: "lookbook",
          price: 6_500_000,
          durationMinutes: 180,
          description: "Chụp lookbook sản phẩm và chân dung đội ngũ.",
          active: true,
        },
        {
          id: "service-demo-event",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Gói Sự Kiện Studio",
          category: "event",
          price: 8_000_000,
          durationMinutes: 240,
          description: "Ghi hình sự kiện tại studio hoặc địa điểm khách chọn.",
          active: true,
        },
      ])
      .onConflictDoNothing()
      .run();

    const wardrobeNames = [
      "Váy cưới trắng tay dài",
      "Váy cưới ren cổ V",
      "Áo dài thêu hoa",
      "Vest nam xanh navy",
      "Vest nam be",
      "Đầm dạ hội đỏ",
      "Đầm baby pastel",
      "Bộ gia đình pastel",
      "Suit bé trai",
      "Váy bé gái",
      "Áo dài nam",
      "Váy dạ hội đen",
      "Áo khoác lông",
      "Phụ kiện voan cưới",
      "Giày cưới trắng",
    ];

    const wardrobeRows = wardrobeNames.map((name, index) => ({
      id: `wardrobe-demo-${String(index + 1).padStart(2, "0")}`,
      tenantId: DEMO_TENANT.id,
      branchId: index % 2 === 0 ? branchIdByKey.q1 : branchIdByKey["thu-duc"],
      sku: `VD-${String(index + 1).padStart(3, "0")}`,
      qrCode: `QR-VD-${String(index + 1).padStart(3, "0")}`,
      name,
      size: ["S", "M", "L", "XL"][index % 4] ?? "M",
      color: ["Trắng", "Đỏ", "Xanh", "Be", "Đen"][index % 5] ?? "Trắng",
      status: index === 0 ? "rented" : index === 6 ? "cleaning" : index === 12 ? "maintenance" : "available",
      rentalPrice: 500_000 + (index % 5) * 100_000,
      depositPrice: 1_000_000 + (index % 3) * 500_000,
      image: null,
    }));

    tx.insert(wardrobeItems).values(wardrobeRows).onConflictDoNothing().run();

    const settingRows = [
      {
        id: "setting-demo-name",
        tenantId: DEMO_TENANT.id,
        key: "studio.name",
        value: DEMO_TENANT.name,
      },
      {
        id: "setting-demo-address",
        tenantId: DEMO_TENANT.id,
        key: "studio.address",
        value: "12 Nguyễn Huệ, Quận 1, TP.HCM",
      },
      {
        id: "setting-demo-phone",
        tenantId: DEMO_TENANT.id,
        key: "studio.phone",
        value: "028 0000 0001",
      },
      {
        id: "setting-demo-email",
        tenantId: DEMO_TENANT.id,
        key: "studio.email",
        value: "hello@studiocore.demo",
      },
      {
        id: "setting-demo-website",
        tenantId: DEMO_TENANT.id,
        key: "studio.website",
        value: "https://studiocore.demo",
      },
      {
        id: "setting-demo-tax-code",
        tenantId: DEMO_TENANT.id,
        key: "studio.taxCode",
        value: "0000000000",
      },
      {
        id: "setting-demo-bank-name",
        tenantId: DEMO_TENANT.id,
        key: "payment.bankName",
        value: "Ngân hàng Demo (không dùng chuyển khoản thật)",
      },
      {
        id: "setting-demo-bank-bin",
        tenantId: DEMO_TENANT.id,
        key: "payment.bankBin",
        value: "970436",
      },
      {
        id: "setting-demo-bank-account",
        tenantId: DEMO_TENANT.id,
        key: "payment.bankAccountNumber",
        value: "0000000000",
      },
      {
        id: "setting-demo-bank-holder",
        tenantId: DEMO_TENANT.id,
        key: "payment.bankAccountName",
        value: "STUDIO ANH DUONG DEMO",
      },
      {
        id: "setting-demo-working-hours",
        tenantId: DEMO_TENANT.id,
        key: "studio.workingHours",
        value: JSON.stringify({
          monday: "08:00-18:00",
          tuesday: "08:00-18:00",
          wednesday: "08:00-18:00",
          thursday: "08:00-18:00",
          friday: "08:00-18:00",
          saturday: "08:00-17:00",
          sunday: "closed",
        }),
      },
      {
        id: "setting-demo-ai-provider",
        tenantId: DEMO_TENANT.id,
        key: "ai.provider",
        value: "local",
      },
      {
        id: "setting-demo-ai-consent",
        tenantId: DEMO_TENANT.id,
        key: "ai.consent",
        value: "false",
      },
      {
        id: "setting-demo-ai-budget",
        tenantId: DEMO_TENANT.id,
        key: "ai.budgetVnd",
        value: "0",
      },
      {
        id: "setting-demo-ai-blur",
        tenantId: DEMO_TENANT.id,
        key: "ai.feature.blur",
        value: "true",
      },
      {
        id: "setting-demo-ai-exposure",
        tenantId: DEMO_TENANT.id,
        key: "ai.feature.exposure",
        value: "true",
      },
      {
        id: "setting-demo-ai-duplicate",
        tenantId: DEMO_TENANT.id,
        key: "ai.feature.duplicate",
        value: "true",
      },
      {
        id: "setting-demo-ai-burst",
        tenantId: DEMO_TENANT.id,
        key: "ai.feature.burst",
        value: "true",
      },
      {
        id: "setting-demo-ai-eye",
        tenantId: DEMO_TENANT.id,
        key: "ai.feature.eye_detection",
        value: "false",
      },
      {
        id: "setting-secondary-name",
        tenantId: DEMO_SECONDARY_TENANT.id,
        key: "studio.name",
        value: DEMO_SECONDARY_TENANT.name,
      },
      {
        id: "setting-secondary-address",
        tenantId: DEMO_SECONDARY_TENANT.id,
        key: "studio.address",
        value: DEMO_SECONDARY_TENANT.branchAddress,
      },
      {
        id: "setting-secondary-phone",
        tenantId: DEMO_SECONDARY_TENANT.id,
        key: "studio.phone",
        value: DEMO_SECONDARY_TENANT.branchPhone,
      },
    ];

    tx.insert(settings).values(settingRows).onConflictDoNothing().run();
    summary.settings = settingRows.length;

    tx.insert(serviceAddons)
      .values([
        {
          id: "addon-demo-makeup",
          tenantId: DEMO_TENANT.id,
          serviceId: "service-demo-wedding",
          name: "Makeup cô dâu",
          price: 1_500_000,
          active: true,
        },
        {
          id: "addon-demo-extra-hour",
          tenantId: DEMO_TENANT.id,
          serviceId: "service-demo-wedding",
          name: "Phụ thu ngoài giờ",
          price: 800_000,
          active: true,
        },
        {
          id: "addon-demo-album",
          tenantId: DEMO_TENANT.id,
          serviceId: "service-demo-family",
          name: "Album da 20x20",
          price: 1_200_000,
          active: true,
        },
        {
          id: "addon-demo-print",
          tenantId: DEMO_TENANT.id,
          serviceId: "service-demo-family",
          name: "In ảnh 30x45",
          price: 600_000,
          active: true,
        },
        {
          id: "addon-demo-travel",
          tenantId: DEMO_TENANT.id,
          serviceId: "service-demo-lookbook",
          name: "Di chuyển nội thành",
          price: 500_000,
          active: true,
        },
        {
          id: "addon-demo-raw",
          tenantId: DEMO_TENANT.id,
          serviceId: "service-demo-event",
          name: "Toàn bộ file RAW",
          price: 2_000_000,
          active: true,
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(products)
      .values([
        {
          id: "product-demo-album",
          tenantId: DEMO_TENANT.id,
          sku: "SP-ALBUM-20",
          name: "Album da 20x20",
          category: "album",
          price: 1_200_000,
          stock: 20,
          status: "active",
        },
        {
          id: "product-demo-print",
          tenantId: DEMO_TENANT.id,
          sku: "SP-PRINT-3045",
          name: "Ảnh in 30x45",
          category: "print",
          price: 250_000,
          stock: 100,
          status: "active",
        },
        {
          id: "product-demo-frame",
          tenantId: DEMO_TENANT.id,
          sku: "SP-FRAME-A3",
          name: "Khung gỗ A3",
          category: "frame",
          price: 450_000,
          stock: 30,
          status: "active",
        },
        {
          id: "product-demo-usb",
          tenantId: DEMO_TENANT.id,
          sku: "SP-USB-32",
          name: "USB 32GB",
          category: "delivery",
          price: 300_000,
          stock: 50,
          status: "active",
        },
        {
          id: "product-demo-makeup",
          tenantId: DEMO_TENANT.id,
          sku: "SP-MAKEUP",
          name: "Bộ makeup cơ bản",
          category: "service",
          price: 800_000,
          stock: 10,
          status: "inactive",
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(vouchers)
      .values([
        {
          id: "voucher-demo-welcome",
          tenantId: DEMO_TENANT.id,
          code: "WELCOME10",
          name: "Giảm 10% khách mới",
          discountType: "percent",
          value: 10,
          minOrder: 3_000_000,
          maxDiscount: 1_000_000,
          usageLimit: 50,
          usedCount: 1,
          startsAt: new Date("2026-01-01T00:00:00+07:00"),
          endsAt: new Date("2027-12-31T23:59:59+07:00"),
          active: true,
        },
        {
          id: "voucher-demo-wedding",
          tenantId: DEMO_TENANT.id,
          code: "WEDDING500",
          name: "Giảm 500.000đ gói cưới",
          discountType: "fixed",
          value: 500_000,
          minOrder: 8_000_000,
          usageLimit: 20,
          usedCount: 1,
          startsAt: new Date("2026-01-01T00:00:00+07:00"),
          endsAt: new Date("2027-12-31T23:59:59+07:00"),
          active: true,
        },
        {
          id: "voucher-demo-family",
          tenantId: DEMO_TENANT.id,
          code: "FAMILY300",
          name: "Giảm 300.000đ gói gia đình",
          discountType: "fixed",
          value: 300_000,
          minOrder: 3_000_000,
          usageLimit: 30,
          usedCount: 1,
          startsAt: new Date("2026-01-01T00:00:00+07:00"),
          endsAt: new Date("2027-12-31T23:59:59+07:00"),
          active: true,
        },
      ])
      .onConflictDoNothing()
      .run();

    const interactionTypes = ["call", "message", "meeting", "note", "follow_up"];
    const interactionContents = [
      "Gọi tư vấn gói cưới, khách hẹn xem studio cuối tuần.",
      "Khách nhắn Zalo hỏi lịch chụp baby tháng này.",
      "Tư vấn gói gia đình, khách chọn chi nhánh Thủ Đức.",
      "Ghi chú: khách quan tâm lookbook doanh nghiệp.",
      "Follow-up sau buổi chụp, khách hài lòng.",
      "Khách gọi đổi giờ chụp sang buổi chiều.",
      "Tư vấn thêm album và ảnh in.",
      "Khách phản hồi sẽ xác nhận trong tuần.",
      "Ghi chú sở thích màu pastel và phong cách tự nhiên.",
      "Nhắc lịch hẹn xem ảnh và chọn ảnh.",
    ];

    const interactionRows = customerNames.map((_, index) => ({
      id: `customer-interaction-demo-${String(index + 1).padStart(2, "0")}`,
      tenantId: DEMO_TENANT.id,
      customerId: `customer-demo-${String(index + 1).padStart(2, "0")}`,
      type: interactionTypes[index % interactionTypes.length] ?? "note",
      content: interactionContents[index] ?? "Tương tác demo.",
      occurredAt: new Date(`2026-10-${String(20 + (index % 8)).padStart(2, "0")}T10:00:00+07:00`),
      createdBy: index % 3 === 0 ? demoStaffId("SC-MANAGER") : demoStaffId("SC-OWNER"),
    }));

    tx.insert(customerInteractions)
      .values(interactionRows)
      .onConflictDoNothing()
      .run();

    const orderRows = [
      {
        id: "order-demo-01",
        code: "DH-20261101-0001",
        customerId: "customer-demo-01",
        branchId: branchIdByKey.q1,
        status: "completed" as OrderStatus,
        photographerId: demoStaffId("SC-PHOTO"),
        editorId: demoStaffId("SC-RETOUCH"),
        makeupId: demoStaffId("SC-MAKEUP"),
        scheduledAt: new Date("2026-10-01T09:00:00+07:00"),
        location: "Studio Quận 1",
        subtotal: 14_700_000,
        surcharge: 0,
        discount: 200_000,
        voucherId: "voucher-demo-welcome",
        voucherCode: "WELCOME10",
        voucherDiscount: 1_000_000,
        total: 13_500_000,
        deposit: 5_000_000,
        paid: 13_500_000,
        remaining: 0,
        notes: "Đơn demo đã hoàn tất.",
        contractConfirmedAt: new Date("2026-09-25T10:30:00+07:00"),
        contractConfirmedBy: demoStaffId("SC-OWNER"),
        createdBy: demoStaffId("SC-OWNER"),
      },
      {
        id: "order-demo-02",
        code: "DH-20261102-0002",
        customerId: "customer-demo-02",
        branchId: branchIdByKey.q1,
        status: "editing" as OrderStatus,
        photographerId: demoStaffId("SC-PHOTO"),
        editorId: demoStaffId("SC-RETOUCH"),
        makeupId: null,
        scheduledAt: new Date("2026-10-18T14:00:00+07:00"),
        location: "Studio Quận 1",
        subtotal: 4_700_000,
        surcharge: 0,
        discount: 0,
        voucherId: null,
        voucherCode: null,
        voucherDiscount: 0,
        total: 4_700_000,
        deposit: 2_000_000,
        paid: 2_000_000,
        remaining: 2_700_000,
        notes: "Đang hậu kỳ.",
        contractConfirmedAt: null,
        contractConfirmedBy: null,
        createdBy: demoStaffId("SC-MANAGER"),
      },
      {
        id: "order-demo-03",
        code: "DH-20261103-0003",
        customerId: "customer-demo-03",
        branchId: branchIdByKey["thu-duc"],
        status: "scheduled" as OrderStatus,
        photographerId: demoStaffId("SC-PHOTO2"),
        editorId: null,
        makeupId: demoStaffId("SC-MAKEUP"),
        scheduledAt: new Date("2026-11-10T09:00:00+07:00"),
        location: "Studio Thủ Đức",
        subtotal: 6_250_000,
        surcharge: 0,
        discount: 0,
        voucherId: "voucher-demo-family",
        voucherCode: "FAMILY300",
        voucherDiscount: 300_000,
        total: 5_950_000,
        deposit: 3_000_000,
        paid: 3_000_000,
        remaining: 2_950_000,
        notes: "Đã lên lịch, khách cần xác nhận lại trang phục.",
        contractConfirmedAt: null,
        contractConfirmedBy: null,
        createdBy: demoStaffId("SC-LETAN"),
      },
      {
        id: "order-demo-04",
        code: "DH-20261104-0004",
        customerId: "customer-demo-04",
        branchId: branchIdByKey.q1,
        status: "new" as OrderStatus,
        photographerId: null,
        editorId: null,
        makeupId: null,
        scheduledAt: new Date("2026-11-20T15:00:00+07:00"),
        location: "Địa điểm khách chọn",
        subtotal: 7_000_000,
        surcharge: 0,
        discount: 0,
        voucherId: null,
        voucherCode: null,
        voucherDiscount: 0,
        total: 7_000_000,
        deposit: 0,
        paid: 0,
        remaining: 7_000_000,
        notes: "Khách mới, chưa thu cọc.",
        contractConfirmedAt: null,
        contractConfirmedBy: null,
        createdBy: demoStaffId("SC-LETAN"),
      },
      {
        id: "order-demo-05",
        code: "DH-20261105-0005",
        customerId: "customer-demo-05",
        branchId: branchIdByKey["thu-duc"],
        status: "cancelled" as OrderStatus,
        photographerId: demoStaffId("SC-PHOTO2"),
        editorId: null,
        makeupId: null,
        scheduledAt: new Date("2026-11-25T08:00:00+07:00"),
        location: "Studio Thủ Đức",
        subtotal: 8_000_000,
        surcharge: 0,
        discount: 0,
        voucherId: null,
        voucherCode: null,
        voucherDiscount: 0,
        total: 8_000_000,
        deposit: 0,
        paid: 0,
        remaining: 0,
        notes: "Đơn demo bị hủy.",
        cancelReason: "Khách đổi lịch sang tháng sau.",
        contractConfirmedAt: null,
        contractConfirmedBy: null,
        createdBy: demoStaffId("SC-MANAGER"),
      },
      {
        id: "order-demo-06",
        code: "DH-20261106-0006",
        customerId: "customer-demo-06",
        branchId: branchIdByKey.q1,
        status: "deposit_received" as OrderStatus,
        photographerId: demoStaffId("SC-PHOTO"),
        editorId: null,
        makeupId: demoStaffId("SC-MAKEUP"),
        scheduledAt: new Date("2026-12-05T09:00:00+07:00"),
        location: "Studio Quận 1",
        subtotal: 13_500_000,
        surcharge: 0,
        discount: 0,
        voucherId: "voucher-demo-wedding",
        voucherCode: "WEDDING500",
        voucherDiscount: 500_000,
        total: 13_000_000,
        deposit: 4_000_000,
        paid: 4_000_000,
        remaining: 9_000_000,
        notes: "Khách đã cọc, chờ xác nhận lịch.",
        contractConfirmedAt: null,
        contractConfirmedBy: null,
        createdBy: demoStaffId("SC-OWNER"),
      },
    ].map((order) => ({
      ...order,
      tenantId: DEMO_TENANT.id,
    }));

    tx.insert(orders).values(orderRows).onConflictDoNothing().run();

    const orderItemRows = [
      {
        id: "order-item-demo-01-1",
        orderId: "order-demo-01",
        itemType: "service" as const,
        refId: "service-demo-wedding",
        name: "Gói Cưới Premium",
        quantity: 1,
        unitPrice: 12_000_000,
        total: 12_000_000,
        sortOrder: 1,
      },
      {
        id: "order-item-demo-01-2",
        orderId: "order-demo-01",
        itemType: "addon" as const,
        refId: "addon-demo-makeup",
        name: "Makeup cô dâu",
        quantity: 1,
        unitPrice: 1_500_000,
        total: 1_500_000,
        sortOrder: 2,
      },
      {
        id: "order-item-demo-01-3",
        orderId: "order-demo-01",
        itemType: "product" as const,
        refId: "product-demo-album",
        name: "Album da 20x20",
        quantity: 1,
        unitPrice: 1_200_000,
        total: 1_200_000,
        sortOrder: 3,
      },
      {
        id: "order-item-demo-02-1",
        orderId: "order-demo-02",
        itemType: "service" as const,
        refId: "service-demo-baby",
        name: "Gói Baby 1 Tuổi",
        quantity: 1,
        unitPrice: 3_500_000,
        total: 3_500_000,
        sortOrder: 1,
      },
      {
        id: "order-item-demo-02-2",
        orderId: "order-demo-02",
        itemType: "product" as const,
        refId: "product-demo-album",
        name: "Album da 20x20",
        quantity: 1,
        unitPrice: 1_200_000,
        total: 1_200_000,
        sortOrder: 2,
      },
      {
        id: "order-item-demo-03-1",
        orderId: "order-demo-03",
        itemType: "service" as const,
        refId: "service-demo-family",
        name: "Gói Gia Đình",
        quantity: 1,
        unitPrice: 4_800_000,
        total: 4_800_000,
        sortOrder: 1,
      },
      {
        id: "order-item-demo-03-2",
        orderId: "order-demo-03",
        itemType: "product" as const,
        refId: "product-demo-print",
        name: "Ảnh in 30x45",
        quantity: 1,
        unitPrice: 250_000,
        total: 250_000,
        sortOrder: 2,
      },
      {
        id: "order-item-demo-03-3",
        orderId: "order-demo-03",
        itemType: "addon" as const,
        refId: "addon-demo-album",
        name: "Album da 20x20",
        quantity: 1,
        unitPrice: 1_200_000,
        total: 1_200_000,
        sortOrder: 3,
      },
      {
        id: "order-item-demo-04-1",
        orderId: "order-demo-04",
        itemType: "service" as const,
        refId: "service-demo-lookbook",
        name: "Lookbook Doanh Nghiệp",
        quantity: 1,
        unitPrice: 6_500_000,
        total: 6_500_000,
        sortOrder: 1,
      },
      {
        id: "order-item-demo-04-2",
        orderId: "order-demo-04",
        itemType: "addon" as const,
        refId: "addon-demo-travel",
        name: "Di chuyển nội thành",
        quantity: 1,
        unitPrice: 500_000,
        total: 500_000,
        sortOrder: 2,
      },
      {
        id: "order-item-demo-05-1",
        orderId: "order-demo-05",
        itemType: "service" as const,
        refId: "service-demo-event",
        name: "Gói Sự Kiện Studio",
        quantity: 1,
        unitPrice: 8_000_000,
        total: 8_000_000,
        sortOrder: 1,
      },
      {
        id: "order-item-demo-06-1",
        orderId: "order-demo-06",
        itemType: "service" as const,
        refId: "service-demo-wedding",
        name: "Gói Cưới Premium",
        quantity: 1,
        unitPrice: 12_000_000,
        total: 12_000_000,
        sortOrder: 1,
      },
      {
        id: "order-item-demo-06-2",
        orderId: "order-demo-06",
        itemType: "addon" as const,
        refId: "addon-demo-makeup",
        name: "Makeup cô dâu",
        quantity: 1,
        unitPrice: 1_500_000,
        total: 1_500_000,
        sortOrder: 2,
      },
    ].map((item) => ({
      ...item,
      tenantId: DEMO_TENANT.id,
    }));

    tx.insert(orderItems).values(orderItemRows).onConflictDoNothing().run();

    const statusSequences: Record<string, OrderStatus[]> = {
      "order-demo-01": [
        "new",
        "deposit_received",
        "confirmed",
        "scheduled",
        "shooting",
        "awaiting_edit",
        "editing",
        "awaiting_selection",
        "awaiting_approval",
        "delivered",
        "completed",
      ],
      "order-demo-02": [
        "new",
        "deposit_received",
        "scheduled",
        "shooting",
        "awaiting_edit",
        "editing",
      ],
      "order-demo-03": ["new", "deposit_received", "confirmed", "scheduled"],
      "order-demo-04": ["new"],
      "order-demo-05": ["new", "cancelled"],
      "order-demo-06": ["new", "deposit_received"],
    };

    const historyRows = Object.entries(statusSequences).flatMap(
      ([orderId, statuses]) =>
        statuses.map((toStatus, index) => ({
          id: `order-history-${orderId}-${String(index + 1).padStart(2, "0")}`,
          tenantId: DEMO_TENANT.id,
          orderId,
          fromStatus: index === 0 ? null : statuses[index - 1] ?? null,
          toStatus,
          note:
            index === 0
              ? "Tạo đơn demo."
              : toStatus === "cancelled"
                ? "Khách đổi lịch."
                : "Cập nhật trạng thái demo.",
          changedBy: demoStaffId("SC-OWNER"),
          createdAt: new Date(
            new Date("2026-10-01T08:00:00+07:00").getTime() +
              index * 60 * 60 * 1000,
          ),
        })),
    );

    tx.insert(orderStatusHistory).values(historyRows).onConflictDoNothing().run();

    const paymentRows = [
      {
        id: "payment-demo-01-deposit",
        orderId: "order-demo-01",
        amount: 5_000_000,
        method: "bank_transfer",
        status: "completed" as const,
        reference: "DEMO-CK-0001",
        idempotencyKey: "seed-order-01-deposit",
        paidAt: new Date("2026-09-25T11:00:00+07:00"),
        createdBy: demoStaffId("SC-OWNER"),
      },
      {
        id: "payment-demo-01-final",
        orderId: "order-demo-01",
        amount: 8_500_000,
        method: "cash",
        status: "completed" as const,
        reference: "DEMO-TM-0001",
        idempotencyKey: "seed-order-01-final",
        paidAt: new Date("2026-10-30T16:00:00+07:00"),
        createdBy: demoStaffId("SC-KETOAN"),
      },
      {
        id: "payment-demo-02-deposit",
        orderId: "order-demo-02",
        amount: 2_000_000,
        method: "cash",
        status: "completed" as const,
        reference: "DEMO-TM-0002",
        idempotencyKey: "seed-order-02-deposit",
        paidAt: new Date("2026-10-02T10:00:00+07:00"),
        createdBy: demoStaffId("SC-MANAGER"),
      },
      {
        id: "payment-demo-03-deposit",
        orderId: "order-demo-03",
        amount: 3_000_000,
        method: "bank_transfer",
        status: "completed" as const,
        reference: "DEMO-CK-0003",
        idempotencyKey: "seed-order-03-deposit",
        paidAt: new Date("2026-10-05T09:30:00+07:00"),
        createdBy: demoStaffId("SC-LETAN"),
      },
      {
        id: "payment-demo-06-deposit",
        orderId: "order-demo-06",
        amount: 4_000_000,
        method: "bank_transfer",
        status: "completed" as const,
        reference: "DEMO-CK-0006",
        idempotencyKey: "seed-order-06-deposit",
        paidAt: new Date("2026-10-08T14:00:00+07:00"),
        createdBy: demoStaffId("SC-OWNER"),
      },
    ].map((payment) => ({
      ...payment,
      tenantId: DEMO_TENANT.id,
    }));

    tx.insert(payments).values(paymentRows).onConflictDoNothing().run();

    tx.insert(rooms)
      .values([
        {
          id: "room-demo-q1-1",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Phòng Studio 1",
          capacity: 2,
          status: "active",
          notes: "Phòng chụp chính, có phông nền trắng và xám.",
        },
        {
          id: "room-demo-q1-2",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Phòng Studio 2",
          capacity: 1,
          status: "active",
          notes: "Phòng baby và chân dung nhỏ.",
        },
        {
          id: "room-demo-thu-duc-1",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey["thu-duc"],
          name: "Phòng Studio 3",
          capacity: 2,
          status: "active",
          notes: "Phòng chụp gia đình.",
        },
        {
          id: "room-secondary-1",
          tenantId: DEMO_SECONDARY_TENANT.id,
          branchId: DEMO_SECONDARY_TENANT.branchId,
          name: "Phòng Bình Minh",
          capacity: 1,
          status: "active",
          notes: "Phòng demo tenant phụ.",
        },
      ])
      .onConflictDoNothing()
      .run();

    const shiftDates = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 10, 3 + index));
      return date.toISOString().slice(0, 10);
    });

    const shiftRows: (typeof staffShifts.$inferInsert)[] = [];
    for (const account of DEMO_ACCOUNTS) {
      for (const branchKey of account.branchKeys) {
        for (const date of shiftDates) {
          shiftRows.push({
            id: `shift-${account.code.toLowerCase()}-${branchKey}-${date}`,
            tenantId: DEMO_TENANT.id,
            branchId: branchIdByKey[branchKey],
            staffId: demoStaffId(account.code),
            startAt: new Date(`${date}T08:00:00+07:00`),
            endAt: new Date(`${date}T18:00:00+07:00`),
            role: "shift",
            status: "active",
          });
        }
      }
    }
    for (const date of shiftDates) {
      shiftRows.push({
        id: `shift-secondary-owner-${date}`,
        tenantId: DEMO_SECONDARY_TENANT.id,
        branchId: DEMO_SECONDARY_TENANT.branchId,
        staffId: DEMO_SECONDARY_TENANT.owner.id,
        startAt: new Date(`${date}T08:00:00+07:00`),
        endAt: new Date(`${date}T18:00:00+07:00`),
        role: "shift",
        status: "active",
      });
    }
    tx.insert(staffShifts).values(shiftRows).onConflictDoNothing().run();
    summary.staffShifts = shiftRows.length;

    tx.insert(leaveRequests)
      .values([
        {
          id: "leave-demo-photo2-20261112",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey["thu-duc"],
          staffId: demoStaffId("SC-PHOTO2"),
          startAt: new Date("2026-11-12T08:00:00+07:00"),
          endAt: new Date("2026-11-12T18:00:00+07:00"),
          status: "approved",
          reason: "Nghỉ phép demo.",
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "leave-demo-makeup-20261115",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          staffId: demoStaffId("SC-MAKEUP"),
          startAt: new Date("2026-11-15T08:00:00+07:00"),
          endAt: new Date("2026-11-15T12:00:00+07:00"),
          status: "pending",
          reason: "Việc cá nhân, chờ duyệt.",
          createdBy: demoStaffId("SC-MANAGER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(appointments)
      .values([
        {
          id: "appointment-demo-01",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          orderId: "order-demo-01",
          roomId: "room-demo-q1-1",
          photographerId: demoStaffId("SC-PHOTO"),
          makeupId: demoStaffId("SC-MAKEUP"),
          editorId: demoStaffId("SC-RETOUCH"),
          startAt: new Date("2026-10-01T09:00:00+07:00"),
          endAt: new Date("2026-10-01T13:00:00+07:00"),
          status: "completed",
          idempotencyKey: "seed-appointment-01",
          notes: "Buổi chụp cưới đã hoàn tất.",
          checkInAt: new Date("2026-10-01T08:50:00+07:00"),
          checkOutAt: new Date("2026-10-01T13:10:00+07:00"),
          checkedInBy: demoStaffId("SC-LETAN"),
          checkedOutBy: demoStaffId("SC-PHOTO"),
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "appointment-demo-02",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          orderId: "order-demo-02",
          roomId: "room-demo-q1-2",
          photographerId: demoStaffId("SC-PHOTO"),
          editorId: demoStaffId("SC-RETOUCH"),
          startAt: new Date("2026-10-18T14:00:00+07:00"),
          endAt: new Date("2026-10-18T15:30:00+07:00"),
          status: "completed",
          idempotencyKey: "seed-appointment-02",
          notes: "Buổi chụp baby đã hoàn tất.",
          checkInAt: new Date("2026-10-18T13:55:00+07:00"),
          checkOutAt: new Date("2026-10-18T15:35:00+07:00"),
          checkedInBy: demoStaffId("SC-LETAN"),
          checkedOutBy: demoStaffId("SC-PHOTO"),
          createdBy: demoStaffId("SC-MANAGER"),
        },
        {
          id: "appointment-demo-03",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey["thu-duc"],
          orderId: "order-demo-03",
          roomId: "room-demo-thu-duc-1",
          photographerId: demoStaffId("SC-PHOTO2"),
          startAt: new Date("2026-11-10T09:00:00+07:00"),
          endAt: new Date("2026-11-10T11:00:00+07:00"),
          status: "scheduled",
          idempotencyKey: "seed-appointment-03",
          notes: "Chụp gia đình tại Thủ Đức.",
          createdBy: demoStaffId("SC-LETAN"),
        },
        {
          id: "appointment-demo-04",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          orderId: "order-demo-04",
          roomId: "room-demo-q1-1",
          startAt: new Date("2026-11-20T15:00:00+07:00"),
          endAt: new Date("2026-11-20T17:00:00+07:00"),
          status: "scheduled",
          idempotencyKey: "seed-appointment-04",
          notes: "Chờ phân công photographer.",
          createdBy: demoStaffId("SC-LETAN"),
        },
        {
          id: "appointment-demo-05",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey["thu-duc"],
          orderId: "order-demo-05",
          roomId: "room-demo-thu-duc-1",
          photographerId: demoStaffId("SC-PHOTO2"),
          startAt: new Date("2026-11-25T08:00:00+07:00"),
          endAt: new Date("2026-11-25T12:00:00+07:00"),
          status: "cancelled",
          idempotencyKey: "seed-appointment-05",
          notes: "Lịch demo đã hủy.",
          cancelReason: "Khách đổi lịch.",
          createdBy: demoStaffId("SC-MANAGER"),
        },
        {
          id: "appointment-demo-06",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          orderId: "order-demo-06",
          roomId: "room-demo-q1-1",
          photographerId: demoStaffId("SC-PHOTO"),
          makeupId: demoStaffId("SC-MAKEUP"),
          startAt: new Date("2026-12-05T09:00:00+07:00"),
          endAt: new Date("2026-12-05T13:00:00+07:00"),
          status: "scheduled",
          idempotencyKey: "seed-appointment-06",
          notes: "Buổi chụp cưới sắp tới.",
          createdBy: demoStaffId("SC-OWNER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(wardrobeRentals)
      .values([
        {
          id: "rental-demo-active",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          wardrobeItemId: "wardrobe-demo-01",
          orderId: "order-demo-02",
          customerId: "customer-demo-02",
          checkedOutAt: new Date("2026-10-18T14:00:00+07:00"),
          dueAt: new Date("2026-10-25T18:00:00+07:00"),
          conditionOut: "good",
          cleaningFee: 0,
          damageFee: 0,
          deposit: 1_500_000,
          status: "active",
          notes: "Trang phục demo đang cho khách thuê.",
          createdBy: demoStaffId("SC-LETAN"),
        },
        {
          id: "rental-demo-returned",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          wardrobeItemId: "wardrobe-demo-03",
          orderId: "order-demo-01",
          customerId: "customer-demo-01",
          checkedOutAt: new Date("2026-09-28T10:00:00+07:00"),
          dueAt: new Date("2026-10-05T18:00:00+07:00"),
          returnedAt: new Date("2026-10-04T16:00:00+07:00"),
          conditionOut: "good",
          conditionIn: "cleaning",
          cleaningFee: 200_000,
          damageFee: 0,
          deposit: 1_000_000,
          status: "returned",
          notes: "Đã trả, cần giặt.",
          createdBy: demoStaffId("SC-LETAN"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(equipment)
      .values([
        {
          id: "equipment-demo-camera",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Sony A7 IV",
          category: "camera",
          serialNumber: "CAM-DEMO-001",
          status: "available",
          notes: "Máy chính của studio.",
        },
        {
          id: "equipment-demo-lens",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Lens 24-70mm f/2.8",
          category: "lens",
          serialNumber: "LENS-DEMO-001",
          status: "available",
        },
        {
          id: "equipment-demo-light",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Đèn Godox AD600",
          category: "light",
          serialNumber: "LIGHT-DEMO-001",
          status: "in_use",
        },
        {
          id: "equipment-demo-reflector",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey["thu-duc"],
          name: "Reflector 5 in 1",
          category: "accessory",
          serialNumber: "ACC-DEMO-001",
          status: "available",
        },
        {
          id: "equipment-demo-tripod",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey["thu-duc"],
          name: "Tripod Manfrotto",
          category: "accessory",
          serialNumber: "ACC-DEMO-002",
          status: "maintenance",
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(equipmentUsages)
      .values([
        {
          id: "equipment-usage-demo-01",
          tenantId: DEMO_TENANT.id,
          equipmentId: "equipment-demo-camera",
          orderId: "order-demo-01",
          appointmentId: "appointment-demo-01",
          staffId: demoStaffId("SC-PHOTO"),
          checkedOutAt: new Date("2026-10-01T08:30:00+07:00"),
          returnedAt: new Date("2026-10-01T13:30:00+07:00"),
          conditionOut: "good",
          conditionIn: "good",
          notes: "Sử dụng cho buổi chụp cưới.",
          createdBy: demoStaffId("SC-OWNER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    const demoShareToken = createShareTokenRecord(DEMO_ALBUM.token);

    tx.insert(albums)
      .values({
        id: DEMO_ALBUM.id,
        tenantId: DEMO_TENANT.id,
        branchId: branchIdByKey.q1,
        orderId: "order-demo-02",
        customerId: "customer-demo-02",
        title: DEMO_ALBUM.title,
        sourceType: "drive",
        sourceUrl: DEMO_ALBUM.sourceUrl,
        driveFolderId: DEMO_ALBUM.driveFolderId,
        recursiveScan: true,
        selectionLimit: DEMO_ALBUM.selectionLimit,
        extraPhotoEnabled: true,
        extraPhotoPrice: DEMO_ALBUM.extraPhotoPrice,
        allowFavorites: true,
        allowNotes: true,
        selectionStatus: "draft",
        token: demoShareToken.tokenHash,
        tokenEncrypted: demoShareToken.tokenEncrypted,
        downloadLimit: 30,
        allowDownloads: true,
        status: "ready",
        notes:
          "Album demo với ảnh synthetic. Đây là môi trường demo, không chứa ảnh hay PII thật.",
        createdBy: demoStaffId("SC-MANAGER"),
      })
      .onConflictDoNothing()
      .run();

    tx.insert(albumSources)
      .values({
        id: "album-source-demo-local",
        tenantId: DEMO_TENANT.id,
        albumId: DEMO_ALBUM.id,
        provider: "local_drive",
        sourceUrl: DEMO_ALBUM.sourceUrl,
        externalFolderId: DEMO_ALBUM.driveFolderId,
        displayName: "Drive demo (adapter local)",
        recursive: true,
        status: "synced",
        lastSyncedAt: new Date("2026-11-03T02:05:00Z"),
      })
      .onConflictDoNothing()
      .run();

    tx.insert(albumFolders)
      .values(
        DEMO_ALBUM.folders.map((folder, index) => ({
          id: `folder-demo-${folder.key}`,
          tenantId: DEMO_TENANT.id,
          albumId: DEMO_ALBUM.id,
          sourceId: "album-source-demo-local",
          externalId: folder.externalId,
          name: folder.name,
          relativePath: folder.key,
          photoCount: DEMO_ALBUM.photos.filter(
            (photo) => photo.folder === folder.key,
          ).length,
          sortOrder: index,
        })),
      )
      .onConflictDoNothing()
      .run();

    tx.insert(photos)
      .values(
        DEMO_ALBUM.photos.map((photo, index) => {
          const folder = DEMO_ALBUM.folders.find(
            (item) => item.key === photo.folder,
          );
          return {
            id: `photo-demo-${photo.code.toLowerCase()}`,
            tenantId: DEMO_TENANT.id,
            albumId: DEMO_ALBUM.id,
            folderId: folder ? `folder-demo-${folder.key}` : null,
            code: photo.code,
            filename: photo.filename,
            relativePath: `${photo.folder}/${photo.filename}`,
            storageKey: demoPhotoStorageKey(photo.folder, photo.filename),
            thumbnailKey: demoPhotoThumbnailKey(photo.folder, photo.filename),
            previewKey: demoPhotoPreviewKey(photo.folder, photo.filename),
            sourceFileId: folder
              ? `${folder.externalId}:${photo.filename}`
              : photo.filename,
            width: 1200,
            height: 800,
            size: 0,
            isRaw: photo.isRaw,
            checksum: `seed-checksum-${photo.code}`,
            watermarked: true,
            status: "ready",
            sortOrder: index,
          };
        }),
      )
      .onConflictDoNothing()
      .run();

    const orderMeta: Record<
      string,
      { branchId: string; customerId: string }
    > = {
      "order-demo-01": { branchId: branchIdByKey.q1, customerId: "customer-demo-01" },
      "order-demo-02": { branchId: branchIdByKey.q1, customerId: "customer-demo-02" },
      "order-demo-03": {
        branchId: branchIdByKey["thu-duc"],
        customerId: "customer-demo-03",
      },
      "order-demo-06": { branchId: branchIdByKey.q1, customerId: "customer-demo-06" },
    };

    tx.insert(transactions)
      .values([
        {
          id: "transaction-demo-payment-01-deposit",
          tenantId: DEMO_TENANT.id,
          branchId: orderMeta["order-demo-01"]?.branchId ?? branchIdByKey.q1,
          type: "income",
          category: "order_payment",
          amount: 5_000_000,
          orderId: "order-demo-01",
          customerId: "customer-demo-01",
          method: "bank_transfer",
          description: "Thu cọc đơn DH-20261101-0001",
          reference: "DEMO-CK-0001",
          idempotencyKey: "seed-payment-demo-01-deposit",
          occurredAt: new Date("2026-09-25T11:00:00+07:00"),
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "transaction-demo-payment-01-final",
          tenantId: DEMO_TENANT.id,
          branchId: orderMeta["order-demo-01"]?.branchId ?? branchIdByKey.q1,
          type: "income",
          category: "order_payment",
          amount: 8_500_000,
          orderId: "order-demo-01",
          customerId: "customer-demo-01",
          method: "cash",
          description: "Thu dứt điểm đơn DH-20261101-0001",
          reference: "DEMO-TM-0001",
          idempotencyKey: "seed-payment-demo-01-final",
          occurredAt: new Date("2026-10-30T16:00:00+07:00"),
          createdBy: demoStaffId("SC-KETOAN"),
        },
        {
          id: "transaction-demo-payment-02",
          tenantId: DEMO_TENANT.id,
          branchId: orderMeta["order-demo-02"]?.branchId ?? branchIdByKey.q1,
          type: "income",
          category: "order_payment",
          amount: 2_000_000,
          orderId: "order-demo-02",
          customerId: "customer-demo-02",
          method: "cash",
          description: "Thu cọc đơn DH-20261102-0002",
          reference: "DEMO-TM-0002",
          idempotencyKey: "seed-payment-demo-02-deposit",
          occurredAt: new Date("2026-10-02T10:00:00+07:00"),
          createdBy: demoStaffId("SC-MANAGER"),
        },
        {
          id: "transaction-demo-payment-03",
          tenantId: DEMO_TENANT.id,
          branchId: orderMeta["order-demo-03"]?.branchId ?? branchIdByKey["thu-duc"],
          type: "income",
          category: "order_payment",
          amount: 3_000_000,
          orderId: "order-demo-03",
          customerId: "customer-demo-03",
          method: "bank_transfer",
          description: "Thu cọc đơn DH-20261103-0003",
          reference: "DEMO-CK-0003",
          idempotencyKey: "seed-payment-demo-03-deposit",
          occurredAt: new Date("2026-10-05T09:30:00+07:00"),
          createdBy: demoStaffId("SC-LETAN"),
        },
        {
          id: "transaction-demo-payment-06",
          tenantId: DEMO_TENANT.id,
          branchId: orderMeta["order-demo-06"]?.branchId ?? branchIdByKey.q1,
          type: "income",
          category: "order_payment",
          amount: 4_000_000,
          orderId: "order-demo-06",
          customerId: "customer-demo-06",
          method: "bank_transfer",
          description: "Thu cọc đơn DH-20261106-0006",
          reference: "DEMO-CK-0006",
          idempotencyKey: "seed-payment-demo-06-deposit",
          occurredAt: new Date("2026-10-08T14:00:00+07:00"),
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "transaction-demo-expense-rent",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          type: "expense",
          category: "rent",
          amount: 12_000_000,
          method: "bank_transfer",
          description: "Tiền thuê studio tháng 10/2026",
          idempotencyKey: "seed-expense-demo-rent",
          occurredAt: new Date("2026-10-01T09:00:00+07:00"),
          createdBy: demoStaffId("SC-KETOAN"),
        },
        {
          id: "transaction-demo-expense-marketing",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          type: "expense",
          category: "marketing",
          amount: 2_000_000,
          method: "card",
          description: "Chi phí quảng cáo Facebook tháng 10",
          idempotencyKey: "seed-expense-demo-marketing",
          occurredAt: new Date("2026-10-12T15:00:00+07:00"),
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "transaction-demo-expense-equipment",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          type: "expense",
          category: "equipment",
          amount: 1_500_000,
          method: "cash",
          description: "Bảo trì thiết bị và đèn studio",
          idempotencyKey: "seed-expense-demo-equipment",
          occurredAt: new Date("2026-10-18T11:00:00+07:00"),
          createdBy: demoStaffId("SC-KETOAN"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(expenses)
      .values([
        {
          id: "expense-demo-rent",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          category: "rent",
          amount: 12_000_000,
          vendor: "Chủ nhà studio Nguyễn Huệ",
          description: "Tiền thuê studio tháng 10/2026",
          occurredAt: new Date("2026-10-01T09:00:00+07:00"),
          transactionId: "transaction-demo-expense-rent",
          createdBy: demoStaffId("SC-KETOAN"),
        },
        {
          id: "expense-demo-marketing",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          category: "marketing",
          amount: 2_000_000,
          vendor: "Meta Ads (demo)",
          description: "Chi phí quảng cáo Facebook tháng 10",
          occurredAt: new Date("2026-10-12T15:00:00+07:00"),
          transactionId: "transaction-demo-expense-marketing",
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "expense-demo-equipment",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          category: "equipment",
          amount: 1_500_000,
          vendor: "Trung tâm bảo trì demo",
          description: "Bảo trì thiết bị và đèn studio",
          occurredAt: new Date("2026-10-18T11:00:00+07:00"),
          transactionId: "transaction-demo-expense-equipment",
          createdBy: demoStaffId("SC-KETOAN"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(budgets)
      .values([
        {
          id: "budget-demo-marketing-2026-11",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          category: "marketing",
          period: "2026-11",
          amount: 10_000_000,
          notes: "Ngân sách quảng cáo tháng 11.",
        },
        {
          id: "budget-demo-rent-2026-11",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          category: "rent",
          period: "2026-11",
          amount: 12_000_000,
          notes: "Ngân sách thuê studio tháng 11.",
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(invoices)
      .values([
        {
          id: "invoice-demo-01",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          orderId: "order-demo-01",
          customerId: "customer-demo-01",
          invoiceNo: "HD-202610-0001",
          taxCode: "0000000000",
          subtotal: 12_500_000,
          vatRate: 8,
          vatAmount: 1_000_000,
          total: 13_500_000,
          status: "issued",
          issuedAt: new Date("2026-10-30T16:30:00+07:00"),
          createdBy: demoStaffId("SC-KETOAN"),
        },
        {
          id: "invoice-demo-02",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          orderId: "order-demo-02",
          customerId: "customer-demo-02",
          invoiceNo: "HD-202610-0002",
          taxCode: "0000000000",
          subtotal: 4_351_852,
          vatRate: 8,
          vatAmount: 348_148,
          total: 4_700_000,
          status: "issued",
          issuedAt: new Date("2026-10-31T10:00:00+07:00"),
          createdBy: demoStaffId("SC-KETOAN"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(commissionRules)
      .values([
        {
          id: "commission-rule-demo-photo",
          tenantId: DEMO_TENANT.id,
          name: "Photographer 5% giá trị đơn",
          role: "photographer",
          type: "percent",
          value: 5,
          effectiveFrom: new Date("2026-01-01T00:00:00+07:00"),
          active: true,
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "commission-rule-demo-makeup",
          tenantId: DEMO_TENANT.id,
          name: "Makeup 200.000đ/buổi",
          role: "makeup",
          type: "fixed",
          value: 200_000,
          effectiveFrom: new Date("2026-01-01T00:00:00+07:00"),
          active: true,
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "commission-rule-demo-retouch",
          tenantId: DEMO_TENANT.id,
          name: "Retoucher 3% giá trị đơn",
          role: "retoucher",
          type: "percent",
          value: 3,
          effectiveFrom: new Date("2026-01-01T00:00:00+07:00"),
          active: true,
          createdBy: demoStaffId("SC-OWNER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(commissions)
      .values([
        {
          id: "commission-demo-photo-01",
          tenantId: DEMO_TENANT.id,
          orderId: "order-demo-01",
          staffId: demoStaffId("SC-PHOTO"),
          ruleId: "commission-rule-demo-photo",
          role: "photographer",
          ruleType: "percent",
          ruleValue: 5,
          baseAmount: 13_500_000,
          amount: 675_000,
          status: "approved",
          approvedBy: demoStaffId("SC-OWNER"),
          approvedAt: new Date("2026-10-31T09:00:00+07:00"),
          payrollId: "payroll-demo-photo-2026-10",
          note: "Hoa hồng order-demo-01.",
        },
        {
          id: "commission-demo-makeup-01",
          tenantId: DEMO_TENANT.id,
          orderId: "order-demo-01",
          staffId: demoStaffId("SC-MAKEUP"),
          ruleId: "commission-rule-demo-makeup",
          role: "makeup",
          ruleType: "fixed",
          ruleValue: 200_000,
          baseAmount: 13_500_000,
          amount: 200_000,
          status: "approved",
          approvedBy: demoStaffId("SC-OWNER"),
          approvedAt: new Date("2026-10-31T09:05:00+07:00"),
          note: "Hoa hồng order-demo-01.",
        },
        {
          id: "commission-demo-retouch-01",
          tenantId: DEMO_TENANT.id,
          orderId: "order-demo-01",
          staffId: demoStaffId("SC-RETOUCH"),
          ruleId: "commission-rule-demo-retouch",
          role: "retoucher",
          ruleType: "percent",
          ruleValue: 3,
          baseAmount: 13_500_000,
          amount: 405_000,
          status: "pending",
          note: "Hoa hồng order-demo-01.",
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(payrolls)
      .values({
        id: "payroll-demo-photo-2026-10",
        tenantId: DEMO_TENANT.id,
        period: "2026-10",
        staffId: demoStaffId("SC-PHOTO"),
        baseSalary: 12_000_000,
        workDays: 22,
        commissionAmount: 675_000,
        bonus: 0,
        deduction: 0,
        net: 12_675_000,
        status: "draft",
        createdBy: demoStaffId("SC-OWNER"),
      })
      .onConflictDoNothing()
      .run();

    tx.insert(attendance)
      .values([
        {
          id: "attendance-demo-owner-1101",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          staffId: demoStaffId("SC-OWNER"),
          checkInAt: new Date("2026-11-01T08:00:00+07:00"),
          checkOutAt: new Date("2026-11-01T17:30:00+07:00"),
          method: "manual",
          notes: "Chấm công demo.",
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "attendance-demo-owner-1102",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          staffId: demoStaffId("SC-OWNER"),
          checkInAt: new Date("2026-11-02T08:05:00+07:00"),
          checkOutAt: new Date("2026-11-02T17:35:00+07:00"),
          method: "gps",
          latitude: "10.7769",
          longitude: "106.7009",
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "attendance-demo-owner-1103",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          staffId: demoStaffId("SC-OWNER"),
          checkInAt: new Date("2026-11-03T08:00:00+07:00"),
          checkOutAt: new Date("2026-11-03T17:30:00+07:00"),
          method: "qr",
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "attendance-demo-photo-1101",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          staffId: demoStaffId("SC-PHOTO"),
          checkInAt: new Date("2026-11-01T08:00:00+07:00"),
          checkOutAt: new Date("2026-11-01T18:00:00+07:00"),
          method: "manual",
          createdBy: demoStaffId("SC-MANAGER"),
        },
        {
          id: "attendance-demo-photo-1102",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          staffId: demoStaffId("SC-PHOTO"),
          checkInAt: new Date("2026-11-02T08:10:00+07:00"),
          checkOutAt: new Date("2026-11-02T18:05:00+07:00"),
          method: "manual",
          createdBy: demoStaffId("SC-MANAGER"),
        },
        {
          id: "attendance-demo-photo-1103",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          staffId: demoStaffId("SC-PHOTO"),
          checkInAt: new Date("2026-11-03T08:00:00+07:00"),
          checkOutAt: new Date("2026-11-03T18:00:00+07:00"),
          method: "manual",
          createdBy: demoStaffId("SC-MANAGER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(tasks)
      .values([
        {
          id: "task-demo-01",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          title: "Gọi tư vấn gói cưới cho khách Trang",
          description: "Xác nhận ngày cưới, ngân sách và gói chụp mong muốn.",
          assigneeId: demoStaffId("SC-LETAN"),
          orderId: "order-demo-01",
          customerId: "customer-demo-01",
          priority: "high",
          status: "todo",
          dueAt: new Date("2026-11-04T09:00:00+07:00"),
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "task-demo-02",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          title: "Chuẩn bị ảnh album cưới demo",
          description: "Kiểm tra watermark và selection trước khi gửi khách.",
          assigneeId: demoStaffId("SC-RETOUCH"),
          customerId: "customer-demo-02",
          albumId: DEMO_ALBUM.id,
          priority: "medium",
          status: "doing",
          dueAt: new Date("2026-11-06T17:00:00+07:00"),
          createdBy: demoStaffId("SC-MANAGER"),
        },
        {
          id: "task-demo-03",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          title: "Duyệt chi phí marketing tháng 10",
          description: "Đối soát hóa đơn quảng cáo và sổ quỹ.",
          assigneeId: demoStaffId("SC-KETOAN"),
          priority: "high",
          status: "review",
          dueAt: new Date("2026-11-05T11:00:00+07:00"),
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "task-demo-04",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          title: "Gửi yêu cầu đánh giá sau bàn giao",
          description: "Gửi lời cảm ơn và form đánh giá cho khách demo.",
          assigneeId: demoStaffId("SC-MANAGER"),
          customerId: "customer-demo-01",
          priority: "low",
          status: "done",
          dueAt: new Date("2026-11-02T16:00:00+07:00"),
          completedAt: new Date("2026-11-02T15:30:00+07:00"),
          createdBy: demoStaffId("SC-OWNER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(taskComments)
      .values([
        {
          id: "task-comment-demo-01",
          tenantId: DEMO_TENANT.id,
          taskId: "task-demo-01",
          authorId: demoStaffId("SC-MANAGER"),
          content: "Ưu tiên gọi trước 10h, khách đang cân nhắc thêm gói baby.",
        },
        {
          id: "task-comment-demo-02",
          tenantId: DEMO_TENANT.id,
          taskId: "task-demo-02",
          authorId: demoStaffId("SC-OWNER"),
          content: "@SC-RETOUCH kiểm tra kỹ watermark và missing trước khi gửi.",
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(documents)
      .values([
        {
          id: "document-demo-01",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Album PhotoShare demo",
          category: "album",
          url: "/share/demo-share-album-01",
          visibility: "internal",
          version: 1,
          notes: "Liên kết album synthetic dùng cho đào tạo nội bộ.",
          uploadedBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "document-demo-02",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Drive demo folder",
          category: "drive",
          url: `https://drive.google.com/drive/folders/${DEMO_ALBUM.driveFolderId}`,
          visibility: "internal",
          version: 1,
          notes: "Folder Drive local demo, không phải dữ liệu thật.",
          uploadedBy: demoStaffId("SC-MANAGER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(campaigns)
      .values([
        {
          id: "campaign-demo-facebook",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "Facebook cưới tháng 10",
          source: "facebook",
          budget: 8_000_000,
          spend: 5_500_000,
          leads: 42,
          ordersCount: 6,
          revenue: 46_500_000,
          startAt: new Date("2026-10-01T00:00:00+07:00"),
          endAt: new Date("2026-10-31T23:59:59+07:00"),
          status: "active",
          notes: "Số liệu demo, chưa kết nối Meta Ads.",
          createdBy: demoStaffId("SC-OWNER"),
        },
        {
          id: "campaign-demo-tiktok",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          name: "TikTok baby tháng 10",
          source: "tiktok",
          budget: 5_000_000,
          spend: 3_200_000,
          leads: 25,
          ordersCount: 3,
          revenue: 11_400_000,
          startAt: new Date("2026-10-05T00:00:00+07:00"),
          endAt: new Date("2026-10-31T23:59:59+07:00"),
          status: "active",
          notes: "Số liệu demo, chưa kết nối TikTok Ads.",
          createdBy: demoStaffId("SC-MANAGER"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(conversations)
      .values([
        {
          id: "conversation-demo-01",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          customerId: "customer-demo-01",
          channel: "facebook",
          subject: "Hỏi bảng giá gói cưới",
          assignedTo: demoStaffId("SC-LETAN"),
          status: "unanswered",
          aiAutoReply: true,
          lastMessageAt: new Date("2026-11-03T08:15:00+07:00"),
        },
        {
          id: "conversation-demo-02",
          tenantId: DEMO_TENANT.id,
          branchId: branchIdByKey.q1,
          customerId: "customer-demo-03",
          channel: "zalo",
          subject: "Đổi lịch chụp baby",
          assignedTo: demoStaffId("SC-MANAGER"),
          status: "processing",
          aiAutoReply: false,
          lastMessageAt: new Date("2026-11-02T16:40:00+07:00"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(messages)
      .values([
        {
          id: "message-demo-01",
          tenantId: DEMO_TENANT.id,
          conversationId: "conversation-demo-01",
          direction: "inbound",
          senderName: "Khách demo",
          content: "Cho mình xin bảng giá gói cưới tháng 12 với ạ.",
          sentAt: new Date("2026-11-03T08:10:00+07:00"),
        },
        {
          id: "message-demo-02",
          tenantId: DEMO_TENANT.id,
          conversationId: "conversation-demo-01",
          direction: "outbound",
          senderName: "Studio (local)",
          content: "Studio đã nhận tin. Tư vấn viên sẽ gửi bảng giá chi tiết trong ít phút.",
          sentAt: new Date("2026-11-03T08:15:00+07:00"),
        },
        {
          id: "message-demo-03",
          tenantId: DEMO_TENANT.id,
          conversationId: "conversation-demo-02",
          direction: "inbound",
          senderName: "Khách demo",
          content: "Mình muốn đổi lịch chụp baby sang cuối tuần sau.",
          sentAt: new Date("2026-11-02T16:35:00+07:00"),
        },
        {
          id: "message-demo-04",
          tenantId: DEMO_TENANT.id,
          conversationId: "conversation-demo-02",
          direction: "outbound",
          senderName: "Studio (local)",
          content: "Mình đã ghi nhận, sẽ kiểm tra slot trống và phản hồi bạn.",
          sentAt: new Date("2026-11-02T16:40:00+07:00"),
        },
      ])
      .onConflictDoNothing()
      .run();

    tx.insert(activityLogs)
      .values([
        {
          id: "activity-seed-demo",
          tenantId: DEMO_TENANT.id,
          actorId: null,
          action: "system.seed",
          entity: "tenant",
          entityId: DEMO_TENANT.id,
          metadata: JSON.stringify({ source: "seed", version: 1 }),
          createdAt: new Date("2026-11-03T02:00:00Z"),
        },
        {
          id: "activity-seed-secondary",
          tenantId: DEMO_SECONDARY_TENANT.id,
          actorId: null,
          action: "system.seed",
          entity: "tenant",
          entityId: DEMO_SECONDARY_TENANT.id,
          metadata: JSON.stringify({ source: "seed", version: 1 }),
          createdAt: new Date("2026-11-03T02:01:00Z"),
        },
      ])
      .onConflictDoNothing()
      .run();
  });

  return summary;
}
