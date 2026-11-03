import Link from "next/link";
import { CalendarDays, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { BookingSheet } from "@/components/scheduling/booking-sheet";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  APPOINTMENT_STATUS_META,
  type AppointmentStatus,
} from "@/lib/scheduling/status";
import {
  formatDateKey,
  formatTimeLabel,
  getTodayKey,
} from "@/lib/scheduling/time";
import {
  getCalendarData,
  type CalendarAppointment,
  type CalendarView,
} from "@/lib/services/appointment-service";
import { orderAssigneeOptions, listOrderOptions } from "@/lib/services/order-service";
import { listRooms } from "@/lib/services/room-service";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Lịch chụp",
};

type SearchParams = {
  date?: string;
  view?: string;
  branchId?: string;
  photographerId?: string;
  roomId?: string;
};

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "timeline", label: "Timeline" },
];

function buildHref(
  current: SearchParams,
  overrides: Partial<SearchParams>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/manage/calendar?${query}` : "/manage/calendar";
}

function eventColor(colorKey: string): string {
  let hash = 0;
  for (let index = 0; index < colorKey.length; index += 1) {
    hash = (hash * 31 + colorKey.charCodeAt(index)) % 360;
  }
  return `hsl(${hash} 62% 42%)`;
}

function EventCard({
  appointment,
  compact = false,
}: {
  appointment: CalendarAppointment;
  compact?: boolean;
}) {
  const meta = APPOINTMENT_STATUS_META[appointment.status];

  return (
    <Link
      href={`/manage/calendar/${appointment.id}`}
      className={cn(
        "block rounded-lg border border-border border-l-4 bg-surface p-2.5 transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-[var(--focus)]",
        compact ? "text-xs" : "text-sm",
      )}
      style={{ borderLeftColor: eventColor(appointment.colorKey) }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold tabular-nums text-foreground">
          {formatTimeLabel(appointment.startAt)}–{formatTimeLabel(appointment.endAt)}
        </span>
        <Badge tone={meta.tone} className="px-1.5 py-0 text-[10px]">
          {meta.label}
        </Badge>
      </div>
      <p className="mt-1 truncate font-medium text-foreground">
        {appointment.customerName}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {appointment.orderCode}
        {appointment.roomName ? ` · ${appointment.roomName}` : ""}
        {appointment.photographerName ? ` · ${appointment.photographerName}` : ""}
      </p>
    </Link>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {(["scheduled", "checked_in", "completed", "cancelled"] as AppointmentStatus[]).map(
        (status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <Badge tone={APPOINTMENT_STATUS_META[status].tone}>
              {APPOINTMENT_STATUS_META[status].label}
            </Badge>
          </span>
        ),
      )}
    </div>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem lịch chụp." />;
  }

  const params = await searchParams;
  const todayKey = getTodayKey();
  const date = params.date ?? todayKey;
  const view = (VIEWS.some((item) => item.value === params.view)
    ? params.view
    : "week") as CalendarView;

  const data = getCalendarData(getDb(), actor, {
    date,
    view,
    branchId: params.branchId,
    photographerId: params.photographerId,
    roomId: params.roomId,
  });
  const rooms = listRooms(getDb(), actor);
  const assignees = orderAssigneeOptions(getDb(), actor);
  const orders = listOrderOptions(getDb(), actor);
  const canManage = hasPermission(actor.permissions, "schedule.manage");
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";
  const currentFilters: SearchParams = {
    date: data.dateKey,
    view: data.view,
    branchId: data.branchId ?? undefined,
    photographerId: data.photographerId ?? undefined,
    roomId: data.roomId ?? undefined,
  };

  return (
    <div>
      <PageHeader
        title="Lịch chụp"
        description={`${data.rangeLabel} · ${data.appointments.length} lịch trong phạm vi xem.`}
        actions={
          <>
            {canManage ? (
              <Button asChild variant="outline">
                <Link href="/manage/settings/rooms">
                  <DoorOpen className="h-4 w-4" aria-hidden="true" />
                  Phòng chụp
                </Link>
              </Button>
            ) : null}
            {canManage ? (
              <BookingSheet
                orders={orders}
                rooms={rooms}
                assignees={assignees}
                branches={actor.branches}
                defaultBranchId={defaultBranchId}
                defaultDate={data.dateKey}
              />
            ) : null}
          </>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Chế độ xem lịch">
            {VIEWS.map((item) => (
              <Button
                key={item.value}
                asChild
                variant={data.view === item.value ? "primary" : "ghost"}
                size="sm"
              >
                <Link
                  href={buildHref(currentFilters, { view: item.value })}
                  role="tab"
                  aria-selected={data.view === item.value}
                >
                  {item.label}
                </Link>
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(currentFilters, { date: data.prevDateKey })}>
                Trước
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(currentFilters, { date: todayKey, view: "day" })}>
                Hôm nay
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(currentFilters, { date: data.nextDateKey })}>
                Sau
              </Link>
            </Button>
            <span className="text-sm font-medium text-foreground">
              {data.monthLabel ?? formatDateKey(data.dateKey)}
            </span>
          </div>
        </div>

        <form method="get" className="mt-4 grid gap-3 md:grid-cols-5" aria-label="Bộ lọc lịch">
          <input type="hidden" name="view" value={data.view} />
          <div>
            <Label htmlFor="calendar-date">Ngày</Label>
            <Input
              id="calendar-date"
              name="date"
              type="date"
              defaultValue={data.dateKey}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="calendar-branch">Chi nhánh</Label>
            <Select
              id="calendar-branch"
              name="branchId"
              defaultValue={data.branchId ?? ""}
              className="mt-1.5"
            >
              {actor.role === "owner" ? <option value="">Tất cả chi nhánh</option> : null}
              {actor.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="calendar-photographer">Photographer</Label>
            <Select
              id="calendar-photographer"
              name="photographerId"
              defaultValue={data.photographerId ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {assignees.photographers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="calendar-room">Phòng</Label>
            <Select
              id="calendar-room"
              name="roomId"
              defaultValue={data.roomId ?? ""}
              className="mt-1.5"
            >
              <option value="">Tất cả</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">
              Lọc
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/manage/calendar">Xóa lọc</Link>
            </Button>
          </div>
        </form>
        <div className="mt-3">
          <StatusLegend />
        </div>
      </div>

      {data.view === "day" ? (
        <section aria-label="Lịch ngày" className="space-y-3">
          {data.appointments.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
              title="Chưa có lịch trong ngày"
              description="Chọn ngày khác hoặc dùng nút Xếp lịch để tạo buổi chụp."
            />
          ) : (
            data.appointments.map((appointment) => (
              <EventCard key={appointment.id} appointment={appointment} />
            ))
          )}
        </section>
      ) : null}

      {data.view === "week" ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <div className="grid min-w-[980px] grid-cols-7 divide-x divide-border">
            {data.days.map((day) => (
              <div key={day.dateKey} className="min-h-64 p-2">
                <div
                  className={cn(
                    "mb-2 flex items-center justify-between rounded-lg px-2 py-1 text-xs",
                    day.isToday ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="font-medium">{day.weekdayLabel}</span>
                  <span className="tabular-nums">{day.label.slice(0, 5)}</span>
                </div>
                <div className="space-y-2">
                  {day.appointments.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">Trống</p>
                  ) : (
                    day.appointments.map((appointment) => (
                      <EventCard key={appointment.id} appointment={appointment} compact />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.view === "month" ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <div className="grid min-w-[900px] grid-cols-7 border-b border-border bg-surface-muted text-center text-xs font-medium text-muted-foreground">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid min-w-[900px] grid-cols-7">
            {data.days.map((day) => (
              <div
                key={day.dateKey}
                className={cn(
                  "min-h-28 border-b border-r border-border p-1.5",
                  !day.isCurrentMonth && "bg-surface-muted/50 text-muted-foreground",
                  day.isToday && "bg-accent/40",
                )}
              >
                <Link
                  href={buildHref(currentFilters, { view: "day", date: day.dateKey })}
                  className="mb-1 inline-block rounded px-1 text-xs font-medium tabular-nums hover:text-primary"
                >
                  {day.dateKey.slice(8)}
                </Link>
                <div className="space-y-1">
                  {day.appointments.slice(0, 3).map((appointment) => (
                    <EventCard key={appointment.id} appointment={appointment} compact />
                  ))}
                  {day.appointments.length > 3 ? (
                    <p className="px-1 text-[10px] text-muted-foreground">
                      +{day.appointments.length - 3} lịch khác
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.view === "timeline" ? (
        <div className="space-y-5">
          {data.days.filter((day) => day.appointments.length > 0).length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
              title="Chưa có lịch trong 30 ngày"
              description="Dùng nút Xếp lịch để tạo buổi chụp đầu tiên trong khoảng này."
            />
          ) : (
            data.days
              .filter((day) => day.appointments.length > 0)
              .map((day) => (
                <section key={day.dateKey} aria-label={`Lịch ngày ${day.label}`}>
                  <h2 className="mb-2 text-sm font-semibold text-foreground">
                    {day.weekdayLabel}, {day.label}
                  </h2>
                  <div className="grid gap-2 lg:grid-cols-2">
                    {day.appointments.map((appointment) => (
                      <EventCard key={appointment.id} appointment={appointment} />
                    ))}
                  </div>
                </section>
              ))
          )}
        </div>
      ) : null}
    </div>
  );
}
