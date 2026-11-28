import {and,desc,eq} from "drizzle-orm";
import {requireActor} from "@/lib/auth/session";
import {getDb} from "@/lib/db/client";
import {attendance} from "@/lib/db/schema";
import {hasPermission} from "@/lib/auth/permissions";
import {attendanceFence,makeAttendanceCode} from "@/lib/services/self-attendance-service";
import {MobileClock,StudioClockQr} from "@/components/hr/mobile-clock";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Select} from "@/components/ui/select";
import {formatDateTime} from "@/lib/utils";
import {setFence} from "./actions";
export default async function Page({searchParams}:{searchParams:Promise<{branch?:string;code?:string;result?:string}>}) {
  const actor=await requireActor(), db=getDb(), params=await searchParams;
  const branch=actor.branches.find(b=>b.id===(params.branch||actor.activeBranchId||actor.branches[0]?.id));
  if(!branch)return <p>Chi nhánh không có trong hồ sơ của bạn.</p>;
  const admin=hasPermission(actor.permissions,"staff.manage"), fence=attendanceFence(db,actor.tenantId,branch.id);
  const code=admin && !params.code && makeAttendanceCode(db,actor,branch.id);
  const shifts=db.select().from(attendance).where(and(eq(attendance.tenantId,actor.tenantId),eq(attendance.staffId,actor.staffId))).orderBy(desc(attendance.checkInAt)).limit(10).all();
  return <main className="mx-auto max-w-md space-y-5 p-3"><h1 className="text-xl font-bold">Chấm công GPS + QR</h1><p>{actor.staffName} · {branch.name}</p>
    {params.code?<MobileClock branch={branch.id} code={params.code} checkout={Boolean(shifts[0]&&!shifts[0].checkOutAt)}/>:<p>Quét mã QR đang hiển thị tại chi nhánh để vào hoặc kết thúc ca.</p>}
    {code && <StudioClockQr code={code} branch={branch.id}/>}
    {admin && !params.code && <details open={!fence}><summary>Cấu hình vị trí chấm công</summary><form><label>Chi nhánh<Select name="branch" defaultValue={branch.id}>{actor.branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</Select></label><Button type="submit" variant="outline">Chọn</Button></form>
    <form action={setFence}><input type="hidden" name="branch" value={branch.id}/><label>Vĩ độ<Input required type="number" step="any" name="lat" defaultValue={fence?.lat}/></label><label>Kinh độ<Input required type="number" step="any" name="lng" defaultValue={fence?.lng}/></label><label>Bán kính (m)<Input required name="radius" type="number" min="10" max="2000" defaultValue={fence?.radius??100}/></label><Button type="submit">Lưu vị trí</Button></form></details>}
    {params.result && <p role="status">{params.result}</p>}<h2 className="font-semibold">Ca gần nhất của tôi</h2>{shifts.map(s=><p key={s.id}>{formatDateTime(s.checkInAt)} · {s.checkOutAt?formatDateTime(s.checkOutAt):"Đang trong ca"}</p>)}</main>;
}
