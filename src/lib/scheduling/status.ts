export const APPOINTMENT_STATUSES = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type AppointmentStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export const APPOINTMENT_STATUS_META: Record<
  AppointmentStatus,
  { label: string; tone: AppointmentStatusTone }
> = {
  scheduled: { label: "Đã lên lịch", tone: "info" },
  checked_in: { label: "Đã check-in", tone: "warning" },
  completed: { label: "Đã hoàn tất", tone: "success" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
  no_show: { label: "Khách không đến", tone: "danger" },
};

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return (APPOINTMENT_STATUSES as readonly string[]).includes(value);
}
