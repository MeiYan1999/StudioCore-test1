"use server";

import { revalidatePath } from "next/cache";
import {
  fieldErrorsFromZod,
  getFormString,
  type ActionState,
} from "@/lib/actions/action-state";
import { getActorContext } from "@/lib/auth/session";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  addCustomerInteraction,
  createCustomer,
  updateCustomer,
  type CustomerCreateData,
} from "@/lib/services/customer-service";
import { getDb } from "@/lib/db/client";
import {
  customerCreateSchema,
  customerInteractionSchema,
} from "@/lib/validators/customers";

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

function customerValues(formData: FormData): Record<string, string> {
  const keys = [
    "name",
    "phone",
    "email",
    "address",
    "birthday",
    "source",
    "tier",
    "status",
    "ownerId",
    "branchId",
    "tags",
    "heightCm",
    "dressSize",
    "shoeSize",
    "measurementsNote",
    "followUpAt",
    "notes",
  ];

  return Object.fromEntries(keys.map((key) => [key, getFormString(formData, key)]));
}

function toCustomerData(parsed: {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  birthday?: string | null;
  source: CustomerCreateData["source"];
  tier: CustomerCreateData["tier"];
  status: CustomerCreateData["status"];
  ownerId?: string | null;
  branchId: string;
  tags?: string | null;
  heightCm?: string | null;
  dressSize?: string | null;
  shoeSize?: string | null;
  measurementsNote?: string | null;
  followUpAt?: string | null;
  notes?: string | null;
}): CustomerCreateData {
  return {
    name: parsed.name,
    phone: parsed.phone,
    email: parsed.email || null,
    address: parsed.address || null,
    birthday: parsed.birthday || null,
    source: parsed.source,
    tier: parsed.tier,
    status: parsed.status,
    ownerId: parsed.ownerId || null,
    branchId: parsed.branchId,
    tags: parsed.tags ? parsed.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    heightCm: parsed.heightCm || "",
    dressSize: parsed.dressSize || "",
    shoeSize: parsed.shoeSize || "",
    measurementsNote: parsed.measurementsNote || "",
    followUpAt: parsed.followUpAt || "",
    notes: parsed.notes || null,
  };
}

export async function createCustomerAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) {
    return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  }

  const values = customerValues(formData);
  const parsed = customerCreateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin khách hàng.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    const customerId = createCustomer(getDb(), actor, toCustomerData(parsed.data));
    revalidatePath("/manage/customers");
    revalidatePath("/manage/dashboard");
    return {
      status: "success",
      message: "Đã thêm khách hàng.",
      values: { ...values, id: customerId },
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateCustomerAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) {
    return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  }

  const customerId = getFormString(formData, "customerId");
  const values = customerValues(formData);
  const parsed = customerCreateSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin khách hàng.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateCustomer(getDb(), actor, customerId, toCustomerData(parsed.data));
    revalidatePath("/manage/customers");
    revalidatePath(`/manage/customers/${customerId}`);
    revalidatePath("/manage/dashboard");
    return { status: "success", message: "Đã cập nhật khách hàng.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function addCustomerInteractionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) {
    return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  }

  const values = {
    type: getFormString(formData, "type"),
    content: getFormString(formData, "content"),
    occurredAt: getFormString(formData, "occurredAt"),
    followUpAt: getFormString(formData, "followUpAt"),
  };

  const parsed = customerInteractionSchema.safeParse({
    customerId: getFormString(formData, "customerId"),
    ...values,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại nội dung tương tác.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    addCustomerInteraction(getDb(), actor, {
      ...parsed.data,
      occurredAt: parsed.data.occurredAt || "",
      followUpAt: parsed.data.followUpAt || "",
    });
    revalidatePath(`/manage/customers/${parsed.data.customerId}`);
    revalidatePath("/manage/customers");
    return { status: "success", message: "Đã ghi nhận tương tác." };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}
