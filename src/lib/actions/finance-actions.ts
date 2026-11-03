"use server";

import { revalidatePath } from "next/cache";
import {
  fieldErrorsFromZod,
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  buildVietQrForOrder,
  createExpense,
  createInvoiceForOrder,
  createManualTransaction,
  recordRefund,
  remindDebt,
  saveBudget,
  updateInvoiceStatus,
} from "@/lib/services/finance-service";
import {
  budgetSchema,
  expenseSchema,
  invoiceSchema,
  invoiceStatusSchema,
  manualTransactionSchema,
  refundSchema,
} from "@/lib/validators/finance";
import { signWebhookBody } from "@/lib/finance/webhook";
import crypto from "node:crypto";

function errorMessage(error: unknown): string {
  if (
    error instanceof AuthorizationError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  ) {
    return error.message;
  }
  return "Không thể thực hiện thao tác tài chính. Vui lòng thử lại.";
}

export async function createTransactionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const parsed = manualTransactionSchema.safeParse({
    type: getFormString(formData, "type"),
    branchId: getFormString(formData, "branchId"),
    category: getFormString(formData, "category"),
    amount: getFormString(formData, "amount"),
    method: getFormString(formData, "method"),
    description: getFormString(formData, "description"),
    reference: getFormString(formData, "reference"),
    occurredAt: getFormString(formData, "occurredAt"),
    orderId: getFormString(formData, "orderId"),
    customerId: getFormString(formData, "customerId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra giao dịch.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  try {
    createManualTransaction(getDb(), actor, {
      type: parsed.data.type,
      branchId: parsed.data.branchId,
      category: parsed.data.category,
      amount: parsed.data.amount,
      method: parsed.data.method,
      description: parsed.data.description || "",
      reference: parsed.data.reference || "",
      occurredAt: parsed.data.occurredAt || "",
      orderId: parsed.data.orderId || "",
      customerId: parsed.data.customerId || "",
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance");
  return { status: "success", message: "Đã ghi nhận giao dịch." };
}

export async function createExpenseAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const parsed = expenseSchema.safeParse({
    branchId: getFormString(formData, "branchId"),
    category: getFormString(formData, "category"),
    amount: getFormString(formData, "amount"),
    vendor: getFormString(formData, "vendor"),
    description: getFormString(formData, "description"),
    occurredAt: getFormString(formData, "occurredAt"),
    method: getFormString(formData, "method"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra khoản chi.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  try {
    createExpense(getDb(), actor, {
      branchId: parsed.data.branchId,
      category: parsed.data.category,
      amount: parsed.data.amount,
      vendor: parsed.data.vendor || "",
      description: parsed.data.description || "",
      occurredAt: parsed.data.occurredAt || "",
      method: parsed.data.method,
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance");
  return { status: "success", message: "Đã ghi nhận khoản chi." };
}

export async function saveBudgetAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const parsed = budgetSchema.safeParse({
    branchId: getFormString(formData, "branchId"),
    category: getFormString(formData, "category"),
    period: getFormString(formData, "period"),
    amount: getFormString(formData, "amount"),
    notes: getFormString(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra ngân sách.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  try {
    saveBudget(getDb(), actor, {
      branchId: parsed.data.branchId || "",
      category: parsed.data.category,
      period: parsed.data.period,
      amount: parsed.data.amount,
      notes: parsed.data.notes || "",
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance");
  return { status: "success", message: "Đã lưu ngân sách." };
}

export async function createInvoiceAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const parsed = invoiceSchema.safeParse({
    orderId: getFormString(formData, "orderId"),
    vatRate: getFormString(formData, "vatRate"),
    notes: getFormString(formData, "notes"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra hóa đơn.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  try {
    const invoiceId = createInvoiceForOrder(getDb(), actor, {
      orderId: parsed.data.orderId,
      vatRate: parsed.data.vatRate,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/finance/invoices");
    return {
      status: "success",
      message: "Đã tạo hóa đơn.",
      values: { id: invoiceId },
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

export async function updateInvoiceStatusAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const parsed = invoiceStatusSchema.safeParse({
    invoiceId: getFormString(formData, "invoiceId"),
    status: getFormString(formData, "status"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Yêu cầu không hợp lệ." };
  }
  try {
    updateInvoiceStatus(getDb(), actor, parsed.data.invoiceId, parsed.data.status);
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance/invoices");
  return { status: "success", message: "Đã cập nhật trạng thái hóa đơn." };
}

export async function recordRefundAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const parsed = refundSchema.safeParse({
    orderId: getFormString(formData, "orderId"),
    amount: getFormString(formData, "amount"),
    reason: getFormString(formData, "reason"),
    method: getFormString(formData, "method"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra hoàn tiền.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }
  try {
    recordRefund(getDb(), actor, {
      orderId: parsed.data.orderId,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      method: parsed.data.method,
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance");
  return { status: "success", message: "Đã ghi nhận hoàn tiền." };
}

export async function remindDebtAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    remindDebt(getDb(), actor, getFormString(formData, "orderId"));
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/finance/debts");
  return { status: "success", message: "Đã ghi nhận nhắc thu." };
}

export type PaymentSandboxState =
  | {
      ok: true;
      payload: string;
      content: string;
      imageUrl: string;
      amount: number;
      orderCode: string;
      provider: "manual" | "vietqr";
      webhook: {
        body: string;
        signature: string;
        timestamp: number;
        eventId: string;
        amount: number;
        orderId: string;
      };
    }
  | { ok: false; error: string };

export async function prepareMockPaymentAction(input: {
  orderId: string;
  amount: number;
  content: string;
}): Promise<PaymentSandboxState> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  try {
    const qr = buildVietQrForOrder(getDb(), actor, input);
    const eventId = `mock-${crypto.randomUUID()}`;
    const timestamp = Date.now();
    const body = JSON.stringify({
      eventId,
      orderId: input.orderId,
      amount: qr.amount,
      provider: "mock",
      reference: qr.content,
      occurredAt: new Date().toISOString(),
    });
    const signature = signWebhookBody(body, timestamp);
    return {
      ok: true,
      payload: qr.payload,
      content: qr.content,
      imageUrl: qr.imageUrl,
      amount: qr.amount,
      orderCode: qr.orderCode,
      provider: qr.provider,
      webhook: {
        body,
        signature,
        timestamp,
        eventId,
        amount: qr.amount,
        orderId: input.orderId,
      },
    };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
