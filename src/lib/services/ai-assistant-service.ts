import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { branches, settings } from "../db/schema";
import { setTenantSetting } from "./settings-write-service";

export type BranchItem = {
  id: string;
  name: string;
  enabled: boolean;
};

export type AiAssistantSettings = {
  enabled: boolean;
  paused: boolean;
  webhookUrl: string;
  hmacSecret: string;
  agentKey: string | null;
  branches: BranchItem[];
};

export function generateHmacSecret(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function generateDraftWriterKey(db: AppDb, tenantId: string): string {
  const newKey = `scmcp_draft_writer_${crypto.randomBytes(16).toString("hex")}`;
  setTenantSetting(db, tenantId, "ai_assistant.agent_key", newKey);
  return newKey;
}

export function getAiAssistantSettings(
  db: AppDb,
  tenantId: string,
): AiAssistantSettings {
  // Enabled
  const enabledRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "ai_assistant.enabled")))
    .get();
  const enabled = enabledRow?.value === "true";

  // Paused
  const pausedRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "ai_assistant.paused")))
    .get();
  const paused = pausedRow?.value === "true";

  // Webhook URL
  const webhookRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "ai_assistant.webhook_url")))
    .get();
  const webhookUrl = webhookRow?.value || "";

  // HMAC Secret
  const hmacRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "ai_assistant.hmac_secret")))
    .get();
  const hmacSecret = hmacRow?.value || "";

  // Agent Key
  const agentKeyRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "ai_assistant.agent_key")))
    .get();
  const agentKey = agentKeyRow?.value || null;

  // Active branches
  const activeBranchesRow = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "ai_assistant.active_branches")))
    .get();

  let activeBranchIds: string[] = [];
  if (activeBranchesRow?.value) {
    try {
      activeBranchIds = JSON.parse(activeBranchesRow.value) as string[];
    } catch {
      activeBranchIds = [];
    }
  }

  // Tenant branches
  const tenantBranches = db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(eq(branches.tenantId, tenantId))
    .all();

  const branchItems: BranchItem[] = tenantBranches.map((b) => ({
    id: b.id,
    name: b.name,
    enabled: activeBranchIds.includes(b.id),
  }));

  // If no branch found, supply default "Cửa hàng chính"
  if (branchItems.length === 0) {
    branchItems.push({
      id: "default-branch",
      name: "Cửa hàng chính",
      enabled: activeBranchIds.includes("default-branch"),
    });
  }

  return {
    enabled,
    paused,
    webhookUrl,
    hmacSecret,
    agentKey,
    branches: branchItems,
  };
}

export function setAiAssistantEnabled(
  db: AppDb,
  tenantId: string,
  enabled: boolean,
): void {
  setTenantSetting(db, tenantId, "ai_assistant.enabled", enabled ? "true" : "false");
}

export function setAiAssistantPaused(
  db: AppDb,
  tenantId: string,
  paused: boolean,
): void {
  setTenantSetting(db, tenantId, "ai_assistant.paused", paused ? "true" : "false");
}

export function toggleBranchAiAssistant(
  db: AppDb,
  tenantId: string,
  branchId: string,
  enabled: boolean,
): void {
  const current = getAiAssistantSettings(db, tenantId);
  const currentActive = current.branches.filter((b) => b.enabled).map((b) => b.id);
  let updated: string[];

  if (enabled) {
    updated = Array.from(new Set([...currentActive, branchId]));
  } else {
    updated = currentActive.filter((id) => id !== branchId);
  }

  setTenantSetting(
    db,
    tenantId,
    "ai_assistant.active_branches",
    JSON.stringify(updated),
  );
}

export function saveAiAssistantWebhook(
  db: AppDb,
  tenantId: string,
  webhookUrl: string,
  hmacSecret: string,
): void {
  setTenantSetting(db, tenantId, "ai_assistant.webhook_url", webhookUrl.trim());
  setTenantSetting(db, tenantId, "ai_assistant.hmac_secret", hmacSecret.trim());
}
