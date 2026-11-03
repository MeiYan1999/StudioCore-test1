"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fieldErrorsFromZod,
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { isOrderStatus } from "@/lib/orders/status";
import {
  changeOrderStatus,
  confirmOrderContract,
  createOrder,
  recordOrderPayment,
} from "@/lib/services/order-service";
import { getDb } from "@/lib/db/client";
import {
  orderCreateSchema,
  orderPaymentSchema,
  orderStatusSchema,
} from "@/lib/validators/orders";

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

function orderValues(formData: FormData): Record<string, string> {
  const keys = [
    "customerMode",
    "customerId",
    "customerName",
    "customerPhone",
    "branchId",
    "scheduledAt",
    "location",
    "photographerId",
    "editorId",
    "makeupId",
    "itemsJson",
    "surcharge",
    "discount",
    "voucherCode",
    "deposit",
    "depositMethod",
    "notes",
  ];

  return Object.fromEntries(keys.map((key) => [key, getFormString(formData, key)]));
}

export async function createOrderAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = orderValues(formData);
  let items: unknown = [];

  try {
    items = JSON.parse(values.itemsJson || "[]");
  } catch {
    return {
      status: "error",
      message: "Danh sách item không hợp lệ.",
      values,
    };
  }

  const parsed = orderCreateSchema.safeParse({
    customerMode: values.customerMode,
    customerId: values.customerId,
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    branchId: values.branchId,
    scheduledAt: values.scheduledAt,
    location: values.location,
    photographerId: values.photographerId,
    editorId: values.editorId,
    makeupId: values.makeupId,
    items,
    surcharge: values.surcharge,
    discount: values.discount,
    voucherCode: values.voucherCode,
    deposit: values.deposit,
    depositMethod: values.depositMethod,
    notes: values.notes,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin đơn hàng.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  let orderId: string;
  try {
    orderId = createOrder(getDb(), actor, {
      customerMode: parsed.data.customerMode,
      customerId: parsed.data.customerId || "",
      customerName: parsed.data.customerName || "",
      customerPhone: parsed.data.customerPhone || "",
      branchId: parsed.data.branchId,
      scheduledAt: parsed.data.scheduledAt || "",
      location: parsed.data.location || "",
      photographerId: parsed.data.photographerId || null,
      editorId: parsed.data.editorId || null,
      makeupId: parsed.data.makeupId || null,
      items: parsed.data.items.map((item) => ({
        itemType: item.itemType,
        refId: item.refId || null,
        name: item.name || "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      surcharge: parsed.data.surcharge,
      discount: parsed.data.discount,
      voucherCode: parsed.data.voucherCode || "",
      deposit: parsed.data.deposit,
      depositMethod: parsed.data.depositMethod,
      notes: parsed.data.notes || "",
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }

  revalidatePath("/manage/orders");
  revalidatePath("/manage/dashboard");
  redirect(`/manage/orders/${orderId}`);
}

export async function changeOrderStatusAction(formData: FormData): Promise<void> {
  const actor = await getActorContext();
  if (!actor) redirect("/login");

  const parsed = orderStatusSchema.safeParse({
    orderId: getFormString(formData, "orderId"),
    toStatus: getFormString(formData, "toStatus"),
    note: getFormString(formData, "note"),
  });

  if (!parsed.success) {
    const orderId = getFormString(formData, "orderId");
    redirect(`/manage/orders/${orderId}?error=${encodeURIComponent("Dữ liệu trạng thái không hợp lệ.")}`);
  }

  if (!isOrderStatus(parsed.data.toStatus)) {
    redirect(
      `/manage/orders/${parsed.data.orderId}?error=${encodeURIComponent("Trạng thái không hợp lệ.")}`,
    );
  }

  try {
    changeOrderStatus(
      getDb(),
      actor,
      parsed.data.orderId,
      parsed.data.toStatus,
      parsed.data.note || "",
    );
  } catch (error) {
    redirect(
      `/manage/orders/${parsed.data.orderId}?error=${encodeURIComponent(errorMessage(error))}`,
    );
  }

  revalidatePath(`/manage/orders/${parsed.data.orderId}`);
  revalidatePath("/manage/orders");
  redirect(`/manage/orders/${parsed.data.orderId}?statusUpdated=1`);
}

export async function recordPaymentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = {
    amount: getFormString(formData, "amount"),
    method: getFormString(formData, "method"),
    reference: getFormString(formData, "reference"),
    paidAt: getFormString(formData, "paidAt"),
  };
  const orderId = getFormString(formData, "orderId");
  const parsed = orderPaymentSchema.safeParse({ orderId, ...values });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin thanh toán.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    recordOrderPayment(getDb(), actor, orderId, {
      amount: parsed.data.amount,
      method: parsed.data.method,
      reference: parsed.data.reference || "",
      paidAt: parsed.data.paidAt || "",
    });
    revalidatePath(`/manage/orders/${orderId}`);
    revalidatePath("/manage/orders");
    revalidatePath("/manage/dashboard");
    return {
      status: "success",
      message: "Đã ghi nhận thanh toán.",
      values,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function confirmContractAction(formData: FormData): Promise<void> {
  const actor = await getActorContext();
  if (!actor) redirect("/login");

  const orderId = getFormString(formData, "orderId");

  try {
    confirmOrderContract(getDb(), actor, orderId);
  } catch (error) {
    redirect(
      `/manage/orders/${orderId}/contract?error=${encodeURIComponent(errorMessage(error))}`,
    );
  }

  revalidatePath(`/manage/orders/${orderId}`);
  revalidatePath(`/manage/orders/${orderId}/contract`);
  redirect(`/manage/orders/${orderId}/contract?confirmed=1`);
}
