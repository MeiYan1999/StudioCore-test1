import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { settings } from "../db/schema";
import { decryptSecret, encryptSecret } from "../security/secret-crypto";
import { setTenantSetting } from "./settings-write-service";

export type AiHubFeatureId =
  | "ceo_assistant"
  | "messenger_assistant"
  | "ads_analysis"
  | "social_content"
  | "photo_tools"
  | "continuous_learning";

export type AiHubFeatureConfig = {
  id: AiHubFeatureId;
  name: string;
  description: string;
  icon: "bot" | "messenger" | "ads" | "social" | "photo" | "learning";
  enabled: boolean;
  model: string;
  budgetUsd: number;
  warningPercent: number;
  tokensUsed: number;
  callsCount: number;
  usedUsd: number;
  modelOptions: { value: string; label: string }[];
};

export type AiHubApiKey = {
  id: string;
  name: string;
  provider: "openai" | "gemini" | "anthropic" | "deepseek" | "openrouter";
  keyMasked: string;
  keyEncrypted?: string;
  status: "active" | "error" | "quota_exceeded" | "paused";
  priority: number;
  callCount: number;
  createdAt: string;
  lastUsedAt?: string | null;
};

export type AiHubData = {
  features: AiHubFeatureConfig[];
  apiKeys: AiHubApiKey[];
  metrics: {
    totalKeys: number;
    activeKeys: number;
    totalFeatures: number;
    activeFeatures: number;
    costThisMonthUsd: number;
    costThisMonthVnd: number;
    totalBudgetUsd: number;
    budgetPercent: number;
  };
};

const CHAT_MODEL_OPTIONS = [
  { value: "GPT-4o Mini (rẻ, nhanh)", label: "GPT-4o Mini (rẻ, nhanh)" },
  { value: "GPT-4o (mạnh, đa năng)", label: "GPT-4o (mạnh, đa năng)" },
  { value: "GPT-4.5 Preview", label: "GPT-4.5 Preview" },
  { value: "Gemini 1.5 Flash (nhanh)", label: "Gemini 1.5 Flash (nhanh)" },
  { value: "Gemini 1.5 Pro (mạnh)", label: "Gemini 1.5 Pro (mạnh)" },
  { value: "Claude 3.5 Sonnet", label: "Claude 3.5 Sonnet" },
  { value: "Claude 3.5 Haiku", label: "Claude 3.5 Haiku" },
  { value: "DeepSeek V3", label: "DeepSeek V3" },
];

const PHOTO_MODEL_OPTIONS = [
  {
    value: "GPT Image 2.5 Sunburst (edit chính xác - tỉ mỉ)",
    label: "GPT Image 2.5 Sunburst (edit chính xác - tỉ mỉ)",
  },
  { value: "GPT Image Flare (nhanh)", label: "GPT Image Flare (nhanh)" },
  { value: "Gemini 2.5 Flash Vision", label: "Gemini 2.5 Flash Vision" },
  { value: "Gemini 2.5 Pro Vision", label: "Gemini 2.5 Pro Vision" },
  { value: "SDXL Studio Retouch (tách nền)", label: "SDXL Studio Retouch (tách nền)" },
];

