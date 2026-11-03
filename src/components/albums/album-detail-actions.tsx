"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCw, Unlock } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import {
  rescanAlbumAction,
  setSelectionLockAction,
} from "@/lib/actions/album-actions";

export function AlbumRescanButton({ albumId }: { albumId: string }) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await rescanAlbumAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã quét lại album.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không quét lại được album.");
      }
      return result;
    },
    initialActionState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="albumId" value={albumId} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Đang quét...">
        <RefreshCw className="h-4 w-4" aria-hidden />
        Quét lại Drive
      </SubmitButton>
    </form>
  );
}

export function AlbumSelectionLockButton({
  albumId,
  locked,
  canLock,
}: {
  albumId: string;
  locked: boolean;
  canLock: boolean;
}) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await setSelectionLockAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật khóa lựa chọn.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không thể cập nhật khóa.");
      }
      return result;
    },
    initialActionState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="albumId" value={albumId} />
      <input type="hidden" name="locked" value={locked ? "off" : "on"} />
      <SubmitButton
        variant={locked ? "outline" : "secondary"}
        size="sm"
        pendingLabel="Đang cập nhật..."
        disabled={!locked && !canLock}
      >
        {locked ? (
          <>
            <Unlock className="h-4 w-4" aria-hidden />
            Mở khóa lựa chọn
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" aria-hidden />
            Khóa lựa chọn
          </>
        )}
      </SubmitButton>
    </form>
  );
}
