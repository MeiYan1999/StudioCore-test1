"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createRoomAction,
  updateRoomAction,
} from "@/lib/actions/scheduling-actions";
import { initialActionState } from "@/lib/actions/action-state";
import type { RoomItem } from "@/lib/services/room-service";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/shared/submit-button";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-[var(--danger)]">
      {message}
    </p>
  );
}

export function RoomSheet({
  room,
  branches,
}: {
  room?: RoomItem;
  branches: { id: string; name: string }[];
}) {
  const isEdit = Boolean(room);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = isEdit
        ? await updateRoomAction(previousState, formData)
        : await createRoomAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu phòng chụp.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const values = state.values;
  const defaultBranchId = room?.branchId ?? branches[0]?.id ?? "";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={isEdit ? "outline" : "primary"} size={isEdit ? "sm" : "default"}>
          {isEdit ? (
            "Sửa"
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Thêm phòng
            </>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Sửa phòng chụp" : "Thêm phòng chụp"}</SheetTitle>
          <SheetDescription>
            Phòng được dùng để kiểm tra xung đột lịch theo chi nhánh.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4" noValidate>
          {room ? <input type="hidden" name="roomId" value={room.id} /> : null}
          {state.status === "error" && state.message ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div>
            <Label htmlFor="room-name">Tên phòng</Label>
            <Input
              id="room-name"
              name="name"
              defaultValue={values?.name ?? room?.name ?? ""}
              className="mt-1.5"
              required
            />
            <FieldError id="room-name-error" message={state.fieldErrors?.name} />
          </div>
          <div>
            <Label htmlFor="room-branch">Chi nhánh</Label>
            <Select
              id="room-branch"
              name="branchId"
              defaultValue={values?.branchId ?? defaultBranchId}
              className="mt-1.5"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="room-capacity">Sức chứa</Label>
              <Input
                id="room-capacity"
                name="capacity"
                type="number"
                min={1}
                defaultValue={values?.capacity ?? room?.capacity ?? 1}
                className="mt-1.5"
                required
              />
              <FieldError id="room-capacity-error" message={state.fieldErrors?.capacity} />
            </div>
            <div>
              <Label htmlFor="room-status">Trạng thái</Label>
              <Select
                id="room-status"
                name="status"
                defaultValue={values?.status ?? room?.status ?? "active"}
                className="mt-1.5"
              >
                <option value="active">Đang dùng</option>
                <option value="inactive">Ngưng dùng</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="room-notes">Ghi chú</Label>
            <textarea
              id="room-notes"
              name="notes"
              rows={3}
              defaultValue={values?.notes ?? room?.notes ?? ""}
              className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            />
          </div>

          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Hủy
              </Button>
            </SheetClose>
            <SubmitButton pendingLabel="Đang lưu...">
              {isEdit ? "Lưu thay đổi" : "Thêm phòng"}
            </SubmitButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
