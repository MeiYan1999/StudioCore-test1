"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Heart,
  Images,
  Loader2,
  Lock,
  MessageSquare,
  Moon,
  QrCode,
  Send,
  Share2,
  Sun,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatVnd } from "@/lib/utils";
import type {
  ShareGalleryPage,
  SharePhotoView,
} from "@/lib/services/share-service";
import {
  loadShareCodesAction,
  loadSharePageAction,
  submitShareSelectionAction,
  updateSharePhotoAction,
} from "@/lib/actions/share-actions";
import {
  COPY_FORMAT_LABELS,
  formatPhotoCodes,
  type CopyFormat,
} from "@/lib/share/copy-formats";

const THEME_STORAGE_KEY = "studiocore-drive-gallery-theme";

function restoreSiteTheme() {
  let stored = "system";
  try {
    stored = window.localStorage.getItem("studiocore-theme") || "system";
  } catch {
    stored = "system";
  }
  const dark =
    stored === "dark" ||
    (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const REASON_MESSAGES: Record<string, string> = {
  not_found: "Không tìm thấy album hoặc link không đúng.",
  revoked: "Studio đã thu hồi link chia sẻ này.",
  expired: "Link chia sẻ đã hết hạn. Vui lòng liên hệ studio để gia hạn.",
  archived: "Album đã được lưu trữ và không còn chia sẻ.",
  password_required: "Album này cần mật khẩu để xem.",
};

function reasonMessage(reason: string): string {
  return REASON_MESSAGES[reason] ?? "Không thể mở album lúc này.";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(area);
      return copied;
    } catch {
      return false;
    }
  }
}

function countsAfterPatch(
  counts: ShareGalleryPage["counts"],
  photo: SharePhotoView,
  patch: { selected?: boolean; favorite?: boolean; note?: string },
  page: ShareGalleryPage,
): ShareGalleryPage["counts"] {
  let selected = counts.selected;
  if (patch.selected !== undefined) {
    selected += patch.selected ? (photo.selected ? 0 : 1) : photo.selected ? -1 : 0;
  }
  let notes = counts.notes;
  if (patch.note !== undefined) {
    const hadNote = Boolean(photo.note?.trim());
    const hasNote = Boolean(patch.note.trim());
    if (!hadNote && hasNote) notes += 1;
    if (hadNote && !hasNote) notes -= 1;
  }
  const extraCount = page.album.extraPhotoEnabled
    ? Math.max(0, selected - page.album.selectionLimit)
    : 0;
  return {
    ...counts,
    selected,
    notes,
    extraCount,
    extraFee: extraCount * page.album.extraPhotoPrice,
  };
}

function PhotoNoteEditor({
  initialNote,
  disabled,
  onSave,
}: {
  initialNote: string;
  disabled: boolean;
  onSave: (note: string) => void;
}) {
  const [value, setValue] = useState(initialNote);
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, 500))}
        placeholder="Ghi chú cho ảnh này (ví dụ: chỉnh da, xóa vật thể...)"
        disabled={disabled}
        rows={3}
        maxLength={500}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{value.length}/500</span>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || value.trim() === initialNote.trim()}
          onClick={() => onSave(value)}
        >
          Lưu ghi chú
        </Button>
      </div>
    </div>
  );
}

