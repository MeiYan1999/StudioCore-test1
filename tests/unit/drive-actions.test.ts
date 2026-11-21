import { beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import type { AppDb } from "@/lib/db/client";
import type { ActorContext } from "@/lib/auth/types";
import { driveShareFiles, staff, tenants } from "@/lib/db/schema";
import {
  createDriveDevice,
  createDriveShare,
  getDriveSelection,
  updateDriveShareStatus,
} from "@/lib/services/drive-service";
import { mutateDriveGalleryAction } from "@/lib/actions/drive-actions";
import { createTestDb } from "../helpers/test-db";

const state = vi.hoisted(() => ({ db: null as AppDb | null, access: false }));
vi.mock("@/lib/db/client", async (original) => ({
  ...(await original<typeof import("@/lib/db/client")>()),
  getDb: () => state.db!,
}));
vi.mock("@/lib/share/drive-access", () => ({
  hasDriveAccess: async () => state.access,
  grantDriveAccess: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const actor: ActorContext = {
  sessionId: "s",
  tenantId: "drive-actions-tenant",
  tenantName: "Studio",
  tenantSlug: "drive-actions",
  tenantPlan: "pro",
  staffId: "drive-actions-staff",
  staffName: "Owner",
  staffCode: "O",
  staffEmail: null,
  role: "owner",
  permissions: ["albums.view", "albums.manage"],
  branches: [],
  activeBranchId: null,
  readOnly: false,
};
let token: string;
let fileId: string;
let shareId: string;
beforeEach(() => {
  state.access = false;
  state.db = createTestDb();
  state.db
    .insert(tenants)
    .values({ id: actor.tenantId, name: "Studio", slug: actor.tenantSlug })
    .run();
  state.db
    .insert(staff)
    .values({
      id: actor.staffId,
      tenantId: actor.tenantId,
      code: "ACT",
      name: "Owner",
      role: "owner",
    })
    .run();
  const { device } = createDriveDevice(state.db, actor);
  const share = createDriveShare(state.db, device.id, {
    kind: "album",
    title: "Private",
    folderName: "Photos",
    pin: "123456",
    allowOriginals: false,
    maxSelect: 1,
    expiresInDays: 0,
    files: [
      { fileKey: "photo_01", name: "one.jpg", relPath: "one.jpg", kind: "image", sizeBytes: 1 },
    ],
  });
  token = share.url.split("/").pop()!;
  shareId = share.id;
  fileId = state.db
    .select()
    .from(driveShareFiles)
    .where(eq(driveShareFiles.shareId, share.id))
    .get()!.id;
});
function form(operation: string, rawToken = token) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    token: rawToken,
    operation,
    fileId,
    note: "hello",
    author: "Customer",
    content: "Trim",
    seconds: "1",
  }))
    result.set(key, value);
  return result;
}
it.each(["like", "note", "finalize", "comment"])(
  "requires fresh token and PIN access for %s",
  async (operation) => {
    expect((await mutateDriveGalleryAction({ status: "idle" }, form(operation))).status).toBe(
      "error",
    );
    expect(
      (await mutateDriveGalleryAction({ status: "idle" }, form(operation, "unknown"))).status,
    ).toBe("error");
    expect(getDriveSelection(state.db!, actor, shareId).items).toEqual([]);
  },
);
it("allows verified likes, notes and finalization but rechecks current status", async () => {
  state.access = true;
  for (const operation of ["like", "note", "finalize"])
    expect((await mutateDriveGalleryAction({ status: "idle" }, form(operation))).status).toBe(
      "success",
    );
  expect(getDriveSelection(state.db!, actor, shareId).items[0].note).toBe("hello");
  expect((await mutateDriveGalleryAction({ status: "idle" }, form("like"))).status).toBe("error");
  updateDriveShareStatus(state.db!, actor, shareId, "paused");
  expect((await mutateDriveGalleryAction({ status: "idle" }, form("note"))).status).toBe("error");
});
