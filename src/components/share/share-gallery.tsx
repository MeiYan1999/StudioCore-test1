"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Heart,
  Images,
  Link2,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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

const TABS: { key: "all" | "selected" | "notes"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "selected", label: "Đã chọn" },
  { key: "notes", label: "Ghi chú" },
];

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
  initial,
}: {
  token: string;
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Images className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  StudioCore PhotoShare
                </p>
                <h1 className="truncate text-lg font-semibold text-foreground">
                  {page.album.title}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Link2 className="h-4 w-4" aria-hidden />
                Copy link
              </Button>
              <Badge tone={locked ? "neutral" : submitted ? "warning" : "info"}>
                {locked
                  ? "Đã khóa lựa chọn"
                  : submitted
                    ? "Đã gửi studio"
                    : "Đang chọn ảnh"}
              </Badge>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone={page.counts.selected > page.album.selectionLimit ? "warning" : "success"}>
              Đã chọn {page.counts.selected}/{page.album.selectionLimit} ảnh
            </Badge>
            {page.album.extraPhotoEnabled && page.counts.extraCount > 0 ? (
              <span className="text-xs font-medium text-[var(--warning)]">
                Vượt {page.counts.extraCount} ảnh · phí dự kiến{" "}
                {formatVnd(page.counts.extraFee)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {page.album.extraPhotoEnabled
                  ? `Ảnh thêm ${formatVnd(page.album.extraPhotoPrice)}/ảnh nếu vượt quota`
                  : "Chọn đúng số lượng studio đã thông báo"}
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={copyNotes}
                  onChange={(event) => setCopyNotes(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Kèm ghi chú
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={copying}>
                    {copying ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                    Copy mã đã chọn
                  </Button>
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
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                onClick={() => setSubmitOpen(true)}
                disabled={locked || page.counts.selected === 0 || submitting}
              >
                <Send className="h-4 w-4" aria-hidden />
                {submitted ? "Gửi lại lựa chọn" : "Gửi lựa chọn"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {page.isDemo ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-[var(--warning)] dark:border-amber-900 dark:bg-amber-950/40">
            <strong>Đây là môi trường demo.</strong> Toàn bộ ảnh là ảnh synthetic
            có nhãn, không phải ảnh hay dữ liệu khách hàng thật.
          </div>
        ) : null}

        {locked ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
            <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <div>
              <p className="font-medium text-foreground">Lựa chọn đã được khóa</p>
              <p className="text-muted-foreground">
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
          <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Đã ghi nhận lựa chọn.</p>
            {submittedInfo.extraFee > 0 ? (
              <p className="mt-1 text-muted-foreground">
                {submittedInfo.extraCount} ảnh vượt quota, phí phát sinh{" "}
                <strong>{formatVnd(submittedInfo.extraFee)}</strong>
                {submittedInfo.requestCode
                  ? ` · Yêu cầu thanh toán ${submittedInfo.requestCode} đã được tạo ở trạng thái chờ.`
                  : null}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Không phát sinh phí ảnh thêm.
              </p>
            )}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => void loadPage(item.key, folderId)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === item.key
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label} ({page.counts[item.key]})
              </button>
            ))}
          </div>
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
            <button
              type="button"
              onClick={() => void loadPage(tab, "")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                folderId === ""
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              Tất cả thư mục
            </button>
            {page.folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => void loadPage(tab, folder.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  folderId === folder.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {folder.name} ({folder.photoCount})
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/2] w-full rounded-xl" />
            ))}
          </div>
        ) : page.photos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
            <Images className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium text-foreground">
              {tab === "selected"
                ? "Bạn chưa chọn ảnh nào"
                : tab === "notes"
                  ? "Chưa có ảnh nào có ghi chú"
                  : "Album chưa có ảnh"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === "all"
                ? "Studio sẽ thông báo khi ảnh sẵn sàng."
                : "Chuyển sang tab Tất cả để chọn ảnh và thêm ghi chú."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {page.photos.map((photo, index) => (
                <article
                  key={photo.id}
                  className="group overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <div className="relative aspect-[3/2] bg-surface-muted">
                    <button
                      type="button"
                      className="absolute inset-0 h-full w-full"
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
                    <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 font-mono text-xs font-semibold text-white">
                      {photo.code}
                    </span>
                    {photo.isRaw ? (
                      <span className="pointer-events-none absolute left-2 top-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        RAW
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={
                        photo.favorite ? `Bỏ tim ${photo.code}` : `Thả tim ${photo.code}`
                      }
                      aria-pressed={photo.favorite}
                      disabled={locked || !page.album.allowFavorites}
                      onClick={() =>
                        void updatePhoto(photo.id, {
                          favorite: !photo.favorite,
                        })
                      }
                      className={cn(
                        "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-50",
                        photo.favorite && "bg-rose-600 hover:bg-rose-700",
                      )}
                    >
                      <Heart
                        className={cn("h-4 w-4", photo.favorite && "fill-current")}
                        aria-hidden
                      />
                    </button>
                    <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-2">
                      <span className="min-w-0 truncate rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
                        {photo.folderName ?? "Chưa phân thư mục"}
                      </span>
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
                          "flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-white",
                          photo.selected
                            ? "bg-primary hover:bg-primary-hover"
                            : "bg-black/60 hover:bg-black/80",
                        )}
                      >
                        <Check className="h-4 w-4" aria-hidden />
                        {photo.selected ? "Đã chọn" : "Chọn"}
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {photo.filename}
                    </p>
                    {photo.note ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {photo.note}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const copied = await copyText(photo.code);
                          toast[copied ? "success" : "error"](
                            copied ? `Đã copy ${photo.code}` : "Không copy được mã.",
                          );
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        Mã
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={locked || !page.album.allowNotes}
                        onClick={(event) =>
                          openPhoto(photo.id, event.currentTarget)
                        }
                      >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        {photo.note ? "Sửa ghi chú" : "Ghi chú"}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {page.hasMore ? (
              <div className="mt-5 flex justify-center">
                <Button variant="outline" onClick={() => void loadMore()} disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Tải thêm ảnh
                </Button>
              </div>
            ) : null}
          </>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Ảnh xem trên PhotoShare là bản derivative có watermark. Bản gốc chỉ tải
          được khi studio cho phép.
        </p>
      </main>

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
