import crypto from "node:crypto";
import { getEnv } from "../env";

const DEFAULT_DEV_SECRET = "studiocore-dev-webhook-secret";
const TOLERANCE_SECONDS = 5 * 60;

export function mockWebhookEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function getWebhookSecret(): string {
  return process.env.PAYMENT_WEBHOOK_SECRET?.trim() || DEFAULT_DEV_SECRET;
}

export function signWebhookBody(
  body: string,
  timestamp: number,
  secret = getWebhookSecret(),
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

export function verifyWebhookSignature(input: {
  body: string;
  timestamp: string;
  signature: string;
  now?: number;
  secret?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!mockWebhookEnabled()) {
    return { ok: false, error: "Mock webhook bị tắt ở production." };
  }
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { ok: false, error: "Timestamp webhook không hợp lệ." };
  }
  const now = input.now ?? Date.now();
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS * 1000) {
    return { ok: false, error: "Webhook đã quá cũ hoặc lệch giờ." };
  }
  const expected = signWebhookBody(
    input.body,
    timestamp,
    input.secret ?? getWebhookSecret(),
  );
  const actualBuffer = Buffer.from(input.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false, error: "Chữ ký webhook không hợp lệ." };
  }
  return { ok: true };
}

export function getMockWebhookPublicInfo(): {
  enabled: boolean;
  endpoint: string;
  secretConfigured: boolean;
} {
  void getEnv();
  return {
    enabled: mockWebhookEnabled(),
    endpoint: "/api/mock/webhook/payment",
    secretConfigured: Boolean(process.env.PAYMENT_WEBHOOK_SECRET?.trim()),
  };
}
