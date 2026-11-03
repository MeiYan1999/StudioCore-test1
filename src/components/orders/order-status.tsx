"use client";

import { changeOrderStatusAction } from "@/lib/actions/order-actions";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/orders/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

export function OrderStatusForm({
  orderId,
  nextStatuses,
}: {
  orderId: string;
  nextStatuses: OrderStatus[];
}) {
  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Đơn hàng không còn trạng thái chuyển tiếp khả dụng.
      </p>
    );
  }

  return (
    <form action={changeOrderStatusAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <Label htmlFor="next-status">Trạng thái tiếp theo</Label>
        <Select id="next-status" name="toStatus" className="mt-1.5" required>
          {nextStatuses.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_META[status].label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="status-note">Ghi chú</Label>
        <textarea
          id="status-note"
          name="note"
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          placeholder="Ví dụ: đã chụp xong, khách đã chọn ảnh..."
        />
      </div>
      <SubmitButton pendingLabel="Đang cập nhật..." size="sm">
        Cập nhật trạng thái
      </SubmitButton>
    </form>
  );
}

export function CancelOrderDialog({ orderId }: { orderId: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive" size="sm">
          Hủy đơn hàng
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hủy đơn hàng?</AlertDialogTitle>
          <AlertDialogDescription>
            Đơn hàng sẽ chuyển sang trạng thái Đã hủy, được ghi audit và không thể hoàn tác
            từ giao diện. Vui lòng nhập lý do cụ thể.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={changeOrderStatusAction} className="mt-4 space-y-3">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="toStatus" value="cancelled" />
          <div>
            <Label htmlFor={`cancel-reason-${orderId}`}>Lý do hủy</Label>
            <textarea
              id={`cancel-reason-${orderId}`}
              name="note"
              rows={3}
              required
              className="mt-1.5 w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="ghost">
                Giữ đơn
              </Button>
            </AlertDialogCancel>
            <SubmitButton pendingLabel="Đang hủy..." variant="destructive">
              Xác nhận hủy đơn
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
