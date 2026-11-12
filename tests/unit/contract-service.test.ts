import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import { appointments, customers, orders, payments, tenants, branches, staff } from "@/lib/db/schema";
import {
  createContractWithAppointments,
  getNextContractCode,
} from "@/lib/services/contract-service";
import { createTestDb } from "../helpers/test-db";
import type { ActorContext } from "@/lib/auth/types";

let db: AppDb;
const TEST_TENANT = "tenant-contract-test";
const TEST_BRANCH = "branch-contract-test";
const TEST_STAFF = "staff-contract-test";

const testActor: ActorContext = {
  sessionId: "test-session", tenantSlug: "studio-test", tenantPlan: "pro", staffCode: "NV001", staffEmail: null, readOnly: false,
  staffId: TEST_STAFF,
  staffName: "Test Manager",
  tenantId: TEST_TENANT,
  tenantName: "Studio Test",
  activeBranchId: TEST_BRANCH,
  role: "manager",
  permissions: ["orders.manage", "orders.view", "schedule.manage"],
  branches: [{ id: TEST_BRANCH, name: "Chi nhánh chính" }],
};

beforeAll(() => {
  db = createTestDb();

  db.insert(tenants)
    .values({
      id: TEST_TENANT,
      name: "Studio Test",
      slug: "studio-test",
      status: "active",
      plan: "pro",
    })
    .run();

  db.insert(branches)
    .values({
      id: TEST_BRANCH,
      tenantId: TEST_TENANT,
      name: "Chi nhánh chính",
      address: "123 Đường Test",
      phone: "0900000001",
    })
    .run();

  db.insert(staff)
    .values({
      id: TEST_STAFF,
      tenantId: TEST_TENANT,
      code: "NV001",
      name: "Test Manager",
      email: "manager@test.com",
      role: "manager",
      active: true,
      passwordHash: "hash",
    })
    .run();
});

describe("Contract Service - Lên Hợp Đồng Studio & Kế Hoạch Chụp", () => {
  it("tự sinh mã hợp đồng bắt đầu bằng HD00001", () => {
    const code = getNextContractCode(db, TEST_TENANT);
    expect(code).toBe("HD00001");
  });

  it("khởi tạo hợp đồng mới thành công với đầy đủ thông tin, thanh toán cọc và tự lên lịch chụp", () => {
    const result = createContractWithAppointments(db, testActor, {
      code: "HD00001",
      signedAt: "2026-11-11",
      customerName: "Hoang Thang",
      customerPhone: "0912345678",
      branchId: TEST_BRANCH,
      serviceCategory: "Pre-wedding",
      packageName: "Gói Tiệc Cưới & Ngoại Cảnh",
      crewConfig: "1 Chụp",
      surcharge: 0,
      total: 5000000,
      deposit: 500000,
      depositMethod: "bank_transfer",
      notes: "Chụp ảnh cổng và album pre-wedding",
      sessions: [
        {
          date: "2026-11-11",
          startTime: "09:00",
          endTime: "12:00",
          location: "Phòng Studio A",
        },
      ],
    });

    expect(result.orderId).toBeDefined();
    expect(result.code).toBe("HD00001");
    expect(result.appointmentIds.length).toBe(1);

    // Verify Customer created
    const cust = db.select().from(customers).where(eq(customers.id, result.customerId)).get();
    expect(cust).toBeDefined();
    expect(cust?.name).toBe("Hoang Thang");
    expect(cust?.phone).toBe("0912345678");

    // Verify Order created
    const ord = db.select().from(orders).where(eq(orders.id, result.orderId)).get();
    expect(ord).toBeDefined();
    expect(ord?.code).toBe("HD00001");
    expect(ord?.total).toBe(5000000);
    expect(ord?.deposit).toBe(500000);
    expect(ord?.paid).toBe(500000);
    expect(ord?.remaining).toBe(4500000);
    expect(ord?.status).toBe("deposit_received");

    // Verify Payment created
    const pay = db.select().from(payments).where(eq(payments.orderId, result.orderId)).all();
    expect(pay.length).toBe(1);
    expect(pay[0].amount).toBe(500000);
    expect(pay[0].reference).toBe("COC-HD00001");

    // Verify Appointment created on Calendar
    const appts = db.select().from(appointments).where(eq(appointments.orderId, result.orderId)).all();
    expect(appts.length).toBe(1);
    expect(appts[0].notes).toContain("Hoang Thang");
    expect(appts[0].notes).toContain("Phòng Studio A");
  });

  it("mã hợp đồng tiếp theo tự động tăng lên HD00002", () => {
    const code = getNextContractCode(db, TEST_TENANT);
    expect(code).toBe("HD00002");
  });

  it("hỗ trợ hợp đồng nhiều buổi chụp (Buổi 1 + Buổi 2) tự động lên lịch đầy đủ", () => {
    const result = createContractWithAppointments(db, testActor, {
      code: "HD00002",
      signedAt: "2026-11-12",
      customerName: "Minh Anh",
      customerPhone: "0987654321",
      branchId: TEST_BRANCH,
      serviceCategory: "Tiệc cưới",
      packageName: "Gói Phóng Sự Cưới Trọn Gói",
      crewConfig: "2 Chụp + 1 Makeup",
      surcharge: 500000,
      surchargeNote: "Phát sinh ngoại thành",
      total: 7000000,
      deposit: 1000000,
      depositMethod: "cash",
      sessions: [
        {
          date: "2026-11-20",
          startTime: "07:00",
          endTime: "11:00",
          location: "Nhà gái & Lễ ăn hỏi",
        },
        {
          date: "2026-11-21",
          startTime: "16:00",
          endTime: "21:00",
          location: "Trung tâm tiệc cưới Rosa",
        },
      ],
    });

    expect(result.appointmentIds.length).toBe(2);

    const appts = db.select().from(appointments).where(eq(appointments.orderId, result.orderId)).all();
    expect(appts.length).toBe(2);
    expect(appts[0].notes).toContain("Buổi 1");
    expect(appts[1].notes).toContain("Buổi 2");
  });
});
