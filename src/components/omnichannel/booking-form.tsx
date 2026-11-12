"use client";
import { useEffect, useRef, useState } from "react";
export type Package = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
  description?: string | null;
  image?: string | null;
};
export const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
export const when = (value: number) =>
  new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
export async function command(input: object) {
  const response = await fetch("/api/omni", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Thao tác thất bại");
  return data;
}
export function BookingForm({
  packages,
  conversationId,
  token,
  onDone,
}: {
  packages: Package[];
  conversationId?: string;
  token?: string;
  onDone?: () => void;
}) {
  const [serviceId, setService] = useState(packages[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const requestKey = useRef("");
  useEffect(() => {
    let current = true;
    if (date && serviceId)
      fetch(
        `/api/booking?serviceId=${encodeURIComponent(serviceId)}&date=${date}`,
      )
        .then((r) => r.json())
        .then((d) => {
          if (current) {
            setSlots(d.slots ?? []);
            setNotice(d.error ?? "");
          }
        })
        .catch(() => {
          if (current) setNotice("Không tải được giờ trống.");
        });
    return () => {
      current = false;
    };
  }, [date, serviceId]);
  return (
    <form
      className="omni-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNotice("");
        const f = new FormData(e.currentTarget);
        requestKey.current ||= crypto.randomUUID();
        const key = requestKey.current;
        const input = {
          serviceId,
          date,
          time: String(f.get("time")),
          name: String(f.get("name")),
          phone: String(f.get("phone")),
          notes: String(f.get("notes")),
          key,
          token,
        };
        try {
          if (conversationId)
            await command({
              ...input,
              action: "book",
              id: conversationId,
              surcharge: Number(f.get("surcharge")),
              discount: Number(f.get("discount")),
              deposit: Number(f.get("deposit")),
            });
          else {
            const r = await fetch("/api/booking", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
          }
          setNotice(
            "Đã giữ chỗ. Studio sẽ liên hệ để xác nhận và hướng dẫn đặt cọc.",
          );
          onDone?.();
        } catch (error) {
          setNotice((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Gói chụp
        <select
          value={serviceId}
          onChange={(e) => {
            setSlots([]);
            setService(e.target.value);
          }}
        >
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {money(p.price)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Họ tên
        <input name="name" required maxLength={120} />
      </label>
      <label>
        Số điện thoại
        <input name="phone" type="tel" required maxLength={20} />
      </label>
      <label>
        Ngày chụp
        <input
          type="date"
          required
          value={date}
          onChange={(e) => {
            setSlots([]);
            setDate(e.target.value);
          }}
        />
      </label>
      <label>
        Giờ trống · giờ Việt Nam
        <select name="time" required key={`${date}:${serviceId}`}>
          <option value="">Chọn giờ</option>
          {slots.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      {date && !slots.length && <p>Chưa có khung giờ trống trong ngày này.</p>}
      {conversationId && (
        <>
          <label>
            Phụ phí (VND)
            <input name="surcharge" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Giảm giá (VND)
            <input name="discount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Cọc yêu cầu (VND)
            <input name="deposit" type="number" min="0" defaultValue="0" />
          </label>
        </>
      )}
      <label>
        Ghi chú
        <textarea name="notes" maxLength={2000} />
      </label>
      <button disabled={busy || !slots.length}>
        {busy
          ? "Đang giữ chỗ…"
          : conversationId
            ? "Tạo đơn và giữ lịch"
            : "Đặt lịch"}
      </button>
      {notice && <p role="status">{notice}</p>}
    </form>
  );
}
