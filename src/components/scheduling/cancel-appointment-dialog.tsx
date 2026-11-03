"use client";

import { cancelAppointmentAction } from "@/lib/actions/scheduling-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { SubmitButton } from "@/components/shared/submit-button";

export function CancelAppointmentDialog({ appointmentId }: { appointmentId: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          Hủy lịch
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hủy lịch chụp?</AlertDialogTitle>
          <AlertDialogDescription>
            Lịch sẽ chuyển sang trạng thái Đã hủy và được ghi audit. Hành động này không thể
            hoàn tác từ giao diện; hãy nhập lý do cụ thể.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={cancelAppointmentAction} className="mt-4 space-y-3">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <div>
            <Label htmlFor={`cancel-appointment-${appointmentId}`}>Lý do hủy</Label>
            <textarea
              id={`cancel-appointment-${appointmentId}`}
              name="reason"
              rows={3}
              required
              className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost">
                Giữ lịch
              </Button>
            </AlertDialogCancel>
            <SubmitButton pendingLabel="Đang hủy..." variant="destructive">
              Xác nhận hủy lịch
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
