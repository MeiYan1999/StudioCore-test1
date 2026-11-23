"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  Brush,
  Copy,
  Download,
  FileIcon,
  Heart,
  Info,
  Maximize,
  MessageSquare,
  Minimize,
  Moon,
  PanelBottom,
  QrCode,
  Share2,
  Sun,
  WifiOff,
  X,
  Play,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
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
type GalleryTab = "all" | "picked" | "notes";
type LightboxAction = "view" | "note" | "drawing";

export function DriveGallery(props: Props) {
  const { slug, kind, maxSelect, allowOriginal } = props;
  const base = `/api/drive/s/${encodeURIComponent(slug)}`;
  const [files, setFiles] = useState(props.files);
  const [submitted, setSubmitted] = useState(props.submittedAt !== null);
  const [tab, setTab] = useState<GalleryTab>("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submissionNote, setSubmissionNote] = useState("");
  const [photoNote, setPhotoNote] = useState("");
  const [photoNoteBusy, setPhotoNoteBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ascending, setAscending] = useState(true);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [drawingActive, setDrawingActive] = useState(false);
  const [drawingRequest, setDrawingRequest] = useState(0);
  const [initialDrawingId, setInitialDrawingId] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [downloadsBusy, setDownloadsBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const filmstripCurrentRef = useRef<HTMLButtonElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const lightboxOpenerRef = useRef<HTMLElement | null>(null);
  const previousDarkClassRef = useRef<boolean | null>(null);

  const selecting = kind === "select";
  const downloadAllowed = selecting ? allowOriginal : true;
  const pickedCount = useMemo(() => files.filter((f) => f.picked).length, [files]);
  const notesCount = useMemo(() => files.filter((file) => file.note || file.markup).length, [files]);
  const list = useMemo(() => {
    const filtered =
      tab === "picked"
        ? files.filter((file) => file.picked)
        : tab === "notes"
          ? files.filter((file) => file.note || file.markup)
          : files;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "vi", { sensitivity: "base" }) * (ascending ? 1 : -1));
  }, [ascending, files, tab]);
  const openIndex = openId ? list.findIndex((f) => f.id === openId) : -1;
  const openFile = openIndex >= 0 ? list[openIndex] : null;
  const openFileId = openFile?.id ?? "";
  const photoCodes = useMemo(
    () => files.filter((file) => file.picked).map((file) => file.name.replace(/\.[^.]+$/, "")),
    [files],
  );
  const downloadFiles = selecting ? files.filter((file) => file.picked) : files;
  const downloadCount = selecting ? pickedCount : files.length;
  const onEditorDrawingChange = useCallback((drawing: boolean) => setDrawingActive(drawing), []);

  const fileUrl = (id: string, variant: "thumb" | "preview" | "original", download = false) =>
    `${base}/file/${encodeURIComponent(id)}?v=${variant}${download ? "&download=1" : ""}`;

  function downloadFile(file: DrivePublicFile) {
    if (!downloadAllowed) return;
    const anchor = document.createElement("a");
    anchor.href = fileUrl(file.id, allowOriginal ? "original" : "preview", true);
    anchor.download = file.name;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  useEffect(() => {
    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem("studiocore-drive-gallery-theme");
    } catch {
      return;
    }
    if (savedTheme === "dark") {
      const timeout = window.setTimeout(() => setTheme("dark"), 0);
      return () => window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    previousDarkClassRef.current = root.classList.contains("dark");
    return () => {
      root.classList.toggle("dark", previousDarkClassRef.current === true);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    filmstripCurrentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [openFileId, showFilmstrip]);

  useEffect(() => {
    if (openFile) {
      lightboxRef.current?.focus();
      return;
    }
    const opener = lightboxOpenerRef.current;
    if (opener?.isConnected) opener.focus();
    lightboxOpenerRef.current = null;
  }, [openFile?.id]);

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  function openLightbox(fileId: string, action: LightboxAction = "view") {
    const target = files.find((file) => file.id === fileId);
    lightboxOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpenId(fileId);
    setPhotoNote(target?.note ?? "");
    setNotePanelOpen(action === "note");
    setInfoOpen(false);
    setInitialDrawingId(action === "drawing" ? fileId : null);
    setDrawingActive(action === "drawing");
  }

  async function copyText(value: string, successMessage: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.append(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("copy failed");
      }
      toast.success(successMessage);
    } catch {
      toast.error("Không thể sao chép. Hãy thử lại.");
    }
  }

  async function shareGallery() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: props.title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyText(url, "Đã sao chép link chia sẻ.");
  }

  async function downloadGallery() {
    if (!downloadAllowed || downloadsBusy || !downloadFiles.length) return;
    setDownloadsBusy(true);
    try {
      for (const [index, file] of downloadFiles.entries()) {
        downloadFile(file);
        if (index < downloadFiles.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      toast.success(
        `Đã bắt đầu tải ${downloadFiles.length} tệp. Nếu trình duyệt hỏi, hãy bấm Cho phép tải nhiều tệp.`,
      );
    } finally {
      setDownloadsBusy(false);
    }
  }

  function downloadCurrent() {
    if (!openFile || !downloadAllowed) return;
    downloadFile(openFile);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.error("Không thể bật chế độ toàn màn hình.");
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem("studiocore-drive-gallery-theme", next);
    } catch {
      return;
    }
  }

  function openQrDialog() {
    setCurrentUrl(window.location.href);
    setQrOpen(true);
  }

  function startDrawing() {
    if (!openFile || !selecting || submitted || !(openFile.kind === "image" || openFile.kind === "raw")) return;
    setNotePanelOpen(false);
    setInfoOpen(false);
    setDrawingActive(true);
    setDrawingRequest((current) => current + 1);
  }

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
        const data = (await response.json().catch(() => null)) as
          | { error?: string; picked?: boolean; note?: string | null; markup?: DriveMarkup | null }
          | null;
        if (!response.ok || !data || typeof data.picked !== "boolean") {
          throw new Error(data?.error ?? "Không lưu được lựa chọn.");
        }
        const picked = data.picked;
        setFiles((current) =>
          current.map((currentFile) =>
            currentFile.id === file.id
              ? {
                  ...currentFile,
                  picked,
                  note: data.note ?? null,
                  markup: data.markup ?? null,
                }
              : currentFile,
          ),
        );
        setPhotoNote(data.note ?? "");
        if (!picked) setNotePanelOpen(false);
      } catch (error) {
        setFiles((current) => current.map((f) => (f.id === file.id ? { ...f, picked: !next } : f)));
        toast.error(error instanceof Error ? error.message : "Không lưu được lựa chọn.");
      }
    },
    [base, maxSelect, pickedCount, selecting, submitted],
  );

  const move = useCallback(
    async (delta: number) => {
      if (openIndex < 0) return;
      const target = list[openIndex + delta];
      if (!target || !openFile || target.id === openFile.id) return;
      if (photoNote !== (openFile.note ?? "") && !(await savePhotoNote(openFile.id, photoNote))) return;
      setOpenId(target.id);
      setPhotoNote(target.note ?? "");
      setNotePanelOpen(false);
      setInfoOpen(false);
      setDrawingActive(false);
      setInitialDrawingId(null);
    },
    [list, openFile, openIndex, photoNote],
  );

  const closeLightbox = useCallback(async () => {
    if (openFile && photoNote !== (openFile.note ?? "") && !(await savePhotoNote(openFile.id, photoNote))) return;
    setOpenId(null);
    setNotePanelOpen(false);
    setDrawingActive(false);
  }, [openFile, photoNote]);

  useEffect(() => {
    if (!openFile) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("button, input, textarea, select, [contenteditable], [data-drive-markup-editor]")
      ) {
        return;
      }
      if (event.key === "Escape") void closeLightbox();
      else if (event.key === "ArrowRight") move(1);
      else if (event.key === "ArrowLeft") move(-1);
      else if (event.key === " " && selecting) {
        event.preventDefault();
        void togglePick(openFile);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFile, closeLightbox, move, selecting, togglePick]);

  async function savePhotoNote(fileId: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${base}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, note: text }),
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
      setPhotoNote(data.note ?? "");
      toast.success("Đã lưu ghi chú cho ảnh.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được ghi chú.");
      return false;
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
        body: JSON.stringify({ note: submissionNote }),
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
    <main
      className={cn(
        "min-h-screen pb-28 transition-colors",
        theme === "dark" ? "dark bg-neutral-950 text-neutral-100" : "bg-[#f3f4f6] text-slate-900",
      )}
      style={{
        backgroundColor: theme === "dark" ? "#0a0a0a" : "#f3f4f6",
        color: theme === "dark" ? "#f5f5f5" : "#0f172a",
      }}
    >
      <header className="border-b border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
              {props.studioName.trim().charAt(0).toLocaleUpperCase("vi") || "S"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold uppercase tracking-wide">{props.studioName}</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">StudioCore Drive</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Bật giao diện sáng" : "Bật giao diện tối"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={openQrDialog}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-sm font-medium hover:bg-slate-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <QrCode className="h-4 w-4" aria-hidden />
              <span>QR</span>
            </button>
            {downloadAllowed ? (
              <button
                type="button"
                onClick={() => void downloadGallery()}
                disabled={!downloadCount || downloadsBusy}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                <Download className="h-4 w-4" aria-hidden />
                Tải ảnh ({downloadCount})
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void shareGallery()}
              aria-label="Chia sẻ"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-sm font-medium hover:bg-slate-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Chia sẻ</span>
            </button>
          </div>
        </div>
        {!props.online ? (
          <div className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            Máy tính của studio đang ngoại tuyến nên ảnh chưa hiển thị được. Vui lòng thử lại sau hoặc báo studio.
          </div>
        ) : null}
      </header>

      <section className="mx-auto flex max-w-[1040px] flex-wrap items-start justify-between gap-4 px-4 pb-5 pt-7">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{props.title}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            {props.clientName ? `Dành cho ${props.clientName} · ` : ""}
            {files.length} ảnh
          </p>
          {props.message ? (
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-neutral-300">
              {props.message}
            </p>
          ) : null}
        </div>
        {selecting ? (
          <button
            type="button"
            onClick={() =>
              void copyText(window.location.href, "Đã sao chép link, gửi cho người thân để cùng chọn.")
            }
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Cùng chọn ảnh
          </button>
        ) : null}
      </section>

      <div className="sticky top-0 z-30 border-y border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-neutral-800">
            <button
              type="button"
              aria-pressed={tab === "all"}
              onClick={() => {
                setTab("all");
                setShown(PAGE_SIZE);
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
                tab === "all"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                  : "text-slate-600 dark:text-neutral-300",
              )}
            >
              Tất cả ({files.length})
            </button>
            {selecting ? (
              <button
                type="button"
                aria-pressed={tab === "picked"}
                onClick={() => {
                  setTab("picked");
                  setShown(PAGE_SIZE);
                }}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
                  tab === "picked"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                    : "text-slate-600 dark:text-neutral-300",
                )}
              >
                ♡ ({pickedCount})
              </button>
            ) : null}
            <button
              type="button"
              aria-pressed={tab === "notes"}
              onClick={() => {
                setTab("notes");
                setShown(PAGE_SIZE);
              }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
                tab === "notes"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                  : "text-slate-600 dark:text-neutral-300",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {notesCount}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {selecting ? (
              <div className="hidden min-w-28 items-center gap-2 sm:flex">
                {maxSelect > 0 ? (
                  <>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700">
                      <span
                        className="block h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.min(100, (pickedCount / maxSelect) * 100)}%` }}
                      />
                    </span>
                    <span className="whitespace-nowrap text-xs font-semibold text-blue-700 dark:text-blue-300">
                      {pickedCount}/{maxSelect}
                    </span>
                  </>
                ) : (
                  <span className="whitespace-nowrap text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {pickedCount} đã chọn
                  </span>
                )}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setAscending((current) => !current)}
              title={ascending ? "Sắp xếp tên Z → A" : "Sắp xếp tên A → Z"}
              aria-label={ascending ? "Sắp xếp tên A đến Z" : "Sắp xếp tên Z đến A"}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-xs font-medium hover:bg-slate-50 dark:border-neutral-700 dark:hover:bg-neutral-800 sm:text-sm"
            >
              {ascending ? <ArrowDownAZ className="h-4 w-4" aria-hidden /> : <ArrowUpAZ className="h-4 w-4" aria-hidden />}
              <span className="hidden sm:inline">{ascending ? "A → Z" : "Z → A"}</span>
            </button>
            <button
              type="button"
              disabled={!photoCodes.length}
              onClick={() => void copyText(photoCodes.join(", "), "Đã sao chép mã ảnh đã chọn.")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-blue-300 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40 sm:text-sm"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Mã
            </button>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1040px] px-4 pb-32 pt-5">
        {list.length === 0 ? (
          <p className="py-20 text-center text-sm text-slate-500 dark:text-neutral-400">
            {tab === "picked"
              ? "Bạn chưa chọn ảnh nào. Bấm vào biểu tượng trái tim để chọn."
              : tab === "notes"
                ? "Chưa có ảnh nào được ghi chú."
                : "Thư mục chưa có tệp."}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {list.slice(0, shown).map((file) => (
              <li
                key={file.id}
                className="overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(15,23,42,0.09)] dark:bg-neutral-900 dark:shadow-black/30"
              >
                <div className="relative aspect-[3/2] overflow-hidden bg-slate-200 dark:bg-neutral-800">
                  <button
                    type="button"
                    onClick={() => openLightbox(file.id)}
                    className="absolute inset-0 block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    aria-label={`Xem ${file.name}`}
                  >
                    {file.kind === "other" || file.kind === "video" ? (
                      <span className="flex h-full w-full items-center justify-center bg-neutral-900 text-neutral-400">
                        <FileIcon className="h-9 w-9" aria-hidden />
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
                  </button>
                  <span className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                    {file.name}
                  </span>
                </div>
                <div className="flex min-h-12 items-center gap-1.5 px-2 py-1.5">
                  {selecting ? (
                    <button
                      type="button"
                      disabled={submitted}
                      onClick={() => void togglePick(file)}
                      aria-pressed={file.picked}
                      aria-label={file.picked ? `Bỏ chọn ${file.name}` : `Chọn ${file.name}`}
                      className={cn(
                        "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold transition",
                        file.picked
                          ? "bg-[#e5484d] text-white hover:bg-[#d73e43]"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700",
                        submitted && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <Heart className={cn("h-3.5 w-3.5 shrink-0", file.picked && "fill-current")} aria-hidden />
                      <span className="truncate">{file.picked ? "Đã chọn" : "Chọn"}</span>
                    </button>
                  ) : downloadAllowed ? (
                    <button
                      type="button"
                      onClick={() => {
                        const anchor = document.createElement("a");
                        anchor.href = fileUrl(file.id, allowOriginal ? "original" : "preview", true);
                        anchor.download = file.name;
                        anchor.click();
                      }}
                      aria-label={`Tải ${file.name}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                  <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    {file.kind === "image" || file.kind === "raw" ? (
                      <button
                        type="button"
                        onClick={() => openLightbox(file.id, "drawing")}
                        disabled={!selecting || submitted}
                        aria-label={`Vẽ ghi chú cho ${file.name}`}
                        title={file.markup ? "Sửa nét vẽ" : "Vẽ ghi chú"}
                        className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        <Brush className="h-4 w-4" aria-hidden />
                        {file.markup ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" /> : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openLightbox(file.id, "note")}
                      aria-label={`Ghi chú cho ${file.name}`}
                      className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden />
                      {file.note ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {list.length > shown ? (
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => setShown((count) => count + PAGE_SIZE)}>
              Xem thêm ({list.length - shown})
            </Button>
          </div>
        ) : null}
      </section>

      {selecting ? (
        <div className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-fit rounded-full border border-slate-200 bg-white/95 p-2 shadow-[0_8px_30px_rgba(15,23,42,0.18)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
          <div className="flex items-center gap-1.5">
            <span className="whitespace-nowrap px-2 text-xs font-bold text-blue-700 dark:text-blue-300 sm:text-sm">
              {pickedCount}/{maxSelect > 0 ? maxSelect : "∞"}
            </span>
            <button
              type="button"
              disabled={!photoCodes.length}
              onClick={() => void copyText(photoCodes.join(", "), "Đã sao chép mã ảnh đã chọn.")}
              className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy
            </button>
            <button
              type="button"
              aria-pressed={tab === "picked"}
              onClick={() => {
                setTab((current) => (current === "picked" ? "all" : "picked"));
                setShown(PAGE_SIZE);
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
                tab === "picked" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
              )}
            >
              <Heart className="h-3.5 w-3.5" aria-hidden />
              Ảnh chọn
            </button>
            <Button
              disabled={submitted || pickedCount === 0}
              onClick={() => setConfirming(true)}
              className="h-9 rounded-full bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              {submitted ? "Đã gửi" : "Gửi Studio"}
            </Button>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Gửi lựa chọn"
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-slate-900 shadow-xl dark:bg-neutral-900 dark:text-white">
            <h2 className="text-lg font-semibold">Gửi {pickedCount} ảnh đã chọn?</h2>
            <p className="text-sm text-slate-500 dark:text-neutral-400">
              Sau khi gửi bạn không thể đổi lựa chọn, trừ khi studio mở lại.
            </p>
            <Textarea
              value={submissionNote}
              onChange={(event) => setSubmissionNote(event.target.value)}
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

      {qrOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Mã QR của album"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center text-slate-900 shadow-xl dark:bg-neutral-900 dark:text-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Quét mã để mở album</h2>
              <button type="button" onClick={() => setQrOpen(false)} aria-label="Đóng" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-neutral-800">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mx-auto inline-flex rounded-xl bg-white p-3">
              <QRCodeSVG value={currentUrl} size={232} includeMargin />
            </div>
            <p className="break-all text-xs text-slate-500 dark:text-neutral-400">{currentUrl}</p>
          </div>
        </div>
      ) : null}

      {openFile ? (
        <div
          ref={lightboxRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white"
          role="dialog"
          aria-modal="true"
          aria-label={openFile.name}
        >
          <header className="relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">
                {openIndex + 1} / {list.length}
              </span>
              <span className="max-w-[45vw] truncate rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium sm:max-w-md">
                {openFile.name}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowFilmstrip((shownFilmstrip) => !shownFilmstrip)}
                aria-label={showFilmstrip ? "Ẩn dải ảnh" : "Hiện dải ảnh"}
                aria-pressed={showFilmstrip}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <PanelBottom className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  setInfoOpen((current) => !current);
                  setNotePanelOpen(false);
                }}
                aria-label="Thông tin ảnh"
                aria-expanded={infoOpen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <Info className="h-4 w-4" aria-hidden />
              </button>
              {downloadAllowed ? (
                <button
                  type="button"
                  onClick={downloadCurrent}
                  aria-label="Tải ảnh"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                {fullscreen ? <Minimize className="h-4 w-4" aria-hidden /> : <Maximize className="h-4 w-4" aria-hidden />}
              </button>
              <button
                type="button"
                onClick={() => void closeLightbox()}
                aria-label="Đóng"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {infoOpen ? (
              <div className="absolute right-4 top-14 z-20 w-64 rounded-xl border border-white/10 bg-neutral-900 p-4 text-sm shadow-xl">
                <p className="break-words font-semibold">{openFile.name}</p>
                <dl className="mt-2 space-y-1 text-xs text-white/65">
                  <div className="flex justify-between gap-3">
                    <dt>Kích thước</dt>
                    <dd>{formatDriveBytes(openFile.size)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Loại tệp</dt>
                    <dd>{openFile.kind === "raw" ? "Ảnh RAW" : openFile.kind === "video" ? "Video" : openFile.kind === "other" ? "Tệp khác" : "Ảnh"}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </header>

            <div className="relative min-h-0 flex-1">
              {openFile.kind === "video" ? (
              <div
                className={cn(
                  "absolute inset-x-0 top-0 flex items-center justify-center px-10",
                  "bottom-24 sm:bottom-0",
                )}
              >
                <video
                  key={openFile.id}
                  src={fileUrl(openFile.id, "preview")}
                  controls
                  playsInline
                  className="max-h-full max-w-full"
                />
              </div>
            ) : openFile.kind === "other" ? (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                Không xem trước được loại tệp này.
              </p>
            ) : (
              <div className="absolute inset-0 flex px-4 sm:px-16">
                <DriveMarkupEditor
                  key={openFile.id}
                  fileName={openFile.name}
                  imageUrl={fileUrl(openFile.id, "preview")}
                  markup={openFile.markup}
                  editable={selecting && !submitted && (openFile.kind === "image" || openFile.kind === "raw")}
                  onSave={(markup) => saveMarkup(openFile.id, markup)}
                  startInDrawingMode={initialDrawingId === openFile.id}
                  drawingRequest={drawingRequest}
                  hideStartButton
                  onDrawingChange={onEditorDrawingChange}
                />
              </div>
            )}
            {openIndex > 0 ? (
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label="Ảnh trước"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white shadow hover:bg-white/20 sm:left-4 sm:p-3"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
            {openIndex < list.length - 1 ? (
              <button
                type="button"
                onClick={() => move(1)}
                aria-label="Ảnh sau"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white shadow hover:bg-white/20 sm:right-4 sm:p-3"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            ) : null}
          </div>

          {showFilmstrip ? (
            <div className="z-10 flex h-[72px] shrink-0 items-center gap-2 overflow-x-auto border-t border-white/10 bg-black/85 px-3 py-2">
              {list.map((file, index) => (
                <button
                  key={file.id}
                  ref={file.id === openFile.id ? filmstripCurrentRef : undefined}
                  type="button"
                  onClick={() => move(index - openIndex)}
                  aria-label={`Mở ${file.name}`}
                  aria-current={file.id === openFile.id ? true : undefined}
                  className={cn(
                    "relative h-12 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-neutral-800",
                    file.id === openFile.id ? "border-blue-500" : "border-transparent opacity-70 hover:opacity-100",
                  )}
                >
                  {file.kind === "video" || file.kind === "other" ? (
                    <span className="flex h-full w-full items-center justify-center">
                      <FileIcon className="h-4 w-4 text-white/60" aria-hidden />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh được chuyển tiếp trực tiếp từ máy studio
                    <img src={fileUrl(file.id, "thumb")} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {file.picked ? (
                    <span className="absolute bottom-0.5 right-0.5 text-[#e5484d]" aria-label="Đã chọn">
                      <Heart className="h-3 w-3 fill-current" aria-hidden />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          {!drawingActive ? (
            <div
              className={cn(
                "absolute left-3 right-3 z-20 sm:left-auto sm:right-5 sm:w-auto",
                showFilmstrip ? "bottom-[82px] sm:bottom-[84px]" : "bottom-3 sm:bottom-4",
              )}
            >
              <div className="mx-auto flex w-full max-w-full items-center justify-between gap-1 rounded-full border border-white/10 bg-neutral-900/95 p-1.5 text-white shadow-xl sm:mx-0 sm:w-auto sm:justify-start sm:gap-1.5">
                {selecting ? (
                  <button
                    type="button"
                    disabled={submitted}
                    onClick={() => void togglePick(openFile)}
                    aria-pressed={openFile.picked}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold",
                      openFile.picked ? "bg-[#e5484d] text-white" : "bg-white/10 hover:bg-white/20",
                      submitted && "opacity-60",
                    )}
                  >
                    <Heart className={cn("h-4 w-4", openFile.picked && "fill-current")} aria-hidden />
                    {openFile.picked ? "Đã chọn" : "Chọn"}
                  </button>
                ) : null}
                {selecting ? (
                  <span className="whitespace-nowrap px-2 text-xs font-semibold text-white/80">
                    ♥ {pickedCount}{maxSelect > 0 ? `/${maxSelect}` : ""}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setNotePanelOpen((current) => !current);
                    setInfoOpen(false);
                  }}
                  aria-expanded={notePanelOpen}
                  aria-label="Ghi chú ảnh"
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10",
                    notePanelOpen && "bg-white/15",
                  )}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden />
                </button>
                {selecting && !submitted && (openFile.kind === "image" || openFile.kind === "raw") ? (
                  <button
                    type="button"
                    onClick={startDrawing}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold hover:bg-white/10"
                  >
                    <Brush className="h-4 w-4" aria-hidden />
                    Vẽ
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {notePanelOpen && !drawingActive ? (
            <div
              className={cn(
                "absolute left-3 right-3 z-20 rounded-xl border border-white/10 bg-neutral-900 p-3 shadow-xl sm:left-auto sm:right-5 sm:w-80",
                showFilmstrip ? "bottom-[132px] sm:bottom-[136px]" : "bottom-[64px] sm:bottom-[72px]",
              )}
            >
              <label htmlFor="drive-photo-note" className="mb-2 block text-xs font-medium text-white/75">
                Ghi chú cho ảnh
              </label>
              <Textarea
                id="drive-photo-note"
                value={photoNote}
                onChange={(event) => setPhotoNote(event.target.value.slice(0, 500))}
                readOnly={!selecting || submitted || !openFile.picked}
                maxLength={500}
                rows={3}
                placeholder={openFile.picked ? "Ghi chú cho ảnh này…" : "Chọn ảnh để thêm ghi chú."}
                aria-label="Ghi chú cho ảnh"
                className="max-h-28 border-white/20 bg-white/10 text-white placeholder:text-white/45"
              />
              {selecting && !submitted ? (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={!openFile.picked || photoNoteBusy}
                    onClick={async () => {
                      setPhotoNoteBusy(true);
                      try {
                        if (await savePhotoNote(openFile.id, photoNote)) setNotePanelOpen(false);
                      } finally {
                        setPhotoNoteBusy(false);
                      }
                    }}
                    className="h-8 rounded-full bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
                  >
                    {photoNoteBusy ? "Đang lưu…" : "Lưu ghi chú"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
