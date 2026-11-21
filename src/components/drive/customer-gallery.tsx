"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Heart,
  Download,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { DriveGallery } from "@/lib/services/drive-service";
import { mutateDriveGalleryAction, verifyDrivePinAction } from "@/lib/actions/drive-actions";
import { initialActionState, type ActionState } from "@/lib/actions/action-state";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

type GalleryFile = DriveGallery["files"][number];

function GalleryForm({
  token,
  operation,
  fileId,
  children,
  verify = false,
}: {
  token: string;
  operation?: string;
  fileId?: string;
  children: React.ReactNode;
  verify?: boolean;
}) {
  const [state, action, pending] = useActionState(async (previous: ActionState, form: FormData) => {
    const result = await (verify ? verifyDrivePinAction : mutateDriveGalleryAction)(previous, form);
    if (result.status === "success") toast.success(result.message);
    else toast.error(result.message);
    return result;
  }, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="operation" value={operation || ""} />
      <input type="hidden" name="fileId" value={fileId || ""} />
      <fieldset disabled={pending} className="space-y-2 disabled:opacity-60">
        {children}
      </fieldset>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function DrivePinForm({ token }: { token: string }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <LockKeyhole className="mb-3 size-8 text-primary" />
      <h2 className="mb-2 text-lg font-semibold">Nhập PIN để xem</h2>
      <p className="mb-5 text-sm text-muted-foreground">Nhập mã 6 số studio đã gửi cho bạn.</p>
      <GalleryForm token={token} verify>
        <label htmlFor="drive-pin" className="sr-only">
          PIN
        </label>
        <Input
          id="drive-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          placeholder="PIN 6 số"
        />
        <Button type="submit" className="w-full">
          Mở album
        </Button>
      </GalleryForm>
    </div>
  );
}

function MediaImage({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div
        className={`flex min-h-40 flex-col items-center justify-center gap-2 bg-surface-muted p-5 text-center text-sm text-muted-foreground ${className || ""}`}
      >
        <ImageOff className="size-8" />
        <span>Chưa tải được ảnh. Vui lòng thử lại sau.</span>
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(element) => {
        if (element?.complete && element.naturalWidth === 0) setFailed(true);
      }}
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

function DownloadLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noreferrer" download>
        <Download className="size-4" />
        {children}
      </a>
    </Button>
  ) : null;
}

function FileSelection({
  file,
  token,
  locked,
  atLimit,
}: {
  file: GalleryFile;
  token: string;
  locked: boolean;
  atLimit: boolean;
}) {
  if (!["image", "raw"].includes(file.kind)) return null;
  return (
    <div className="space-y-2">
      <GalleryForm token={token} operation="like" fileId={file.id}>
        <Button
          type="submit"
          variant={file.liked ? "primary" : "outline"}
          size="sm"
          disabled={locked || (!file.liked && atLimit)}
          aria-pressed={file.liked}
        >
          <Heart className={`size-4 ${file.liked ? "fill-current" : ""}`} />
          {file.liked ? "Đã chọn" : "Chọn ảnh"}
        </Button>
      </GalleryForm>
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          {file.note ? "Xem / sửa ghi chú" : "Thêm ghi chú"}
        </summary>
        <GalleryForm token={token} operation="note" fileId={file.id}>
          <Textarea
            aria-label={`Ghi chú ${file.name}`}
            name="note"
            maxLength={1000}
            defaultValue={file.note}
            disabled={locked}
            className="mt-2"
          />
          <Button type="submit" size="sm" variant="outline" disabled={locked}>
            Lưu ghi chú
          </Button>
        </GalleryForm>
      </details>
    </div>
  );
}

