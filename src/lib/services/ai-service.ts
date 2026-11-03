import crypto from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import type { AppDb } from "../db/client";
import { aiJobs, albums, photos, settings } from "../db/schema";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import { AuthorizationError, NotFoundError, ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { getEnv } from "../env";
import { getStorageAdapter } from "../adapters/storage";
import { decryptSecret, encryptSecret } from "../security/secret-crypto";
import { getTenantSettings } from "./settings-service";

export type AiFeatureFlags = {
  blur: boolean;
  exposure: boolean;
  duplicate: boolean;
  burst: boolean;
  eyeDetection: boolean;
};

export type AiSettingsView = {
  provider: "local" | "openai" | "gemini";
  model: string;
  hasApiKey: boolean;
  consent: boolean;
  budgetVnd: number;
  costPerImageVnd: number;
  features: AiFeatureFlags;
};

export type AiInsight = {
  code: string;
  filename: string;
  issues: ("blur" | "under_exposed" | "over_exposed")[];
  sharpness: number;
  brightness: number;
};

export type AiAnalysisResult = {
  provider: string;
  generatedAt: string;
  scanned: number;
  insights: AiInsight[];
  duplicateGroups: { codes: string[]; reason: "near_duplicate" }[];
  burstGroups: { codes: string[]; keep: string }[];
  unsupported: string[];
  errors: { code: string; message: string }[];
};

export type AiJobView = {
  id: string;
  albumId: string | null;
  type: string;
  provider: string;
  status: string;
  estimatedCost: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  result: AiAnalysisResult | null;
};

const PROVIDERS = ["local", "openai", "gemini"] as const;
type AiProvider = (typeof PROVIDERS)[number];

function parseProvider(value: string | undefined, fallback: AiProvider): AiProvider {
  return (PROVIDERS as readonly string[]).includes(value ?? "")
    ? (value as AiProvider)
    : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function parseInteger(value: string | undefined, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

export function getAiSettingsView(
  db: AppDb,
  tenantId: string,
): AiSettingsView {
  const settingsMap = getTenantSettings(db, tenantId);
  const env = getEnv();
  const provider = parseProvider(
    settingsMap["ai.provider"],
    parseProvider(env.AI_PROVIDER, "local"),
  );
  const storedKey = decryptSecret(settingsMap["ai.apiKeyEncrypted"] ?? null);
  const hasApiKey = Boolean(storedKey || env.AI_API_KEY?.trim());
  return {
    provider,
    model:
      settingsMap["ai.model"] ||
      env.AI_MODEL ||
      (provider === "openai"
        ? "gpt-4o-mini"
        : provider === "gemini"
          ? "gemini-1.5-flash"
          : "local-heuristic"),
    hasApiKey,
    consent: parseBoolean(settingsMap["ai.consent"], false),
    budgetVnd: parseInteger(
      settingsMap["ai.budgetVnd"],
      env.AI_MONTHLY_BUDGET_VND,
    ),
    costPerImageVnd: parseInteger(settingsMap["ai.costPerImageVnd"], 0),
    features: {
      blur: parseBoolean(settingsMap["ai.feature.blur"], true),
      exposure: parseBoolean(settingsMap["ai.feature.exposure"], true),
      duplicate: parseBoolean(settingsMap["ai.feature.duplicate"], true),
      burst: parseBoolean(settingsMap["ai.feature.burst"], true),
      eyeDetection: parseBoolean(settingsMap["ai.feature.eye_detection"], false),
    },
  };
}

export type SaveAiSettingsInput = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  clearApiKey: boolean;
  consent: boolean;
  budgetVnd: number;
  costPerImageVnd: number;
  features: AiFeatureFlags;
};

function upsertTenantSetting(
  db: AppDb,
  tenantId: string,
  key: string,
  value: string,
): void {
  const existing = db
    .select({ id: settings.id })
    .from(settings)
    .where(
      and(
        eq(settings.tenantId, tenantId),
        eq(settings.key, key),
        isNull(settings.branchId),
      ),
    )
    .get();
  if (existing) {
    db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.id, existing.id))
      .run();
    return;
  }
  db.insert(settings)
    .values({
      id: `setting-ai-${key.replace(/[^a-z0-9]+/gi, "-")}-${tenantId}`,
      tenantId,
      key,
      value,
      branchId: null,
    })
    .run();
}