export const DEFAULT_AI_FEATURES: AiHubFeatureConfig[] = [
  {
    id: "ceo_assistant",
    name: "Trợ lý CEO AI",
    description: "Chat phân tích kinh doanh, hỏi đáp số liệu",
    icon: "bot",
    enabled: true,
    model: "GPT-4o Mini (rẻ, nhanh)",
    budgetUsd: 10,
    warningPercent: 80,
    tokensUsed: 0,
    callsCount: 0,
    usedUsd: 0,
    modelOptions: CHAT_MODEL_OPTIONS,
  },
  {
    id: "messenger_assistant",
    name: "Trợ lý AI Messenger",
    description:
      "Gợi ý/trả lời tự động trong khung chat khách + Embedding & Auto-learn (RAG)",
    icon: "messenger",
    enabled: true,
    model: "GPT-4o Mini (rẻ, nhanh)",
    budgetUsd: 15,
    warningPercent: 80,
    tokensUsed: 0,
    callsCount: 0,
    usedUsd: 0,
    modelOptions: CHAT_MODEL_OPTIONS,
  },
  {
    id: "ads_analysis",
    name: "Phân tích Quảng cáo",
    description: "Đánh giá hiệu quả Facebook Ads (thường + deep)",
    icon: "ads",
    enabled: true,
    model: "GPT-4o Mini (rẻ, nhanh)",
    budgetUsd: 5,
    warningPercent: 80,
    tokensUsed: 0,
    callsCount: 0,
    usedUsd: 0,
    modelOptions: CHAT_MODEL_OPTIONS,
  },
  {
    id: "social_content",
    name: "Viết content Social",
    description:
      "Sinh caption Facebook, ad copy, hashtag, viết lại nội dung (vision-aware)",
    icon: "social",
    enabled: true,
    model: "GPT-4o Mini (rẻ, nhanh)",
    budgetUsd: 5,
    warningPercent: 80,
    tokensUsed: 0,
    callsCount: 0,
    usedUsd: 0,
    modelOptions: CHAT_MODEL_OPTIONS,
  },
  {
    id: "photo_tools",
    name: "AI Tools Studio (ảnh)",
    description:
      "Canvas ảnh: tách nền, thay phông, typo AI. Model = GPT ưu tiên thay phông (Sunburst = edit chính xác; Flare = nhanh). Typo/tách nền ưu tiên Gemini 2.5 rồi Flare.",
    icon: "photo",
    enabled: true,
    model: "GPT Image 2.5 Sunburst (edit chính xác - tỉ mỉ)",
    budgetUsd: 20,
    warningPercent: 80,
    tokensUsed: 0,
    callsCount: 0,
    usedUsd: 0,
    modelOptions: PHOTO_MODEL_OPTIONS,
  },
  {
    id: "continuous_learning",
    name: "AI Tự học liên tục",
    description:
      "Học cách bán hàng từ hội thoại cũ, chạy ngầm – độc lập với AI trả lời khách",
    icon: "learning",
    enabled: true,
    model: "GPT-4o Mini (rẻ, nhanh)",
    budgetUsd: 10,
    warningPercent: 80,
    tokensUsed: 0,
    callsCount: 0,
    usedUsd: 0,
    modelOptions: CHAT_MODEL_OPTIONS,
  },
];

const USD_TO_VND_RATE = 25400;

function maskApiKey(key: string): string {
  const clean = key.trim();
  if (clean.length <= 8) return "sk-••••••••";
  const start = clean.slice(0, 5);
  const end = clean.slice(-4);
  return `${start}••••••••${end}`;
}

export function getAiHubData(db: AppDb, tenantId: string): AiHubData {
  // 1. Fetch feature configs
  const featuresRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(
      and(
        eq(settings.tenantId, tenantId),
        eq(settings.key, "ai.hub.features"),
        isNull(settings.branchId),
      ),
    )
    .get();

  let storedFeatures: Record<string, Partial<AiHubFeatureConfig>> = {};
  if (featuresRow?.value) {
    try {
      storedFeatures = JSON.parse(featuresRow.value);
    } catch {
      storedFeatures = {};
    }
  }

  const features: AiHubFeatureConfig[] = DEFAULT_AI_FEATURES.map((def) => {
    const custom = storedFeatures[def.id] || {};
    return {
      ...def,
      enabled: custom.enabled !== undefined ? Boolean(custom.enabled) : def.enabled,
      model: custom.model || def.model,
      budgetUsd:
        custom.budgetUsd !== undefined ? Number(custom.budgetUsd) : def.budgetUsd,
      warningPercent:
        custom.warningPercent !== undefined
          ? Number(custom.warningPercent)
          : def.warningPercent,
      tokensUsed:
        custom.tokensUsed !== undefined ? Number(custom.tokensUsed) : def.tokensUsed,
      callsCount:
        custom.callsCount !== undefined ? Number(custom.callsCount) : def.callsCount,
      usedUsd:
        custom.usedUsd !== undefined ? Number(custom.usedUsd) : def.usedUsd,
    };
  });

  // 2. Fetch API Keys pool
  const keysRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(
      and(
        eq(settings.tenantId, tenantId),
        eq(settings.key, "ai.hub.keys"),
        isNull(settings.branchId),
      ),
    )
    .get();

  let apiKeys: AiHubApiKey[] = [];
  if (keysRow?.value) {
    try {
      apiKeys = JSON.parse(keysRow.value);
    } catch {
      apiKeys = [];
    }
  }

  // 3. Compute Metrics
  const totalKeys = apiKeys.length;
  const activeKeys = apiKeys.filter((k) => k.status === "active").length;
  const totalFeatures = features.length;
  const activeFeatures = features.filter((f) => f.enabled).length;

  const totalBudgetUsd = features.reduce((sum, f) => sum + (f.budgetUsd || 0), 0);
  const costThisMonthUsd = features.reduce((sum, f) => sum + (f.usedUsd || 0), 0);
  const costThisMonthVnd = Math.round(costThisMonthUsd * USD_TO_VND_RATE);
  const budgetPercent =
    totalBudgetUsd > 0
      ? Math.min(100, (costThisMonthUsd / totalBudgetUsd) * 100)
      : 0;

  return {
    features,
    apiKeys,
    metrics: {
      totalKeys,
      activeKeys,
      totalFeatures,
      activeFeatures,
      costThisMonthUsd,
      costThisMonthVnd,
      totalBudgetUsd,
      budgetPercent,
    },
  };
}

