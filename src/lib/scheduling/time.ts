export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: VIETNAM_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function getVietnamDateKey(date: Date): string {
  const parts = dateKeyFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getTodayKey(): string {
  return getVietnamDateKey(new Date());
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+07:00`);
}

export function addDaysToKey(dateKey: string, days: number): string {
  const start = parseDateKey(dateKey);
  return getVietnamDateKey(new Date(start.getTime() + days * 24 * 60 * 60 * 1000));
}

export function getWeekdayIndex(dateKey: string): number {
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  return date.getUTCDay();
}

export function startOfWeekKey(dateKey: string): string {
  const weekday = getWeekdayIndex(dateKey);
  return addDaysToKey(dateKey, -((weekday + 6) % 7));
}

export function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function startOfMonthKey(dateKey: string): string {
  return `${getMonthKey(dateKey)}-01`;
}

export function addMonthsToKey(dateKey: string, months: number): string {
  const [yearValue, monthValue] = dateKey.split("-").map(Number);
  if (!yearValue || !monthValue) {
    return dateKey;
  }
  const date = new Date(Date.UTC(yearValue, monthValue - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getVietnamMonthRange(monthKey: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("Tháng phải có dạng YYYY-MM.");
  }
  const yearValue = Number(monthKey.slice(0, 4));
  const monthValue = Number(monthKey.slice(5, 7));
  if (monthValue < 1 || monthValue > 12) {
    throw new Error("Tháng không hợp lệ.");
  }
  return {
    start: new Date(Date.UTC(yearValue, monthValue - 1, 1) - VIETNAM_OFFSET_MS),
    end: new Date(
      Date.UTC(yearValue, monthValue, 0, 23, 59, 59, 999) - VIETNAM_OFFSET_MS,
    ),
  };
}

export function getDayRange(dateKey: string): { start: Date; end: Date } {
  return {
    start: parseDateKey(dateKey),
    end: parseDateKey(addDaysToKey(dateKey, 1)),
  };
}

export function getWeekRange(dateKey: string): { start: Date; end: Date } {
  const startKey = startOfWeekKey(dateKey);
  return { start: parseDateKey(startKey), end: parseDateKey(addDaysToKey(startKey, 7)) };
}

export function getMonthGridRange(dateKey: string): {
  start: Date;
  end: Date;
  monthKey: string;
} {
  const monthKey = getMonthKey(dateKey);
  const first = startOfMonthKey(dateKey);
  const gridStart = startOfWeekKey(first);
  return {
    start: parseDateKey(gridStart),
    end: parseDateKey(addDaysToKey(gridStart, 42)),
    monthKey,
  };
}

export function getDateKeysInRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let current = startKey;
  let guard = 0;
  while (current < endKey && guard < 366) {
    keys.push(current);
    current = addDaysToKey(current, 1);
    guard += 1;
  }
  return keys;
}

export function formatDateKey(dateKey: string): string {
  const [yearValue, monthValue, dayValue] = dateKey.split("-");
  return `${dayValue}/${monthValue}/${yearValue}`;
}

export function formatWeekdayLabel(dateKey: string): string {
  const weekday = getWeekdayIndex(dateKey);
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][weekday] ?? "";
}

export function formatMonthLabel(dateKey: string): string {
  const [yearValue, monthValue] = dateKey.split("-");
  return `Tháng ${Number(monthValue)}/${yearValue}`;
}

export function getLocalMinutes(date: Date): number {
  const parts = timeFormatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function formatTimeLabel(date: Date): string {
  return timeFormatter.format(date);
}

export function getWorkingHoursForDate(
  workingHoursJson: string,
  dateKey: string,
): string | null {
  try {
    const values = JSON.parse(workingHoursJson) as Record<string, string>;
    const weekday = WEEKDAY_KEYS[getWeekdayIndex(dateKey)];
    const value = weekday ? values[weekday] : undefined;
    if (!value || value === "closed") {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function isWithinWorkingHours(
  workingHoursJson: string,
  start: Date,
  end: Date,
): boolean {
  const startKey = getVietnamDateKey(start);
  const endKey = getVietnamDateKey(end);
  if (startKey !== endKey) {
    return false;
  }

  const window = getWorkingHoursForDate(workingHoursJson, startKey);
  if (!window) {
    return false;
  }

  const [openValue, closeValue] = window.split("-");
  if (!openValue || !closeValue) {
    return false;
  }
  const [openHour, openMinute] = openValue.split(":").map(Number);
  const [closeHour, closeMinute] = closeValue.split(":").map(Number);
  const open = (openHour ?? 0) * 60 + (openMinute ?? 0);
  const close = (closeHour ?? 0) * 60 + (closeMinute ?? 0);
  const startMinutes = getLocalMinutes(start);
  const endMinutes = getLocalMinutes(end);

  return startMinutes >= open && endMinutes <= close;
}

export function combineDateKeyTime(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}:00+07:00`);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function formatDateRangeLabel(startKey: string, endKey: string): string {
  return `${formatDateKey(startKey)} – ${formatDateKey(addDaysToKey(endKey, -1))}`;
}