export function saveAiSettings(
  db: AppDb,
  actor: ActorContext,
  input: SaveAiSettingsInput,
): void {
  assertPermission(actor, "settings.manage");
  if (!(PROVIDERS as readonly string[]).includes(input.provider)) {
    throw new ValidationError("AI provider không hợp lệ.");
  }
  if (input.model.length > 120) {
    throw new ValidationError("Tên model tối đa 120 ký tự.");
  }
  if (input.apiKey.length > 500) {
    throw new ValidationError("API key quá dài.");
  }
  if (
    !Number.isInteger(input.budgetVnd) ||
    input.budgetVnd < 0 ||
    !Number.isInteger(input.costPerImageVnd) ||
    input.costPerImageVnd < 0
  ) {
    throw new ValidationError("Ngân sách/chi phí AI không hợp lệ.");
  }

  db.transaction((tx) => {
    upsertTenantSetting(tx, actor.tenantId, "ai.provider", input.provider);
    upsertTenantSetting(
      tx,
      actor.tenantId,
      "ai.model",
      input.model.trim() || "local-heuristic",
    );
    if (input.clearApiKey) {
      upsertTenantSetting(tx, actor.tenantId, "ai.apiKeyEncrypted", "");
    } else if (input.apiKey.trim()) {
      upsertTenantSetting(
        tx,
        actor.tenantId,
        "ai.apiKeyEncrypted",
        encryptSecret(input.apiKey.trim()),
      );
    }
    upsertTenantSetting(
      tx,
      actor.tenantId,
      "ai.consent",
      input.consent ? "true" : "false",
    );
    upsertTenantSetting(
      tx,
      actor.tenantId,
      "ai.budgetVnd",
      String(input.budgetVnd),
    );
    upsertTenantSetting(
      tx,
      actor.tenantId,
      "ai.costPerImageVnd",
      String(input.costPerImageVnd),
    );
    for (const [key, value] of Object.entries(input.features)) {
      upsertTenantSetting(
        tx,
        actor.tenantId,
        `ai.feature.${key === "eyeDetection" ? "eye_detection" : key}`,
        value ? "true" : "false",
      );
    }
  });

  writeAudit(db, {
    tenantId: actor.tenantId,
    actorId: actor.staffId,
    action: "settings.ai.update",
    entity: "settings",
    metadata: {
      provider: input.provider,
      consent: input.consent,
      keyChanged: input.clearApiKey || input.apiKey.trim().length > 0,
    },
  });
}

function getApiKey(db: AppDb, tenantId: string): string | null {
  const settingsMap = getTenantSettings(db, tenantId);
  return (
    decryptSecret(settingsMap["ai.apiKeyEncrypted"] ?? null) ??
    getEnv().AI_API_KEY?.trim() ??
    null
  );
}

function issuesFromPromptContent(content: string): AiInsight["issues"] {
  try {
    const parsed = JSON.parse(content) as { issues?: unknown };
    if (!Array.isArray(parsed.issues)) return [];
    return parsed.issues.filter(
      (issue): issue is AiInsight["issues"][number] =>
        issue === "blur" ||
        issue === "under_exposed" ||
        issue === "over_exposed",
    );
  } catch {
    return [];
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) return response;
      if (response.status !== 429 && response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, 500 * (attempt + 1)),
    );
  }
  throw lastError instanceof Error ? lastError : new Error("AI provider lỗi.");
}

async function callOpenAiVision(
  apiKey: string,
  model: string,
  base64: string,
): Promise<AiInsight["issues"]> {
  const response = await fetchWithRetry(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Kiểm tra ảnh studio. Trả đúng JSON {"issues": []} với các giá trị có thể: "blur", "under_exposed", "over_exposed". Không thêm chữ khác.',
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`OpenAI trả lỗi HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return issuesFromPromptContent(payload.choices?.[0]?.message?.content ?? "");
}

async function callGeminiVision(
  apiKey: string,
  model: string,
  base64: string,
): Promise<AiInsight["issues"]> {
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Kiểm tra ảnh studio. Trả đúng JSON {"issues": []} với các giá trị có thể: "blur", "under_exposed", "over_exposed". Không thêm chữ khác.',
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Gemini trả lỗi HTTP ${response.status}.`);
  }
  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return issuesFromPromptContent(
    payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
  );
}

