"use server";

import { revalidatePath } from "next/cache";
import { getActorContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  createContractWithAppointments,
  getNextContractCode,
  type ContractSessionInput,
} from "@/lib/services/contract-service";

export interface CreateContractActionResult {
  success: boolean;
  orderId?: string;
  code?: string;
  customerId?: string;
  error?: string;
  message?: string;
}

export async function getNextContractCodeAction(): Promise<{ code: string }> {
  const actor = await getActorContext();
  if (!actor) {
    return { code: "HD00001" };
  }
  const db = getDb();
  const code = getNextContractCode(db, actor.tenantId);
  return { code };
}

export async function createContractAction(
  formData: FormData,
): Promise<CreateContractActionResult> {
  const actor = await getActorContext();
  if (!actor) {
    return { success: false, error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  }

  const code = (formData.get("code") as string)?.trim() || "";
  const signedAt = (formData.get("signedAt") as string)?.trim() || "";
  const customerName = (formData.get("customerName") as string)?.trim() || "";
  const customerPhone = (formData.get("customerPhone") as string)?.trim() || "";
  const branchId =
    (formData.get("branchId") as string)?.trim() ||
    actor.activeBranchId ||
    actor.branches[0]?.id ||
    "";
  const serviceCategory = (formData.get("serviceCategory") as string)?.trim() || "";
  const serviceId = (formData.get("serviceId") as string)?.trim() || null;
  const packageName =
    (formData.get("packageName") as string)?.trim() || "Gói chụp hợp đồng studio";
  const crewConfig = (formData.get("crewConfig") as string)?.trim() || "1 Chụp";
  const surcharge = Number(formData.get("surcharge")) || 0;
  const surchargeNote = (formData.get("surchargeNote") as string)?.trim() || "";
  const total = Number(formData.get("total")) || 0;
  const deposit = Number(formData.get("deposit")) || 0;
  const depositMethod = (formData.get("depositMethod") as
    | "bank_transfer"
    | "cash"
    | "vietqr"
    | "card") || "bank_transfer";
  const notes = (formData.get("notes") as string)?.trim() || "";

  let sessions: ContractSessionInput[] = [];
  try {
    const rawSessions = formData.get("sessions") as string;
    if (rawSessions) {
      sessions = JSON.parse(rawSessions);
    }
  } catch {
    sessions = [];
  }

  // Fallback to primary session date if no sessions in list
  if (sessions.length === 0) {
    const sessionDate = (formData.get("sessionDate") as string)?.trim() || signedAt;
    const sessionStartTime = (formData.get("sessionStartTime") as string)?.trim() || "09:00";
    const sessionEndTime = (formData.get("sessionEndTime") as string)?.trim() || "12:00";
    const sessionLocation = (formData.get("sessionLocation") as string)?.trim() || "";
    const sessionPhotographerId =
      (formData.get("sessionPhotographerId") as string)?.trim() || null;
    const sessionMakeupId = (formData.get("sessionMakeupId") as string)?.trim() || null;
    const sessionEditorId = (formData.get("sessionEditorId") as string)?.trim() || null;

    if (sessionDate) {
      sessions.push({
        date: sessionDate,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        location: sessionLocation,
        photographerId: sessionPhotographerId,
        makeupId: sessionMakeupId,
        editorId: sessionEditorId,
      });
    }
  }

  try {
    const db = getDb();
    const result = createContractWithAppointments(db, actor, {
      code,
      signedAt,
      customerName,
      customerPhone,
      branchId,
      serviceCategory,
      serviceId,
      packageName,
      crewConfig,
      surcharge,
      surchargeNote,
      total,
      deposit,
      depositMethod,
      notes,
      sessions,
    });

    revalidatePath("/manage/calendar");
    revalidatePath("/manage/orders");
    revalidatePath("/manage/dashboard");
    revalidatePath("/manage/finance");
    revalidatePath(`/manage/orders/${result.orderId}`);

    return {
      success: true,
      orderId: result.orderId,
      code: result.code,
      customerId: result.customerId,
      message: `Tạo thành công hợp đồng ${result.code}!`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Không thể tạo hợp đồng. Vui lòng kiểm tra lại thông tin.",
    };
  }
}
