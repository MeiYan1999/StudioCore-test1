import { createHash, randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "../security/secret-crypto";

const TOKEN_BYTES = 24;

export function generateShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashShareToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function createShareTokenRecord(rawToken = generateShareToken()): {
  rawToken: string;
  tokenHash: string;
  tokenEncrypted: string;
} {
  return {
    rawToken,
    tokenHash: hashShareToken(rawToken),
    tokenEncrypted: encryptSecret(rawToken),
  };
}

export function revealShareToken(tokenEncrypted: string | null): string | null {
  return decryptSecret(tokenEncrypted);
}

export function shareLinkFor(rawToken: string): string {
  return `/share/${rawToken}`;
}