type LocalMetrics = {
  sharpness: number;
  brightness: number;
  hash: string;
};

export async function measureLocalImage(buffer: Buffer): Promise<LocalMetrics> {
  const grayscale = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize({ width: 256, height: 256, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = grayscale;
  const width = info.width;
  const height = info.height;
  let sum = 0;
  let laplacianSum = 0;
  let laplacianSquares = 0;
  let laplacianCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const center = data[index] ?? 0;
      const laplacian =
        4 * center -
        (data[index - 1] ?? 0) -
        (data[index + 1] ?? 0) -
        (data[index - width] ?? 0) -
        (data[index + width] ?? 0);
      laplacianSum += laplacian;
      laplacianSquares += laplacian * laplacian;
      laplacianCount += 1;
    }
  }
  for (const value of data) {
    sum += value;
  }
  const mean = sum / data.length;
  const laplacianMean = laplacianCount ? laplacianSum / laplacianCount : 0;
  const sharpness = laplacianCount
    ? laplacianSquares / laplacianCount - laplacianMean * laplacianMean
    : 0;

  const hashRaw = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();
  let hash = "";
  for (let y = 0; y < 8; y += 1) {
    let bits = 0;
    for (let x = 0; x < 8; x += 1) {
      const left = hashRaw[y * 9 + x] ?? 0;
      const right = hashRaw[y * 9 + x + 1] ?? 0;
      bits = (bits << 1) | (left > right ? 1 : 0);
    }
    hash += bits.toString(16).padStart(2, "0");
  }

  return {
    sharpness,
    brightness: mean,
    hash,
  };
}

