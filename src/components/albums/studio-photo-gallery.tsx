"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  Images,
  MessageSquare,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { AlbumPhotoView } from "@/lib/services/album-service";
import { cn, formatDateTime, formatVnd } from "@/lib/utils";
import { copyToClipboard } from "@/lib/utils/clipboard";

type Tab = "all" | "selected" | "notes";

export function StudioPhotoGallery({
  photos,
  folders,
}: {
  photos: AlbumPhotoView[];
  folders: { id: string; name: string; photoCount: number }[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [folderId, setFolderId] = useState("");
  const [visible, setVisible] = useState(24);
  const [openId, setOpenId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const photosRef = useRef<AlbumPhotoView[]>([]);

  const counts = {
    all: photos.filter((photo) => photo.status !== "missing").length,
    selected: photos.filter((photo) => photo.selected).length,
    notes: photos.filter((photo) => Boolean(photo.note?.trim())).length,
  };

  const filtered = photos.filter((photo) => {
    if (folderId && photo.folderId !== folderId) return false;
    if (tab === "selected") return photo.selected;
    if (tab === "notes") return Boolean(photo.note?.trim());
    return true;
  });
  useEffect(() => {
    photosRef.current = filtered;
  }, [filtered]);
  const shown = filtered.slice(0, visible);
  const currentPhoto = openId
    ? photos.find((photo) => photo.id === openId) ?? null
    : null;
  const currentIndex = currentPhoto
    ? filtered.findIndex((photo) => photo.id === currentPhoto.id)
    : -1;

  const changeTab = (next: Tab) => {
    setTab(next);
    setVisible(24);
    setOpenId(null);
  };

  const changeFolder = (next: string) => {
    setFolderId(next);
    setVisible(24);
    setOpenId(null);
  };

  const openPhoto = (photo: AlbumPhotoView, trigger: HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setOpenId(photo.id);
  };

  useEffect(() => {
    if (!openId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const list = photosRef.current;
        const index = list.findIndex((photo) => photo.id === openId);
        const offset = event.key === "ArrowRight" ? 1 : -1;
        const target = list[index + offset];
        if (target) setOpenId(target.id);
      }
    };
    window.addEventListener("keydown", handler);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(timer);
      lastTriggerRef.current?.focus();
    };
  }, [openId]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-1">
          {(
            [
              ["all", "Tất cả"],
              ["selected", "Khách đã chọn"],
              ["notes", "Ghi chú"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => changeTab(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                tab === key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => changeFolder("")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs",
              folderId === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            Tất cả thư mục
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => changeFolder(folder.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                folderId === folder.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {folder.name} ({folder.photoCount})
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Images className="h-6 w-6" aria-hidden />}
          title={
            tab === "selected"
              ? "Khách chưa chọn ảnh"
              : tab === "notes"
                ? "Chưa có ghi chú"
                : "Album chưa có ảnh"
          }
          description={
            tab === "all"
              ? "Tải ảnh lên hoặc quét lại nguồn Drive để thêm ảnh."
              : "Chuyển tab để xem toàn bộ ảnh."
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((photo) => (
              <article
                key={photo.id}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <div className="relative aspect-[3/2] bg-surface-muted">
                  <button
                    type="button"
                    className="absolute inset-0 h-full w-full"
                    onClick={(event) => openPhoto(photo, event.currentTarget)}
                    aria-label={`Xem ảnh ${photo.code}`}
                  >
                    <Image
                      src={photo.thumbnailUrl}
                      alt={`Ảnh ${photo.code}`}
                      width={480}
                      height={320}
                      unoptimized
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-xs text-white">
                    {photo.code}
                  </span>
                  <div className="pointer-events-none absolute right-2 top-2 flex gap-1">
                    {photo.selected ? (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Đã chọn
                      </span>
                    ) : null}
                    {photo.favorite ? (
                      <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        ♥
                      </span>
                    ) : null}
                    {photo.status === "missing" ? (
                      <span className="rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Missing
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-medium text-foreground">
                    {photo.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {photo.folderName ?? "Chưa phân thư mục"}
                  </p>
                  {photo.note ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {photo.note}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
          {visible < filtered.length ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisible((current) => current + 24)}
              >
                Xem thêm ({filtered.length - visible} ảnh)
              </Button>
            </div>
          ) : null}
        </>
      )}

      {currentPhoto ? (
        <div
          className="fixed inset-0 z-50 flex bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh ${currentPhoto.code}`}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col overflow-y-auto rounded-xl bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-sm font-semibold">
                  {currentPhoto.code}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {currentPhoto.folderName ?? "Chưa phân thư mục"} ·{" "}
                  {currentPhoto.filename}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ảnh trước"
                  disabled={currentIndex <= 0}
                  onClick={() => {
                    const previous = filtered[currentIndex - 1];
                    if (previous) setOpenId(previous.id);
                  }}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Ảnh tiếp theo"
                  disabled={currentIndex >= filtered.length - 1}
                  onClick={() => {
                    const next = filtered[currentIndex + 1];
                    if (next) setOpenId(next.id);
                  }}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </Button>
                <Button
                  ref={closeButtonRef}
                  variant="ghost"
                  size="icon"
                  aria-label="Đóng ảnh"
                  onClick={() => setOpenId(null)}
                >
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              </div>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex items-center justify-center rounded-lg bg-black/5 p-2 dark:bg-black/30">
                <Image
                  src={currentPhoto.previewUrl}
                  alt={`Xem trước ${currentPhoto.code}`}
                  width={1440}
                  height={960}
                  unoptimized
                  className="max-h-[62vh] w-auto max-w-full object-contain"
                />
              </div>
              <aside className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={currentPhoto.selected ? "success" : "neutral"}>
                    {currentPhoto.selected ? "Khách đã chọn" : "Chưa chọn"}
                  </Badge>
                  {currentPhoto.favorite ? (
                    <Badge tone="danger">
                      <Heart className="h-3 w-3 fill-current" aria-hidden /> Yêu thích
                    </Badge>
                  ) : null}
                  {currentPhoto.note ? (
                    <Badge tone="info">
                      <MessageSquare className="h-3 w-3" aria-hidden /> Có ghi chú
                    </Badge>
                  ) : null}
                </div>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Tên file</dt>
                    <dd className="truncate text-right">{currentPhoto.filename}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Kích thước</dt>
                    <dd>
                      {currentPhoto.width}×{currentPhoto.height}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Trạng thái</dt>
                    <dd>{currentPhoto.status}</dd>
                  </div>
                  {currentPhoto.selectedAt ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Chọn lúc</dt>
                      <dd>{formatDateTime(currentPhoto.selectedAt)}</dd>
                    </div>
                  ) : null}
                  {currentPhoto.extraFee > 0 ? (
                    <div className="flex justify-between gap-3 text-[var(--warning)]">
                      <dt>Phí ảnh thêm</dt>
                      <dd>{formatVnd(currentPhoto.extraFee)}</dd>
                    </div>
                  ) : null}
                </dl>
                {currentPhoto.note ? (
                  <div className="rounded-lg bg-surface-muted p-3 text-xs">
                    <p className="font-medium text-foreground">Ghi chú của khách</p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {currentPhoto.note}
                    </p>
                  </div>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const copied = await copyToClipboard(currentPhoto.code);
                    toast[copied ? "success" : "error"](
                      copied ? `Đã copy ${currentPhoto.code}` : "Không copy được mã.",
                    );
                  }}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  Copy mã ảnh
                </Button>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
