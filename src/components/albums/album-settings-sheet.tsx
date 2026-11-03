"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import { initialActionState } from "@/lib/actions/action-state";
import { updateAlbumAction } from "@/lib/actions/album-actions";
import type { AlbumDetail } from "@/lib/services/album-service";

type CustomerOption = { id: string; name: string; phone: string };
type OrderOption = {
  id: string;
  code: string;
  status: string;
  customerId: string;
  branchId: string;
};

function expiresAtValue(value: Date | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function AlbumSettingsSheet({
  album,
  customers,
  orders,
}: {
  album: AlbumDetail;
  customers: CustomerOption[];
  orders: OrderOption[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [customerId, setCustomerId] = useState(album.customerId ?? "");
  const [orderId, setOrderId] = useState(album.orderId ?? "");
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await updateAlbumAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã lưu cấu hình album.");
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialActionState,
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.branchId === album.branchId &&
          (!customerId || order.customerId === customerId),
      ),
    [album.branchId, customerId, orders],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4" aria-hidden />
          Cấu hình album
        </Button>
      </SheetTrigger>
      <SheetContent className="max-w-xl">
        <SheetHeader>
          <SheetTitle>Cấu hình album</SheetTitle>
          <SheetDescription>
            Thông tin khách/đơn, quota chọn ảnh, quyền tải và bảo vệ link chia sẻ.
          </SheetDescription>
        </SheetHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="albumId" value={album.id} />
          {state.status === "error" ? (
            <Alert tone="danger">{state.message}</Alert>
          ) : null}

          <div>
            <Label htmlFor="album-edit-title">Tiêu đề album</Label>
            <Input
              id="album-edit-title"
              name="title"
              defaultValue={state.values?.title ?? album.title}
              className="mt-1.5"
              maxLength={160}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="album-edit-customer">Khách hàng</Label>
              <Select
                id="album-edit-customer"
                name="customerId"
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setOrderId("");
                }}
                className="mt-1.5"
              >
                <option value="">Không gắn khách</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phone}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="album-edit-order">Đơn hàng</Label>
              <Select
                id="album-edit-order"
                name="orderId"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                disabled={!customerId}
                className="mt-1.5"
              >
                <option value="">Không gắn đơn</option>
                {filteredOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.code}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="album-edit-notes">Ghi chú nội bộ</Label>
            <Textarea
              id="album-edit-notes"
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={state.values?.notes ?? album.notes ?? ""}
              className="mt-1.5"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="album-edit-quota">Số ảnh được chọn</Label>
              <Input
                id="album-edit-quota"
                name="selectionLimit"
                type="number"
                min={1}
                max={1000}
                defaultValue={state.values?.selectionLimit ?? String(album.selectionLimit)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="album-edit-download-limit">Giới hạn lượt tải</Label>
              <Input
                id="album-edit-download-limit"
                name="downloadLimit"
                type="number"
                min={1}
                defaultValue={album.downloadLimit ?? ""}
                placeholder="Không giới hạn"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 text-sm">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="extraPhotoEnabled"
                defaultChecked={album.extraPhotoEnabled}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <span>
                <span className="font-medium text-foreground">
                  Thu phí ảnh vượt quota
                </span>
                <span className="block text-xs text-muted-foreground">
                  Nếu tắt, khách không thể chọn vượt số lượng.
                </span>
              </span>
            </label>
            <div className="mt-3">
              <Label htmlFor="album-edit-extra-price">Đơn giá ảnh thêm (VND)</Label>
              <Input
                id="album-edit-extra-price"
                name="extraPhotoPrice"
                type="number"
                min={0}
                step={1}
                defaultValue={album.extraPhotoPrice}
                className="mt-1.5 max-w-xs"
              />
            </div>
          </div>

          <div className="grid gap-2 rounded-lg bg-surface-muted p-3 text-sm sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="allowFavorites"
                defaultChecked={album.allowFavorites}
                className="h-4 w-4 rounded border-border"
              />
              Cho phép thả tim
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="allowNotes"
                defaultChecked={album.allowNotes}
                className="h-4 w-4 rounded border-border"
              />
              Cho phép ghi chú
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="allowDownloads"
                defaultChecked={album.allowDownloads}
                className="h-4 w-4 rounded border-border"
              />
              Cho phép tải ảnh gốc
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="album-edit-expires">Link hết hạn</Label>
              <Input
                id="album-edit-expires"
                name="expiresAt"
                type="date"
                defaultValue={expiresAtValue(album.expiresAt)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="album-edit-password">Mật khẩu mới</Label>
              <Input
                id="album-edit-password"
                name="password"
                type="password"
                maxLength={72}
                autoComplete="new-password"
                placeholder={album.hasPassword ? "Để trống để giữ mật khẩu" : "Chưa đặt mật khẩu"}
                className="mt-1.5"
              />
            </div>
          </div>

          {album.hasPassword ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="clearPassword"
                className="h-4 w-4 rounded border-border"
              />
              Xóa mật khẩu hiện tại
            </label>
          ) : null}

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-[var(--warning)] dark:border-amber-900 dark:bg-amber-950/40">
            Đổi giới hạn chọn hoặc đơn giá chỉ áp dụng cho lần gửi lựa chọn tiếp
            theo. Yêu cầu thanh toán đã tạo không tự thu tiền.
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Đóng
            </Button>
            <SubmitButton pendingLabel="Đang lưu...">Lưu cấu hình</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
