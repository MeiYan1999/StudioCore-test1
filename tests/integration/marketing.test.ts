import { beforeAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { createSession, getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import {
  branches,
  contactRequests,
  rolePermissions,
  settings,
  staff,
  tenants,
} from "@/lib/db/schema";
import {
  findTenantDemoOwner,
  registerTenant,
  slugifyStudioName,
} from "@/lib/services/onboarding-service";
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from "@/lib/services/password-reset-service";
import { createContactRequest } from "@/lib/services/contact-service";
import { createOrder } from "@/lib/services/order-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;

beforeAll(() => {
  db = createTestDb();
});

describe("onboarding và pháp lý", () => {
  it("slug tiếng Việt và đăng ký tenant trial thật", () => {
    expect(slugifyStudioName("Studio Ánh Dương")).toBe("studio-anh-duong");
    const result = registerTenant(db, {
      studioName: "Studio Kiểm Thử",
      ownerName: "Nguyễn Kiểm Thử",
      email: "qa-owner@studiocore.test",
      phone: "0900000099",
      password: "DemoTest@123",
      branchName: "Chi nhánh Kiểm Thử",
      branchAddress: "1 Đường Test, Quận 1",
      branchPhone: "0900000098",
    });
    const tenant = db.select().from(tenants).where(eq(tenants.id, result.tenantId)).get();
    expect(tenant?.plan).toBe("trial");
    expect(tenant?.slug).toBe("studio-kiem-thu");
    const branch = db.select().from(branches).where(eq(branches.id, result.branchId)).get();
    expect(branch?.name).toBe("Chi nhánh Kiểm Thử");
    const owner = db.select().from(staff).where(eq(staff.id, result.staffId)).get();
    expect(owner?.role).toBe("owner");
    const permissions =
      db
        .select({ value: count() })
        .from(rolePermissions)
        .where(eq(rolePermissions.tenantId, result.tenantId))
        .get()?.value ?? 0;
    expect(permissions).toBeGreaterThan(0);
    const studioSettings = db
      .select({ value: settings.value })
      .from(settings)
      .where(
        and(
          eq(settings.tenantId, result.tenantId),
          eq(settings.key, "studio.name"),
        ),
      )
      .get();
    expect(studioSettings?.value).toBe("Studio Kiểm Thử");

    const second = registerTenant(db, {
      studioName: "Studio Kiểm Thử",
      ownerName: "Nguyễn Kiểm Thử 2",
      email: "qa-owner2@studiocore.test",
      phone: "",
      password: "DemoTest@123",
      branchName: "",
      branchAddress: "",
      branchPhone: "",
    });
    expect(second.tenantSlug).toBe("studio-kiem-thu-2");
  });

  it("reset token thật, dùng một lần và thu hồi session cũ", async () => {
    const login = await authenticate(
      db,
      { mode: "password", identifier: "qa-owner@studiocore.test", secret: "DemoTest@123" },
      { ip: "192.0.2.150", userAgent: "vitest-reset" },
    );
    if (!login.ok) throw new Error(login.error);
    const oldActor = await getActorFromToken(db, login.token);
    expect(oldActor).not.toBeNull();
    const request = requestPasswordReset(db, "qa-owner@studiocore.test");
    expect(request.link).toBeTruthy();
    const url = new URL(request.link as string);
    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();
    resetPasswordWithToken(db, token as string, "NewDemo@123");
    expect(await getActorFromToken(db, login.token)).toBeNull();
    const oldLogin = await authenticate(
      db,
      { mode: "password", identifier: "qa-owner@studiocore.test", secret: "DemoTest@123" },
      { ip: "192.0.2.151", userAgent: "vitest-reset" },
    );
    expect(oldLogin.ok).toBe(false);
    const newLogin = await authenticate(
      db,
      { mode: "password", identifier: "qa-owner@studiocore.test", secret: "NewDemo@123" },
      { ip: "192.0.2.152", userAgent: "vitest-reset" },
    );
    expect(newLogin.ok).toBe(true);
    expect(() =>
      resetPasswordWithToken(db, token as string, "Another@123"),
    ).toThrow(/không hợp lệ|hết hạn/);
  });

  it("contact request validate, lưu DB và rate limit theo IP", () => {
    const id = createContactRequest(
      db,
      {
        name: "Khách Test",
        email: "contact@example.demo",
        phone: "0900000077",
        studioName: "Studio Test",
        message: "Tôi cần tư vấn quy trình vận hành studio.",
        source: "vitest",
      },
      "192.0.2.200",
    );
    const row = db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, id))
      .get();
    expect(row?.phone).toBe("0900000077");
    expect(row?.status).toBe("new");
    for (let index = 0; index < 4; index += 1) {
      createContactRequest(
        db,
        {
          name: `Khách ${index}`,
          email: `contact${index}@example.demo`,
          phone: "",
          studioName: "",
          message: "Nội dung yêu cầu tư vấn đủ dài cho kiểm thử.",
          source: "vitest",
        },
        "192.0.2.200",
      );
    }
    expect(() =>
      createContactRequest(
        db,
        {
          name: "Khách 6",
          email: "contact6@example.demo",
          phone: "",
          studioName: "",
          message: "Nội dung yêu cầu tư vấn đủ dài cho kiểm thử.",
          source: "vitest",
        },
        "192.0.2.200",
      ),
    ).toThrow(/quá nhiều/);
  });

  it("demo session read-only không có quyền mutation", async () => {
    const demoOwner = findTenantDemoOwner(db);
    expect(demoOwner).not.toBeNull();
    if (!demoOwner) return;
    const session = await createSession(db, {
      tenantId: demoOwner.tenantId,
      staffId: demoOwner.staffId,
      activeBranchId: null,
      ip: "192.0.2.210",
      userAgent: "vitest-demo",
      readOnly: true,
      ttlMinutes: 30,
    });
    const demo = await getActorFromToken(db, session.token);
    expect(demo?.readOnly).toBe(true);
    expect(demo?.permissions).not.toContain("orders.manage");
    expect(() =>
      createOrder(db, demo as ActorContext, {
        customerMode: "existing",
        customerId: "customer-demo-01",
        customerName: "",
        customerPhone: "",
        branchId: "branch-demo-q1",
        scheduledAt: "",
        location: "",
        photographerId: null,
        editorId: null,
        makeupId: null,
        items: [
          {
            itemType: "custom",
            refId: null,
            name: "Demo",
            quantity: 1,
            unitPrice: 1000,
          },
        ],
        surcharge: 0,
        discount: 0,
        voucherCode: "",
        deposit: 0,
        depositMethod: "cash",
        notes: "",
      }),
    ).toThrow(/quyền/);
  });
});
