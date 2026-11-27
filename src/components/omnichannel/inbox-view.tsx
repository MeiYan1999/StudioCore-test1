"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleAlert,
  Clock,
  ImagePlus,
  MessageCircle,
  Plug,
  Search,
  Send,
  Settings,
  UserRound,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookingForm, command, money, when } from "./booking-form";
import type { Data, Thread } from "./workspace";

const LABELS = ["Khách mới", "Đang tư vấn", "Chờ cọc", "Đã chốt"] as const;
const LABEL_STYLE: Record<string, string> = {
  "Khách mới": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  "Đang tư vấn":
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "Chờ cọc":
    "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  "Đã chốt":
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};
const STATUS: Record<string, string> = {
  unanswered: "Chưa trả lời",
  processing: "Đang xử lý",
  replied: "Đã trả lời",
};
const BOOKING_STATUS: Record<string, string> = {
  held: "Giữ chỗ",
  confirmed: "Đã xác nhận",
  completed: "Hoàn thành",
  expired: "Hết hạn",
  cancelled: "Đã hủy",
};
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-600",
  "bg-orange-500",
];
const field =
  "w-full rounded-lg border border-[var(--input-border)] bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]";
const DAY = 86400000;
const VN = "Asia/Ho_Chi_Minh";
const dayKey = (value: number) =>
  new Date(value).toLocaleDateString("vi-VN", { timeZone: VN });

function shortTime(value: number | null, now: number) {
  if (!value) return "";
  const diff = now - value;
  if (diff < 60000) return "Vừa xong";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
  if (dayKey(value) === dayKey(now))
    return new Date(value).toLocaleTimeString("vi-VN", {
      timeZone: VN,
      hour: "2-digit",
      minute: "2-digit",
    });
  return new Date(value).toLocaleDateString("vi-VN", {
    timeZone: VN,
    day: "2-digit",
    month: "2-digit",
  });
}

function Avatar({
  name,
  src,
  size = "h-11 w-11",
}: {
  name: string;
  src?: string | null;
  size?: string;
}) {
  const [failed, setFailed] = useState("");
  const color =
    AVATAR_COLORS[
      [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) %
        AVATAR_COLORS.length
    ];
  if (src && failed !== src)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(src)}
        className={cn("shrink-0 rounded-full object-cover", size)}
      />
    );
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white",
        size,
        color,
      )}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

const threadName = (t: Thread) => t.customer_name || t.subject || "Khách";
const isUnread = (t: Thread) => t.last_inbound_at > t.read_at;