function hashDistance(a: string, b: string): number {
  let value = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let distance = 0;
  while (value > 0n) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

function clusterNearDuplicates(
  items: { code: string; hash: string; sharpness: number }[],
): string[][] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current] ?? current] ?? current;
      current = parent[current] ?? current;
    }
    return current;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (hashDistance(items[i]?.hash ?? "", items[j]?.hash ?? "") <= 6) {
        union(i, j);
      }
    }
  }
  const groups = new Map<number, string[]>();
  items.forEach((item, index) => {
    const root = find(index);
    const list = groups.get(root) ?? [];
    list.push(item.code);
    groups.set(root, list);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

async function analyzeLocal(
  db: AppDb,
  tenantId: string,
  albumId: string,
  settingsView: AiSettingsView,
): Promise<AiAnalysisResult> {
  const photoRows = db
    .select()
    .from(photos)
    .where(
      and(
        eq(photos.albumId, albumId),
        eq(photos.tenantId, tenantId),
        eq(photos.status, "ready"),
      ),
    )
    .orderBy(asc(photos.sortOrder), asc(photos.code))
    .limit(100)
    .all();

  const insights: AiInsight[] = [];
  const errors: { code: string; message: string }[] = [];
  const measured: { code: string; hash: string; sharpness: number }[] = [];
  const adapter = getStorageAdapter();

  for (const photo of photoRows) {
    try {
      const buffer = await adapter.read(photo.storageKey);
      const metrics = await measureLocalImage(buffer);
      const issues: AiInsight["issues"] = [];
      if (settingsView.features.blur && metrics.sharpness < 35) {
        issues.push("blur");
      }
      if (settingsView.features.exposure) {
        if (metrics.brightness < 55) issues.push("under_exposed");
        if (metrics.brightness > 242) issues.push("over_exposed");
      }
      measured.push({
        code: photo.code,
        hash: metrics.hash,
        sharpness: metrics.sharpness,
      });
      if (issues.length > 0) {
        insights.push({
          code: photo.code,
          filename: photo.filename,
          issues,
          sharpness: Math.round(metrics.sharpness),
          brightness: Math.round(metrics.brightness),
        });
      }
    } catch (error) {
      errors.push({
        code: photo.code,
        message:
          error instanceof Error ? error.message : "Không đọc được ảnh.",
      });
    }
  }

  const groups = settingsView.features.duplicate || settingsView.features.burst
    ? clusterNearDuplicates(measured)
    : [];
  const duplicateGroups = settingsView.features.duplicate
    ? groups.map((codes) => ({ codes, reason: "near_duplicate" as const }))
    : [];
  const burstGroups = settingsView.features.burst
    ? groups.map((codes) => {
        const keep = codes
          .map((code) => measured.find((item) => item.code === code))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
          .sort((a, b) => b.sharpness - a.sharpness)[0]?.code;
        return { codes, keep: keep ?? codes[0] ?? "" };
      })
    : [];

  return {
    provider: "local",
    generatedAt: new Date().toISOString(),
    scanned: photoRows.length,
    insights,
    duplicateGroups,
    burstGroups,
    unsupported: ["eye_detection"],
    errors,
  };
}

async function analyzeLive(
  db: AppDb,
  tenantId: string,
  albumId: string,
  settingsView: AiSettingsView,
  apiKey: string,
): Promise<AiAnalysisResult> {
  const photoRows = db
    .select()
    .from(photos)
    .where(
      and(
        eq(photos.albumId, albumId),
        eq(photos.tenantId, tenantId),
        eq(photos.status, "ready"),
      ),
    )
    .orderBy(asc(photos.sortOrder), asc(photos.code))
    .limit(20)
    .all();
  const adapter = getStorageAdapter();
  const insights: AiInsight[] = [];
  const errors: { code: string; message: string }[] = [];
  const measured: { code: string; hash: string; sharpness: number }[] = [];

  for (const photo of photoRows) {
    try {
      const buffer = await adapter.read(photo.storageKey);
      const metrics = await measureLocalImage(buffer);
      measured.push({
        code: photo.code,
        hash: metrics.hash,
        sharpness: metrics.sharpness,
      });
      const base64 = buffer.toString("base64");
      const issues =
        settingsView.provider === "openai"
          ? await callOpenAiVision(apiKey, settingsView.model, base64)
          : await callGeminiVision(apiKey, settingsView.model, base64);
      if (issues.length > 0) {
        insights.push({
          code: photo.code,
          filename: photo.filename,
          issues,
          sharpness: Math.round(metrics.sharpness),
          brightness: Math.round(metrics.brightness),
        });
      }
    } catch (error) {
      errors.push({
        code: photo.code,
        message:
          error instanceof Error ? error.message : "Provider trả lỗi.",
      });
    }
  }

  const groups = settingsView.features.duplicate
    ? clusterNearDuplicates(measured).map((codes) => ({
        codes,
        reason: "near_duplicate" as const,
      }))
    : [];

  return {
    provider: settingsView.provider,
    generatedAt: new Date().toISOString(),
    scanned: photoRows.length,
    insights,
    duplicateGroups: groups,
    burstGroups: settingsView.features.burst
      ? groups.map((group) => {
          const keep = group.codes
            .map((code) => measured.find((item) => item.code === code))
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .sort((a, b) => b.sharpness - a.sharpness)[0]?.code;
          return { codes: group.codes, keep: keep ?? group.codes[0] ?? "" };
        })
      : [],
    unsupported: ["eye_detection"],
    errors,
  };
}

export async function runAlbumAiScan(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
): Promise<{ jobId: string; result: AiAnalysisResult }> {
  assertPermission(actor, "albums.manage");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);

  const settingsView = getAiSettingsView(db, actor.tenantId);
  const apiKey = getApiKey(db, actor.tenantId);
  const photoCount =
    db
      .select({ id: photos.id })
      .from(photos)
      .where(
        and(
          eq(photos.albumId, albumId),
          eq(photos.tenantId, actor.tenantId),
          eq(photos.status, "ready"),
        ),
      )
      .all().length;
  if (photoCount === 0) {
    throw new ValidationError("Album chưa có ảnh sẵn sàng để phân tích.");
  }

  let estimatedCost = 0;
  if (settingsView.provider !== "local") {
    if (!settingsView.consent) {
      throw new AuthorizationError(
        "Cần bật consent trước khi gửi ảnh khách ra AI provider bên ngoài.",
      );
    }
    if (!apiKey) {
      throw new ValidationError(
        "AI provider chưa có API key. Cấu hình trong AI Hub hoặc đặt AI_API_KEY.",
      );
    }
    estimatedCost = settingsView.costPerImageVnd * photoCount;
    if (settingsView.budgetVnd > 0 && estimatedCost > settingsView.budgetVnd) {
      throw new ValidationError(
        `Chi phí ước tính ${estimatedCost.toLocaleString("vi-VN")}đ vượt ngân sách AI ${settingsView.budgetVnd.toLocaleString("vi-VN")}đ.`,
      );
    }
    if (settingsView.budgetVnd === 0 && estimatedCost > 0) {
      throw new ValidationError(
        "Chưa đặt ngân sách AI. Đặt ngân sách trước khi chạy provider trả phí.",
      );
    }
  }

  const jobId = crypto.randomUUID();
  db.insert(aiJobs)
    .values({
      id: jobId,
      tenantId: actor.tenantId,
      albumId,
      type:
        settingsView.provider === "local"
          ? "local_quality_scan"
          : "live_quality_scan",
      provider: settingsView.provider,
      status: "running",
      inputRef: albumId,
      outputRef: null,
      estimatedCost,
      createdBy: actor.staffId,
    })
    .run();

  try {
    const result =
      settingsView.provider === "local"
        ? await analyzeLocal(db, actor.tenantId, albumId, settingsView)
        : await analyzeLive(
            db,
            actor.tenantId,
            albumId,
            settingsView,
            apiKey as string,
          );
    db.update(aiJobs)
      .set({
        status: "completed",
        outputRef: JSON.stringify(result),
        updatedAt: new Date(),
      })
      .where(eq(aiJobs.id, jobId))
      .run();

    writeAudit(db, {
      tenantId: actor.tenantId,
      actorId: actor.staffId,
      action: "ai.job.run",
      entity: "ai_job",
      entityId: jobId,
      metadata: {
        albumId,
        provider: settingsView.provider,
        scanned: result.scanned,
        estimatedCost,
      },
    });

    return { jobId, result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI provider xử lý thất bại.";
    db.update(aiJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId))
      .run();
    throw new ValidationError(message);
  }
}

function mapJob(row: typeof aiJobs.$inferSelect): AiJobView {
  let result: AiAnalysisResult | null = null;
  if (row.outputRef) {
    try {
      result = JSON.parse(row.outputRef) as AiAnalysisResult;
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    albumId: row.albumId,
    type: row.type,
    provider: row.provider,
    status: row.status,
    estimatedCost: row.estimatedCost,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    result,
  };
}

export function getAiJobsForAlbum(
  db: AppDb,
  actor: ActorContext,
  albumId: string,
  limit = 5,
): AiJobView[] {
  assertPermission(actor, "albums.view");
  const album = db
    .select()
    .from(albums)
    .where(and(eq(albums.id, albumId), eq(albums.tenantId, actor.tenantId)))
    .get();
  if (!album) throw new NotFoundError("Không tìm thấy album.");
  assertBranchAccess(actor, album.branchId);
  return db
    .select()
    .from(aiJobs)
    .where(and(eq(aiJobs.albumId, albumId), eq(aiJobs.tenantId, actor.tenantId)))
    .orderBy(desc(aiJobs.createdAt))
    .limit(limit)
    .all()
    .map(mapJob);
}

export function listAiJobLogs(
  db: AppDb,
  actor: ActorContext,
  limit = 10,
): AiJobView[] {
  assertPermission(actor, "settings.view");
  return db
    .select()
    .from(aiJobs)
    .where(eq(aiJobs.tenantId, actor.tenantId))
    .orderBy(desc(aiJobs.createdAt))
    .limit(limit)
    .all()
    .map(mapJob);
}
