import { beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import { hasPermission } from "@/lib/auth/permissions";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { createManualTransaction, listTransactions } from "@/lib/services/finance-service";
import { createAlbum, getAlbumDetail } from "@/lib/services/album-service";
import { getOrderDetail, listOrders } from "@/lib/services/order-service";
import { createTask } from "@/lib/services/task-service";
import { saveCommissionRule } from "@/lib/services/commission-payroll-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
const actors: Record<string, ActorContext> = {};

async function login(email: string, ip: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip, userAgent: "vitest-roles" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

beforeAll(async () => {
  db = createTestDb();
  const accounts: [string, string][] = [
    ["owner", "owner@studiocore.demo"],
    ["manager", "manager@studiocore.demo"],
    ["receptionist", "letan@studiocore.demo"],
    ["photographer", "photo@studiocore.demo"],
    ["makeup", "makeup@studiocore.demo"],
    ["retoucher", "retouch@studiocore.demo"],
    ["accountant", "ketoan@studiocore.demo"],
    ["platform", "platform@studiocore.demo"],
  ];
  for (const [key, email] of accounts) {
    actors[key] = await login(email, `192.0.2.${300 + Object.keys(actors).length}`);
  }
});

describe("ma trận phân quyền Phase 7", () => {
  it("permission đúng theo từng vai trò", () => {
    expect(hasPermission(actors.owner?.permissions ?? [], "finance.manage")).toBe(true);
    expect(hasPermission(actors.manager?.permissions ?? [], "finance.view")).toBe(true);
    expect(hasPermission(actors.manager?.permissions ?? [], "finance.manage")).toBe(false);
    expect(hasPermission(actors.receptionist?.permissions ?? [], "orders.manage")).toBe(true);
    expect(hasPermission(actors.receptionist?.permissions ?? [], "finance.view")).toBe(false);
    expect(hasPermission(actors.photographer?.permissions ?? [], "albums.manage")).toBe(true);
    expect(hasPermission(actors.photographer?.permissions ?? [], "customers.manage")).toBe(false);
    expect(hasPermission(actors.makeup?.permissions ?? [], "albums.manage")).toBe(false);
    expect(hasPermission(actors.retoucher?.permissions ?? [], "albums.manage")).toBe(true);
    expect(hasPermission(actors.accountant?.permissions ?? [], "finance.manage")).toBe(true);
    expect(hasPermission(actors.accountant?.permissions ?? [], "payroll.manage")).toBe(true);
    expect(hasPermission(actors.accountant?.permissions ?? [], "orders.manage")).toBe(false);
    expect(hasPermission(actors.platform?.permissions ?? [], "tenants.manage")).toBe(true);
    expect(hasPermission(actors.platform?.permissions ?? [], "orders.view")).toBe(false);
  });

  it("server chặn mutation ngoài quyền", async () => {
    expect(() =>
      createManualTransaction(db, actors.manager as ActorContext, {
        type: "income",
        branchId: "branch-demo-q1",
        category: "other",
        amount: 1000,
        method: "cash",
        description: "Should fail",
        reference: "",
        occurredAt: "",
        orderId: "",
        customerId: "",
      }),
    ).toThrow(/quyền/);
    expect(() =>
      listTransactions(db, actors.receptionist as ActorContext, {
        page: 1,
        pageSize: 10,
      }),
    ).toThrow(/quyền/);
    await expect(
      createAlbum(db, actors.makeup as ActorContext, {
        branchId: "branch-demo-q1",
        customerId: "",
        orderId: "",
        title: "Forbidden",
        notes: "",
        sourceType: "upload",
        sourceUrl: "",
        sourceUrls: "",
        selectionLimit: 5,
        extraPhotoEnabled: false,
        extraPhotoPrice: 0,
        allowFavorites: true,
        allowNotes: true,
        allowDownloads: true,
        downloadLimit: null,
        password: "",
        expiresAt: "",
      }),
    ).rejects.toThrow(/quyền/);
    expect(() =>
      createTask(db, actors.platform as ActorContext, {
        title: "Forbidden task",
        description: "",
        branchId: "branch-demo-q1",
        assigneeId: "",
        orderId: "",
        customerId: "",
        albumId: "",
        priority: "medium",
        status: "todo",
        dueAt: "",
      }),
    ).toThrow(/quyền/);
    expect(() =>
      saveCommissionRule(db, actors.receptionist as ActorContext, {
        name: "Forbidden",
        role: "photographer",
        type: "fixed",
        value: 1000,
        effectiveFrom: "2026-01-01T00:00",
        active: true,
      }),
    ).toThrow(/quyền/);
    expect(() =>
      getAlbumDetail(db, actors.platform as ActorContext, "album-demo-01"),
    ).toThrow(/quyền/);
  });

  it("tenant isolation và branch scope", async () => {
    const secondary = await login("owner@studiobinhminh.demo", "192.0.2.330");
    expect(() =>
      getAlbumDetail(db, secondary, "album-demo-01"),
    ).toThrow(/Không tìm thấy album/);
    const secondaryOrders = listOrders(db, secondary, {
      page: 1,
      pageSize: 20,
    });
    expect(secondaryOrders.total).toBe(0);
    expect(
      listTransactions(db, secondary, { page: 1, pageSize: 20 }).total,
    ).toBe(0);

    const photographerOrders = listOrders(db, actors.photographer as ActorContext, {
      page: 1,
      pageSize: 50,
    });
    expect(
      photographerOrders.items.every((order) => order.branchName === "Chi nhánh Quận 1"),
    ).toBe(true);
    expect(
      getOrderDetail(db, actors.photographer as ActorContext, "order-demo-03"),
    ).toBeNull();
    await expect(
      createAlbum(db, actors.photographer as ActorContext, {
        branchId: "branch-demo-thu-duc",
        customerId: "",
        orderId: "",
        title: "Sai chi nhánh",
        notes: "",
        sourceType: "upload",
        sourceUrl: "",
        sourceUrls: "",
        selectionLimit: 5,
        extraPhotoEnabled: false,
        extraPhotoPrice: 0,
        allowFavorites: true,
        allowNotes: true,
        allowDownloads: true,
        downloadLimit: null,
        password: "",
        expiresAt: "",
      }),
    ).rejects.toThrow(/chi nhánh/);
  });
});
