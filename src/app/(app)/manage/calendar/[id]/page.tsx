import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, DoorOpen, MapPin, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { SubmitButton } from "@/components/shared/submit-button";
import { BookingSheet } from "@/components/scheduling/booking-sheet";
import { CancelAppointmentDialog } from "@/components/scheduling/cancel-appointment-dialog";
import {
  checkInAppointmentAction,
  checkOutAppointmentAction,
} from "@/lib/actions/scheduling-actions";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { ORDER_STATUS_META } from "@/lib/orders/status";
import {
  APPOINTMENT_STATUS_META,
} from "@/lib/scheduling/status";
import { formatDateKey, getVietnamDateKey } from "@/lib/scheduling/time";
import { formatDateTime } from "@/lib/utils";
import { getAppointmentDetail } from "@/lib/services/appointment-service";
import { listOrderOptions, orderAssigneeOptions } from "@/lib/services/order-service";
import { listRooms } from "@/lib/services/room-service";

export const metadata = {
  title: "Chi tiết lịch chụp",
};

export default async function AppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    checkedIn?: string;
    checkedOut?: string;
    cancelled?: string;
  }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "schedule.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem lịch chụp." />;
  }

  const { id } = await params;
  const messages = await searchParams;
  const appointment = getAppointmentDetail(getDb(), actor, id);
  if (!appointment) notFound();

  const canManage = hasPermission(actor.permissions, "schedule.manage");
  const canCheck =
    canManage || appointment.photographer?.id === actor.staffId;
  const statusMeta = APPOINTMENT_STATUS_META[appointment.status];
  const dateKey = getVietnamDateKey(appointment.startAt);
  const rooms = listRooms(getDb(), actor);
  const orders = listOrderOptions(getDb(), actor);
  const assignees = orderAssigneeOptions(getDb(), actor);

  return (
    <div>
      <PageHeader
        title={`Buổi chụp · ${appointment.orderCode}`}
        description={`${appointment.customerName} · ${formatDateTime(appointment.startAt)} · ${appointment.branchName}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/manage/calendar">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Về lịch
              </Link>
            </Button>
            {canManage && appointment.status === "scheduled" ? (
              <BookingSheet
                appointment={appointment}
                orders={orders}
                rooms={rooms}
                assignees={assignees}
                branches={actor.branches}
                defaultBranchId={appointment.branchId}
                defaultDate={dateKey}
              />
            ) : null}
          </>
        }
      />

      {messages.error ? (
        <Alert tone="danger" className="mb-4">{messages.error}</Alert>
      ) : null}
      {messages.checkedIn ? (
        <Alert tone="success" className="mb-4">Đã check-in buổi chụp.</Alert>
      ) : null}
      {messages.checkedOut ? (
        <Alert tone="success" className="mb-4">Đã check-out buổi chụp.</Alert>
      ) : null}
      {messages.cancelled ? (
        <Alert tone="success" className="mb-4">Đã hủy lịch chụp.</Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Thông tin buổi chụp</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateKey(dateKey)} · {appointment.branchName}
                </p>
              </div>
              <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  Thời gian
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDateTime(appointment.startAt)} → {formatDateTime(appointment.endAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Buffer {appointment.bufferMinutes} phút
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DoorOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Phòng chụp
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {appointment.roomName ?? "Không chỉ định phòng"}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Photographer
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {appointment.photographer?.name ?? "Chưa phân công"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Makeup</p>
                <p className="mt-1 text-sm text-foreground">
                  {appointment.makeup?.name ?? "Chưa phân công"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Retoucher / Editor</p>
                <p className="mt-1 text-sm text-foreground">
                  {appointment.editor?.name ?? "Chưa phân công"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Trạng thái đơn</p>
                <p className="mt-1 text-sm text-foreground">
                  {ORDER_STATUS_META[appointment.orderStatus].label}
                </p>
              </div>
              {appointment.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Ghi chú</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {appointment.notes}
                  </p>
                </div>
              ) : null}
              {appointment.cancelReason ? (
                <div className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-[var(--danger)] dark:bg-red-950/30">
                  <p className="font-medium">Lý do hủy</p>
                  <p className="mt-1">{appointment.cancelReason}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thời gian thực tế</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Check-in</p>
                <p className="mt-1 font-medium text-foreground">
                  {appointment.checkInAt ? formatDateTime(appointment.checkInAt) : "Chưa check-in"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Check-out</p>
                <p className="mt-1 font-medium text-foreground">
                  {appointment.checkOutAt ? formatDateTime(appointment.checkOutAt) : "Chưa check-out"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Khách hàng & đơn hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Khách hàng</p>
                <Link
                  href={`/manage/customers/${appointment.customerId}`}
                  className="mt-1 block font-medium text-foreground hover:text-primary"
                >
                  {appointment.customerName}
                </Link>
                <p className="tabular-nums text-muted-foreground">{appointment.customerPhone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Đơn hàng</p>
                <Link
                  href={`/manage/orders/${appointment.orderId}`}
                  className="mt-1 block font-mono text-sm font-medium text-foreground hover:text-primary"
                >
                  {appointment.orderCode}
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thao tác</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {appointment.status === "scheduled" && canCheck ? (
                <form action={checkInAppointmentAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <SubmitButton pendingLabel="Đang check-in...">
                    Check-in buổi chụp
                  </SubmitButton>
                </form>
              ) : null}
              {appointment.status === "checked_in" && canCheck ? (
                <form action={checkOutAppointmentAction}>
                  <input type="hidden" name="appointmentId" value={appointment.id} />
                  <SubmitButton pendingLabel="Đang check-out...">
                    Check-out buổi chụp
                  </SubmitButton>
                </form>
              ) : null}
              {appointment.status === "completed" ? (
                <p className="text-sm text-muted-foreground">
                  Buổi chụp đã hoàn tất. Đơn hàng đã chuyển sang bước hậu kỳ.
                </p>
              ) : null}
              {appointment.status === "cancelled" ? (
                <p className="text-sm text-muted-foreground">Lịch đã hủy.</p>
              ) : null}
              {canManage && appointment.status === "scheduled" ? (
                <CancelAppointmentDialog appointmentId={appointment.id} />
              ) : null}
              {!canCheck && appointment.status !== "completed" ? (
                <p className="text-xs text-muted-foreground">
                  Bạn chỉ có quyền xem lịch này.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quy tắc lịch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                Kiểm tra giờ làm việc, ca làm và nghỉ phép.
              </p>
              <p>Xung đột phòng/nhân sự bị chặn trong transaction ghi.</p>
              <p>Buffer 30 phút áp dụng giữa hai ca.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
