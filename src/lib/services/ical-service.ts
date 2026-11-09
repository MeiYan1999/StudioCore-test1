import crypto from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import {
  appointments,
  branches,
  customers,
  orders,
  rooms,
  settings,
  staff,
} from "../db/schema";
import { setTenantSetting } from "./settings-write-service";
import { APPOINTMENT_STATUS_META } from "../scheduling/status";

export function formatIcsDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

export function getOrCreateCalendarFeedToken(db: AppDb, tenantId: string): string {
  const existing = db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "calendar.feed_token")))
    .get();

  if (existing?.value?.trim()) {
    return existing.value.trim();
  }

  const token = crypto.randomBytes(20).toString("hex");
  setTenantSetting(db, tenantId, "calendar.feed_token", token);
  return token;
}

export function regenerateCalendarFeedToken(db: AppDb, tenantId: string): string {
  const token = crypto.randomBytes(20).toString("hex");
  setTenantSetting(db, tenantId, "calendar.feed_token", token);
  return token;
}

export function generateCalendarIcs(
  db: AppDb,
  feedToken: string,
): { icsContent: string; studioName: string } | null {
  const cleanToken = feedToken.trim();
  if (!cleanToken) return null;

  const foundSetting = db
    .select({ tenantId: settings.tenantId })
    .from(settings)
    .where(and(eq(settings.key, "calendar.feed_token"), eq(settings.value, cleanToken)))
    .get();

  if (!foundSetting) return null;

  const tenantId = foundSetting.tenantId;

  const studioName =
    db
      .select({ value: settings.value })
      .from(settings)
      .where(and(eq(settings.tenantId, tenantId), eq(settings.key, "studio.name")))
      .get()?.value || "StudioCore";

  const appts = db
    .select({
      id: appointments.id,
      startAt: appointments.startAt,
      endAt: appointments.endAt,
      status: appointments.status,
      notes: appointments.notes,
      updatedAt: appointments.updatedAt,
      orderCode: orders.code,
      customerName: customers.name,
      customerPhone: customers.phone,
      branchName: branches.name,
      roomName: rooms.name,
      photographerName: staff.name,
    })
    .from(appointments)
    .innerJoin(orders, eq(appointments.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .innerJoin(branches, eq(appointments.branchId, branches.id))
    .leftJoin(rooms, eq(appointments.roomId, rooms.id))
    .leftJoin(staff, eq(appointments.photographerId, staff.id))
    .where(and(eq(appointments.tenantId, tenantId), isNull(appointments.archivedAt)))
    .orderBy(desc(appointments.startAt))
    .limit(500)
    .all();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudioCore//Calendar Sync 1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(`StudioCore - ${studioName}`)}`,
    "X-WR-TIMEZONE:Asia/Ho_Chi_Minh",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const appt of appts) {
    const statusMeta = APPOINTMENT_STATUS_META[appt.status];
    const summary = `[${statusMeta.label}] ${appt.orderCode} - ${appt.customerName}`;
    const descLines: string[] = [
      `Khách hàng: ${appt.customerName}`,
      `Số điện thoại: ${appt.customerPhone}`,
      `Chi nhánh: ${appt.branchName}`,
      appt.roomName ? `Phòng: ${appt.roomName}` : null,
      appt.photographerName ? `Photographer: ${appt.photographerName}` : null,
      `Trạng thái: ${statusMeta.label}`,
      appt.notes ? `Ghi chú: ${appt.notes}` : null,
    ].filter(Boolean) as string[];

    const location = [appt.branchName, appt.roomName].filter(Boolean).join(" - ");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${appt.id}@studiocore.io.vn`,
      `DTSTAMP:${formatIcsDateTime(appt.updatedAt || appt.startAt)}`,
      `DTSTART:${formatIcsDateTime(appt.startAt)}`,
      `DTEND:${formatIcsDateTime(appt.endAt)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descLines.join("\n"))}`,
      `LOCATION:${escapeIcsText(location)}`,
      `STATUS:${appt.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR", "");

  return {
    icsContent: lines.join("\r\n"),
    studioName,
  };
}

export function buildGoogleCalendarEventUrl(appointment: {
  orderCode: string;
  customerName: string;
  customerPhone?: string;
  startAt: Date;
  endAt: Date;
  branchName?: string;
  roomName?: string;
  photographerName?: string;
  notes?: string;
}): string {
  const title = `Lịch chụp: ${appointment.orderCode} - ${appointment.customerName}`;
  const startIso = formatIcsDateTime(appointment.startAt);
  const endIso = formatIcsDateTime(appointment.endAt);
  const details = [
    `Khách hàng: ${appointment.customerName}`,
    appointment.customerPhone ? `SĐT: ${appointment.customerPhone}` : null,
    appointment.branchName ? `Chi nhánh: ${appointment.branchName}` : null,
    appointment.roomName ? `Phòng chụp: ${appointment.roomName}` : null,
    appointment.photographerName ? `Photographer: ${appointment.photographerName}` : null,
    appointment.notes ? `Ghi chú: ${appointment.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const location = [appointment.branchName, appointment.roomName].filter(Boolean).join(" - ");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${startIso}/${endIso}`,
    details,
    location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildGoogleCalendarSubscribeUrl(feedUrl: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl)}`;
}
