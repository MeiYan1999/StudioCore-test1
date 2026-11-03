"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, LogIn, LogOut, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
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
import { initialActionState } from "@/lib/actions/action-state";
import {
  checkInAction,
  checkOutAction,
  createLeaveAction,
  setLeaveStatusAction,
  updateStaffSalaryAction,
} from "@/lib/actions/payroll-hr-actions";

type StaffOption = { id: string; name: string; code: string };
type BranchOption = { id: string; name: string };

export function StaffSalarySheet({
  staffId,
  staffName,
  baseSalary,
}: {
  staffId: string;
  staffName: string;
  baseSalary: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await updateStaffSalaryAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã cập nhật lương.");
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
        <Button variant="ghost" size="sm">Sửa lương</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Lương cơ bản — {staffName}</SheetTitle>
          <SheetDescription>
            Thay đổi lương cơ bản áp dụng cho kỳ lương tạo mới; bảng lương cũ giữ snapshot.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <input type="hidden" name="staffId" value={staffId} />
          <div>
            <Label htmlFor="staff-base-salary">Lương cơ bản tháng (VND)</Label>
            <Input
              id="staff-base-salary"
              name="baseSalary"
              type="number"
              min={0}
              step={100000}
              defaultValue={baseSalary}
              className="mt-1.5"
            />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Lưu lương</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function AttendanceCheckInSheet({
  staff,
  branches,
  defaultBranchId,
}: {
  staff: StaffOption[];
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await checkInAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã check-in.");
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
          <LogIn className="h-4 w-4" aria-hidden />
          Check-in
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Chấm công check-in</SheetTitle>
          <SheetDescription>
            Hỗ trợ thủ công/GPS/QR; lưu vị trí và thiết bị nếu có.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="attendance-staff">Nhân sự</Label>
            <Select id="attendance-staff" name="staffId" defaultValue={staff[0]?.id ?? ""} className="mt-1.5">
              {staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="attendance-branch">Chi nhánh</Label>
            <Select id="attendance-branch" name="branchId" defaultValue={defaultBranchId} className="mt-1.5">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="attendance-method">Phương thức</Label>
              <Select id="attendance-method" name="method" defaultValue="manual" className="mt-1.5">
                <option value="manual">Thủ công</option>
                <option value="gps">GPS</option>
                <option value="qr">QR</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="attendance-time">Giờ vào</Label>
              <Input id="attendance-time" name="checkIn" type="datetime-local" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="attendance-lat">Latitude</Label>
              <Input id="attendance-lat" name="latitude" placeholder="10.7769" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="attendance-lng">Longitude</Label>
              <Input id="attendance-lng" name="longitude" placeholder="106.7009" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="attendance-device">Thiết bị</Label>
            <Input id="attendance-device" name="device" className="mt-1.5" placeholder="Máy tính studio..." />
          </div>
          <div>
            <Label htmlFor="attendance-notes">Ghi chú</Label>
            <Textarea id="attendance-notes" name="notes" rows={2} className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang lưu...">Check-in</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function CheckOutButton({ attendanceId }: { attendanceId: string }) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await checkOutAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã check-out.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không check-out được.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="attendanceId" value={attendanceId} />
      <input type="hidden" name="checkOut" value="" />
      <SubmitButton variant="outline" size="sm" pendingLabel="...">
        <LogOut className="h-3.5 w-3.5" aria-hidden />
        Check-out
      </SubmitButton>
    </form>
  );
}

export function LeaveCreateSheet({
  staff,
  branches,
  defaultBranchId,
}: {
  staff: StaffOption[];
  branches: BranchOption[];
  defaultBranchId: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await createLeaveAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã gửi đơn nghỉ.");
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
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          Tạo đơn nghỉ
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tạo đơn nghỉ phép</SheetTitle>
          <SheetDescription>
            Nhân sự thường chỉ tạo cho mình; owner có thể tạo cho nhân sự khác.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="space-y-4">
          {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
          <div>
            <Label htmlFor="leave-staff">Nhân sự</Label>
            <Select id="leave-staff" name="staffId" defaultValue={staff[0]?.id ?? ""} className="mt-1.5">
              {staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.code}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="leave-branch">Chi nhánh</Label>
            <Select id="leave-branch" name="branchId" defaultValue={defaultBranchId} className="mt-1.5">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="leave-start">Từ</Label>
              <Input id="leave-start" name="startAt" type="datetime-local" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="leave-end">Đến</Label>
              <Input id="leave-end" name="endAt" type="datetime-local" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="leave-reason">Lý do</Label>
            <Textarea id="leave-reason" name="reason" rows={3} className="mt-1.5" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Đang gửi...">Gửi đơn</SubmitButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function LeaveStatusButtons({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [, formAction] = useActionState(
    async (previousState: typeof initialActionState, formData: FormData) => {
      const result = await setLeaveStatusAction(previousState, formData);
      if (result.status === "success") {
        toast.success(result.message ?? "Đã xử lý đơn nghỉ.");
        router.refresh();
      } else if (result.status === "error") {
        toast.error(result.message ?? "Không xử lý được đơn nghỉ.");
      }
      return result;
    },
    initialActionState,
  );
  return (
    <div className="flex justify-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="leaveId" value={leaveId} />
        <input type="hidden" name="status" value="approved" />
        <SubmitButton variant="outline" size="sm" pendingLabel="...">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Duyệt
        </SubmitButton>
      </form>
      <form action={formAction}>
        <input type="hidden" name="leaveId" value={leaveId} />
        <input type="hidden" name="status" value="rejected" />
        <SubmitButton variant="ghost" size="sm" pendingLabel="...">
          <X className="h-3.5 w-3.5" aria-hidden />
          Từ chối
        </SubmitButton>
      </form>
    </div>
  );
}

export function AttendanceNowLabel() {
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" aria-hidden />
      Giờ để trống = thời điểm hiện tại
    </span>
  );
}