export function updateAiHubFeature(
  db: AppDb,
  tenantId: string,
  featureId: AiHubFeatureId,
  updates: Partial<AiHubFeatureConfig>,
): AiHubData {
  const data = getAiHubData(db, tenantId);
  const existingMap: Record<string, Partial<AiHubFeatureConfig>> = {};

  for (const f of data.features) {
    existingMap[f.id] = {
      enabled: f.enabled,
      model: f.model,
      budgetUsd: f.budgetUsd,
      warningPercent: f.warningPercent,
      tokensUsed: f.tokensUsed,
      callsCount: f.callsCount,
      usedUsd: f.usedUsd,
    };
  }

  existingMap[featureId] = {
    ...existingMap[featureId],
    ...updates,
  };

  setTenantSetting(
    db,
    tenantId,
    "ai.hub.features",
    JSON.stringify(existingMap),
  );

  return getAiHubData(db, tenantId);
}

export function resetAiHubFeatureStats(
  db: AppDb,
  tenantId: string,
  featureId: AiHubFeatureId,
): AiHubData {
  return updateAiHubFeature(db, tenantId, featureId, {
    tokensUsed: 0,
    callsCount: 0,
    usedUsd: 0,
  });
}

export function addAiHubApiKey(
  db: AppDb,
  tenantId: string,
  input: {
    name: string;
    provider: "openai" | "gemini" | "anthropic" | "deepseek" | "openrouter";
    apiKey: string;
    priority?: number;
  },
): AiHubData {
  const data = getAiHubData(db, tenantId);
  const cleanKey = input.apiKey.trim();
  const id = `key_${crypto.randomUUID().slice(0, 12)}`;

  const newKey: AiHubApiKey = {
    id,
    name: input.name.trim() || `API Key ${input.provider.toUpperCase()}`,
    provider: input.provider,
    keyMasked: maskApiKey(cleanKey),
    keyEncrypted: encryptSecret(cleanKey),
    status: "active",
    priority: input.priority || data.apiKeys.length + 1,
    callCount: 0,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  const updatedKeys = [...data.apiKeys, newKey];
  setTenantSetting(db, tenantId, "ai.hub.keys", JSON.stringify(updatedKeys));

  return getAiHubData(db, tenantId);
}

export function toggleAiHubApiKey(
  db: AppDb,
  tenantId: string,
  keyId: string,
  active: boolean,
): AiHubData {
  const data = getAiHubData(db, tenantId);
  const updatedKeys = data.apiKeys.map((k) =>
    k.id === keyId ? { ...k, status: active ? ("active" as const) : ("paused" as const) } : k,
  );
  setTenantSetting(db, tenantId, "ai.hub.keys", JSON.stringify(updatedKeys));
  return getAiHubData(db, tenantId);
}

export function deleteAiHubApiKey(
  db: AppDb,
  tenantId: string,
  keyId: string,
): AiHubData {
  const data = getAiHubData(db, tenantId);
  const updatedKeys = data.apiKeys.filter((k) => k.id !== keyId);
  setTenantSetting(db, tenantId, "ai.hub.keys", JSON.stringify(updatedKeys));
  return getAiHubData(db, tenantId);
}
