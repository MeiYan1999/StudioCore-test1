"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckSquare2, List, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/shared/submit-button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DateTimeText } from "@/components/shared/date-time";
import { initialActionState } from "@/lib/actions/action-state";
import {
  addTaskCommentAction,
  createTaskAction,
  loadTaskDetailAction,
  updateTaskAction,
} from "@/lib/actions/operations-actions";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_META,
  TASK_STATUSES,
  TASK_STATUS_META,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/constants";
import type { TaskDetail, TaskView } from "@/lib/services/task-service";

type Option = { id: string; name: string };
type CodeOption = { id: string; code: string };
type AlbumOption = { id: string; title: string };

function toDateTimeInput(value: Date | null): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

function TaskFields({
  task,
  branches,
  assignees,
  orders,
  customers,
  albums,
  defaultBranchId,
  defaultCustomerId,
}: {
  task?: TaskView;
  branches: { id: string; name: string }[];
  assignees: { id: string; name: string; code: string }[];
  orders: CodeOption[];
  customers: Option[];
  albums: AlbumOption[];
  defaultBranchId: string;
  defaultCustomerId?: string;
}) {
  return (
    <>
      <div>
        <Label htmlFor="task-title">Tiêu đề</Label>
        <Input id="task-title" name="title" defaultValue={task?.title ?? ""} required className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="task-description">Mô tả</Label>
        <Textarea
          id="task-description"
          name="description"
          rows={3}
          defaultValue={task?.description ?? ""}
          className="mt-1.5"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="task-branch">Chi nhánh</Label>
          <Select id="task-branch" name="branchId" defaultValue={task?.branchId ?? defaultBranchId} className="mt-1.5">
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-assignee">Người phụ trách</Label>
          <Select id="task-assignee" name="assigneeId" defaultValue={task?.assigneeId ?? ""} className="mt-1.5">
            <option value="">Chưa phân công</option>
            {assignees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-priority">Ưu tiên</Label>
          <Select id="task-priority" name="priority" defaultValue={task?.priority ?? "medium"} className="mt-1.5">
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_META[priority].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-status">Trạng thái</Label>
          <Select id="task-status" name="status" defaultValue={task?.status ?? "todo"} className="mt-1.5">
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_META[status].label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-due">Deadline</Label>
          <Input
            id="task-due"
            name="dueAt"
            type="datetime-local"
            defaultValue={task ? toDateTimeInput(task.dueAt) : ""}
            className="mt-1.5"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="task-customer">Khách hàng</Label>
          <Select
            id="task-customer"
            name="customerId"
            defaultValue={task?.customerId ?? defaultCustomerId ?? ""}
            className="mt-1.5"
          >
            <option value="">Không gắn</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-order">Đơn hàng</Label>
          <Select id="task-order" name="orderId" defaultValue={task?.orderId ?? ""} className="mt-1.5">
            <option value="">Không gắn</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.code}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="task-album">Album</Label>
          <Select id="task-album" name="albumId" defaultValue={task?.albumId ?? ""} className="mt-1.5">
            <option value="">Không gắn</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.title}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </>
  );
}

