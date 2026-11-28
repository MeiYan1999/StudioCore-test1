"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
import {useRouter} from "next/navigation";
import {QRCodeSVG} from "qrcode.react";
import {Button} from "@/components/ui/button";
import {clockAtBranch} from "@/app/(app)/manage/check-in/actions";

const subscribeOrigin=()=>()=>{};
export function StudioClockQr({branch,code}:{branch:string;code:string}) {
  const router=useRouter();
  const origin=useSyncExternalStore(subscribeOrigin,()=>window.location.origin,()=>"");
  useEffect(()=>{const id=window.setInterval(()=>router.refresh(),30000);return()=>window.clearInterval(id);},[router]);
  const url=origin+"/manage/check-in?"+new URLSearchParams({branch,code});
  return origin && <div><a href={url} aria-label="Mở liên kết chấm công của mã QR"><QRCodeSVG value={url} size={186} marginSize={3}/></a><p>Nhân viên quét mã bằng camera điện thoại tại chi nhánh.</p></div>;
}
export function MobileClock({branch,code,checkout}:{branch:string;code:string;checkout:boolean}) {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const router=useRouter();
  function capture(){
    if(!navigator.geolocation){setMessage("Thiết bị chưa hỗ trợ vị trí.");return;}
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async p=>{
      try { setMessage(await clockAtBranch(branch,code,p.coords.latitude,p.coords.longitude,checkout));router.refresh(); }
      catch {setMessage("Mất kết nối. Hãy kiểm tra lại ca công.");} finally {setBusy(false);}
    },()=>{setMessage("Chưa lấy được vị trí. Cho phép truy cập GPS rồi thử lại.");setBusy(false);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  }
  return <div><Button disabled={busy} onClick={capture}>{busy?"Đang lấy vị trí…":checkout?"Kết thúc ca bằng GPS":"Vào ca bằng GPS"}</Button><p role="status">{message}</p></div>;
}
