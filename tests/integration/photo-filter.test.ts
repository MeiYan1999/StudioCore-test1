import { beforeAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import { photoFilterItems, photoFilterJobs } from "@/lib/db/schema";
import {
  listRecentFilterJobs,
  savePhotoFilterJob,
} from "@/lib/services/photo-filter-service";
import { DEMO_ALBUM } from "@/lib/demo-album";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;
let secondaryOwner: ActorContext;

async function login(email: string, ip: string): Promise<ActorContext> {
  const result = await authenticate(
    db,
    { mode: "password", identifier: email, secret: "Demo@123" },
    { ip, userAgent: "vitest-filter" },
  );
  if (!result.ok) throw new Error(result.error);
  const actor = await getActorFromToken(db, result.token);
  if (!actor) throw new Error("Không dựng actor");
  return actor;
}

beforeAll(async () => {
  db = createTestDb();
  owner = await login("owner@studiocore.demo", "192.0.2.80");
  secondaryOwner = await login("owner@studiobinhminh.demo", "192.0.2.81");
});

describe("lưu job lọc ảnh", () => {
  it("lưu aggregate/items, không lưu đường dẫn tuyệt đối, tenant isolation", () => {
    const result = savePhotoFilterJob(db, owner, {
      albumId: DEMO_ALBUM.id,
      mode: "alphanumeric",
      inputCodesText: "ANH-001\nANH-002\nANH-999",
      parsedCount: 3,
      matchedCount: 2,
      missingCount: 1,
      ambiguousCount: 0,
      duplicateCount: 0,
      outputMode: "subfolder",
      outputFolderName: "Ảnh khách chọn",
      fileType: "all",
      status: "completed",
      items: [
        {
          inputCode: "ANH-001",
          matchedFilename: "anh-001.jpg",
          status: "matched",
        },
        {
          inputCode: "ANH-002",
          matchedFilename: "anh-002.jpg",
          status: "matched",
        },
        {
          inputCode: "ANH-999",
          matchedFilename: "",
          status: "missing",
          message: "Không tìm thấy file khớp.",
        },
      ],
    });

    const job = db
      .select()
      .from(photoFilterJobs)
      .where(eq(photoFilterJobs.id, result.jobId))
      .get();
    expect(job?.matchedCount).toBe(2);
    expect(job?.missingCount).toBe(1);
    expect(job?.status).toBe("completed");
    expect(job?.outputFolderName).toContain("khách chọn");

    const items = db
      .select()
      .from(photoFilterItems)
      .where(eq(photoFilterItems.jobId, result.jobId))
      .all();
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.matchedFilename).not.toMatch(/^[A-Za-z]:\\/);
      expect(item.matchedFilename).not.toContain("Users");
    }

    expect(() =>
      savePhotoFilterJob(db, secondaryOwner, {
        albumId: DEMO_ALBUM.id,
        mode: "alphanumeric",
        inputCodesText: "ANH-001",
        parsedCount: 1,
        matchedCount: 1,
        missingCount: 0,
        ambiguousCount: 0,
        duplicateCount: 0,
        outputMode: "subfolder",
        outputFolderName: "Ảnh khách chọn",
        fileType: "all",
        status: "completed",
        items: [],
      }),
    ).toThrow(/Không tìm thấy album/);

    const recent = listRecentFilterJobs(db, owner, 5);
    expect(recent[0]?.id).toBe(result.jobId);
    const newest = db
      .select()
      .from(photoFilterJobs)
      .orderBy(desc(photoFilterJobs.createdAt))
      .get();
    expect(newest?.id).toBe(result.jobId);
  });
});
