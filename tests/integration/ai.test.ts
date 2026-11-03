import { beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login-service";
import { getActorFromToken } from "@/lib/auth/session-core";
import type { ActorContext } from "@/lib/auth/types";
import type { AppDb } from "@/lib/db/client";
import {
  getAiJobsForAlbum,
  getAiSettingsView,
  runAlbumAiScan,
  saveAiSettings,
} from "@/lib/services/ai-service";
import { DEMO_ALBUM } from "@/lib/demo-album";
import { generateDemoAlbumAssets } from "@/lib/storage/local-storage";
import { createTestDb } from "../helpers/test-db";

let db: AppDb;
let owner: ActorContext;

const FEATURES = {
  blur: true,
  exposure: true,
  duplicate: true,
  burst: true,
  eyeDetection: false,
};

beforeAll(async () => {
  db = createTestDb();
  await generateDemoAlbumAssets();
  const login = await authenticate(
    db,
    { mode: "password", identifier: "owner@studiocore.demo", secret: "Demo@123" },
    { ip: "192.0.2.90", userAgent: "vitest-ai" },
  );
  if (!login.ok) throw new Error(login.error);
  const actor = await getActorFromToken(db, login.token);
  if (!actor) throw new Error("Không dựng owner actor");
  owner = actor;
});

describe("AI Hub", () => {
  it("local heuristic tạo job completed, log kết quả và chưa hỗ trợ eye detection", async () => {
    const result = await runAlbumAiScan(db, owner, DEMO_ALBUM.id);
    expect(result.result.provider).toBe("local");
    expect(result.result.scanned).toBe(12);
    expect(result.result.unsupported).toContain("eye_detection");
    expect(Array.isArray(result.result.insights)).toBe(true);

    const jobs = getAiJobsForAlbum(db, owner, DEMO_ALBUM.id, 5);
    expect(jobs[0]?.id).toBe(result.jobId);
    expect(jobs[0]?.status).toBe("completed");
    expect(jobs[0]?.estimatedCost).toBe(0);
    expect(jobs[0]?.result?.scanned).toBe(12);
  });

  it("consent và API key bắt buộc với provider live", async () => {
    saveAiSettings(db, owner, {
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "",
      clearApiKey: true,
      consent: false,
      budgetVnd: 0,
      costPerImageVnd: 0,
      features: FEATURES,
    });
    expect(getAiSettingsView(db, owner.tenantId).provider).toBe("openai");
    await expect(runAlbumAiScan(db, owner, DEMO_ALBUM.id)).rejects.toThrow(
      /consent/,
    );

    saveAiSettings(db, owner, {
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "",
      clearApiKey: true,
      consent: true,
      budgetVnd: 0,
      costPerImageVnd: 0,
      features: FEATURES,
    });
    await expect(runAlbumAiScan(db, owner, DEMO_ALBUM.id)).rejects.toThrow(
      /API key/,
    );
  });

  it("cost guard chặn job live vượt ngân sách trước khi gọi mạng", async () => {
    saveAiSettings(db, owner, {
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "demo-key-not-sent",
      clearApiKey: false,
      consent: true,
      budgetVnd: 100,
      costPerImageVnd: 1_000,
      features: FEATURES,
    });
    await expect(runAlbumAiScan(db, owner, DEMO_ALBUM.id)).rejects.toThrow(
      /vượt ngân sách/,
    );

    saveAiSettings(db, owner, {
      provider: "local",
      model: "local-heuristic",
      apiKey: "",
      clearApiKey: true,
      consent: false,
      budgetVnd: 0,
      costPerImageVnd: 0,
      features: FEATURES,
    });
    expect(getAiSettingsView(db, owner.tenantId).provider).toBe("local");
    expect(getAiSettingsView(db, owner.tenantId).hasApiKey).toBe(false);
  });
});
