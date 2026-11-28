import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { ActorContext } from "../auth/types";
import { assertBranchAccess, assertPermission } from "../auth/permissions";
import type { AppDb } from "../db/client";
import { attendance, staffBranches, settings } from "../db/schema";
import { getEnv } from "../env";
import { setTenantSetting } from "./settings-write-service";

const location = z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
const fenceSchema = location.extend({radius:z.number().int().min(10).max(2000)});
const key = (branch:string) => "attendance.gpsqr."+branch;
export function attendanceFence(db:AppDb, tenantId:string, branch:string) {
  const row=db.select({value:settings.value}).from(settings).where(and(eq(settings.tenantId,tenantId),eq(settings.key,key(branch)),isNull(settings.branchId))).get();
  return row ? fenceSchema.parse(JSON.parse(row.value)) : null;
}
export function saveAttendanceFence(db:AppDb,actor:ActorContext,branch:string,config:z.infer<typeof fenceSchema>) {
  assertPermission(actor,"staff.manage"); assertBranchAccess(actor,branch);
  setTenantSetting(db,actor.tenantId,key(branch),JSON.stringify(fenceSchema.parse(config)));
}
const slotLength=60000;
function signature(tenantId:string,branch:string,slot:number) {
  return createHmac("sha256",getEnv().AUTH_SECRET).update(JSON.stringify(["attendance",tenantId,branch,slot])).digest("base64url");
}
export function makeAttendanceCode(db:AppDb,actor:ActorContext,branch:string,now=Date.now()) {
  assertPermission(actor,"staff.manage"); assertBranchAccess(actor,branch);
  if (!attendanceFence(db,actor.tenantId,branch)) return null;
  const slot=Math.floor(now/slotLength);
  return slot+"."+signature(actor.tenantId,branch,slot);
}
export function selfAttendance(db:AppDb,actor:ActorContext,branch:string,code:string,position:z.infer<typeof location>,checkout:boolean,now=Date.now()) {
  if(actor.readOnly||actor.planLapsed) throw new Error("Tài khoản đang chỉ đọc.");
  assertBranchAccess(actor,branch);
  const assigned=db.select().from(staffBranches).where(and(eq(staffBranches.tenantId,actor.tenantId),eq(staffBranches.staffId,actor.staffId),eq(staffBranches.branchId,branch))).get();
  if(!assigned) throw new Error("Bạn chưa được phân công tại chi nhánh này.");
  const fence=attendanceFence(db,actor.tenantId,branch);
  if(!fence) throw new Error("Chi nhánh chưa cấu hình GPS và QR.");
  const [raw,mac]=code.split(".");
  const slot=Number(raw);
  const expected=signature(actor.tenantId,branch,slot);
  if (!mac || !/^\d+\.[\w-]{43}$/.test(code) || slot>Math.floor(now/slotLength) || slot<Math.floor(now/slotLength)-1 || !timingSafeEqual(Buffer.from(mac),Buffer.from(expected))) throw new Error("QR đã hết hạn hoặc không thuộc chi nhánh.");
  const {lat,lng}=location.parse(position);
  const rad=(degrees:number)=>degrees*Math.PI/180;
  const a=Math.sin(rad(lat-fence.lat)/2)**2+Math.cos(rad(lat))*Math.cos(rad(fence.lat))*Math.sin(rad(lng-fence.lng)/2)**2;
  if(12742000*Math.asin(Math.sqrt(Math.min(1,a)))>fence.radius) throw new Error("Vị trí nằm ngoài bán kính chấm công.");
  return db.transaction(tx=>{
    const open=tx.select().from(attendance).where(and(eq(attendance.tenantId,actor.tenantId),eq(attendance.staffId,actor.staffId),isNull(attendance.checkOutAt))).get();
    if(checkout) {
      if(!open || open.branchId!==branch) throw new Error("Không có ca mở tại chi nhánh.");
      tx.update(attendance).set({checkOutAt:new Date(now),updatedAt:new Date(now)}).where(eq(attendance.id,open.id)).run();
      return open.id;
    }
    if(open) throw new Error("Bạn đang có ca chưa kết thúc.");
    const id=crypto.randomUUID();
    tx.insert(attendance).values({id,tenantId:actor.tenantId,branchId:branch,staffId:actor.staffId,createdBy:actor.staffId,method:"gps_qr",checkInAt:new Date(now),latitude:String(lat),longitude:String(lng)}).run();
    return id;
  },{behavior:"immediate"});
}
