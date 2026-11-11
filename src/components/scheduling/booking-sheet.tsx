"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  createAppointmentAction,
  updateAppointmentAction,
} from "@/lib/actions/scheduling-actions";
import { initialActionState } from "@/lib/actions/action-state";
import type { AppointmentDetail } from "@/lib/services/appointment-service";
import type { AssigneeOption, OrderOption } from "@/lib/services/order-service";
import type { RoomItem } from "@/lib/services/room-service";
import type { ServiceItem } from "@/lib/services/catalog-service";
import { toDateTimeLocalValue } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  ContractCreateModal,
  type StudioBankConfig,
} from "@/components/orders/contract-create-modal";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-[var(--danger)]">
      {message}
    </p>
  );
}

export function BookingSheet({
  orders,
  rooms,
  assignees,
  branches,
  defaultBranchId,
  defaultDate,
  appointment,
  contractModalProps,
  trigger,
}: {
  orders: OrderOption[];
  rooms: RoomItem[];
  assignees: {
    photographers: AssigneeOption[];
    editors: AssigneeOption[];
    makeup: AssigneeOption[];
  };
  branches: { id: string; name: string }[];
  defaultBranchId: string;
  defaultDate: string;
  appointment?: AppointmentDetail;
  contractModalProps?: {
    branches: { id: string; name: string }[];
    services?: ServiceItem[];
    rooms?: RoomItem[];
    assignees?: {
      photographers: AssigneeOption[];
      editors: AssigneeOption[];
      makeup: AssigneeOption[];
    };
    defaultBranchId?: string;
    studioBankConfig?: StudioBankConfig;
  };
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(appointment);
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState(
    appointment?.branchId ?? defaultBranchId,
  );
  const [orderId, setOrderId] = useState(
    appointment?.orderId ??
      orders.find((order) => order.branchId === defaultBranchId)?.id ??
      "",
  );
  const [roomId, setRoomId] = useState(
    appointment?.roomId ??
      rooms.find((room) => room.branchId === defaultBranchId)?.id ??
      "",
  );
  const [photographerId, setPhotographerId] = useState(
    appointment?.photographer?.id ?? "",
  );
  const [editorId, setEditorId] = useState(appointment?.editor?.id ?? "");
  const [makeupId, setMakeupId] = useState(appointment?.makeup?.id ?? "");
  const [startAt, setStartAt] = useState(
    appointment
      ? toDateTimeLocalValue(appointment.startAt)
      : `${defaultDate}T09:00`,
  );
  const [endAt, setEndAt] = useState(
    appointment
      ? toDateTimeLocalValue(appointment.endAt)
      : `${defaultDate}T11:00`,
  );
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateAppointmentAction(previousState, formData)
        : await createAppointmentAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu lịch hẹn.");
        setOpen(false);
        const appointmentId = result.values?.appointmentId;
        if (appointmentId) {
          router.push(`/manage/calendar/${appointmentId}`);
        }
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const branchOrders = orders.filter((order) => order.branchId === branchId);
  const branchRooms = rooms.filter(
    (room) => room.branchId === branchId && room.status === "active",
  );
  const branchPhotographers = assignees.photographers.filter((member) =>
    member.branchIds.includes(branchId),
  );
  const branchEditors = assignees.editors.filter((member) =>
    member.branchIds.includes(branchId),
  );
  const branchMakeup = assignees.makeup.filter((member) =>
    member.branchIds.includes(branchId),
  );

  function onBranchChange(nextBranchId: string) {
    setBranchId(nextBranchId);
    setOrderId(
      orders.find((order) => order.branchId === nextBranchId)?.id ?? "",
    );
    setRoomId(rooms.find((room) => room.branchId === nextBranchId)?.id ?? "");
    setPhotographerId("");
    setEditorId("");
    setMakeupId("");
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && !isEdit) {
          setIdempotencyKey(crypto.randomUUID());
          setStartAt(`${defaultDate}T09:00`);
          setEndAt(`${defaultDate}T11:00`);
        }
      }}
    >
      <SheetTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button variant={isEdit ? "outline" : "primary"} size={isEdit ? "sm" : "default"}>
            {isEdit ? (
              "Sửa lịch"
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Xếp lịch
              </>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="max-w-2xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa lịch chụp" : "Xếp lịch chụp"}</SheetTitle>
          <SheetDescription>
            Hệ thống kiểm tra phòng, photographer, makeup, editor, ca làm, nghỉ phép và buffer 30 phút trong transaction.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-4" noValidate>
          {appointment ? (
            <input type="hidden" name="appointmentId" value={appointment.id} />
          ) : (
            <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          )}

          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}
          {state.suggestions && state.suggestions.length > 0 ? (
            <Alert tone="info">
              <p className="font-medium">Khung giờ còn trống gợi ý:</p>
              <ul className="mt-1 list-inside list-disc">
                {state.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="booking-branch">Chi nhánh</Label>
              <Select
                id="booking-branch"
                name="branchId"
                value={branchId}
                onChange={(event) => onBranchChange(event.target.value)}
                className="mt-1.5"
                required
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <FieldError id="booking-branch-error" message={state.fieldErrors?.branchId} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="booking-order">Đơn hàng</Label>
                {contractModalProps && !isEdit ? (
                  <ContractCreateModal
                    {...contractModalProps}
                    defaultDate={defaultDate}
                    defaultBranchId={branchId}
                    trigger={
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        + Lên hợp đồng mới
                      </button>
                    }
                  />
                ) : null}
              </div>
              <Select
                id="booking-order"
                name="orderId"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                className="mt-1.5"
                required
              >
                <option value="">Chọn đơn hàng</option>
                {branchOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.code} · {order.customerName}
                  </option>
                ))}
              </Select>
              {branchOrders.length === 0 && !isEdit && contractModalProps && (
                <div className="mt-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2.5 text-center">
                  <p className="text-xs text-muted-foreground mb-1.5">
                    Chưa có đơn hàng nào chờ xếp lịch.
                  </p>
                  <ContractCreateModal
                    {...contractModalProps}
                    defaultDate={defaultDate}
                    defaultBranchId={branchId}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Lên Hợp Đồng Mới &amp; Xếp Lịch
                      </button>
                    }
                  />
                </div>
              )}
              <FieldError id="booking-order-error" message={state.fieldErrors?.orderId} />
            </div>

            <div>
              <Label htmlFor="booking-start">Bắt đầu</Label>
              <Input
                id="booking-start"
                name="startAt"
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className="mt-1.5"
                required
              />
              <FieldError id="booking-start-error" message={state.fieldErrors?.startAt} />
            </div>
            <div>
              <Label htmlFor="booking-end">Kết thúc</Label>
              <Input
                id="booking-end"
                name="endAt"
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className="mt-1.5"
                required
              />
              <FieldError id="booking-end-error" message={state.fieldErrors?.endAt} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="booking-room">Phòng chụp</Label>
              <Select
                id="booking-room"
                name="roomId"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                className="mt-1.5"
              >
                <option value="">Không chỉ định phòng</option>
                {branchRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} · sức chứa {room.capacity}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="booking-photographer">Photographer</Label>
              <Select
                id="booking-photographer"
                name="photographerId"
                value={photographerId}
                onChange={(event) => setPhotographerId(event.target.value)}
                className="mt-1.5"
              >
                <option value="">Chưa phân công</option>
                {branchPhotographers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="booking-editor">Retoucher / Editor</Label>
              <Select
                id="booking-editor"
                name="editorId"
                value={editorId}
                onChange={(event) => setEditorId(event.target.value)}
                className="mt-1.5"
              >
                <option value="">Chưa phân công</option>
                {branchEditors.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="booking-makeup">Makeup</Label>
              <Select
                id="booking-makeup"
                name="makeupId"
                value={makeupId}
                onChange={(event) => setMakeupId(event.target.value)}
                className="mt-1.5"
              >
                <option value="">Chưa phân công</option>
                {branchMakeup.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="booking-notes">Ghi chú</Label>
              <textarea
                id="booking-notes"
                name="notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Buffer 30 phút được áp dụng tự động giữa hai ca. Nếu trùng, hệ thống trả 409 và gợi ý khung giờ khác.
          </p>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang kiểm tra lịch...">
              {isEdit ? "Lưu lịch" : "Xếp lịch"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
