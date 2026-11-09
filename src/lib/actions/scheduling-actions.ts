"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fieldErrorsFromZod,
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import {
  AuthorizationError,
  BookingConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  cancelAppointment,
  checkInAppointment,
  checkOutAppointment,
  createAppointment,
  updateAppointment,
} from "@/lib/services/appointment-service";
import { regenerateCalendarFeedToken } from "@/lib/services/ical-service";
import { createRoom, updateRoom } from "@/lib/services/room-service";
import { getDb } from "@/lib/db/client";
import { parseVietnamDateTimeLocal } from "@/lib/utils";
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  roomSchema,
} from "@/lib/validators/scheduling";

function errorMessage(error: unknown): string {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

function appointmentValues(formData: FormData): Record<string, string> {
  const keys = [
    "branchId",
    "orderId",
    "roomId",
    "photographerId",
    "makeupId",
    "editorId",
    "startAt",
    "endAt",
    "notes",
    "idempotencyKey",
  ];
  return Object.fromEntries(keys.map((key) => [key, getFormString(formData, key)]));
}

function parseAppointmentDates(values: Record<string, string>): {
  startAt: string;
  endAt: string;
} | null {
  const start = parseVietnamDateTimeLocal(values.startAt);
  const end = parseVietnamDateTimeLocal(values.endAt);
  if (!start || !end) {
    return null;
  }
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export async function createRoomAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = Object.fromEntries(
    ["branchId", "name", "capacity", "status", "notes"].map((key) => [
      key,
      getFormString(formData, key),
    ]),
  );
  const parsed = roomSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin phòng chụp.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createRoom(getDb(), actor, {
      ...parsed.data,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/settings/rooms");
    revalidatePath("/manage/calendar");
    return { status: "success", message: "Đã thêm phòng chụp.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateRoomAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const roomId = getFormString(formData, "roomId");
  const values = Object.fromEntries(
    ["branchId", "name", "capacity", "status", "notes"].map((key) => [
      key,
      getFormString(formData, key),
    ]),
  );
  const parsed = roomSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin phòng chụp.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateRoom(getDb(), actor, roomId, {
      ...parsed.data,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/settings/rooms");
    revalidatePath("/manage/calendar");
    return { status: "success", message: "Đã cập nhật phòng chụp.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function createAppointmentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = appointmentValues(formData);
  const parsed = appointmentCreateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin lịch hẹn.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  const dates = parseAppointmentDates(values);
  if (!dates) {
    return { status: "error", message: "Khung giờ hẹn không hợp lệ.", values };
  }

  try {
    const result = await createAppointment(getDb(), actor, {
      orderId: parsed.data.orderId,
      branchId: parsed.data.branchId,
      roomId: parsed.data.roomId || "",
      photographerId: parsed.data.photographerId || null,
      makeupId: parsed.data.makeupId || null,
      editorId: parsed.data.editorId || null,
      startAt: dates.startAt,
      endAt: dates.endAt,
      notes: parsed.data.notes || "",
      idempotencyKey: parsed.data.idempotencyKey,
    });
    revalidatePath("/manage/calendar");
    revalidatePath(`/manage/calendar/${result.appointmentId}`);
    revalidatePath(`/manage/orders/${parsed.data.orderId}`);
    return {
      status: "success",
      message: "Đã xếp lịch chụp.",
      values: { ...values, appointmentId: result.appointmentId },
    };
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return {
        status: "error",
        message: error.message,
        suggestions: error.suggestions,
        values,
      };
    }
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateAppointmentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const appointmentId = getFormString(formData, "appointmentId");
  const values = appointmentValues(formData);
  const parsed = appointmentUpdateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin lịch hẹn.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  const dates = parseAppointmentDates(values);
  if (!dates) {
    return { status: "error", message: "Khung giờ hẹn không hợp lệ.", values };
  }

  try {
    await updateAppointment(getDb(), actor, appointmentId, {
      orderId: parsed.data.orderId,
      branchId: parsed.data.branchId,
      roomId: parsed.data.roomId || "",
      photographerId: parsed.data.photographerId || null,
      makeupId: parsed.data.makeupId || null,
      editorId: parsed.data.editorId || null,
      startAt: dates.startAt,
      endAt: dates.endAt,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/calendar");
    revalidatePath(`/manage/calendar/${appointmentId}`);
    revalidatePath(`/manage/orders/${parsed.data.orderId}`);
    return {
      status: "success",
      message: "Đã cập nhật lịch hẹn.",
      values: { ...values, appointmentId },
    };
  } catch (error) {
    if (error instanceof BookingConflictError) {
      return {
        status: "error",
        message: error.message,
        suggestions: error.suggestions,
        values,
      };
    }
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const actor = await getActorContext();
  if (!actor) redirect("/login");

  const appointmentId = getFormString(formData, "appointmentId");
  const reason = getFormString(formData, "reason");

  try {
    cancelAppointment(getDb(), actor, appointmentId, reason);
  } catch (error) {
    redirect(
      `/manage/calendar/${appointmentId}?error=${encodeURIComponent(errorMessage(error))}`,
    );
  }

  revalidatePath("/manage/calendar");
  revalidatePath(`/manage/calendar/${appointmentId}`);
  redirect(`/manage/calendar/${appointmentId}?cancelled=1`);
}

async function checkInOutAction(
  formData: FormData,
  action: "checkIn" | "checkOut",
): Promise<void> {
  const actor = await getActorContext();
  if (!actor) redirect("/login");

  const appointmentId = getFormString(formData, "appointmentId");

  try {
    if (action === "checkIn") {
      checkInAppointment(getDb(), actor, appointmentId);
    } else {
      checkOutAppointment(getDb(), actor, appointmentId);
    }
  } catch (error) {
    redirect(
      `/manage/calendar/${appointmentId}?error=${encodeURIComponent(errorMessage(error))}`,
    );
  }

  revalidatePath("/manage/calendar");
  revalidatePath(`/manage/calendar/${appointmentId}`);
  redirect(
    `/manage/calendar/${appointmentId}?${action === "checkIn" ? "checkedIn" : "checkedOut"}=1`,
  );
}

export async function checkInAppointmentAction(formData: FormData): Promise<void> {
  await checkInOutAction(formData, "checkIn");
}

export async function checkOutAppointmentAction(formData: FormData): Promise<void> {
  await checkInOutAction(formData, "checkOut");
}

export async function regenerateCalendarFeedTokenAction(): Promise<{
  ok: boolean;
  feedToken?: string;
  error?: string;
}> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  try {
    const newToken = regenerateCalendarFeedToken(getDb(), actor.tenantId);
    revalidatePath("/manage/calendar");
    return { ok: true, feedToken: newToken };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

