"use server";
import {requireActor} from "@/lib/auth/session";
import {getDb} from "@/lib/db/client";
import {saveAttendanceFence,selfAttendance} from "@/lib/services/self-attendance-service";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";

export async function clockAtBranch(branch:string,code:string,lat:number,lng:number,checkout:boolean) {
  try {
    selfAttendance(getDb(),await requireActor(),branch,code,{lat,lng},checkout);
    revalidatePath("/manage/check-in");
    revalidatePath("/manage/staff/attendance");
    return checkout?"Đã kết thúc ca.":"Đã vào ca.";
  } catch(err) {return err instanceof Error?err.message:"Không ghi được ca.";}
}
export async function setFence(form:FormData) {
  const branch=String(form.get("branch"));
  let result="Đã lưu vị trí.";
  try {
    const number=(key:string)=>String(form.get(key)??"").trim()?Number(form.get(key)):NaN;
    saveAttendanceFence(getDb(),await requireActor(),branch,{lat:number("lat"),lng:number("lng"),radius:number("radius")});
  } catch { result="Không thể lưu. Kiểm tra quyền, tọa độ và bán kính 10–2000 m."; }
  revalidatePath("/manage/check-in");
  redirect("/manage/check-in?branch="+encodeURIComponent(branch)+"&result="+encodeURIComponent(result));
}
