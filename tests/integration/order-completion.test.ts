import { beforeAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { commissions, customerInteractions } from "@/lib/db/schema";
import { changeOrderStatus } from "@/lib/services/order-service";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;

beforeAll(async () => {
  db = createTestDb();
  const login = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.130", userAgent: "vitest-completion" },
  );
  if (!login.ok) throw new Error(login.error);
  const actor = await getActorFromToken(db, login.token);
  if (!actor) throw new Error("Không dựng actor");
  owner = actor;
});

describe("hoàn tất đơn", () => {
  it("tự tính commission và ghi yêu cầu đánh giá", () => {
    const chain = [
      "shooting",
      "awaiting_edit",
      "editing",
      "awaiting_selection",
      "awaiting_approval",
      "delivered",
      "completed",
    ] as const;
    for (const status of chain) {
      changeOrderStatus(db, owner, "order-demo-03", status, "Test hoàn tất");
    }
    const rows = db
      .select()
      .from(commissions)
      .where(
        and(
          eq(commissions.tenantId, owner.tenantId),
          eq(commissions.orderId, "order-demo-03"),
        ),
      )
      .all();
    expect(rows).toHaveLength(2);
    const photographer = rows.find((row) => row.role === "photographer");
    expect(photographer?.amount).toBe(297_500);
    expect(photographer?.ruleType).toBe("percent");
    const review = db
      .select({ value: count() })
      .from(customerInteractions)
      .where(
        and(
          eq(customerInteractions.tenantId, owner.tenantId),
          eq(customerInteractions.customerId, "customer-demo-03"),
          eq(customerInteractions.type, "review_request"),
        ),
      )
      .get()?.value;
    expect(review).toBeGreaterThan(0);
  });
});