export function ShareGallery({
  token,
  studioName,
  initial,
}: {
  token: string;
  studioName: string;
  initial: ShareGalleryPage;
}) {
  const [page, setPage] = useState<ShareGalleryPage>(initial);
  const [tab, setTab] = useState<"all" | "selected" | "notes">("all");
  const [folderId, setFolderId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyNotes, setCopyNotes] = useState(false);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState<{
    extraCount: number;
    extraFee: number;
    requestCode: string | null;
  } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [qrOpen, setQrOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const photosRef = useRef<SharePhotoView[]>(page.photos);

  const locked = page.album.selectionStatus === "locked";
  const submitted = page.album.selectionStatus === "submitted";
  const currentPhoto = openPhotoId
    ? page.photos.find((photo) => photo.id === openPhotoId) ?? null
    : null;

  const loadPage = useCallback(
    async (nextTab: "all" | "selected" | "notes", nextFolderId: string) => {
      setLoading(true);
      const result = await loadSharePageAction({
        token,
        tab: nextTab,
        folderId: nextFolderId || undefined,
        page: 1,
      });
      setLoading(false);
      if (!result.ok) {
        toast.error(reasonMessage(result.reason));
        return;
      }
      setPage(result.page);
      setTab(nextTab);
      setFolderId(nextFolderId);
      setOpenPhotoId(null);
    },
    [token],
  );

  const loadMore = useCallback(async () => {
    if (loading || !page.hasMore) return;
    setLoading(true);
    const result = await loadSharePageAction({
      token,
      tab,
      folderId: folderId || undefined,
      page: page.page + 1,
    });
    setLoading(false);
    if (!result.ok) {
      toast.error(reasonMessage(result.reason));
      return;
    }
    setPage((previous) => ({
      ...result.page,
      photos: [...previous.photos, ...result.page.photos],
    }));
  }, [folderId, loading, page.hasMore, page.page, tab, token]);

  const updatePhoto = useCallback(
    async (
      photoId: string,
      patch: { selected?: boolean; favorite?: boolean; note?: string },
    ) => {
      const photo = page.photos.find((item) => item.id === photoId);
      if (!photo) return;
      const snapshot = page;
      setPage((previous) => {
        const target = previous.photos.find((item) => item.id === photoId);
        if (!target) return previous;
        return {
          ...previous,
          photos: previous.photos.map((item) =>
            item.id === photoId
              ? {
                  ...item,
                  selected: patch.selected ?? item.selected,
                  favorite: patch.favorite ?? item.favorite,
                  note: patch.note !== undefined ? patch.note.trim() || null : item.note,
                }
              : item,
          ),
          counts: countsAfterPatch(previous.counts, target, patch, previous),
        };
      });

      const result = await updateSharePhotoAction({
        token,
        photoId,
        favorite: patch.favorite,
        selected: patch.selected,
        note: patch.note,
      });

      if (!result.ok) {
        setPage(snapshot);
        toast.error(result.error);
        return;
      }

      setPage((previous) => {
        let photos = previous.photos.map((item) =>
          item.id === photoId
            ? {
                ...item,
                selected:
                  patch.selected ?? item.selected,
                favorite:
                  patch.favorite ?? item.favorite,
                note:
                  patch.note !== undefined
                    ? patch.note.trim() || null
                    : item.note,
              }
            : item,
        );
        if (tab === "selected" && patch.selected === false) {
          photos = photos.filter((item) => item.id !== photoId);
        }
        if (
          tab === "notes" &&
          patch.note !== undefined &&
          !patch.note.trim()
        ) {
          photos = photos.filter((item) => item.id !== photoId);
        }
        return {
          ...previous,
          photos,
          counts: {
            ...previous.counts,
            selected: result.summary.selectedCount,
            notes: result.summary.noteCount,
            extraCount: result.summary.extraCount,
            extraFee: result.summary.extraFee,
          },
        };
      });

      if (patch.note !== undefined) {
        toast.success("Đã lưu ghi chú.");
      }
    },
    [page, tab, token],
  );

  const handleCopy = useCallback(
    async (format: CopyFormat) => {
      setCopying(true);
      const result = await loadShareCodesAction({ token });
      setCopying(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.items.length === 0) {
        toast.error("Bạn chưa chọn ảnh nào.");
        return;
      }
      const text = formatPhotoCodes(result.items, format, copyNotes);
      const copied = await copyText(text);
      if (copied) {
        toast.success(`Đã copy ${result.items.length} mã ảnh.`);
      } else {
        toast.error("Trình duyệt không cho phép copy tự động.");
      }
    },
    [copyNotes, token],
  );

  const handleCopyLink = useCallback(async () => {
    const copied = await copyText(window.location.href);
    toast[copied ? "success" : "error"](
      copied ? "Đã copy link album." : "Không copy được link.",
    );
  }, []);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: page.album.title, url: window.location.href });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await handleCopyLink();
  }, [handleCopyLink, page.album.title]);

  // Giống trang StudioCore Drive: mặc định sáng, chỉ tối khi khách đã chọn.
  useLayoutEffect(() => {
    let savedTheme: string | null = null;
    try {
      savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {}
    const dark = savedTheme === "dark";
    document.documentElement.classList.toggle("dark", dark);
    if (dark) {
      const timeout = window.setTimeout(() => setTheme("dark"), 0);
      return () => {
        window.clearTimeout(timeout);
        restoreSiteTheme();
      };
    }
    return restoreSiteTheme;
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  };

  const confirmSubmit = useCallback(async () => {
    setSubmitting(true);
    const result = await submitShareSelectionAction({ token });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSubmitOpen(false);
    setSubmittedInfo({
      extraCount: result.summary.extraCount,
      extraFee: result.summary.extraFee,
      requestCode: result.paymentRequestCode,
    });
    setPage((previous) => ({
      ...previous,
      album: { ...previous.album, selectionStatus: "submitted" },
      counts: {
        ...previous.counts,
        selected: result.summary.selectedCount,
        notes: result.summary.noteCount,
        extraCount: result.summary.extraCount,
        extraFee: result.summary.extraFee,
      },
    }));
    toast.success("Đã gửi lựa chọn ảnh cho studio.");
  }, [token]);

  useEffect(() => {
    photosRef.current = page.photos;
  }, [page.photos]);

  useEffect(() => {
    if (!openPhotoId) return;
    const handleKey = (event: KeyboardEvent) => {
      const photos = photosRef.current;
      const index = photos.findIndex((photo) => photo.id === openPhotoId);
      if (event.key === "Escape") {
        setOpenPhotoId(null);
      } else if (event.key === "ArrowRight" && index >= 0) {
        const next = photos[index + 1];
        if (next) setOpenPhotoId(next.id);
      } else if (event.key === "ArrowLeft" && index > 0) {
        const previous = photos[index - 1];
        if (previous) setOpenPhotoId(previous.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(timer);
      lastTriggerRef.current?.focus();
    };
  }, [openPhotoId]);

  const currentIndex = currentPhoto
    ? page.photos.findIndex((photo) => photo.id === currentPhoto.id)
    : -1;

  const openPhoto = (photoId: string, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setOpenPhotoId(photoId);
  };

  const quotaExceeded = page.counts.selected > page.album.selectionLimit;
  const toolbarButton =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 px-2.5 text-sm font-medium hover:bg-slate-50 dark:border-neutral-700 dark:hover:bg-neutral-800";
  const tabButton = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition sm:text-sm",
      active
        ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-700 dark:text-white"
        : "text-slate-600 dark:text-neutral-300",
    );
  const folderChip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition",
      active
        ? "border-blue-600 bg-blue-600 text-white"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800",
    );
  const iconButton =
    "relative inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white";

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-28 text-slate-900 transition-colors dark:bg-neutral-950 dark:text-neutral-100">
      <header className="border-b border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white">
              {studioName.trim().charAt(0).toLocaleUpperCase("vi") || "S"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold uppercase tracking-wide">
                {studioName || "StudioCore"}
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">
                StudioCore PhotoShare
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Bật giao diện sáng" : "Bật giao diện tối"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentUrl(window.location.href);
                setQrOpen(true);
              }}
              className={toolbarButton}
            >
              <QrCode className="h-4 w-4" aria-hidden />
              <span>QR</span>
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label="Chia sẻ"
              className={toolbarButton}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Chia sẻ</span>
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto flex max-w-[1040px] flex-wrap items-start justify-between gap-4 px-4 pb-5 pt-7">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {page.album.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
            {page.counts.all} ảnh ·{" "}
            {locked
              ? "Đã khóa lựa chọn"
              : submitted
                ? "Đã gửi studio"
                : "Đang chọn ảnh"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Cùng chọn ảnh
        </button>
      </section>

      <div className="sticky top-0 z-30 border-y border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-neutral-800">
            <button
              type="button"
              aria-pressed={tab === "all"}
              onClick={() => void loadPage("all", folderId)}
              className={tabButton(tab === "all")}
            >
              Tất cả ({page.counts.all})
            </button>
            <button
              type="button"
              aria-pressed={tab === "selected"}
              aria-label={`Đã chọn (${page.counts.selected})`}
              onClick={() => void loadPage("selected", folderId)}
              className={tabButton(tab === "selected")}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />({page.counts.selected})
            </button>
            <button
              type="button"
              aria-pressed={tab === "notes"}
              aria-label={`Ghi chú (${page.counts.notes})`}
              onClick={() => void loadPage("notes", folderId)}
              className={tabButton(tab === "notes")}
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden />
              {page.counts.notes}
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-neutral-700">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    quotaExceeded ? "bg-amber-500" : "bg-blue-600",
                  )}
                  style={{
                    width: `${
                      page.album.selectionLimit > 0
                        ? Math.min(100, (page.counts.selected / page.album.selectionLimit) * 100)
                        : 0
                    }%`,
                  }}
                />
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-semibold",
                  quotaExceeded
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-blue-700 dark:text-blue-300",
                )}
              >
                {page.counts.selected}/{page.album.selectionLimit}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={copying}
                  aria-label="Copy mã đã chọn"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-blue-300 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950/40 sm:text-sm"
                >
                  {copying ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  Mã
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Định dạng copy</DropdownMenuLabel>
                {(Object.keys(COPY_FORMAT_LABELS) as CopyFormat[]).map(
                  (format) => (
                    <DropdownMenuItem
                      key={format}
                      onSelect={() => void handleCopy(format)}
                    >
                      {COPY_FORMAT_LABELS[format]}
                    </DropdownMenuItem>
                  ),
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  role="menuitemcheckbox"
                  aria-checked={copyNotes}
                  onSelect={(event) => {
                    event.preventDefault();
                    setCopyNotes((current) => !current);
                  }}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      copyNotes
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 dark:border-neutral-600",
                    )}
                  >
                    {copyNotes ? <Check className="h-3 w-3" aria-hidden /> : null}
                  </span>
                  Kèm ghi chú
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1040px] px-4 pt-5">
        {page.isDemo ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-[var(--warning)] dark:border-amber-900 dark:bg-amber-950/40">
            <strong>Đây là môi trường demo.</strong> Toàn bộ ảnh là ảnh synthetic
            có nhãn, không phải ảnh hay dữ liệu khách hàng thật.
          </div>
        ) : null}

        {locked ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <Lock className="mt-0.5 h-4 w-4 text-slate-500 dark:text-neutral-400" aria-hidden />
            <div>
              <p className="font-medium">Lựa chọn đã được khóa</p>
              <p className="text-slate-500 dark:text-neutral-400">
                Studio đã nhận danh sách ảnh bạn chọn. Liên hệ studio nếu cần
                chỉnh sửa.
              </p>
            </div>
          </div>
        ) : submitted ? (
          <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-[var(--success)] dark:border-emerald-900 dark:bg-emerald-950/40">
            Bạn đã gửi lựa chọn. Bạn vẫn có thể chỉnh sửa cho đến khi studio khóa
            danh sách.
          </div>
        ) : null}

        {submittedInfo ? (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            <p className="font-medium">Đã ghi nhận lựa chọn.</p>
            {submittedInfo.extraFee > 0 ? (
              <p className="mt-1 text-slate-500 dark:text-neutral-400">
                {submittedInfo.extraCount} ảnh vượt quota, phí phát sinh{" "}
                <strong>{formatVnd(submittedInfo.extraFee)}</strong>
                {submittedInfo.requestCode
                  ? ` · Yêu cầu thanh toán ${submittedInfo.requestCode} đã được tạo ở trạng thái chờ.`
                  : null}
              </p>
            ) : (
              <p className="mt-1 text-slate-500 dark:text-neutral-400">
                Không phát sinh phí ảnh thêm.
              </p>
            )}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {page.folders.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => void loadPage(tab, "")}
                className={folderChip(folderId === "")}
              >
                Tất cả thư mục
              </button>
              {page.folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => void loadPage(tab, folder.id)}
                  className={folderChip(folderId === folder.id)}
                >
                  {folder.name} ({folder.photoCount})
                </button>
              ))}
            </>
          ) : null}
          {page.album.extraPhotoEnabled && page.counts.extraCount > 0 ? (
            <span className="text-xs font-medium text-[var(--warning)] sm:ml-auto">
              Vượt {page.counts.extraCount} ảnh · phí dự kiến{" "}
              {formatVnd(page.counts.extraFee)}
            </span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-neutral-400 sm:ml-auto">
              {page.album.extraPhotoEnabled
                ? `Ảnh thêm ${formatVnd(page.album.extraPhotoPrice)}/ảnh nếu vượt quota`
                : "Chọn đúng số lượng studio đã thông báo"}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/2] w-full rounded-xl" />
            ))}
          </div>
        ) : page.photos.length === 0 ? (
          <div className="py-20 text-center">
            <Images className="mx-auto h-10 w-10 text-slate-400 dark:text-neutral-500" aria-hidden />
            <p className="mt-3 font-medium">
              {tab === "selected"
                ? "Bạn chưa chọn ảnh nào"
                : tab === "notes"
                  ? "Chưa có ảnh nào có ghi chú"
                  : "Album chưa có ảnh"}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
              {tab === "all"
                ? "Studio sẽ thông báo khi ảnh sẵn sàng."
                : "Chuyển sang tab Tất cả để chọn ảnh và thêm ghi chú."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {page.photos.map((photo, index) => (
                <article
                  key={photo.id}
                  className="overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(15,23,42,0.09)] dark:bg-neutral-900 dark:shadow-black/30"
                >
                  <div className="relative aspect-[3/2] overflow-hidden bg-slate-200 dark:bg-neutral-800">
                    <button
                      type="button"
                      className="absolute inset-0 block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                      onClick={(event) =>
                        openPhoto(photo.id, event.currentTarget)
                      }
                      aria-label={`Xem ảnh ${photo.code}`}
                    >
                      <Image
                        src={photo.thumbnailUrl}
                        alt={`Ảnh ${photo.code} — ${photo.filename}`}
                        width={480}
                        height={320}
                        unoptimized
                        referrerPolicy="no-referrer"
                        priority={index === 0}
                        loading={index === 0 ? "eager" : "lazy"}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <span
                      title={photo.filename}
                      className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-3.5rem)] truncate rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white"
                    >
                      {photo.code}
                      {photo.isRaw ? " · RAW" : ""}
                    </span>
                    {page.album.allowFavorites ? (
                      <button
                        type="button"
                        aria-label={
                          photo.favorite ? `Bỏ tim ${photo.code}` : `Thả tim ${photo.code}`
                        }
                        aria-pressed={photo.favorite}
                        disabled={locked}
                        onClick={() =>
                          void updatePhoto(photo.id, {
                            favorite: !photo.favorite,
                          })
                        }
                        className={cn(
                          "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 disabled:opacity-50",
                          photo.favorite && "bg-[#e5484d] hover:bg-[#d73e43]",
                        )}
                      >
                        <Heart
                          className={cn("h-4 w-4", photo.favorite && "fill-current")}
                          aria-hidden
                        />
                      </button>
                    ) : null}
                    {page.folders.length > 1 && photo.folderName ? (
                      <span className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/55 px-2 py-1 text-[10px] text-white">
                        {photo.folderName}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-h-12 items-center gap-1.5 px-2 py-1.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={photo.selected}
                      aria-label={
                        photo.selected
                          ? `Bỏ chọn ${photo.code}`
                          : `Chọn ${photo.code}`
                      }
                      disabled={locked}
                      onClick={() =>
                        void updatePhoto(photo.id, {
                          selected: !photo.selected,
                        })
                      }
                      className={cn(
                        "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold transition",
                        photo.selected
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700",
                        locked && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">
                        {photo.selected ? "Đã chọn" : "Chọn"}
                      </span>
                    </button>
                    <div className="ml-auto flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={`Copy mã ${photo.code}`}
                        title="Copy mã ảnh"
                        onClick={async () => {
                          const copied = await copyText(photo.code);
                          toast[copied ? "success" : "error"](
                            copied ? `Đã copy ${photo.code}` : "Không copy được mã.",
                          );
                        }}
                        className={iconButton}
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={`Ghi chú cho ${photo.code}`}
                        title={photo.note ?? "Ghi chú"}
                        disabled={locked || !page.album.allowNotes}
                        onClick={(event) =>
                          openPhoto(photo.id, event.currentTarget)
                        }
                        className={iconButton}
                      >
                        <MessageSquare className="h-4 w-4" aria-hidden />
                        {photo.note ? (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                        ) : null}
                      </button>
                    </div>
                  </div>
                  {photo.note ? (
                    <p className="line-clamp-2 break-words border-t border-slate-100 px-2.5 py-1.5 text-xs text-slate-600 dark:border-neutral-800 dark:text-neutral-300">
                      {photo.note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
            {page.hasMore ? (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={() => void loadMore()} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Xem thêm
                </Button>
              </div>
            ) : null}
          </>
        )}

        <p className="mt-8 text-center text-xs text-slate-500 dark:text-neutral-400">
          Ảnh xem trên PhotoShare là bản derivative có watermark. Bản gốc chỉ tải
          được khi studio cho phép.
        </p>
      </main>

      <div className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-fit rounded-full border border-slate-200 bg-white/95 p-2 shadow-[0_8px_30px_rgba(15,23,42,0.18)] backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "whitespace-nowrap px-2 text-xs font-bold sm:text-sm",
              quotaExceeded
                ? "text-amber-700 dark:text-amber-300"
                : "text-blue-700 dark:text-blue-300",
            )}
          >
            {page.counts.selected}/{page.album.selectionLimit}
          </span>
          <button
            type="button"
            disabled={copying || page.counts.selected === 0}
            onClick={() => void handleCopy("comma")}
            className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy
          </button>
          <button
            type="button"
            aria-pressed={tab === "selected"}
            onClick={() =>
              void loadPage(tab === "selected" ? "all" : "selected", folderId)
            }
            className={cn(
              "inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
              tab === "selected"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
            )}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Ảnh chọn
          </button>
          <Button
            disabled={locked || page.counts.selected === 0 || submitting}
            onClick={() => setSubmitOpen(true)}
            className="h-9 rounded-full bg-blue-600 px-3 text-xs text-white hover:bg-blue-700 disabled:opacity-50 sm:px-4 sm:text-sm"
          >
            {submitted ? "Gửi lại" : "Gửi Studio"}
          </Button>
        </div>
      </div>

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
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                aria-label="Đóng"
                className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="mx-auto inline-flex rounded-xl bg-white p-3">
              <QRCodeSVG value={currentUrl} size={232} includeMargin />
            </div>
            <p className="break-all text-xs text-slate-500 dark:text-neutral-400">
              {currentUrl}
            </p>
          </div>
        </div>
      ) : null}

      {currentPhoto ? (
        <div
          className="fixed inset-0 z-50 flex bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh ${currentPhoto.code}`}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col overflow-y-auto rounded-xl bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {currentPhoto.code}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {currentPhoto.folderName ?? "Chưa phân thư mục"} · {currentPhoto.filename}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ảnh trước"
                  disabled={currentIndex <= 0}
                  onClick={() => {
                    const previous = page.photos[currentIndex - 1];
                    if (previous) setOpenPhotoId(previous.id);
                  }}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ảnh tiếp theo"
                  disabled={currentIndex >= page.photos.length - 1}
                  onClick={() => {
                    const next = page.photos[currentIndex + 1];
                    if (next) setOpenPhotoId(next.id);
                  }}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </Button>
                <Button
                  ref={closeButtonRef}
                  variant="ghost"
                  size="icon"
                  aria-label="Đóng ảnh"
                  onClick={() => setOpenPhotoId(null)}
                >
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex items-center justify-center rounded-lg bg-black/5 p-2 dark:bg-black/30">
                <Image
                  src={currentPhoto.previewUrl}
                  alt={`Xem trước ảnh ${currentPhoto.code}`}
                  width={1440}
                  height={960}
                  unoptimized
                  referrerPolicy="no-referrer"
                  className="max-h-[62vh] w-auto max-w-full object-contain"
                />
              </div>
              <aside className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={currentPhoto.selected ? "primary" : "outline"}
                    size="sm"
                    disabled={locked}
                    onClick={() =>
                      void updatePhoto(currentPhoto.id, {
                        selected: !currentPhoto.selected,
                      })
                    }
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    {currentPhoto.selected ? "Bỏ chọn" : "Chọn ảnh"}
                  </Button>
                  <Button
                    variant={currentPhoto.favorite ? "primary" : "outline"}
                    size="sm"
                    disabled={locked || !page.album.allowFavorites}
                    onClick={() =>
                      void updatePhoto(currentPhoto.id, {
                        favorite: !currentPhoto.favorite,
                      })
                    }
                  >
                    <Heart
                      className={cn("h-4 w-4", currentPhoto.favorite && "fill-current")}
                      aria-hidden
                    />
                    {currentPhoto.favorite ? "Bỏ tim" : "Thả tim"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const copied = await copyText(currentPhoto.code);
                      toast[copied ? "success" : "error"](
                        copied ? `Đã copy ${currentPhoto.code}` : "Không copy được mã.",
                      );
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                    Copy mã
                  </Button>
                </div>

                {page.album.allowDownloads ? (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <a
                      href={`/api/share/${encodeURIComponent(token)}/download/${encodeURIComponent(currentPhoto.id)}`}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Tải ảnh gốc (nếu còn lượt)
                    </a>
                  </Button>
                ) : (
                  <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                    Album này không cho phép tải ảnh gốc.
                  </p>
                )}

                {page.album.allowNotes ? (
                  <PhotoNoteEditor
                    key={currentPhoto.id}
                    initialNote={currentPhoto.note ?? ""}
                    disabled={locked}
                    onSave={(note) =>
                      void updatePhoto(currentPhoto.id, { note })
                    }
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Album này không bật ghi chú.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  Dùng phím ←/→ để chuyển ảnh, Esc để đóng. Hình ảnh hiển thị là
                  bản có watermark.
                </p>
              </aside>
            </div>
          </div>
        </div>
      ) : null}

      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gửi lựa chọn cho studio?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đã chọn <strong>{page.counts.selected}</strong> ảnh trên quota{" "}
              <strong>{page.album.selectionLimit}</strong> ảnh.
              {page.counts.extraFee > 0 ? (
                <>
                  {" "}
                  Có <strong>{page.counts.extraCount}</strong> ảnh vượt quota với
                  phí dự kiến{" "}
                  <strong>{formatVnd(page.counts.extraFee)}</strong>. Studio sẽ
                  ghi nhận yêu cầu thanh toán sau khi bạn gửi.
                </>
              ) : (
                " Không phát sinh phí ảnh thêm."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {page.counts.extraFee > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-[var(--warning)] dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Phí chỉ được ghi nhận khi bạn xác nhận gửi. Bạn có thể chỉnh sửa
              lựa chọn sau khi gửi cho đến khi studio khóa.
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void confirmSubmit();
              }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Xác nhận gửi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
