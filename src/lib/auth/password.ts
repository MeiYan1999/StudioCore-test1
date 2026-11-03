import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifySecret(secret: string, stored: string | null): boolean {
  if (!stored) {
    return false;
  }

  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = parts[1];
  const expected = parts[2];
  if (!salt || !expected) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "hex");
  if (expectedBuffer.length !== KEY_LENGTH) {
    return false;
  }

  const actualBuffer = scryptSync(secret, salt, KEY_LENGTH);
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
