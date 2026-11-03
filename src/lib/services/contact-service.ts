import crypto from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { contactRequests } from "../db/schema";
import { ValidationError } from "../errors";
import { writeAudit } from "../audit";
import { normalizeVietnamesePhone } from "../utils/phone";

export type ContactInput = {
  name: string;
  email: string;
  phone: string;
  studioName: string;
  message: string;
  source: string;
};

export function createContactRequest(
  db: AppDb,
  input: ContactInput,
  ip: string,
): string {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const message = input.message.trim();
  if (name.length < 2 || name.length > 120) {
    throw new ValidationError("Tên phải từ 2–120 ký tự.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Email không hợp lệ.");
  }
  if (message.length < 10 || message.length > 3000) {
    throw new ValidationError("Nội dung cần từ 10–3.000 ký tự.");
  }
  const phone = input.phone.trim()
    ? normalizeVietnamesePhone(input.phone)
    : "";
  if (input.phone.trim() && !phone) {
    throw new ValidationError("Số điện thoại không hợp lệ.");
  }
  const phoneValue = phone ?? "";
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const recent =
    db
      .select({ value: count() })
      .from(contactRequests)
      .where(
        and(
          eq(contactRequests.ip, ip),
          gte(contactRequests.createdAt, since),
        ),
      )
      .get()?.value ?? 0;
  if (recent >= 5) {
    throw new ValidationError(
      "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 10 phút.",
    );
  }
  const id = crypto.randomUUID();
  db.insert(contactRequests)
    .values({
      id,
      name,
      email,
      phone: phoneValue,
      studioName: input.studioName.trim().slice(0, 160),
      message,
      source: input.source.trim().slice(0, 40) || "landing",
      status: "new",
      ip,
    })
    .run();
  writeAudit(db, {
    tenantId: null,
    actorId: null,
    action: "contact.request.create",
    entity: "contact_request",
    entityId: id,
    metadata: { source: input.source, email },
  });
  return id;
}
