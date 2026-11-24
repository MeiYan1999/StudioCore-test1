import { ValidationError } from "../errors";

export function normalizeIdempotencyKey(value: string): string {
  const key = value.trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) {
    throw new ValidationError("Mã yêu cầu không hợp lệ, vui lòng tải lại trang.");
  }
  return key;
}
