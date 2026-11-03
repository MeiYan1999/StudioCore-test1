import { ClipboardList } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ForbiddenState } from "@/components/shared/forbidden-state";
import { TaskBoard } from "@/components/tasks/task-board";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import {
  listTaskAssignees,
  listTaskLinkOptions,
  listTasks,
} from "@/lib/services/task-service";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_META,
  TASK_STATUSES,
  TASK_STATUS_META,
} from "@/lib/tasks/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Công việc" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    customerId?: string;
  }>;
}) {
  const actor = await requireActor();
  if (!hasPermission(actor.permissions, "tasks.view")) {
    return <ForbiddenState description="Vai trò của bạn không có quyền xem công việc." />;
  }
  const params = await searchParams;
  const db = getDb();
  const tasks = listTasks(db, actor, params);
  const assignees = listTaskAssignees(db, actor);
  const linkOptions = listTaskLinkOptions(db, actor);
  const canManage = hasPermission(actor.permissions, "tasks.manage");
  const overdue = tasks.filter((task) => task.overdue).length;
  const defaultBranchId = actor.activeBranchId ?? actor.branches[0]?.id ?? "";

  return (
    <div>
      <PageHeader
        title="Công việc"
        description={`${tasks.length} task trong phạm vi xem · ${overdue} quá hạn. Board/list, assignee, deadline, comment và mention.`}
        actions={<ClipboardList className="h-5 w-5 text-muted-foreground" aria-hidden />}
      />
      <form method="get" className="mb-5 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
          <div>
            <Label htmlFor="task-filter-q">Tìm kiếm</Label>
            <Input id="task-filter-q" name="q" defaultValue={params.q ?? ""} placeholder="Tiêu đề, mô tả..." className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="task-filter-status">Trạng thái</Label>
            <Select id="task-filter-status" name="status" defaultValue={params.status ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="task-filter-priority">Ưu tiên</Label>
            <Select id="task-filter-priority" name="priority" defaultValue={params.priority ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_META[priority].label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="task-filter-assignee">Phụ trách</Label>
            <Select id="task-filter-assignee" name="assigneeId" defaultValue={params.assigneeId ?? ""} className="mt-1.5">
              <option value="">Tất cả</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm">Lọc</Button>
        </div>
      </form>

      <TaskBoard
        tasks={tasks}
        branches={actor.branches}
        assignees={assignees}
        orders={linkOptions.orders}
        customers={linkOptions.customers}
        albums={linkOptions.albums}
        defaultBranchId={defaultBranchId}
        defaultCustomerId={params.customerId}
        canManage={canManage}
      />
    </div>
  );
}
