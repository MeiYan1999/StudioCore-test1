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
  createAddon,
  createProduct,
  createService,
  createVoucher,
  updateAddon,
  updateProduct,
  updateService,
  updateVoucher,
} from "@/lib/services/catalog-service";
import { getDb } from "@/lib/db/client";
import {
  addonSchema,
  productSchema,
  serviceSchema,
  voucherSchema,
} from "@/lib/validators/catalog";

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

function valuesOf(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, getFormString(formData, key)]));
}

const serviceKeys = [
  "name",
  "category",
  "branchId",
  "price",
  "durationMinutes",
  "description",
  "active",
];
const addonKeys = ["serviceId", "name", "price", "active"];
const productKeys = ["sku", "name", "category", "price", "stock", "status"];
const voucherKeys = [
  "code",
  "name",
  "branchId",
  "discountType",
  "value",
  "minOrder",
  "maxDiscount",
  "usageLimit",
  "startsAt",
  "endsAt",
  "active",
];

export async function createServiceAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, serviceKeys);
  const parsed = serviceSchema.safeParse({
    ...values,
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin dịch vụ.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createService(getDb(), actor, {
      ...parsed.data,
      description: parsed.data.description || "",
    });
    revalidatePath("/manage/services");
    return { status: "success", message: "Đã thêm dịch vụ.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateServiceAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const serviceId = getFormString(formData, "serviceId");
  const values = valuesOf(formData, serviceKeys);
  const parsed = serviceSchema.safeParse({
    ...values,
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin dịch vụ.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateService(getDb(), actor, serviceId, {
      ...parsed.data,
      description: parsed.data.description || "",
    });
    revalidatePath("/manage/services");
    revalidatePath("/manage/orders");
    return { status: "success", message: "Đã cập nhật dịch vụ.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function createAddonAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, addonKeys);
  const parsed = addonSchema.safeParse({
    ...values,
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin add-on.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createAddon(getDb(), actor, parsed.data);
    revalidatePath("/manage/services");
    return { status: "success", message: "Đã thêm add-on.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateAddonAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const addonId = getFormString(formData, "addonId");
  const values = valuesOf(formData, addonKeys);
  const parsed = addonSchema.safeParse({
    ...values,
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin add-on.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateAddon(getDb(), actor, addonId, parsed.data);
    revalidatePath("/manage/services");
    return { status: "success", message: "Đã cập nhật add-on.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function createProductAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, productKeys);
  const parsed = productSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin sản phẩm.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createProduct(getDb(), actor, parsed.data);
    revalidatePath("/manage/products");
    return { status: "success", message: "Đã thêm sản phẩm.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateProductAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const productId = getFormString(formData, "productId");
  const values = valuesOf(formData, productKeys);
  const parsed = productSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin sản phẩm.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateProduct(getDb(), actor, productId, parsed.data);
    revalidatePath("/manage/products");
    return { status: "success", message: "Đã cập nhật sản phẩm.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function createVoucherAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, voucherKeys);
  const parsed = voucherSchema.safeParse({
    ...values,
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin voucher.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createVoucher(getDb(), actor, {
      ...parsed.data,
      branchId: parsed.data.branchId || null,
      startsAt: parsed.data.startsAt || "",
      endsAt: parsed.data.endsAt || "",
    });
    revalidatePath("/manage/vouchers");
    return { status: "success", message: "Đã thêm voucher.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateVoucherAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const voucherId = getFormString(formData, "voucherId");
  const values = valuesOf(formData, voucherKeys);
  const parsed = voucherSchema.safeParse({
    ...values,
    active: formData.get("active") === "on",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra lại thông tin voucher.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateVoucher(getDb(), actor, voucherId, {
      ...parsed.data,
      branchId: parsed.data.branchId || null,
      startsAt: parsed.data.startsAt || "",
      endsAt: parsed.data.endsAt || "",
    });
    revalidatePath("/manage/vouchers");
    return { status: "success", message: "Đã cập nhật voucher.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}
