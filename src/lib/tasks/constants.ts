export const TASK_STATUSES = ["todo", "doing", "review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" }
> = {
  todo: { label: "Cần làm", tone: "neutral" },
  doing: { label: "Đang làm", tone: "info" },
  review: { label: "Chờ duyệt", tone: "warning" },
  done: { label: "Hoàn tất", tone: "success" },
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; tone: "neutral" | "info" | "warning" | "danger" }
> = {
  low: { label: "Thấp", tone: "neutral" },
  medium: { label: "Trung bình", tone: "info" },
  high: { label: "Cao", tone: "warning" },
  urgent: { label: "Khẩn", tone: "danger" },
};

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["doing", "done"],
  doing: ["review", "done", "todo"],
  review: ["done", "doing"],
  done: ["todo"],
};
