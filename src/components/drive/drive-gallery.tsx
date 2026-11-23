"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Brush,
  Download,
  FileIcon,
  HardDrive,
  Heart,
  MessageSquare,
  Play,
  Send,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DriveMarkupEditor } from "@/components/drive/drive-markup-editor";
import { formatDriveBytes } from "@/lib/drive/constants";
import type { DriveMarkup } from "@/lib/drive/markup";
import type { DrivePublicFile } from "@/lib/services/drive-service";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  title: string;
  clientName: string | null;
  message: string | null;
  studioName: string;
  kind: "select" | "deliver";
  maxSelect: number;
  allowOriginal: boolean;
  submittedAt: number | null;
  online: boolean;
  files: DrivePublicFile[];
};

const PAGE_SIZE = 120;

export function DriveGallery(props: Props) {
  const { slug, kind, maxSelect, allowOriginal } = props;
  const base = `/api/drive/s/${encodeURIComponent(slug)}`;
  const [files, setFiles] = useState(props.files);
  const [submitted, setSubmitted] = useState(props.submittedAt !== null);
  const [tab, setTab] = useState<"all" | "picked">("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const selecting = kind === "select";
  const pickedCount = useMemo(() => files.filter((f) => f.picked).length, [files]);
  const list = useMemo(() => (tab === "picked" ? files.filter((f) => f.picked) : files), [files, tab]);
  const openIndex = openId ? list.findIndex((f) => f.id === openId) : -1;
  const openFile = openIndex >= 0 ? list[openIndex] : null;
  const openFileId = openFile?.id ?? "";

  const fileUrl = (id: string, variant: "thumb" | "preview" | "original") =>
    `${base}/file/${encodeURIComponent(id)}?v=${variant}`;

  const togglePick = useCallback(
    async (file: DrivePublicFile) => {
      if (!selecting || submitted) return;
      const next = !file.picked;
      if (next && maxSelect > 0 && pickedCount >= maxSelect) {
        toast.error(`Bạn chỉ được chọn tối đa ${maxSelect} ảnh.`);
        return;
      }
      setFiles((current) => current.map((f) => (f.id === file.id ? { ...f, picked: next } : f)));
      try {
        const response = await fetch(`${base}/pick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: file.id, picked: next }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Không lưu được lựa chọn.");
        }
      } catch (error) {
        setFiles((current) => current.map((f) => (f.id === file.id ? { ...f, picked: !next } : f)));
        toast.error(error instanceof Error ? error.message : "Không lưu được lựa chọn.");
      }
    },
    [base, maxSelect, pickedCount, selecting, submitted],
  );

  const move = useCallback(
    (delta: number) => {
      if (openIndex < 0) return;
      const target = list[openIndex + delta];
      if (target) setOpenId(target.id);
    },
    [list, openIndex],
  );

  useEffect(() => {
    if (!openFile) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      if (event.key === "Escape") setOpenId(null);
      else if (event.key === "ArrowRight") move(1);
      else if (event.key === "ArrowLeft") move(-1);
      else if (event.key === " " && selecting) {
        event.preventDefault();
        void togglePick(openFile);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFile, move, selecting, togglePick]);

  async function savePhotoNote(fileId: string, photoNote: string) {
    try {
      const response = await fetch(`${base}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, note: photoNote }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; note?: string | null; picked?: boolean }
        | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Không lưu được ghi chú.");
      setFiles((current) =>
        current.map((file) =>
          file.id === fileId ? { ...file, picked: data.picked ?? file.picked, note: data.note ?? null } : file,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được ghi chú.");
    }
  }

  async function saveMarkup(fileId: string, markup: DriveMarkup): Promise<boolean> {
    try {
      const response = await fetch(`${base}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, markup }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; picked?: boolean; markup?: DriveMarkup | null }
        | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Không lưu được nét vẽ.");
      setFiles((current) =>
        current.map((file) =>
          file.id === fileId ? { ...file, markup: data.markup ?? null, picked: data.picked ?? true } : file,
        ),
      );
      toast.success("Đã lưu nét vẽ cho ảnh.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được nét vẽ.");
      return false;
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(`${base}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Không gửi được lựa chọn.");
      setSubmitted(true);
      setConfirming(false);
      toast.success("Đã gửi lựa chọn cho studio.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không gửi được lựa chọn.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardDrive className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{props.title}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {props.studioName}
              {props.clientName ? ` · ${props.clientName}` : ""} · {files.length} tệp
            </p>
          </div>
          {selecting ? (
            <div className="flex gap-1 rounded-lg bg-surface-muted p-1 text-sm">
              {(
                [
                  ["all", `Tất cả (${files.length})`],
                  ["picked", `Đã chọn (${pickedCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setShown(PAGE_SIZE);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium",
                    tab === key ? "bg-surface shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {!props.online ? (
          <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <WifiOff className="h-4 w-4" aria-hidden />
            Máy tính của studio đang ngoại tuyến nên ảnh chưa hiển thị được. Vui lòng thử lại sau hoặc báo studio.
          </div>
        ) : null}
      </header>

      {props.message ? (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <p className="whitespace-pre-line rounded-xl border border-border bg-surface p-4 text-sm">{props.message}</p>
        </div>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 py-4">
        {list.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            {tab === "picked" ? "Bạn chưa chọn ảnh nào. Bấm vào biểu tượng trái tim để chọn." : "Thư mục chưa có tệp."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {list.slice(0, shown).map((file) => (
              <li key={file.id} className="group relative">
                <button
                  type="button"
                  onClick={() => setOpenId(file.id)}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-lg bg-surface-muted ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    file.picked && "ring-2 ring-primary",
                  )}
                  aria-label={`Xem ${file.name}`}
                >
                  {file.kind === "other" || file.kind === "video" ? (
                    <span className="flex h-full w-full items-center justify-center bg-neutral-900 text-neutral-500">
                      <FileIcon className="h-8 w-8" aria-hidden />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh được chuyển tiếp trực tiếp từ máy studio
                    <img
                      src={fileUrl(file.id, "thumb")}
                      alt={file.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                  {file.kind === "video" ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-black/55 p-3 text-white">
                        <Play className="h-5 w-5" aria-hidden />
                      </span>
                    </span>
                  ) : null}
                  {file.note ? (
                    <span
                      className="absolute left-2 top-2 rounded-full bg-black/65 p-1.5 text-white"
                      title="Ảnh có ghi chú"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                  {file.markup ? (
                    <span className="absolute right-2 top-2 rounded-full bg-black/65 p-1.5 text-white" title="Ảnh có nét vẽ">
                      <Brush className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4 text-left text-[11px] text-white">
                    {file.name}
                  </span>
                </button>
                {selecting ? (
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => void togglePick(file)}
                    aria-pressed={file.picked}
                    aria-label={file.picked ? `Bỏ chọn ${file.name}` : `Chọn ${file.name}`}
                    className={cn(
                      "absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full shadow transition",
                      file.picked ? "bg-primary text-primary-foreground" : "bg-white/90 text-neutral-700 hover:bg-white",
                      submitted && "opacity-70",
                    )}
                  >
                    <Heart className={cn("h-4 w-4", file.picked && "fill-current")} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {list.length > shown ? (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Xem thêm ({list.length - shown})
            </Button>
          </div>
        ) : null}
      </div>

      {selecting ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
            <p className="flex-1 text-sm">
              Đã chọn <strong>{pickedCount}</strong>
              {maxSelect > 0 ? ` / ${maxSelect}` : ""} ảnh
              {submitted ? " · Đã gửi cho studio" : ""}
            </p>
            {submitted ? (
              <span className="flex items-center gap-1 text-sm font-medium text-[var(--success)]">
                <Check className="h-4 w-4" aria-hidden />
                Hoàn tất
              </span>
            ) : (
              <Button disabled={pickedCount === 0} onClick={() => setConfirming(true)}>
                <Send className="h-4 w-4" aria-hidden />
                Gửi lựa chọn
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Gửi lựa chọn">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-surface p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Gửi {pickedCount} ảnh đã chọn?</h2>
            <p className="text-sm text-muted-foreground">
              Sau khi gửi bạn không thể đổi lựa chọn, trừ khi studio mở lại.
            </p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder="Lời nhắn cho studio (không bắt buộc)"
              aria-label="Lời nhắn cho studio"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                Xem lại
              </Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? "Đang gửi…" : "Gửi cho studio"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {openFile ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label={openFile.name}>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{openFile.name}</p>
              <p className="text-xs text-white/60">
                {openIndex + 1} / {list.length} · {formatDriveBytes(openFile.size)}
              </p>
            </div>
            {selecting ? (
              <Button
                size="sm"
                variant={openFile.picked ? "primary" : "outline"}
                disabled={submitted}
                onClick={() => void togglePick(openFile)}
                className={openFile.picked ? "" : "border-white/40 bg-transparent text-white hover:bg-white/10"}
              >
                <Heart className={cn("h-4 w-4", openFile.picked && "fill-current")} aria-hidden />
                {openFile.picked ? "Đã chọn" : "Chọn ảnh này"}
              </Button>
            ) : null}
            {allowOriginal ? (
              <Button size="sm" variant="outline" asChild className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <a href={fileUrl(openFile.id, "original")} download={openFile.name}>
                  <Download className="h-4 w-4" aria-hidden />
                  Tải gốc
                </a>
              </Button>
            ) : null}
            <button type="button" onClick={() => setOpenId(null)} aria-label="Đóng" className="rounded-full p-2 hover:bg-white/10">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {openFile.kind === "video" ? (
              <video key={openFile.id} src={fileUrl(openFile.id, "preview")} controls playsInline className="max-h-full max-w-full" />
            ) : openFile.kind === "other" ? (
              <p className="text-sm text-white/70">Không xem trước được loại tệp này.</p>
            ) : (
              <DriveMarkupEditor
                key={openFile.id}
                fileName={openFile.name}
                imageUrl={fileUrl(openFile.id, "preview")}
                markup={openFile.markup}
                editable={selecting && !submitted && (openFile.kind === "image" || openFile.kind === "raw")}
                onSave={(markup) => saveMarkup(openFile.id, markup)}
              />
            )}
            {openIndex > 0 ? (
              <button type="button" onClick={() => move(-1)} aria-label="Ảnh trước" className="absolute left-2 rounded-full bg-white/10 p-3 hover:bg-white/20">
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
            ) : null}
            {openIndex < list.length - 1 ? (
              <button type="button" onClick={() => move(1)} aria-label="Ảnh sau" className="absolute right-2 rounded-full bg-white/10 p-3 hover:bg-white/20">
                <ChevronRight className="h-6 w-6" aria-hidden />
              </button>
            ) : null}
          </div>
          {selecting && openFile.picked ? (
            <div className="border-t border-white/15 bg-black/80 px-4 py-3" onClick={(event) => event.stopPropagation()}>
              <Textarea
                value={openFile.note ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setFiles((current) =>
                    current.map((file) => (file.id === openFileId ? { ...file, note: value || null } : file)),
                  );
                }}
                onBlur={(event) => {
                  if (!submitted) void savePhotoNote(openFileId, event.currentTarget.value);
                }}
                readOnly={submitted}
                maxLength={500}
                placeholder={submitted ? "Chưa có ghi chú cho ảnh này." : "Ghi chú cho ảnh này"}
                aria-label="Ghi chú cho ảnh này"
                className="mx-auto max-h-20 max-w-2xl border-white/25 bg-white/10 text-white placeholder:text-white/50"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
