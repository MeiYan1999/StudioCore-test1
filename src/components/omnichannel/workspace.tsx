"use client";
import { useCallback, useEffect, useState } from "react";
import type { bookingOffers } from "@/lib/db/schema";
import { command, type Package } from "./booking-form";
import { InboxView } from "./inbox-view";
import { MessagingSettingsView } from "./messaging-settings-view";
import "./workspace.css";

export type Thread = {
  id: string;
  subject: string | null;
  customer_name: string | null;
  phone: string | null;
  page_id: string | null;
  page_name: string | null;
  avatar: string | null;
  assigned_to: string | null;
  label: string | null;
  last_message_at: number | null;
  preview_direction: string | null;
  status: string;
  last_inbound_at: number;
  read_at: number;
  preview: string;
};
type Booking = {
  id: string;
  order_id: string;
  service_id: string;
  code: string;
  status: string;
  total: number;
  paid: number;
  remaining: number;
  deposit: number;
  location: string;
  package_name: string;
  start_at: number;
  expires_at: number;
};
export type Data = {
  owner: boolean;
  canDeposit: boolean;
  readiness: string;
  configured: boolean;
  pages: {
    id: string;
    name: string;
    avatar: string;
    status: string;
    lastEventAt: number | null;
  }[];
  branches: { id: string; name: string }[];
  threads: Thread[];
  services: Package[];
  offers: { service: Package; offer: typeof bookingOffers.$inferSelect }[];
  rooms: { id: string; name: string; branchId: string }[];
  staff: { id: string; name: string }[];
  customers: { id: string; name: string; phone: string }[];
  replies: { id: string; content: string }[];
  detail: null | {
    blocked: string | null;
    messages: {
      id: string;
      content: string;
      direction: string;
      sent_at: number;
      delivery_status: string | null;
      error: string | null;
      attachment: string | null;
    }[];
    notes: { id: string; content: string; staff_name: string }[];
    bookings: Booking[];
    history: {
      id: string;
      code: string;
      total: number;
      paid: number;
      remaining: number;
    }[];
  };
};
export function OmniWorkspace({ settings = false }: { settings?: boolean }) {
  const [data, setData] = useState<Data>();
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offerId, setOfferId] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/omni${id ? `?id=${id}` : ""}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
  async function act(input: object) {
    setBusy(true);
    setError("");
    try {
      const result = await command(input);
      await load();
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="omni">
        <h1>{settings ? "Kênh bán hàng · Facebook" : "Inbox"}</h1>
        <p role="status">{error || "Đang tải…"}</p>
      </div>
    );
  if (settings) {
    return (
      <MessagingSettingsView
        data={data}
        busy={busy}
        error={error}
        act={act}
        offerId={offerId}
        setOfferId={setOfferId}
      />
    );
  }
  return (
    <InboxView
      data={data}
      id={id}
      setId={(next) => {
        setData((current) => (current ? { ...current, detail: null } : current));
        setId(next);
      }}
      busy={busy}
      error={error}
      act={act}
      load={load}
    />
  );
}
