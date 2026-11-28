"use client";
import { useState } from "react";
import type { TaxReport } from "@/lib/services/report-service";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function HouseholdLedger({ report, name, address, taxCode, location }: {report:TaxReport; name:string; address:string; taxCode:string; location:string}) {
  const [form,setForm]=useState("");
  const [groups,setGroups]=useState<Record<string,string>>({});
  const [person,setPerson]=useState("");
  const [place,setPlace]=useState(location);
  const [holder,setHolder]=useState(name);
  const [tax,setTax]=useState(taxCode);
  const [home,setHome]=useState(address);
  const isS2=form==="S2a-HKD";
  const grouped=new Map<string,TaxReport["rows"]>();
  for(const row of [...report.rows].reverse()){
    const key=isS2 ? (groups[row.invoiceNo]??"").trim() : "";
    grouped.set(key,[...(grouped.get(key)??[]),row]);
  }
  const inputStyle="border-b px-1 print:border-0";
  if(report.from<"2026-01-01") return <p>Mẫu theo Thông tư 152/2025/TT-BTC áp dụng từ 01/01/2026. Hãy chọn kỳ phù hợp.</p>;
  return <article className="space-y-4 text-sm"><div className="no-print space-y-2"><label>Chế độ kế toán hộ kinh doanh<Select value={form} onChange={e=>setForm(e.target.value)}>
    <option value="">Chọn theo nghĩa vụ thuế của hộ</option><option value="S1a-HKD">S1a-HKD · Không chịu thuế GTGT và không phải nộp thuế TNCN</option>
    <option value="S2a-HKD">S2a-HKD · Nộp thuế GTGT và TNCN theo tỷ lệ trên doanh thu</option></Select></label>
    <p>Dữ liệu ban đầu lấy từ hóa đơn đã phát hành trong kỳ. Rà soát doanh thu ngoài hóa đơn, chứng từ điều chỉnh, địa điểm và người đại diện trước khi in. Chỉnh sửa ở màn hình này chỉ áp dụng cho lần in hiện tại.</p>
    <a href="https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/01/152-btc.pdf" target="_blank" rel="noreferrer" className="underline">Thông tư 152/2025/TT-BTC, Điều 4–6</a></div>
    {form && <><header className="grid grid-cols-2 gap-4"><div><label>Hộ, cá nhân kinh doanh <input className={inputStyle} value={holder} onChange={e=>setHolder(e.target.value)}/></label><br/>
    <label>Địa chỉ <input className={inputStyle} value={home} onChange={e=>setHome(e.target.value)}/></label><br/>
    <label>Mã số thuế <input className={inputStyle} value={tax} onChange={e=>setTax(e.target.value)}/></label></div><div className="text-center">Mẫu số {form}<br/>Thông tư số 152/2025/TT-BTC ngày 31/12/2025 của Bộ trưởng Bộ Tài chính</div></header>
    <div className="text-center"><h1 className="font-bold">SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ</h1><label>Địa điểm kinh doanh <input className={inputStyle} value={place} onChange={e=>setPlace(e.target.value)} placeholder="Bổ sung địa điểm"/></label><p>Kỳ kê khai {report.from} – {report.to}</p></div>
    <p className="text-right">Đơn vị tính đồng</p><table className="w-full border-collapse text-left [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:p-1"><thead><tr>{isS2 && <th>Số hiệu chứng từ</th>}<th>Ngày tháng</th><th>Diễn giải</th><th>Số tiền</th></tr></thead>
    {Array.from(grouped).map(([key,rows])=><tbody key={key}>{isS2 && <tr><th colSpan={4}>Ngành nghề {key||"chưa phân loại"}</th></tr>}
    {rows.map(row=><tr key={row.invoiceNo}>{isS2 && <td>{row.invoiceNo}</td>}<td>{formatDate(row.issuedAt)}</td><td>{row.invoiceNo} · {row.orderCode} · {row.customerName}{isS2 && <input className="no-print block border" aria-label={"Ngành nghề "+row.invoiceNo} defaultValue={key} placeholder="Nhập ngành nghề rồi rời ô" onBlur={e=>setGroups(prev=>({...prev,[row.invoiceNo]:e.target.value}))}/>}</td><td>{row.total.toLocaleString("vi-VN")}</td></tr>)}
    <tr><th colSpan={isS2?3:2}>Tổng cộng {key}</th><th>{rows.reduce((n,r)=>n+r.total,0).toLocaleString("vi-VN")}</th></tr>
    {isS2 && ["Thuế GTGT","Thuế TNCN"].map(label=><tr key={label}><td colSpan={3}>{label}</td><td><Input type="number" min="0" aria-label={label+" "+key} placeholder="Kế toán bổ sung"/></td></tr>)}</tbody>)}</table>
    <div className="ml-auto w-fit text-center"><label>Ngày ký <input type="date" className={inputStyle}/></label><p>NGƯỜI ĐẠI DIỆN HỘ KINH DOANH / CÁ NHÂN KINH DOANH</p><p>(Ký, ghi rõ họ tên, đóng dấu nếu có)</p><input className={inputStyle} aria-label="Người đại diện" value={person} onChange={e=>setPerson(e.target.value)} placeholder="Bổ sung họ tên"/></div>
    <div className="no-print">{(!holder||!tax||!home||!place||!person||isS2 && grouped.has("")) && <p>Còn thiếu thông tin hộ, người ký hoặc phân loại ngành nghề. Vui lòng rà soát trước khi dùng.</p>}<Button onClick={()=>window.print()}>In / lưu PDF bản nháp {form}</Button></div></>}</article>;
}
