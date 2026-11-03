import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { getEnv } from "../env";

const FORMAT_VERSION = "v1";
const SALT = "studiocore-secret-storage-v1";

function deriveKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY?.trim() || getEnv().AUTH_SECRET;
  if (secret.length < 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY hoặc AUTH_SECRET phải dài tối thiểu 32 ký tự.",
    );
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    FORMAT_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(payload: string | null): string | null {
  if (!payload) {
    return null;
  }
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    return null;
  }
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ciphertext = Buffer.from(parts[3], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}
