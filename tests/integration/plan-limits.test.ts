import { beforeAll, describe, expect, it } from "vitest";
import { and, count, eq, isNull } from "drizzle-orm";
import { hasPermission } from "@/lib/auth/permissions";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { branches, staff, tenants } from "@/lib/db/schema";
import { getPlanLimits, isPlanLapsed } from "@/lib/services/plan-limits";
import { saveBranch } from "@/lib/services/settings-write-service";
import { createStaff } from "@/lib/services/staff-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let token: string;
let owner: ActorContext;

const DAY = 24 * 60 * 60 * 1000;

function setTenant(values: { plan?: string; planExpiresAt?: Date | null }): void {
  db.update(tenants).set(values).where(eq(tenants.id, owner.tenantId)).run();
}

function newStaff(code: string) {
  return createStaff(db, owner, {
    name: `Nhân sự ${code}`,
    code,
    email: "",
    phone: "",
    role: "receptionist",
    pin: "482913",
    password: null,
    branchIds: [owner.branches[0].id],
    active: true,
  });
}

function newBranch(name: string) {
  return saveBranch(db, owner, {
    name,
    address: "1 Đường Thử",
    phone: "0900000000",
    status: "active",
  });
}

beforeAll(async () => {
  db = createTestDb();
  const login = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "10.9.0.1", userAgent: "vitest-plan" },
  );
  if (!login.ok) throw new Error(login.error);
  token = login.token;
  const actor = await getActorFromToken(db, token);
  if (!actor) throw new Error("Không dựng được actor");
  owner = actor;
});

describe("hạn mức gói", () => {
  it("định nghĩa hạn mức theo gói", () => {
    expect(getPlanLimits("basic")).toEqual({ branches: 1, staff: 10 });
    expect(getPlanLimits("pro")).toEqual({ branches: 3, staff: 30 });
    expect(getPlanLimits("trial")).toEqual({ branches: 3, staff: 30 });
    expect(getPlanLimits("enterprise")).toEqual({ branches: null, staff: null });
  });

  it("chặn tạo mới khi vượt hạn mức, giữ nguyên dữ liệu đang vượt", () => {
    setTenant({ plan: "basic" });
    const branchCount = () =>
      db.select({ value: count() }).from(branches).where(eq(branches.tenantId, owner.tenantId)).get()!.value;
    const before = branchCount();
    expect(before).toBeGreaterThan(1);
    expect(() => newBranch("Chi nhánh vượt hạn")).toThrow(/tối đa 1 chi nhánh/);
    expect(branchCount()).toBe(before);

    const existing = db.select().from(branches).where(eq(branches.tenantId, owner.tenantId)).get()!;
    expect(() =>
      saveBranch(db, owner, {
        id: existing.id,
        name: existing.name,
        address: existing.address,
        phone: existing.phone,
        status: existing.status,
      }),
    ).not.toThrow();

    setTenant({ plan: "enterprise" });
    expect(() => newBranch("Chi nhánh doanh nghiệp")).not.toThrow();
  });

  it("chặn thêm nhân sự khi đủ hạn mức", () => {
    setTenant({ plan: "basic" });
    const staffCount = () =>
      db
        .select({ value: count() })
        .from(staff)
        .where(and(eq(staff.tenantId, owner.tenantId), isNull(staff.archivedAt)))
        .get()!.value;
    let index = 0;
    while (staffCount() < 10) {
      newStaff(`PLAN-${index}`);
      index += 1;
    }
    expect(() => newStaff("PLAN-OVER")).toThrow(/tối đa 10 nhân sự/);
    setTenant({ plan: "pro" });
    expect(() => newStaff("PLAN-PRO")).not.toThrow();
  });
});

describe("gói hết hạn", () => {
  it("ân hạn 7 ngày", () => {
    const now = new Date("2026-06-30T00:00:00Z");
    expect(isPlanLapsed(null, now)).toBe(false);
    expect(isPlanLapsed(new Date(now.getTime() - 6 * DAY), now)).toBe(false);
    expect(isPlanLapsed(new Date(now.getTime() - 8 * DAY), now)).toBe(true);
  });

  it("trong ân hạn vẫn đủ quyền; quá ân hạn chỉ còn quyền xem nhưng vẫn gia hạn được", async () => {
    setTenant({ plan: "pro", planExpiresAt: new Date(Date.now() - 3 * DAY) });
    const grace = (await getActorFromToken(db, token))!;
    expect(grace.planLapsed).toBe(false);
    expect(hasPermission(grace.permissions, "orders.manage")).toBe(true);

    setTenant({ planExpiresAt: new Date(Date.now() - 8 * DAY) });
    const lapsed = (await getActorFromToken(db, token))!;
    expect(lapsed.planLapsed).toBe(true);
    expect(lapsed.permissions.length).toBeGreaterThan(0);
    expect(lapsed.permissions.every((permission) => permission.endsWith(".view"))).toBe(true);
    expect(hasPermission(lapsed.permissions, "customers.view")).toBe(true);
    expect(lapsed.canRenewPlan).toBe(true);
    expect(() => createStaff(db, lapsed, {} as never)).toThrow();

    setTenant({ planExpiresAt: new Date(Date.now() + 30 * DAY) });
    const renewed = (await getActorFromToken(db, token))!;
    expect(renewed.planLapsed).toBe(false);
    expect(hasPermission(renewed.permissions, "settings.manage")).toBe(true);
  });
});