function VideoGallery({ gallery, token }: { gallery: DriveGallery; token: string }) {
  const videos = gallery.files.filter((file) => file.kind === "video");
  const [fileId, setFileId] = useState(videos[0]?.id);
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const file = videos.find((item) => item.id === fileId);
  if (!file) return <p>Chưa có video.</p>;
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {videos.map((item) => (
            <Button
              key={item.id}
              variant={item.id === fileId ? "primary" : "outline"}
              onClick={() => {
                setFileId(item.id);
                setSeconds(0);
                setFailed(false);
              }}
            >
              {item.name}
            </Button>
          ))}
        </div>
        {file.stream && !failed ? (
          <video
            key={file.stream}
            ref={(element) => {
              video.current = element;
              if (element?.error) setFailed(true);
            }}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-black"
            src={file.stream}
            onTimeUpdate={() => setSeconds(video.current?.currentTime || 0)}
            onError={() => setFailed(true)}
          />
        ) : (
          <p className="rounded-xl bg-surface-muted p-8">
            Chưa tải được video. Vui lòng thử lại sau.
          </p>
        )}
        <DownloadLink href={file.original}>Tải video</DownloadLink>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Bình luận tại {seconds.toFixed(1)}s</h2>
        <GalleryForm token={token} operation="comment" fileId={file.id}>
          <input type="hidden" name="seconds" value={seconds} />
          <Input
            name="author"
            aria-label="Tên của bạn"
            placeholder="Tên của bạn"
            maxLength={80}
            required
          />
          <Textarea
            name="content"
            aria-label="Bình luận"
            placeholder="Góp ý cho studio…"
            maxLength={1000}
            required
          />
          <Button type="submit" disabled={gallery.selectionStatus === "finalized"}>
            Gửi bình luận
          </Button>
        </GalleryForm>
        <div className="space-y-3">
          {gallery.comments
            .filter((item) => item.fileId === file.id)
            .map((comment) => (
              <div key={comment.id} className="border-t border-border pt-3 text-sm">
                <button
                  className="font-medium text-primary underline"
                  onClick={() => {
                    if (video.current) video.current.currentTime = comment.seconds;
                  }}
                >
                  {comment.seconds.toFixed(1)}s · {comment.author}
                </button>
                <p className="whitespace-pre-wrap">{comment.content}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export function CustomerGallery({ gallery, token }: { gallery: DriveGallery; token: string }) {
  const [filter, setFilter] = useState("all");
  const [folder, setFolder] = useState("all");
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const likedCount = gallery.files.filter((file) => file.liked).length;
  const locked = gallery.selectionStatus === "finalized";
  const folders = [
    ...new Set(
      gallery.files.map((file) =>
        file.relPath.includes("/")
          ? file.relPath.slice(0, file.relPath.lastIndexOf("/"))
          : "Thư mục gốc",
      ),
    ),
  ];
  const visible = gallery.files.filter(
    (file) =>
      (filter === "all" || (filter === "liked" ? file.liked : !!file.note)) &&
      (folder === "all" ||
        (file.relPath.includes("/")
          ? file.relPath.slice(0, file.relPath.lastIndexOf("/"))
          : "Thư mục gốc") === folder),
  );
  const photos = visible.filter((file) => ["image", "raw"].includes(file.kind));
  const currentIndex = photos.findIndex((file) => file.id === lightboxId);
  const current = photos[currentIndex];
  useEffect(() => {
    if (!lightboxId || photos.length === 0) return;
    function handle(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        setLightboxId(photos[(currentIndex + delta + photos.length) % photos.length].id);
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [lightboxId, currentIndex, photos]);
  if (gallery.kind === "video") return <VideoGallery gallery={gallery} token={token} />;
  if (gallery.kind === "folder")
    return (
      <div className="space-y-4">
        <DownloadLink href={gallery.zip}>Tải tất cả (ZIP)</DownloadLink>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4">Tên tệp</th>
                <th className="p-4">Thư mục</th>
                <th className="p-4">Dung lượng</th>
                <th className="p-4">Tải xuống</th>
              </tr>
            </thead>
            <tbody>
              {gallery.files.map((file) => (
                <tr key={file.id} className="border-b border-border">
                  <td className="p-4">{file.name}</td>
                  <td className="p-4">{file.relPath}</td>
                  <td className="p-4">{(file.sizeBytes / 1024 / 1024).toFixed(2)} MB</td>
                  <td className="p-4">
                    <DownloadLink href={file.original}>Tải tệp</DownloadLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {gallery.files.length === 0 && <p>Thư mục chưa có tệp.</p>}
      </div>
    );
  return (
    <div className="space-y-6">
      {gallery.kind === "album" && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
          <div>
            <p className="font-semibold">
              Đã chọn {likedCount} / {gallery.maxSelect} ảnh
            </p>
            <p className="text-xs text-muted-foreground">
              Chọn trái tim để gửi ảnh yêu thích cho studio.
            </p>
          </div>
          {locked ? (
            <Badge tone="success">
              <Check className="size-4" />
              Đã chốt lựa chọn. Liên hệ studio để mở lại.
            </Badge>
          ) : (
            <GalleryForm token={token} operation="finalize">
              <Button type="submit">Chốt ảnh gửi studio</Button>
            </GalleryForm>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc ảnh">
          {(gallery.kind === "album"
            ? [
                ["all", "Tất cả"],
                ["liked", "Đã chọn"],
                ["notes", "Có ghi chú"],
              ]
            : [["all", "Tất cả"]]
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? "primary" : "outline"}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
            </Button>
          ))}
        </div>
        <DownloadLink href={gallery.zip}>Tải ZIP</DownloadLink>
      </div>
      {folders.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Thư mục">
          {["all", ...folders].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={folder === value ? "primary" : "outline"}
              onClick={() => setFolder(value)}
            >
              {value === "all" ? "Mọi thư mục" : value}
            </Button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((file) => (
          <article
            key={file.id}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            <button
              className="block w-full text-left"
              disabled={!["image", "raw"].includes(file.kind)}
              onClick={() => setLightboxId(file.id)}
              aria-label={`Xem ${file.name}`}
            >
              <MediaImage
                key={file.thumb}
                src={file.thumb}
                name={file.name}
                className="aspect-[4/3] w-full object-cover"
              />
            </button>
            <div className="space-y-3 p-4">
              <p className="truncate text-sm font-medium" title={file.name}>
                {file.name}
              </p>
              {gallery.kind === "album" && (
                <FileSelection
                  file={file}
                  token={token}
                  locked={locked}
                  atLimit={likedCount >= (gallery.maxSelect || 0)}
                />
              )}
              <DownloadLink href={file.original}>Tải bản gốc</DownloadLink>
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">Không có ảnh trong mục này.</p>
      )}
      <Dialog
        open={!!current}
        onOpenChange={(open) => {
          if (!open) setLightboxId(null);
        }}
      >
        <DialogContent className="max-h-[95dvh] max-w-5xl overflow-y-auto">
          <DialogTitle>{current?.name}</DialogTitle>
          <DialogDescription>
            Xem ảnh lớn. Dùng phím mũi tên để chuyển ảnh, Esc để đóng.
          </DialogDescription>
          {current && (
            <>
              <MediaImage
                key={current.preview}
                src={current.preview}
                name={current.name}
                className="max-h-[60dvh] w-full object-contain"
              />
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  aria-label="Ảnh trước"
                  onClick={() =>
                    setLightboxId(photos[(currentIndex - 1 + photos.length) % photos.length].id)
                  }
                >
                  <ChevronLeft />
                </Button>
                <span>
                  {currentIndex + 1} / {photos.length}
                </span>
                <Button
                  variant="outline"
                  aria-label="Ảnh tiếp"
                  onClick={() => setLightboxId(photos[(currentIndex + 1) % photos.length].id)}
                >
                  <ChevronRight />
                </Button>
              </div>
              {gallery.kind === "album" && (
                <FileSelection
                  key={current.id}
                  file={current}
                  token={token}
                  locked={locked}
                  atLimit={likedCount >= (gallery.maxSelect || 0)}
                />
              )}
              <DownloadLink href={current.original}>Tải bản gốc</DownloadLink>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
