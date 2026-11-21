import { beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { isMissingDetailRecord } from "@/lib/http/detail-not-found";
import { redirectToPath } from "@/lib/http/redirect";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let photographer: ActorContext;

async function login(mode: "password" | "pin", identifier: string, secret: string) {
  const result = await authenticate(
    db,
    { mode, identifier, secret },
    { ip: "192.0.2.40", userAgent: "vitest-detail-not-found" },
  );
  if (!result.ok) throw new Error(`Không login được ${identifier}`);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error(`Không tạo được actor ${identifier}`);
  return actor;
}

beforeAll(async () => {
  db = createTestDb();
  owner = await login("password", "owner@studiocore.demo", "Demo@123");
  photographer = await login("pin", "SC-PHOTO", "444444");
});

describe("isMissingDetailRecord", () => {
  it("flags unknown ids on detail routes", () => {
    expect(isMissingDetailRecord(db, owner, "/manage/orders/new")).toBe(true);
    expect(isMissingDetailRecord(db, owner, "/manage/customers/new")).toBe(true);
    expect(isMissingDetailRecord(db, owner, "/manage/albums/missing/notes")).toBe(true);
  });

  it("passes existing records and non-detail routes", () => {
    expect(isMissingDetailRecord(db, owner, "/manage/orders/order-demo-01")).toBe(false);
    expect(isMissingDetailRecord(db, owner, "/manage/customers/customer-demo-01")).toBe(false);
    expect(isMissingDetailRecord(db, owner, "/manage/orders")).toBe(false);
    expect(isMissingDetailRecord(db, owner, "/manage/dashboard")).toBe(false);
  });

  it("leaves permission failures to the page", () => {
    expect(isMissingDetailRecord(db, photographer, "/manage/settings/users/missing")).toBe(false);
  });
});

describe("redirectToPath", () => {
  it("uses a relative Location so proxies keep the public host", () => {
    const response = redirectToPath("/manage/dashboard?demo=1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/manage/dashboard?demo=1");
  });

  it("rejects external targets", () => {
    expect(() => redirectToPath("https://evil.example")).toThrow();
    expect(() => redirectToPath("//evil.example")).toThrow();
  });
});
