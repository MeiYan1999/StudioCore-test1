"use client";

import { useActionState, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { createDriveDeviceAction, manageDriveAction } from "@/lib/actions/drive-actions";
import { initialActionState, type ActionState } from "@/lib/actions/action-state";

export function CopyButton({
  value,
  children = "Sao chép",
}: {
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          const text = value.startsWith("/drive/")
            ? new URL(value, window.location.origin).href
            : value;
          await navigator.clipboard.writeText(text);
          toast.success("Đã sao chép.");
        } catch {
          toast.error("Không thể sao chép. Vui lòng sao chép thủ công.");
        }
      }}
    >
      <Copy className="size-4" />
      {children}
    </Button>
  );
}

export function AddDeviceButton() {
  const [key, setKey] = useState<string | null>(null);
  const [state, action, pending] = useActionState(async (): Promise<ActionState> => {
    const result = await createDriveDeviceAction();
    if (result.key) setKey(result.key);
    if (result.status === "error") toast.error(result.message);
    return { status: result.status, message: result.message };
  }, initialActionState);
  return (
    <>
      <form action={action}>
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" />
          {pending ? "Đang tạo…" : "Thêm máy tính"}
        </Button>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600">
            {state.message}
          </p>
        )}
      </form>
      <Dialog
        open={!!key}
        onOpenChange={(open) => {
          if (!open) setKey(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>Khóa kết nối máy tính</DialogTitle>
          <DialogDescription>
            Khóa chỉ hiển thị một lần. Không chia sẻ cho người khác.
          </DialogDescription>
          <code
            className="break-all rounded-lg bg-surface-muted p-4 text-sm"
            data-testid="drive-connect-key"
          >
            {key}
          </code>
          <p className="text-sm">Mở StudioCore Drive trên máy tính → Cài đặt → dán khóa</p>
          {key && <CopyButton value={key}>Sao chép khóa</CopyButton>}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StaffMutation({
  id,
  operation,
  children,
}: {
  id: string;
  operation: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(
    async (previous: typeof initialActionState, form: FormData) => {
      if (
        (operation === "revoked" || operation === "revokeDevice") &&
        !window.confirm("Thu hồi không thể hoàn tác. Bạn có chắc chắn?")
      )
        return previous;
      const result = await manageDriveAction(previous, form);
      if (result.status === "success") toast.success(result.message);
      else toast.error(result.message);
      return result;
    },
    initialActionState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="operation" value={operation} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {children}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
