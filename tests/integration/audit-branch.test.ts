import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, ne } from "drizzle-orm";
import { resolveAuditBranchId, writeAudit } from "@/lib/audit";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { activityLogs, customers } from "@/lib/db/schema";
import { listActivityLogs, listAuditActions } from "@/lib/services/audit-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let branchA: string;
let branchB: string;

const filters = { page: 1, pageSize: 500 };

function actions(actor: ActorContext): string[] {
  return listActivityLogs(db, actor, filters).items.map((item) => item.action);
}

beforeAll(async () => {
  db = createTestDb();
  const login = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "10.9.0.1", userAgent: "vitest-audit-branch" },
  );
  if (!login.ok) throw new Error(login.error);
  const actor = await getActorFromToken(db, login.token);
  if (!actor) throw new Error("Không dựng được actor");
  owner = actor;
  [branchA, branchB] = owner.branches.map((branch) => branch.id) as [string, string];
  expect(branchB).toBeTruthy();
});

describe("nhật ký hoạt động theo chi nhánh", () => {
  it("ghi chi nhánh của bản ghi liên quan, hoặc null khi không có", () => {
    const customer = db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, owner.tenantId), eq(customers.branchId, branchB)))
      .get();
    if (!customer) throw new Error("Thiếu khách hàng ở chi nhánh B");
    expect(resolveAuditBranchId(db, "customer", customer.id)).toBe(branchB);
    expect(resolveAuditBranchId(db, "branch", branchA)).toBe(branchA);
    expect(resolveAuditBranchId(db, "staff", owner.staffId)).toBeNull();
    expect(resolveAuditBranchId(db, "customer", "khong-ton-tai")).toBeNull();

    const base = { tenantId: owner.tenantId, actorId: owner.staffId };
    writeAudit(db, { ...base, action: "test.branch_b", entity: "customer", entityId: customer.id });
    writeAudit(db, { ...base, action: "test.branch_a", entity: "branch", entityId: branchA });
    writeAudit(db, { ...base, action: "test.tenant_wide", entity: "settings" });
    writeAudit(db, {
      ...base,
      action: "test.explicit",
      entity: "customer",
      entityId: customer.id,
      branchId: branchA,
    });
    const rows = db.select().from(activityLogs).where(eq(activityLogs.entity, "customer")).all();
    expect(rows.find((row) => row.action === "test.branch_b")?.branchId).toBe(branchB);
    expect(rows.find((row) => row.action === "test.explicit")?.branchId).toBe(branchA);
  });

  it("chủ studio xem tất cả chi nhánh thấy mọi dòng", () => {
    const all = actions({ ...owner, activeBranchId: null });
    expect(all).toEqual(
      expect.arrayContaining(["test.branch_a", "test.branch_b", "test.tenant_wide"]),
    );
  });

  it("đang chọn một chi nhánh thì không thấy dòng của chi nhánh khác", () => {
    const scoped = { ...owner, activeBranchId: branchA };
    const seen = actions(scoped);
    expect(seen).toEqual(expect.arrayContaining(["test.branch_a", "test.explicit", "test.tenant_wide"]));
    expect(seen).not.toContain("test.branch_b");
    expect(listAuditActions(db, scoped)).not.toContain("test.branch_b");
  });

  it("nhân sự không phải chủ chỉ thấy dòng không chi nhánh của chính mình", () => {
    const other = db
      .select({ actorId: activityLogs.actorId })
      .from(activityLogs)
      .where(and(eq(activityLogs.tenantId, owner.tenantId), ne(activityLogs.actorId, owner.staffId)))
      .get();
    const manager = {
      ...owner,
      role: "manager",
      staffId: other?.actorId ?? "nhan-su-khac",
      activeBranchId: branchA,
    } as ActorContext;
    const seen = actions(manager);
    expect(seen).toContain("test.branch_a");
    expect(seen).not.toContain("test.tenant_wide");
    expect(seen).not.toContain("test.branch_b");
  });
});
