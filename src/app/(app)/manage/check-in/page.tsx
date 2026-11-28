import { and, desc, eq } from "drizzle-orm";
import { requireActor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { attendance } from "@/lib/db/schema";
import { hasPermission } from "@/lib/auth/permissions";
import { attendanceFence, makeAttendanceCode } from "@/lib/services/self-attendance-service";
import { MobileClock, StudioClockQr } from "@/components/hr/mobile-clock";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DateTimeText } from "@/components/shared/date-time";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SubmitButton } from "@/components/shared/submit-button";
import { setFence } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Chấm công GPS + QR" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; code?: string; result?: string }>;
}) {
  const actor = await requireActor();
  const db = getDb();
  const params = await searchParams;
  const branch = actor.branches.find((b) => b.id === (params.branch || actor.activeBranchId || actor.branches[0]?.id));
  if (!branch) {
    return (
      <EmptyState
        title="Chi nhánh không có trong hồ sơ của bạn"
        description="Chọn lại chi nhánh bằng liên kết chấm công hoặc liên hệ chủ studio để được gán chi nhánh."
      />
    );
  }
  const admin = hasPermission(actor.permissions, "staff.manage");
  const fence = attendanceFence(db, actor.tenantId, branch.id);
  const code = admin && !params.code && makeAttendanceCode(db, actor, branch.id);
  const shifts = db
    .select()
    .from(attendance)
    .where(and(eq(attendance.tenantId, actor.tenantId), eq(attendance.staffId, actor.staffId)))
    .orderBy(desc(attendance.checkInAt))
    .limit(10)
    .all();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader className="mb-2" title="Chấm công GPS + QR" description={actor.staffName + " · " + branch.name} />
      {params.result ? <Alert tone="info" role="status">{params.result}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Ca làm việc</CardTitle>
        </CardHeader>
        <CardContent>
          {params.code ? (
            <MobileClock branch={branch.id} code={params.code} checkout={Boolean(shifts[0] && !shifts[0].checkOutAt)} />
          ) : (
            <p className="text-sm text-muted-foreground">Quét mã QR đang hiển thị tại chi nhánh để vào hoặc kết thúc ca.</p>
          )}
        </CardContent>
      </Card>

      {code ? (
        <Card>
          <CardHeader>
            <CardTitle>Mã QR tại chi nhánh</CardTitle>
          </CardHeader>
          <CardContent>
            <StudioClockQr code={code} branch={branch.id} />
          </CardContent>
        </Card>
      ) : null}

      {admin && !params.code ? (
        <Card>
          <details open={!fence}>
            <summary className="cursor-pointer p-5 text-base font-semibold">Cấu hình vị trí chấm công</summary>
            <div className="space-y-4 px-5 pb-5">
              <form className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="fence-branch-select">Chi nhánh</Label>
                  <Select id="fence-branch-select" name="branch" defaultValue={branch.id} className="mt-1.5">
                    {actor.branches.map((b) => (
                      <option value={b.id} key={b.id}>{b.name}</option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="outline">Chọn</Button>
              </form>
              <form action={setFence} className="space-y-3 border-t border-border pt-4">
                <input type="hidden" name="branch" value={branch.id} />
                <div>
                  <Label htmlFor="fence-lat">Vĩ độ</Label>
                  <Input id="fence-lat" required type="number" step="any" name="lat" defaultValue={fence?.lat} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="fence-lng">Kinh độ</Label>
                  <Input id="fence-lng" required type="number" step="any" name="lng" defaultValue={fence?.lng} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="fence-radius">Bán kính (m)</Label>
                  <Input id="fence-radius" required name="radius" type="number" min="10" max="2000" defaultValue={fence?.radius ?? 100} className="mt-1.5" />
                </div>
                <SubmitButton pendingLabel="Đang lưu...">Lưu vị trí</SubmitButton>
              </form>
            </div>
          </details>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ca gần nhất của tôi</CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có ca nào được ghi nhận.</p>
          ) : (
            <ul className="divide-y divide-border">
              {shifts.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <DateTimeText value={s.checkInAt} />
                  {s.checkOutAt ? <DateTimeText value={s.checkOutAt} /> : <Badge tone="warning">Đang trong ca</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