export function TaskCreateSheet({
  branches,
  assignees,
  orders,
  customers,
  albums,
  defaultBranchId,
  defaultCustomerId,
}: {
  branches: { id: string; name: string }[];
  assignees: { id: string; name: string; code: string }[];
  orders: CodeOption[];
  customers: Option[];
  albums: AlbumOption[];
  defaultBranchId: string;
  defaultCustomerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createTaskAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã tạo task.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          Tạo công việc
        </Button>
      </SheetTrigger>
      <SheetContent className="max-w-xl">
        <SheetHeader>
          <SheetTitle>Tạo công việc</SheetTitle>
          <SheetDescription>
            Gắn khách/đơn/album; người phụ trách nhận notification.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <TaskFields
            branches={branches}
            assignees={assignees}
            orders={orders}
            customers={customers}
            albums={albums}
            defaultBranchId={defaultBranchId}
            defaultCustomerId={defaultCustomerId}
          />
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Tạo công việc</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function TaskDetailSheet({
  taskId,
  open,
  onOpenChange,
  branches,
  assignees,
  orders,
  customers,
  albums,
  canManage,
  detail,
  loading,
  onReload,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: { id: string; name: string }[];
  assignees: { id: string; name: string; code: string }[];
  orders: CodeOption[];
  customers: Option[];
  albums: AlbumOption[];
  canManage: boolean;
  detail: TaskDetail | null;
  loading: boolean;
  onReload: (taskId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await updateTaskAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật task.");
        router.refresh();
        if (taskId) await onReload(taskId);
      }
      return result;
    },
    initialActionState,
  );
  const [commentState, commentAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await addTaskCommentAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã bình luận.");
        if (taskId) await onReload(taskId);
      }
      return result;
    },
    initialActionState,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-xl">
        <SheetHeader>
          <SheetTitle>{detail?.title ?? "Chi tiết công việc"}</SheetTitle>
          <SheetDescription>
            {detail
              ? `${detail.assigneeName ?? "Chưa phân công"} · ${TASK_STATUS_META[detail.status as TaskStatus]?.label ?? detail.status}`
              : "Đang tải..."}
          </SheetDescription>
        </SheetHeader>
        {loading || !detail ? (
          <p className="text-sm text-muted-foreground">Đang tải chi tiết...</p>
        ) : (
          <div className="space-y-5">
            {detail.overdue ? <Alert tone="warning">Task đã quá hạn.</Alert> : null}
            {canManage ? (
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="taskId" value={detail.id} />
                <TaskFields
                  task={detail}
                  branches={branches}
                  assignees={assignees}
                  orders={orders}
                  customers={customers}
                  albums={albums}
                  defaultBranchId={detail.branchId}
                />
                {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
                <div className="flex justify-end">
                  <SubmitButton pendingLabel="Đang lưu...">Lưu thay đổi</SubmitButton>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="whitespace-pre-wrap">{detail.description ?? "Không có mô tả."}</p>
                <p className="text-xs text-muted-foreground">
                  Deadline: <DateTimeText value={detail.dueAt} />
                </p>
              </div>
            )}

            <section className="border-t border-border pt-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" aria-hidden />
                Bình luận ({detail.comments.length})
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {detail.comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg bg-surface-muted p-2">
                    <p className="text-xs font-medium">{comment.authorName ?? "Hệ thống"}</p>
                    <p className="whitespace-pre-wrap">{comment.content}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      <DateTimeText value={comment.createdAt} />
                    </p>
                  </li>
                ))}
                {detail.comments.length === 0 ? (
                  <li className="text-xs text-muted-foreground">Chưa có bình luận.</li>
                ) : null}
              </ul>
              <form action={commentAction} className="mt-3 space-y-2">
                <input type="hidden" name="taskId" value={detail.id} />
                <Textarea name="content" rows={2} placeholder="Bình luận, @SC-OWNER để mention..." />
                {commentState.status === "error" ? (
                  <Alert tone="danger">{commentState.message}</Alert>
                ) : null}
                <div className="flex justify-end">
                  <SubmitButton variant="outline" size="sm" pendingLabel="Đang gửi...">
                    Gửi bình luận
                  </SubmitButton>
                </div>
              </form>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function TaskBoard({
  tasks,
  branches,
  assignees,
  orders,
  customers,
  albums,
  defaultBranchId,
  defaultCustomerId,
  canManage,
}: {
  tasks: TaskView[];
  branches: { id: string; name: string }[];
  assignees: { id: string; name: string; code: string }[];
  orders: CodeOption[];
  customers: Option[];
  albums: AlbumOption[];
  defaultBranchId: string;
  defaultCustomerId?: string;
  canManage: boolean;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const reloadTask = async (taskId: string) => {
    const result = await loadTaskDetailAction(taskId);
    if (result.ok) setDetail(result.task);
    else toast.error(result.error);
  };

  const openTask = async (taskId: string) => {
    setSelectedId(taskId);
    setDetail(null);
    setDetailLoading(true);
    setOpen(true);
    const result = await loadTaskDetailAction(taskId);
    setDetailLoading(false);
    if (result.ok) setDetail(result.task);
    else toast.error(result.error);
  };

  const columns: DataTableColumn<TaskView>[] = [
    {
      key: "title",
      header: "Công việc",
      cell: (row) => (
        <button
          type="button"
          className="text-left font-medium hover:text-primary"
          onClick={() => openTask(row.id)}
        >
          {row.title}
          {row.overdue ? <Badge tone="danger" className="ml-2">Quá hạn</Badge> : null}
        </button>
      ),
    },
    {
      key: "assignee",
      header: "Phụ trách",
      cell: (row) => row.assigneeName ?? "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      cell: (row) => (
        <Badge tone={TASK_STATUS_META[row.status as TaskStatus]?.tone ?? "neutral"}>
          {TASK_STATUS_META[row.status as TaskStatus]?.label ?? row.status}
        </Badge>
      ),
    },
    {
      key: "priority",
      header: "Ưu tiên",
      cell: (row) => (
        <Badge tone={TASK_PRIORITY_META[row.priority as TaskPriority]?.tone ?? "neutral"}>
          {TASK_PRIORITY_META[row.priority as TaskPriority]?.label ?? row.priority}
        </Badge>
      ),
    },
    {
      key: "due",
      header: "Deadline",
      cell: (row) => <DateTimeText value={row.dueAt} />,
    },
    {
      key: "comments",
      header: "BL",
      className: "text-right",
      cell: (row) => row.commentCount,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setView("board")}
            className={
              view === "board"
                ? "flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                : "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground"
            }
          >
            <CheckSquare2 className="h-4 w-4" aria-hidden />
            Board
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={
              view === "list"
                ? "flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                : "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground"
            }
          >
            <List className="h-4 w-4" aria-hidden />
            Danh sách
          </button>
        </div>
        {canManage ? (
          <TaskCreateSheet
            branches={branches}
            assignees={assignees}
            orders={orders}
            customers={customers}
            albums={albums}
            defaultBranchId={defaultBranchId}
            defaultCustomerId={defaultCustomerId}
          />
        ) : null}
      </div>

      {view === "list" ? (
        <DataTable
          columns={columns}
          rows={tasks}
          getRowKey={(row) => row.id}
          caption="Danh sách công việc"
          empty={<p className="text-sm text-muted-foreground">Chưa có công việc.</p>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {TASK_STATUSES.map((status) => {
            const items = tasks.filter((task) => task.status === status);
            return (
              <section key={status} className="rounded-xl border border-border bg-surface p-2">
                <header className="flex items-center justify-between px-1 py-1">
                  <h3 className="text-sm font-semibold">
                    {TASK_STATUS_META[status].label}
                  </h3>
                  <Badge tone="neutral">{items.length}</Badge>
                </header>
                <div className="space-y-2">
                  {items.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="w-full rounded-lg border border-border bg-background p-2 text-left hover:border-primary"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{task.title}</p>
                        <Badge tone={TASK_PRIORITY_META[task.priority as TaskPriority]?.tone ?? "neutral"}>
                          {TASK_PRIORITY_META[task.priority as TaskPriority]?.label ?? task.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.assigneeName ?? "Chưa phân công"}
                      </p>
                      <p className={task.overdue ? "mt-1 text-xs text-[var(--danger)]" : "mt-1 flex items-center gap-1 text-xs text-muted-foreground"}>
                        <CalendarDays className="h-3 w-3" aria-hidden />
                        <DateTimeText value={task.dueAt} />
                        {task.overdue ? " · Quá hạn" : ""}
                      </p>
                    </button>
                  ))}
                  {items.length === 0 ? (
                    <p className="px-1 py-3 text-xs text-muted-foreground">Không có task.</p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskDetailSheet
        taskId={selectedId}
        open={open}
        onOpenChange={setOpen}
        branches={branches}
        assignees={assignees}
        orders={orders}
        customers={customers}
        albums={albums}
        canManage={canManage}
        detail={detail}
        loading={detailLoading}
        onReload={reloadTask}
      />
    </div>
  );
}
