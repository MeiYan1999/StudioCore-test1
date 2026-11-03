"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import { updateAlbumStatusAction } from "@/lib/actions/album-actions";
import {
  ALBUM_STATUS_META,
  ALBUM_STATUS_TRANSITIONS,
  type AlbumStatus,
} from "@/lib/albums/constants";

const ACTION_LABELS: Partial<Record<AlbumStatus, string>> = {
  draft: "Đưa về chưa upload",
  processing: "Bắt đầu xử lý",
  ready: "Đánh dấu sẵn sàng",
  delivered: "Đánh dấu đã giao",
  archived: "Lưu trữ album",
};

function StatusForm({
  albumId,
  target,
  currentStatus,
}: {
  albumId: string;
  target: AlbumStatus;
  currentStatus: AlbumStatus;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await updateAlbumStatusAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật trạng thái.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không thể đổi trạng thái.");
      }
      return result;
    },
    initialActionState,
  );

  const label =
    currentStatus === "archived" && target === "ready"
      ? "Khôi phục album"
      : ACTION_LABELS[target] ?? ALBUM_STATUS_META[target].label;
  const destructive = target === "archived";
  const form = (
    <form action={formAction}>
      <input type="hidden" name="albumId" value={albumId} />
      <input type="hidden" name="status" value={target} />
      <SubmitButton
        variant={destructive ? "destructive" : "outline"}
        size="sm"
        pendingLabel="Đang cập nhật..."
      >
        {label}
      </SubmitButton>
    </form>
  );

  if (!destructive) {
    return form;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Lưu trữ album?</AlertDialogTitle>
          <AlertDialogDescription>
            Link PhotoShare sẽ ngừng hoạt động ngay. Ảnh và lựa chọn của khách
            vẫn được giữ trong dữ liệu, bạn có thể khôi phục sau.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="ghost">
              Hủy
            </Button>
          </AlertDialogCancel>
          {form}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AlbumStatusActions({
  albumId,
  status,
}: {
  albumId: string;
  status: string;
}) {
  const current = status as AlbumStatus;
  const targets = ALBUM_STATUS_TRANSITIONS[current] ?? [];
  if (targets.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        Không còn trạng thái tiếp theo.
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((target) => (
        <StatusForm
          key={target}
          albumId={albumId}
          target={target}
          currentStatus={current}
        />
      ))}
    </div>
  );
}
