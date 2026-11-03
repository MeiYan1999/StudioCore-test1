"use server";

import { revalidatePath } from "next/cache";
import {
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  createLeaveRequest,
  recordCheckIn,
  recordCheckOut,
  setLeaveStatus,
  updateStaffBaseSalary,
} from "@/lib/services/hr-service";
import {
  approveCommission,
  generatePayrolls,
  markCommissionPaid,
  saveCommissionRule,
  setPayrollStatus,
  updatePayroll,
} from "@/lib/services/commission-payroll-service";

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

export async function checkInAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    recordCheckIn(getDb(), actor, {
      staffId: getFormString(formData, "staffId"),
      branchId: getFormString(formData, "branchId"),
      method: getFormString(formData, "method") as "manual" | "gps" | "qr",
      checkIn: getFormString(formData, "checkIn"),
      latitude: getFormString(formData, "latitude"),
      longitude: getFormString(formData, "longitude"),
      device: getFormString(formData, "device"),
      notes: getFormString(formData, "notes"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/staff/attendance");
  return { status: "success", message: "Đã check-in." };
}

export async function checkOutAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    recordCheckOut(
      getDb(),
      actor,
      getFormString(formData, "attendanceId"),
      getFormString(formData, "checkOut"),
      getFormString(formData, "notes"),
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/staff/attendance");
  return { status: "success", message: "Đã check-out." };
}

export async function createLeaveAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    createLeaveRequest(getDb(), actor, {
      staffId: getFormString(formData, "staffId"),
      branchId: getFormString(formData, "branchId"),
      startAt: getFormString(formData, "startAt"),
      endAt: getFormString(formData, "endAt"),
      reason: getFormString(formData, "reason"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/staff/leave");
  return { status: "success", message: "Đã gửi đơn nghỉ." };
}

export async function setLeaveStatusAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const status = getFormString(formData, "status");
  if (status !== "approved" && status !== "rejected") {
    return { status: "error", message: "Trạng thái không hợp lệ." };
  }
  try {
    setLeaveStatus(
      getDb(),
      actor,
      getFormString(formData, "leaveId"),
      status,
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/staff/leave");
  return { status: "success", message: "Đã cập nhật đơn nghỉ." };
}

export async function updateStaffSalaryAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    updateStaffBaseSalary(
      getDb(),
      actor,
      getFormString(formData, "staffId"),
      Number(getFormString(formData, "baseSalary")),
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/staff");
  return { status: "success", message: "Đã cập nhật lương cơ bản." };
}

export async function saveCommissionRuleAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const type = getFormString(formData, "type");
  if (type !== "fixed" && type !== "percent") {
    return { status: "error", message: "Loại commission không hợp lệ." };
  }
  try {
    saveCommissionRule(getDb(), actor, {
      id: getFormString(formData, "ruleId") || undefined,
      name: getFormString(formData, "name"),
      role: getFormString(formData, "role"),
      type,
      value: Number(getFormString(formData, "value")),
      effectiveFrom: getFormString(formData, "effectiveFrom"),
      active: getFormString(formData, "active") !== "off",
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance/commissions");
  return { status: "success", message: "Đã lưu rule hoa hồng." };
}

export async function approveCommissionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    approveCommission(getDb(), actor, getFormString(formData, "commissionId"));
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance/commissions");
  return { status: "success", message: "Đã duyệt hoa hồng." };
}

export async function payCommissionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    markCommissionPaid(getDb(), actor, getFormString(formData, "commissionId"));
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance/commissions");
  return { status: "success", message: "Đã chi trả hoa hồng." };
}

export async function generatePayrollsAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    const result = generatePayrolls(
      getDb(),
      actor,
      getFormString(formData, "period"),
    );
    revalidatePath("/manage/payroll");
    return {
      status: "success",
      message: `Đã tạo ${result.created} bảng lương, bỏ qua ${result.skipped}.`,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function updatePayrollAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    updatePayroll(getDb(), actor, getFormString(formData, "payrollId"), {
      bonus: Number(getFormString(formData, "bonus") || "0"),
      deduction: Number(getFormString(formData, "deduction") || "0"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/payroll");
  return { status: "success", message: "Đã cập nhật bảng lương." };
}

export async function setPayrollStatusAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const status = getFormString(formData, "status");
  if (status !== "pending" && status !== "approved" && status !== "paid") {
    return { status: "error", message: "Trạng thái bảng lương không hợp lệ." };
  }
  try {
    setPayrollStatus(
      getDb(),
      actor,
      getFormString(formData, "payrollId"),
      status,
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/payroll");
  return { status: "success", message: "Đã cập nhật trạng thái bảng lương." };
}