function ConnectPanel({
  data,
  busy,
  act,
}: {
  data: Data;
  busy: boolean;
  act: (input: object) => Promise<unknown>;
}) {
  const pending = data.pages.filter((p) => p.status !== "connected");
  const [branchId, setBranchId] = useState(data.branches[0]?.id ?? "");
  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Kết nối Fanpage Facebook
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {!data.configured
                ? "Hệ thống chưa bật kết nối Facebook. Sau khi chủ hệ thống cấu hình ứng dụng Meta, nút kết nối sẽ dùng được tại đây."
                : data.owner
                  ? "Đăng nhập Facebook, chọn các Fanpage của studio rồi bật nhận tin. Tin nhắn khách gửi vào Fanpage sẽ hiện ngay trong Inbox này."
                  : "Chủ studio cần kết nối Fanpage để nhận và trả lời tin nhắn tại đây."}
            </p>
          </div>
        </div>
        {data.owner && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {data.branches.length > 1 && (
              <select
                aria-label="Chi nhánh nhận tin của Fanpage"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className={cn(field, "w-auto py-2")}
              >
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              disabled={!data.configured}
              onClick={() => {
                window.location.href = `/api/facebook/oauth${
                  branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""
                }`;
              }}
            >
              <Plug className="h-4 w-4" />
              {pending.length ? "Thêm Fanpage khác" : "Kết nối Fanpage"}
            </Button>
          </div>
        )}
      </div>
      {pending.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={p.name} src={p.avatar} size="h-9 w-9" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.status === "pending"
                      ? "Chưa bật nhận tin"
                      : "Mất kết nối, cần đăng nhập Facebook lại"}
                  </span>
                </span>
              </span>
              {data.owner && p.status === "pending" && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act({ action: "page", id: p.id, connect: true })
                  }
                >
                  Bật nhận tin
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function InboxView({
  data,
  id,
  setId,
  busy,
  error,
  act,
  load,
}: {
  data: Data;
  id: string;
  setId: (id: string) => void;
  busy: boolean;
  error: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  act: (input: object) => Promise<any>;
  load: () => Promise<void>;
}) {
  const [pane, setPane] = useState<"list" | "chat" | "profile">("list");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const [showAttachment, setShowAttachment] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState("");
  const [label, setLabel] = useState("");
  const [assignee, setAssignee] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "unanswered">("all");
  const [creating, setCreating] = useState(false);
  const [service, setService] = useState("");
  const [oauthError] = useState(
    () => new URLSearchParams(window.location.search).get("fb_error") ?? "",
  );
  const [now, setNow] = useState(() => Date.now());
  const bottom = useRef<HTMLDivElement>(null);

  const selected = data.threads.find((t) => t.id === id);
  const messages = data.detail?.messages;
  const lastMessageId = messages?.[messages.length - 1]?.id;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [id, lastMessageId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const connected = data.pages.filter((p) => p.status === "connected");
  const packages = data.offers
    .filter((o) => o.offer.active)
    .map((o) => o.service);
  const threads = useMemo(
    () =>
      data.threads.filter(
        (t) =>
          (!page || t.page_id === page) &&
          (!label || t.label === label) &&
          (!assignee || t.assigned_to === assignee) &&
          (tab !== "unread" || isUnread(t)) &&
          (tab !== "unanswered" || t.status === "unanswered") &&
          `${t.customer_name ?? ""} ${t.subject ?? ""} ${t.phone ?? ""}`
            .toLowerCase()
            .includes(q.trim().toLowerCase()),
      ),
    [data.threads, page, label, assignee, tab, q],
  );
  const unreadCount = data.threads.filter(isUnread).length;
  const unansweredCount = data.threads.filter(
    (t) => t.status === "unanswered",
  ).length;

  function open(t: Thread) {
    setPane("chat");
    if (t.id !== id) {
      setId(t.id);
      setDraft("");
      setAttachment("");
      setShowAttachment(false);
      setShowReplies(false);
      setCreating(false);
    }
    void command({ action: "read", id: t.id }).catch(() => {});
  }
  async function send() {
    if (busy || data.detail?.blocked || (!draft.trim() && !attachment)) return;
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
      setShowAttachment(false);
    }
  }

  return (
    <div className="min-w-0 text-sm text-foreground">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-muted-foreground">
            Tư vấn, đặt lịch và chốt đơn từ tin nhắn Fanpage
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected.length > 0 && (
            <div className="flex items-center gap-1" aria-label="Lọc Fanpage">
              <button
                type="button"
                onClick={() => setPage("")}
                aria-pressed={!page}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  !page
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                Tất cả Fanpage
              </button>
              {connected.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  title={p.name}
                  aria-label={p.name}
                  aria-pressed={page === p.id}
                  onClick={() => setPage(page === p.id ? "" : p.id)}
                  className={cn(
                    "rounded-full border-2 p-0.5",
                    page === p.id ? "border-primary" : "border-transparent",
                  )}
                >
                  <Avatar name={p.name} src={p.avatar} size="h-8 w-8" />
                </button>
              ))}
            </div>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/manage/settings/facebook">
              <Settings className="h-4 w-4" />
              Fanpage & lịch
            </Link>
          </Button>
        </div>
      </header>
      {(error || oauthError) && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[var(--danger)] dark:border-red-900 dark:bg-red-950/40"
        >
          {error || oauthError}
        </p>
      )}
      {(connected.length === 0 ||
        data.pages.some((p) => p.status !== "connected")) && (
        <ConnectPanel data={data} busy={busy} act={act} />
      )}
      <div className="grid h-[calc(100dvh-190px)] min-h-[520px] overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <aside
          className={cn(
            "min-h-0 min-w-0 flex-col border-border lg:flex lg:border-r",
            pane === "list" ? "flex" : "hidden",
          )}
        >
          <div className="space-y-2 border-b border-border p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Tìm khách"
                placeholder="Tìm khách, số điện thoại…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={cn(field, "pl-9")}
              />
            </label>
            <div className="flex gap-1" role="tablist">
              {(
                [
                  ["all", "Tất cả", 0],
                  ["unread", "Chưa đọc", unreadCount],
                  ["unanswered", "Chưa trả lời", unansweredCount],
                ] as const
              ).map(([key, title, count]) => (
                <button
                  type="button"
                  role="tab"
                  key={key}
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium",
                    tab === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {title}
                  {count > 0 && ` (${count})`}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Nhãn"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={cn(field, "py-1.5 text-xs")}
              >
                <option value="">Tất cả nhãn</option>
                {LABELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
              <select
                aria-label="Nhân viên"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className={cn(field, "py-1.5 text-xs")}
              >
                <option value="">Mọi nhân viên</option>
                {data.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => open(t)}
                  aria-current={id === t.id}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left hover:bg-accent",
                    id === t.id && "bg-accent",
                  )}
                >
                  <Avatar name={threadName(t)} src={t.avatar} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate",
                          isUnread(t) ? "font-bold" : "font-medium",
                        )}
                      >
                        {threadName(t)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {shortTime(t.last_message_at, now)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "block truncate text-[13px]",
                        isUnread(t)
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {t.preview_direction === "outbound" && "Bạn: "}
                      {t.preview || "Chưa có tin nhắn"}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      {t.label && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-medium",
                            LABEL_STYLE[t.label],
                          )}
                        >
                          {t.label}
                        </span>
                      )}
                      <span className="truncate text-[11px] text-muted-foreground">
                        {t.page_name || "Hội thoại nội bộ"}
                      </span>
                    </span>
                  </span>
                  {isUnread(t) && (
                    <span
                      aria-label="Chưa đọc"
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                    />
                  )}
                </button>
              </li>
            ))}
            {!threads.length && (
              <li className="p-6 text-center text-muted-foreground">
                {data.threads.length
                  ? "Không có hội thoại khớp bộ lọc."
                  : "Chưa có hội thoại. Tin nhắn Fanpage mới sẽ xuất hiện tại đây."}
              </li>
            )}
          </ul>
        </aside>

        <section
          className={cn(
            "min-h-0 min-w-0 flex-col xl:flex",
            pane === "chat" ? "flex" : "hidden",
            pane === "profile" ? "lg:hidden" : "lg:flex",
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10" />
              <p>Chọn một hội thoại để xem tin nhắn và trả lời khách.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
                <button
                  type="button"
                  aria-label="Về danh sách hội thoại"
                  onClick={() => setPane("list")}
                  className="rounded-lg p-1.5 hover:bg-accent lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar
                  name={threadName(selected)}
                  src={selected.avatar}
                  size="h-10 w-10"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">
                    {threadName(selected)}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.page_name
                      ? `Messenger · ${selected.page_name}`
                      : "Hội thoại nội bộ"}
                  </p>
                </div>
                <select
                  aria-label="Trạng thái xử lý"
                  value={selected.status}
                  onChange={(e) =>
                    act({ action: "status", id, status: e.target.value })
                  }
                  className={cn(field, "hidden w-auto py-1.5 text-xs sm:block")}
                >
                  {Object.entries(STATUS).map(([value, title]) => (
                    <option key={value} value={value}>
                      {title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Thông tin khách và lịch chụp"
                  onClick={() => setPane("profile")}
                  className="rounded-lg p-1.5 hover:bg-accent xl:hidden"
                >
                  <UserRound className="h-5 w-5" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-surface-muted/50 p-4">
                {!messages && (
                  <p className="text-center text-muted-foreground">Đang tải…</p>
                )}
                {messages?.map((m, i) => {
                  const out = m.direction === "outbound";
                  const newDay =
                    i === 0 ||
                    dayKey(messages[i - 1].sent_at) !== dayKey(m.sent_at);
                  return (
                    <div key={m.id} className="flex flex-col">
                      {newDay && (
                        <p className="my-2 self-center rounded-full bg-surface px-3 py-0.5 text-[11px] text-muted-foreground">
                          {dayKey(m.sent_at) === dayKey(now)
                            ? "Hôm nay"
                            : now - m.sent_at < 2 * DAY &&
                                dayKey(m.sent_at) === dayKey(now - DAY)
                              ? "Hôm qua"
                              : dayKey(m.sent_at)}
                        </p>
                      )}
                      <article
                        className={cn(
                          "max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2",
                          out
                            ? "self-end rounded-br-md bg-primary text-primary-foreground"
                            : "self-start rounded-bl-md border border-border bg-surface",
                        )}
                      >
                        {m.attachment && (
                          <a
                            href={m.attachment}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-1 block underline"
                          >
                            {m.direction === "inbound" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.attachment}
                                alt="Ảnh / tệp đính kèm"
                                referrerPolicy="no-referrer"
                                className="max-h-60 rounded-lg"
                              />
                            ) : (
                              "Ảnh đã gửi (bấm để mở)"
                            )}
                          </a>
                        )}
                        {!(m.attachment && m.content.startsWith("[")) && (
                          <p>{m.content}</p>
                        )}
                      </article>
                      <p
                        className={cn(
                          "mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground",
                          out ? "self-end" : "self-start",
                        )}
                      >
                        {new Date(m.sent_at).toLocaleTimeString("vi-VN", {
                          timeZone: VN,
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {out && m.delivery_status === "sending" && (
                          <>
                            <Clock className="h-3 w-3" /> Đang gửi
                          </>
                        )}
                        {out && m.delivery_status === "sent" && (
                          <>
                            <Check className="h-3 w-3" /> Đã gửi
                          </>
                        )}
                        {out && m.delivery_status === "delivered" && (
                          <>
                            <CheckCheck className="h-3 w-3" /> Đã nhận
                          </>
                        )}
                        {out && m.delivery_status === "read" && (
                          <>
                            <CheckCheck className="h-3 w-3 text-primary" /> Đã
                            xem
                          </>
                        )}
                        {out &&
                          ["failed", "unknown"].includes(
                            m.delivery_status ?? "",
                          ) && (
                            <span className="flex items-center gap-1 text-[var(--danger)]">
                              <CircleAlert className="h-3 w-3" />
                              {m.error || "Gửi lỗi"}
                            </span>
                          )}
                      </p>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>
              <form
                className="border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                {data.detail?.blocked && (
                  <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {data.detail.blocked}
                  </p>
                )}
                {showReplies && (
                  <div className="mb-2 max-h-40 overflow-y-auto rounded-lg border border-border">
                    {data.replies.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => {
                          setDraft(r.content);
                          setShowReplies(false);
                        }}
                        className="block w-full truncate border-b border-border px-3 py-2 text-left last:border-0 hover:bg-accent"
                      >
                        {r.content}
                      </button>
                    ))}
                    {!data.replies.length && (
                      <p className="px-3 py-2 text-muted-foreground">
                        Chưa có câu trả lời mẫu. Soạn tin rồi bấm “Lưu mẫu”.
                      </p>
                    )}
                  </div>
                )}
                {showAttachment && (
                  <input
                    aria-label="URL ảnh"
                    placeholder="Dán link ảnh HTTPS công khai"
                    value={attachment}
                    onChange={(e) => setAttachment(e.target.value)}
                    className={cn(field, "mb-2")}
                  />
                )}
                <textarea
                  aria-label="Nội dung gửi"
                  placeholder="Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  maxLength={2000}
                  rows={2}
                  className={cn(field, "resize-none")}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-expanded={showReplies}
                    onClick={() => setShowReplies(!showReplies)}
                  >
                    <Zap className="h-4 w-4" />
                    Trả lời nhanh
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-expanded={showAttachment}
                    onClick={() => {
                      if (showAttachment) setAttachment("");
                      setShowAttachment(!showAttachment);
                    }}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Ảnh
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!draft.trim() || busy}
                    onClick={() => act({ action: "reply", content: draft })}
                  >
                    Lưu mẫu
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="ml-auto"
                    disabled={
                      busy ||
                      !!data.detail?.blocked ||
                      (!draft.trim() && !attachment)
                    }
                  >
                    <Send className="h-4 w-4" />
                    Gửi
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>

        <aside
          className={cn(
            "min-h-0 min-w-0 overflow-y-auto border-border p-4 xl:block xl:border-l",
            pane === "profile" ? "block" : "hidden",
          )}
        >
          <button
            type="button"
            onClick={() => setPane("chat")}
            className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground xl:hidden"
          >
            <ArrowLeft className="h-4 w-4" /> Về tin nhắn
          </button>
          {!selected ? (
            <p className="text-muted-foreground">
              Thông tin khách, lịch chụp và đơn hàng sẽ hiện khi chọn hội thoại.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center">
                <Avatar
                  name={threadName(selected)}
                  src={selected.avatar}
                  size="h-16 w-16"
                />
                <p className="mt-2 text-base font-semibold">
                  {threadName(selected)}
                </p>
                <p className="text-muted-foreground">
                  {selected.phone || "Chưa có số điện thoại"}
                </p>
                {
                  <select
                    key={`${id}:${selected.customer_name ?? ""}`}
                    aria-label="Liên kết hồ sơ khách"
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
                    className={cn(field, "mt-2 py-1.5 text-xs")}
                  >
                    <option value="">
                      {selected.customer_name
                        ? "Đổi sang hồ sơ khách khác"
                        : "Liên kết hồ sơ khách đã có"}
                    </option>
                    {data.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.phone}
                      </option>
                    ))}
                  </select>
                }
              </div>

              {selected.label && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Nhãn
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {LABELS.map((l) => (
                      <button
                        type="button"
                        key={l}
                        aria-pressed={selected.label === l}
                        disabled={busy}
                        onClick={() => act({ action: "label", id, label: l })}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          selected.label === l
                            ? LABEL_STYLE[l]
                            : "bg-surface-muted text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Xử lý
                  <select
                    value={selected.status}
                    onChange={(e) =>
                      act({ action: "status", id, status: e.target.value })
                    }
                    className={cn(field, "mt-1 py-1.5 text-xs")}
                  >
                    {Object.entries(STATUS).map(([value, title]) => (
                      <option key={value} value={value}>
                        {title}
                      </option>
                    ))}
                  </select>
                </label>
                {data.owner && (
                  <label className="text-xs text-muted-foreground">
                    Phân công
                    <select
                      value={selected.assigned_to || ""}
                      onChange={(e) =>
                        act({ action: "assign", id, staffId: e.target.value })
                      }
                      className={cn(field, "mt-1 py-1.5 text-xs")}
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
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Đặt lịch & chốt đơn
                </h3>
                <div className="flex gap-2">
                  <select
                    aria-label="Gói gửi khách"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className={cn(field, "py-1.5 text-xs")}
                  >
                    <option value="">Chọn gói chụp</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
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
                    Gửi link
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setCreating(!creating)}
                >
                  {creating ? "Đóng form" : "Tạo lịch chụp / Tạo đơn"}
                </Button>
                {creating && (
                  <div className="omni mt-2">
                    <BookingForm
                      key={id}
                      packages={packages}
                      conversationId={id}
                      onDone={() => {
                        setCreating(false);
                        void load();
                      }}
                    />
                  </div>
                )}
              </div>

              {!!data.detail?.bookings.length && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Lịch & đơn từ Inbox
                  </h3>
                  <div className="space-y-2">
                    {data.detail.bookings.map((b) => (
                      <article
                        key={b.id}
                        className="space-y-1.5 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/manage/orders/${b.order_id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            {b.code} · {b.package_name}
                          </Link>
                          <Badge
                            tone={
                              b.status === "confirmed" ||
                              b.status === "completed"
                                ? "success"
                                : b.status === "held"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {BOOKING_STATUS[b.status] ?? b.status}
                          </Badge>
                        </div>
                        <p>{when(b.start_at)}</p>
                        <p className="text-xs text-muted-foreground">
                          Tổng {money(b.total)} · Đã cọc {money(b.paid)} · Còn{" "}
                          {money(b.remaining)}
                        </p>
                        {b.status === "held" && (
                          <p className="text-xs text-muted-foreground">
                            Giữ chỗ đến {when(b.expires_at)}
                          </p>
                        )}
                        {["held", "confirmed"].includes(b.status) && (
                          <>
                            {data.canDeposit && (
                              <form
                                className="space-y-1.5"
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
                                <input
                                  required
                                  name="amount"
                                  type="number"
                                  min="1"
                                  max={b.remaining}
                                  aria-label="Cọc thực nhận"
                                  placeholder="Cọc thực nhận (đ)"
                                  className={cn(field, "py-1.5 text-xs")}
                                />
                                <input
                                  name="reference"
                                  aria-label="Mã tham chiếu"
                                  placeholder="Mã tham chiếu chuyển khoản"
                                  className={cn(field, "py-1.5 text-xs")}
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  className="w-full"
                                >
                                  Xác nhận nhận cọc
                                </Button>
                              </form>
                            )}
                            <details>
                              <summary className="cursor-pointer text-xs text-muted-foreground">
                                Đổi lịch
                              </summary>
                              <form
                                className="mt-1.5 space-y-1.5"
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
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    aria-label="Ngày mới"
                                    name="date"
                                    type="date"
                                    required
                                    className={cn(field, "py-1.5 text-xs")}
                                  />
                                  <input
                                    aria-label="Giờ mới"
                                    name="time"
                                    type="time"
                                    required
                                    className={cn(field, "py-1.5 text-xs")}
                                  />
                                </div>
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  className="w-full"
                                >
                                  Lưu giờ mới
                                </Button>
                              </form>
                            </details>
                            <div className="flex flex-wrap gap-1.5">
                              {b.paid >= b.deposit && b.status === "held" && (
                                <Button
                                  size="sm"
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
                                </Button>
                              )}
                              {b.status === "confirmed" && (
                                <Button
                                  size="sm"
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
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-[var(--danger)]"
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
                              </Button>
                            </div>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={() => {
                            setDraft(
                              `Studio xác nhận đơn ${b.code}\nGói: ${b.package_name}\nLịch: ${when(b.start_at)}\nĐịa điểm: ${b.location || "Vui lòng bổ sung địa điểm"}\nĐã cọc: ${money(b.paid)}\nCòn lại: ${money(b.remaining)}\nTrạng thái: ${BOOKING_STATUS[b.status] ?? b.status}`,
                            );
                            setPane("chat");
                          }}
                        >
                          Soạn tin xác nhận
                        </Button>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {!!data.detail?.history.length && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Lịch sử đơn của khách
                  </h3>
                  <ul className="space-y-1">
                    {data.detail.history.map((o) => (
                      <li key={o.id}>
                        <Link
                          href={`/manage/orders/${o.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {o.code}
                        </Link>{" "}
                        <span className="text-muted-foreground">
                          · Đã thu {money(o.paid)} · Còn {money(o.remaining)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ghi chú nội bộ
                </h3>
                {data.detail?.notes.map((n) => (
                  <p
                    key={n.id}
                    className="mb-1.5 rounded-lg bg-amber-50 px-3 py-2 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
                  >
                    {n.content}
                    <span className="block text-[11px] opacity-70">
                      {n.staff_name}
                    </span>
                  </p>
                ))}
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    if (
                      await act({
                        action: "note",
                        id,
                        content: f.get("content"),
                      })
                    )
                      form.reset();
                  }}
                >
                  <input
                    aria-label="Ghi chú nội bộ"
                    name="content"
                    required
                    maxLength={2000}
                    placeholder="Thêm ghi chú…"
                    className={cn(field, "py-1.5 text-xs")}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                  >
                    Lưu
                  </Button>
                </form>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
