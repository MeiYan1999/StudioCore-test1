import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/auth/roles";
import {
  assertBranchAccess,
  getBranchScope,
  hasPermission,
} from "@/lib/auth/permissions";
import type { ActorContext } from "@/lib/auth/types";

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    sessionId: "session-1",
    staffId: "staff-1",
    tenantId: "tenant-1",
    tenantName: "Studio Test",
    tenantSlug: "studio-test",
    tenantPlan: "pro",
    staffName: "Người test",
    staffCode: "TEST-1",
    staffEmail: "test@example.demo",
    role: "owner",
    permissions: [...DEFAULT_ROLE_PERMISSIONS.owner],
    branches: [
      { id: "branch-1", name: "Chi nhánh 1" },
      { id: "branch-2", name: "Chi nhánh 2" },
    ],
    activeBranchId: null,
    readOnly: false,
    ...overrides,
  };
}

describe("RBAC", () => {
  it("owner có quyền quản trị nhưng không có quyền tenant nền tảng", () => {
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.owner, "settings.manage")).toBe(true);
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.owner, "customers.manage")).toBe(true);
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.owner, "tenants.manage")).toBe(false);
  });

  it("platform admin chỉ có quyền tenant nền tảng", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.platform_admin).toEqual(["tenants.manage"]);
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.platform_admin, "dashboard.view")).toBe(false);
  });

  it("kế toán có quyền tài chính nhưng không quản lý người dùng", () => {
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.accountant, "finance.manage")).toBe(true);
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.accountant, "payroll.manage")).toBe(true);
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.accountant, "settings.manage")).toBe(false);
  });

  it("lễ tân không có quyền tài chính", () => {
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.receptionist, "finance.view")).toBe(false);
    expect(hasPermission(DEFAULT_ROLE_PERMISSIONS.receptionist, "customers.manage")).toBe(true);
  });
});

describe("phạm vi chi nhánh", () => {
  it("owner không chọn chi nhánh nghĩa là toàn bộ", () => {
    expect(getBranchScope(actor())).toEqual({ mode: "all" });
  });

  it("owner chọn một chi nhánh thì scope theo chi nhánh", () => {
    expect(getBranchScope(actor({ activeBranchId: "branch-1" }))).toEqual({
      mode: "branch",
      branchId: "branch-1",
    });
  });

  it("manager chỉ có một chi nhánh được giao", () => {
    const manager = actor({
      role: "manager",
      permissions: [...DEFAULT_ROLE_PERMISSIONS.manager],
      branches: [{ id: "branch-1", name: "Chi nhánh 1" }],
      activeBranchId: null,
    });

    expect(getBranchScope(manager)).toEqual({
      mode: "branch",
      branchId: "branch-1",
    });
    expect(() => assertBranchAccess(manager, "branch-2")).toThrow();
  });

  it("không có chi nhánh thì scope none", () => {
    const noBranch = actor({
      role: "manager",
      permissions: [...DEFAULT_ROLE_PERMISSIONS.manager],
      branches: [],
      activeBranchId: null,
    });
    expect(getBranchScope(noBranch)).toEqual({ mode: "none" });
  });
});
