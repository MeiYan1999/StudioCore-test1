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
  addTaskComment,
  createTask,
  getTaskDetail,
  updateTask,
  type TaskDetail,
} from "@/lib/services/task-service";
import { createLinkDocument } from "@/lib/services/document-service";
import { saveCampaign } from "@/lib/services/campaign-service";
import {
  assignConversation,
  createConversation,
  sendMessage,
  setConversationAi,
  setConversationStatus,
  simulateInboundMessage,
} from "@/lib/services/inbox-service";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/constants";

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

function taskValues(formData: FormData) {
  const status = getFormString(formData, "status") as TaskStatus;
  const priority = getFormString(formData, "priority") as TaskPriority;
  return {
    title: getFormString(formData, "title"),
    description: getFormString(formData, "description"),
    branchId: getFormString(formData, "branchId"),
    assigneeId: getFormString(formData, "assigneeId"),
    orderId: getFormString(formData, "orderId"),
    customerId: getFormString(formData, "customerId"),
    albumId: getFormString(formData, "albumId"),
    priority: TASK_PRIORITIES.includes(priority) ? priority : ("medium" as TaskPriority),
    status: TASK_STATUSES.includes(status) ? status : ("todo" as TaskStatus),
    dueAt: getFormString(formData, "dueAt"),
  };
}

export async function createTaskAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    createTask(getDb(), actor, taskValues(formData));
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/tasks");
  const customerId = getFormString(formData, "customerId");
  if (customerId) revalidatePath(`/manage/customers/${customerId}`);
  return { status: "success", message: "Đã tạo công việc." };
}

export async function updateTaskAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    updateTask(
      getDb(),
      actor,
      getFormString(formData, "taskId"),
      taskValues(formData),
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/tasks");
  return { status: "success", message: "Đã cập nhật công việc." };
}

export async function loadTaskDetailAction(
  taskId: string,
): Promise<{ ok: true; task: TaskDetail } | { ok: false; error: string }> {
  const actor = await getActorContext();
  if (!actor) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  try {
    return { ok: true, task: getTaskDetail(getDb(), actor, taskId) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function addTaskCommentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    addTaskComment(
      getDb(),
      actor,
      getFormString(formData, "taskId"),
      getFormString(formData, "content"),
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/tasks");
  return { status: "success", message: "Đã thêm bình luận." };
}

export async function createLinkDocumentAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    createLinkDocument(getDb(), actor, {
      name: getFormString(formData, "name"),
      category: getFormString(formData, "category"),
      url: getFormString(formData, "url"),
      visibility: getFormString(formData, "visibility"),
      branchId: getFormString(formData, "branchId"),
      notes: getFormString(formData, "notes"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/documents");
  return { status: "success", message: "Đã thêm tài liệu liên kết." };
}

export async function saveCampaignAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    saveCampaign(getDb(), actor, {
      id: getFormString(formData, "campaignId") || undefined,
      name: getFormString(formData, "name"),
      source: getFormString(formData, "source"),
      branchId: getFormString(formData, "branchId"),
      budget: Number(getFormString(formData, "budget") || "0"),
      spend: Number(getFormString(formData, "spend") || "0"),
      leads: Number(getFormString(formData, "leads") || "0"),
      ordersCount: Number(getFormString(formData, "ordersCount") || "0"),
      revenue: Number(getFormString(formData, "revenue") || "0"),
      startAt: getFormString(formData, "startAt"),
      endAt: getFormString(formData, "endAt"),
      status: getFormString(formData, "status"),
      notes: getFormString(formData, "notes"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/campaigns");
  return { status: "success", message: "Đã lưu chiến dịch." };
}

export async function createConversationAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    createConversation(getDb(), actor, {
      branchId: getFormString(formData, "branchId"),
      customerId: getFormString(formData, "customerId"),
      channel: getFormString(formData, "channel"),
      subject: getFormString(formData, "subject"),
      assignedTo: getFormString(formData, "assignedTo"),
    });
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/inbox");
  return { status: "success", message: "Đã tạo hội thoại." };
}

export async function sendInboxMessageAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    sendMessage(
      getDb(),
      actor,
      getFormString(formData, "conversationId"),
      getFormString(formData, "content"),
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/inbox");
  return { status: "success", message: "Đã lưu tin nhắn local inbox." };
}

export async function assignConversationAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    assignConversation(
      getDb(),
      actor,
      getFormString(formData, "conversationId"),
      getFormString(formData, "assignedTo"),
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/inbox");
  return { status: "success", message: "Đã phân công hội thoại." };
}

export async function setConversationStatusAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  const status = getFormString(formData, "status");
  if (status !== "unanswered" && status !== "processing" && status !== "replied") {
    return { status: "error", message: "Trạng thái không hợp lệ." };
  }
  try {
    setConversationStatus(
      getDb(),
      actor,
      getFormString(formData, "conversationId"),
      status,
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/inbox");
  return { status: "success", message: "Đã cập nhật trạng thái hội thoại." };
}

export async function setConversationAiAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    setConversationAi(
      getDb(),
      actor,
      getFormString(formData, "conversationId"),
      getFormString(formData, "enabled") === "on",
    );
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
  revalidatePath("/manage/inbox");
  return { status: "success", message: "Đã cập nhật AI auto-reply." };
}

export async function simulateInboundAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await getActorContext();
  if (!actor) return { status: "error", message: "Phiên đăng nhập đã hết hạn." };
  try {
    const result = simulateInboundMessage(
      getDb(),
      actor,
      getFormString(formData, "conversationId"),
      getFormString(formData, "content"),
    );
    revalidatePath("/manage/inbox");
    return {
      status: "success",
      message: result.reply
        ? "AI local đã trả lời trong inbox."
        : "AI local đã chuyển hội thoại cho người thật.",
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}
