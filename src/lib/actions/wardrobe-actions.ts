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
  createEquipment,
  updateEquipment,
} from "@/lib/services/equipment-service";
import {
  createRental,
  createWardrobeItem,
  returnRental,
  updateWardrobeItem,
} from "@/lib/services/wardrobe-service";
import { getDb } from "@/lib/db/client";
import { parseVietnamDateTimeLocal } from "@/lib/utils";
import {
  equipmentSchema,
  rentalReturnSchema,
  rentalSchema,
  wardrobeItemSchema,
} from "@/lib/validators/wardrobe";

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

const wardrobeKeys = [
  "branchId",
  "sku",
  "qrCode",
  "name",
  "size",
  "color",
  "status",
  "rentalPrice",
  "depositPrice",
  "image",
  "notes",
];

export async function createWardrobeItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, wardrobeKeys);
  const parsed = wardrobeItemSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin trang phục.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createWardrobeItem(getDb(), actor, {
      ...parsed.data,
      qrCode: parsed.data.qrCode || "",
      image: parsed.data.image || "",
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/wardrobe");
    return { status: "success", message: "Đã thêm trang phục.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateWardrobeItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const itemId = getFormString(formData, "itemId");
  const values = valuesOf(formData, wardrobeKeys);
  const parsed = wardrobeItemSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin trang phục.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateWardrobeItem(getDb(), actor, itemId, {
      ...parsed.data,
      qrCode: parsed.data.qrCode || "",
      image: parsed.data.image || "",
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/wardrobe");
    revalidatePath(`/manage/wardrobe/${itemId}`);
    return { status: "success", message: "Đã cập nhật trang phục.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function createRentalAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, [
    "wardrobeItemId",
    "orderId",
    "dueAt",
    "deposit",
    "conditionOut",
    "notes",
  ]);
  const parsed = rentalSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin phiếu thuê.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  const dueAt = parseVietnamDateTimeLocal(parsed.data.dueAt);
  if (!dueAt) {
    return { status: "error", message: "Hạn trả không hợp lệ.", values };
  }

  try {
    await createRental(getDb(), actor, {
      wardrobeItemId: parsed.data.wardrobeItemId,
      orderId: parsed.data.orderId || "",
      dueAt: dueAt.toISOString(),
      deposit: parsed.data.deposit,
      conditionOut: parsed.data.conditionOut,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/wardrobe");
    revalidatePath("/manage/wardrobe/rentals");
    return { status: "success", message: "Đã tạo phiếu thuê.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function returnRentalAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, [
    "rentalId",
    "conditionIn",
    "cleaningFee",
    "damageFee",
    "notes",
  ]);
  const parsed = rentalReturnSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin nhận lại.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    const result = returnRental(getDb(), actor, parsed.data.rentalId, {
      conditionIn: parsed.data.conditionIn,
      cleaningFee: parsed.data.cleaningFee,
      damageFee: parsed.data.damageFee,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/wardrobe");
    revalidatePath("/manage/wardrobe/rentals");
    return {
      status: "success",
      message:
        result.totalFee > 0
          ? `Đã nhận lại trang phục. Phí phát sinh ${result.totalFee.toLocaleString("vi-VN")}đ đã ghi vào đơn.`
          : "Đã nhận lại trang phục.",
      values,
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function createEquipmentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const values = valuesOf(formData, [
    "branchId",
    "name",
    "category",
    "serialNumber",
    "status",
    "notes",
  ]);
  const parsed = equipmentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin thiết bị.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    createEquipment(getDb(), actor, {
      ...parsed.data,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/equipment");
    return { status: "success", message: "Đã thêm thiết bị.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}

export async function updateEquipmentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };

  const equipmentId = getFormString(formData, "equipmentId");
  const values = valuesOf(formData, [
    "branchId",
    "name",
    "category",
    "serialNumber",
    "status",
    "notes",
  ]);
  const parsed = equipmentSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vui lòng kiểm tra thông tin thiết bị.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
      values,
    };
  }

  try {
    updateEquipment(getDb(), actor, equipmentId, {
      ...parsed.data,
      notes: parsed.data.notes || "",
    });
    revalidatePath("/manage/equipment");
    return { status: "success", message: "Đã cập nhật thiết bị.", values };
  } catch (error) {
    return { status: "error", message: errorMessage(error), values };
  }
}
