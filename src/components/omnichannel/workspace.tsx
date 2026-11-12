"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { bookingOffers } from "@/lib/db/schema";
import {
  BookingForm,
  command,
  money,
  when,
  type Package,
} from "./booking-form";
import { MessagingSettingsView } from "./messaging-settings-view";
import "./workspace.css";

type Thread = {
  id: string;
  subject: string;
  customer_name: string | null;
  phone: string | null;
  page_id: string;
  page_name: string;
  assigned_to: string;
  label: string;
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
type Data = {
  owner: boolean;
  canDeposit: boolean;
  readiness: string;
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
      delivery_status: string;
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
  const [pane, setPane] = useState("list");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState("");
  const [label, setLabel] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [unread, setUnread] = useState(false);
  const [creating, setCreating] = useState(false);
  const [offerId, setOfferId] = useState("");
  const [service, setService] = useState("");
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
  const selected = data?.threads.find((t) => t.id === id);
  const packages =
    data?.offers.filter((o) => o.offer.active).map((o) => o.service) ?? [];
  const labels = ["Khách mới", "Đang tư vấn", "Chờ cọc", "Đã chốt"];
  if (!data)
    return (
      <div className="omni">
        <h1>{settings ? "Kênh bán hàng · Facebook" : "Inbox"}</h1>
        <p role="status">{error || "Đang tải…"}</p>
      </div>
    );
  const configuredService = offerId || data.services[0]?.id || "";
  const configured = data.offers.find(o => o.service.id === configuredService)?.offer;
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
    <div className="omni">
      <header>
        <div>
          <h1>Inbox</h1>
          <p>Tư vấn, đặt lịch và chốt đơn</p>
        </div>
        <Link href="/manage/settings/facebook">Kết nối Fanpage & lịch</Link>
      </header>
      {error && (
        <p role="alert" className="omni-error">
          {error}
        </p>
      )}
      {!data.pages.some((p) => p.status === "connected") && (
        <p className="omni-notice">
          {data.readiness} Kết nối Fanpage để nhận và gửi tin thật.
        </p>
      )}
      <nav className="omni-mobile">
        {[
          ["list", "Hội thoại"],
          ["chat", "Tin nhắn"],
          ["profile", "Khách & lịch"],
        ].map(([key, title]) => (
          <button
            key={key}
            onClick={() => setPane(key)}
            aria-pressed={pane === key}
          >
            {title}
          </button>
        ))}
      </nav>
      <div className={`omni-grid pane-${pane}`}>
        <aside className="omni-list">
          <input
            aria-label="Tìm khách"
            placeholder="Tìm khách, số điện thoại…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="omni-filters">
            <select
              aria-label="Fanpage"
              value={page}
              onChange={(e) => setPage(e.target.value)}
            >
              <option value="">Tất cả Fanpage</option>
              {data.pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Nhãn"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            >
              <option value="">Tất cả nhãn</option>
              {labels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
            <select
              aria-label="Nhân viên"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Mọi nhân viên</option>
              {data.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Mọi trạng thái</option>
              <option value="unanswered">Chưa trả lời</option>
              <option value="processing">Đang xử lý</option>
              <option value="replied">Đã trả lời</option>
            </select>
          </div>
          <label className="omni-check">
            <input
              type="checkbox"
              checked={unread}
              onChange={(e) => setUnread(e.target.checked)}
            />
            Chưa đọc
          </label>
          {data.threads
            .filter(
              (t) =>
                (!page || t.page_id === page) &&
                (!label || t.label === label) &&
                (!assignee || t.assigned_to === assignee) &&
                (!status || t.status === status) &&
                (!unread || t.last_inbound_at > t.read_at) &&
                `${t.customer_name} ${t.subject} ${t.phone}`
                  .toLowerCase()
                  .includes(q.toLowerCase()),
            )
            .map((t) => (
              <button
                className={`omni-thread ${id === t.id ? "selected" : ""}`}
                key={t.id}
                onClick={() => {
                  setData(current => current ? { ...current, detail: null } : current);
                    setId(t.id);
                  setPane("chat");
                  setDraft("");
                  setAttachment("");
                  void command({ action: "read", id: t.id }).catch(() => {});
                }}
              >
                <strong>
                  {t.customer_name || t.subject}
                  {t.last_inbound_at > t.read_at ? " •" : ""}
                </strong>
                <small>
                  {t.page_name || "Local"} · {t.label}
                </small>
                <span>{t.preview || "Chưa có tin nhắn"}</span>
              </button>
            ))}
          {!data.threads.length && (
            <p>
              Chưa có hội thoại được cấp quyền. Tin nhắn Fanpage mới sẽ xuất
              hiện tại đây.
            </p>
          )}
        </aside>
        <section className="omni-chat">
          <h2>
            {selected?.customer_name || selected?.subject || "Chọn hội thoại"}
          </h2>
          <div className="omni-messages">
            {data.detail?.messages.map((m) => (
              <article
                key={m.id}
                className={`omni-bubble ${m.direction === "outbound" ? "outbound" : ""}`}
              >
                <p>{m.content}</p>
                {m.attachment && (
                  <a href={m.attachment} target="_blank" rel="noreferrer">
                    Xem ảnh / tệp
                  </a>
                )}
                <small>
                  {when(m.sent_at)} · {m.delivery_status || "Local"}
                </small>
                {m.error && <p className="omni-error">{m.error}</p>}
              </article>
            ))}
          </div>
          {id && (
            <form
              className="omni-composer"
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await act({
                  action: "send",
                  id,
                  content: draft,
                  key: crypto.randomUUID(),
                  ...(attachment ? { attachment } : {}),
                });
                if (result?.status === "sent") {
                  setDraft("");
                  setAttachment("");
                }
              }}
            >
              <select
                aria-label="Câu trả lời mẫu"
                onChange={(e) => setDraft(e.target.value)}
                value=""
              >
                <option value="">Chèn câu trả lời mẫu</option>
                {data.replies.map((r) => (
                  <option key={r.id} value={r.content}>
                    {r.content}
                  </option>
                ))}
              </select>
              <textarea
                aria-label="Nội dung gửi"
                placeholder="Soạn tin nhắn…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
              />
              <input
                aria-label="URL ảnh"
                placeholder="URL ảnh HTTPS (tùy chọn)"
                value={attachment}
                onChange={(e) => setAttachment(e.target.value)}
              />
              {data.detail?.blocked && <p>{data.detail.blocked}</p>}
              <button
                disabled={
                  busy || !!data.detail?.blocked || (!draft && !attachment)
                }
              >
                Gửi Messenger
              </button>
              <button
                type="button"
                disabled={!draft || busy}
                onClick={() => act({ action: "reply", content: draft })}
              >
                Lưu câu trả lời mẫu
              </button>
            </form>
          )}
        </section>
        <aside className="omni-profile">
          <h2>Khách hàng & lịch chụp</h2>
          {selected && (
            <>
              <p>{selected.phone || "Khách chưa cung cấp số điện thoại"}</p>
              <p>Nguồn {selected.page_name ? "Facebook" : "Local"}</p>
              <label>
                Liên kết hồ sơ khách
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (
                      e.target.value &&
                      confirm(
                        "Xác nhận đây là hồ sơ của khách trong hội thoại?",
                      )
                    )
                      void act({
                        action: "linkCustomer",
                        id,
                        customerId: e.target.value,
                      });
                  }}
                >
                  <option value="">Chọn hồ sơ đã có</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone}
                    </option>
                  ))}
                </select>
              </label>
              {data.owner && (
                <label>
                  Phân công
                  <select
                    value={selected.assigned_to || ""}
                    onChange={(e) =>
                      act({ action: "assign", id, staffId: e.target.value })
                    }
                  >
                    <option value="">Chưa phân công</option>
                    {data.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Nhãn
                <select
                  value={selected.label || ""}
                  onChange={(e) =>
                    act({ action: "label", id, label: e.target.value })
                  }
                >
                  {labels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label>
                Xử lý
                <select
                  value={selected.status}
                  onChange={(e) =>
                    act({ action: "status", id, status: e.target.value })
                  }
                >
                  <option value="unanswered">Chưa trả lời</option>
                  <option value="processing">Đang xử lý</option>
                  <option value="replied">Đã trả lời</option>
                </select>
              </label>
              <label>
                Gói gửi khách
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  <option value="">Chọn gói chụp</option>
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={!service || busy}
                onClick={async () => {
                  const r = await act({
                    action: "link",
                    id,
                    serviceId: service,
                  });
                  if (r) {
                    setDraft(`Bạn đặt lịch chụp tại ${r.url}`);
                    setPane("chat");
                  }
                }}
              >
                Gửi link đặt lịch
              </button>
              <button onClick={() => setCreating(!creating)}>
                Tạo lịch chụp / Tạo đơn
              </button>
              {creating && (
                <BookingForm
                  key={id}
                  packages={packages}
                  conversationId={id}
                  onDone={() => {
                    setCreating(false);
                    void load();
                  }}
                />
              )}
              <h3>Lịch & đơn từ Inbox</h3>
              {data.detail?.bookings.map((b) => (
                <article className="omni-booking" key={b.id}>
                  <Link href={`/manage/orders/${b.order_id}`}>
                    <strong>
                      {b.code} · {b.package_name}
                    </strong>
                  </Link>
                  <p>{when(b.start_at)}</p>
                  <p>
                    {
                      (
                        {
                          held: "Giữ chỗ",
                          confirmed: "Đã xác nhận",
                          completed: "Hoàn thành",
                          expired: "Hết hạn",
                          cancelled: "Đã hủy",
                        } as Record<string, string>
                      )[b.status]
                    }
                  </p>
                  <p>
                    Tổng {money(b.total)} · Cọc đã nhận {money(b.paid)} · Còn{" "}
                    {money(b.remaining)}
                  </p>
                  {b.status === "held" && (
                    <small>Giữ đến {when(b.expires_at)}</small>
                  )}
                  {["held", "confirmed"].includes(b.status) && (
                    <>
                      {data.canDeposit && (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void act({
                              action: "booking",
                              id: b.id,
                              operation: "deposit",
                              key: crypto.randomUUID(),
                              amount: Number(f.get("amount")),
                              reference: String(f.get("reference")),
                            });
                          }}
                        >
                          <label>
                            Cọc thực nhận
                            <input
                              required
                              name="amount"
                              type="number"
                              min="1"
                              max={b.remaining}
                            />
                          </label>
                          <input
                            name="reference"
                            aria-label="Mã tham chiếu"
                            placeholder="Mã tham chiếu chuyển khoản"
                          />
                          <button disabled={busy}>Xác nhận nhận cọc</button>
                        </form>
                      )}
                      {b.paid >= b.deposit && b.status === "held" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            act({
                              action: "booking",
                              id: b.id,
                              operation: "confirm",
                              key: crypto.randomUUID(),
                            })
                          }
                        >
                          Xác nhận lịch
                        </button>
                      )}
                      <details>
                        <summary>Đổi lịch</summary>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            void act({
                              action: "booking",
                              id: b.id,
                              operation: "reschedule",
                              date: f.get("date"),
                              time: f.get("time"),
                              key: crypto.randomUUID(),
                            });
                          }}
                        >
                          <input
                            aria-label="Ngày mới"
                            name="date"
                            type="date"
                            required
                          />
                          <input
                            aria-label="Giờ mới"
                            name="time"
                            type="time"
                            required
                          />
                          <button disabled={busy}>Lưu giờ mới</button>
                        </form>
                      </details>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "Hủy lịch và đơn này? Khoản tiền đã nhận vẫn lưu để xử lý hoàn tiền.",
                            )
                          )
                            void act({
                              action: "booking",
                              id: b.id,
                              operation: "cancel",
                              key: crypto.randomUUID(),
                            });
                        }}
                      >
                        Hủy lịch / đơn
                      </button>
                      {b.status === "confirmed" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            act({
                              action: "booking",
                              id: b.id,
                              operation: "complete",
                              key: crypto.randomUUID(),
                            })
                          }
                        >
                          Hoàn thành
                        </button>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => {
                      setDraft(
                        `Studio xác nhận đơn ${b.code}\nGói: ${b.package_name}\nLịch: ${when(b.start_at)}\nĐịa điểm: ${b.location || "Vui lòng bổ sung địa điểm"}\nĐã cọc: ${money(b.paid)}\nCòn lại: ${money(b.remaining)}\nTrạng thái: ${b.status}`,
                      );
                      setPane("chat");
                    }}
                  >
                    Soạn xác nhận để xem và gửi
                  </button>
                </article>
              ))}
              <h3>Lịch sử đơn của khách</h3>
              {data.detail?.history.map((o) => (
                <p key={o.id}>
                  <Link href={`/manage/orders/${o.id}`}>{o.code}</Link> · Đã thu{" "}
                  {money(o.paid)} · Còn {money(o.remaining)}
                </p>
              ))}
              <h3>Ghi chú nội bộ</h3>
              {data.detail?.notes.map((n) => (
                <p key={n.id}>
                  {n.content}
                  <small> — {n.staff_name}</small>
                </p>
              ))}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  if (
                    await act({ action: "note", id, content: f.get("content") })
                  )
                    form.reset();
                }}
              >
                <textarea
                  aria-label="Ghi chú nội bộ"
                  name="content"
                  required
                  maxLength={2000}
                />
                <button disabled={busy}>Lưu ghi chú</button>
              </form>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
