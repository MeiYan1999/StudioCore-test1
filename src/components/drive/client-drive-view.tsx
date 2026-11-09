"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Check,
  CheckCircle2,
  Download,
  FileText,
  Folder,
  HardDrive,
  Heart,
  MessageSquare,
  Play,
  Send,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandApertureIcon } from "@/components/brand/brand-logo";
import type { DriveShare, DriveItem, DriveVideoComment } from "@/lib/services/drive-service";

export function ClientDriveView({ initialShare }: { initialShare: DriveShare }) {
  const [share, setShare] = useState<DriveShare>(initialShare);
  const [activeTab, setActiveTab] = useState<"all" | "selected">("all");
  const [selectedPhoto, setSelectedPhoto] = useState<DriveItem | null>(null);
  const [noteInput, setNoteInput] = useState<string>("");
  const [finalSubmitted, setFinalSubmitted] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  // Video state
  const [currentTime, setCurrentTime] = useState<number>(45);
  const [commentText, setCommentText] = useState<string>("");
  const [commentAuthor, setCommentAuthor] = useState<string>("");

  const selectedCount = share.items.filter((i) => i.selected).length;
  const filteredItems =
    activeTab === "selected" ? share.items.filter((i) => i.selected) : share.items;

  const handleToggleSelect = (item: DriveItem) => {
    const updatedItems = share.items.map((i) => {
      if (i.id === item.id) {
        return { ...i, selected: !i.selected };
      }
      return i;
    });
    setShare({
      ...share,
      items: updatedItems,
      selectedCount: updatedItems.filter((i) => i.selected).length,
    });
  };

  const handleSaveNote = () => {
    if (!selectedPhoto) return;
    const updatedItems = share.items.map((i) => {
      if (i.id === selectedPhoto.id) {
        return { ...i, note: noteInput.trim() || null };
      }
      return i;
    });
    setShare({ ...share, items: updatedItems });
    setSelectedPhoto({ ...selectedPhoto, note: noteInput.trim() || null });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const mins = Math.floor(currentTime / 60).toString().padStart(2, "0");
    const secs = Math.floor(currentTime % 60).toString().padStart(2, "0");
    const timeLabel = `${mins}:${secs}`;

    const newComment: DriveVideoComment = {
      id: `cmt-${Date.now()}`,
      seconds: currentTime,
      timeLabel,
      author: commentAuthor.trim() || "Khách hàng",
      content: commentText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...(share.comments || []), newComment].sort(
      (a, b) => a.seconds - b.seconds,
    );

    setShare({ ...share, comments: updatedComments });
    setCommentText("");
  };

  const handleDownload = (label: string) => {
    setDownloadToast(`Đang kết nối tải trực tiếp từ máy studio: ${label}`);
    setTimeout(() => setDownloadToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Client Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xs">
              <BrandApertureIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-foreground text-sm sm:text-base">
                Studio<span className="text-primary">Core</span> Drive
              </span>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync trực tiếp từ máy Studio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5 text-primary" />
              <span>{share.agentHostname}</span>
            </span>

            {share.type === "album" && (
              <Button
                size="sm"
                onClick={() => setFinalSubmitted(true)}
                className="shadow-md shadow-primary/20 text-xs"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Chốt ({selectedCount}) ảnh
              </Button>
            )}

            {share.type === "folder" && share.allowZipDownload && (
              <Button
                size="sm"
                onClick={() => handleDownload("Toan_bo_thu_muc.zip")}
                className="shadow-md shadow-primary/20 text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Tải cả thư mục (.zip)
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6">
        {/* Banner Title & Share Metadata */}
        <div className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={share.type === "video" ? "warning" : share.type === "album" ? "info" : "neutral"}>
                {share.type === "video" ? "Video Review" : share.type === "album" ? "Album Chọn Ảnh" : "Thư Mục File Gốc"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Tổng: <strong className="text-foreground">{share.totalSizeLabel}</strong> · {share.totalFiles} file
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {share.title}
            </h1>
            {share.subtitle && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{share.subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {share.type === "album" && (
              <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    activeTab === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tất cả ({share.items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("selected")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                    activeTab === "selected"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
                  <span>Đã chọn ({selectedCount})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            VIEW MODE 1: ALBUM (Interactive photo grid with selection)
            ========================================================================= */}
        {share.type === "album" && (
          <div className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-xl border bg-surface transition-all duration-300 hover:shadow-lg ${
                    item.selected ? "border-primary ring-2 ring-primary/40" : "border-border"
                  }`}
                >
                  <div
                    className="relative aspect-square cursor-pointer overflow-hidden bg-surface-muted"
                    onClick={() => {
                      setSelectedPhoto(item);
                      setNoteInput(item.note || "");
                    }}
                  >
                    <Image
                      src={item.previewUrl}
                      alt={item.name}
                      width={400}
                      height={400}
                      unoptimized
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-white backdrop-blur-xs">
                      {item.format} · {item.sizeLabel}
                    </span>
                  </div>

                  {/* Top Bar on Item: Heart Button & Code */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(item);
                      }}
                      className={`flex h-8 w-8 items-center justify-center rounded-full shadow-md backdrop-blur-md transition-all active:scale-90 ${
                        item.selected
                          ? "bg-rose-500 text-white"
                          : "bg-black/60 text-white/80 hover:bg-black/80 hover:text-white"
                      }`}
                    >
                      <Heart
                        className={`h-4 w-4 ${item.selected ? "fill-white" : ""}`}
                      />
                    </button>
                  </div>

                  <div className="p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-foreground truncate max-w-[110px]">
                        {item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPhoto(item);
                          setNoteInput(item.note || "");
                        }}
                        className="text-[11px] text-primary hover:underline"
                      >
                        {item.note ? "Sửa ghi chú" : "+ Ghi chú"}
                      </button>
                    </div>
                    {item.note && (
                      <p className="mt-1 truncate text-[10px] text-amber-600 dark:text-amber-400 italic">
                        “{item.note}”
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW MODE 2: FOLDER (Structured file list & direct download)
            ========================================================================= */}
        {share.type === "folder" && (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-border bg-surface p-4 text-xs text-muted-foreground flex items-center justify-between">
              <span>Đường dẫn máy chủ studio: <code className="font-mono text-foreground">{share.localPath}</code></span>
              <span>Tổng dung lượng: <strong className="text-foreground">{share.totalSizeLabel}</strong></span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-surface divide-y divide-border">
              {share.items.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-surface-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {file.format === "ZIP" ? (
                        <Folder className="h-5 w-5" />
                      ) : file.format === "PDF" ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <HardDrive className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {file.format} · {file.sizeLabel}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(file.name)}
                    className="text-xs"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Tải file gốc
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW MODE 3: VIDEO PLAYER WITH TIMESTAMP COMMENTS
            ========================================================================= */}
        {share.type === "video" && share.videoMeta && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            {/* Left: Video Player Mockup */}
            <div className="space-y-4">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
                <Image
                  src={share.videoMeta.coverUrl}
                  alt={share.title}
                  width={1280}
                  height={720}
                  className="h-full w-full object-cover opacity-80"
                />

                {/* Simulated Overlay Controls */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95 cursor-pointer">
                    <Play className="h-8 w-8 ml-1 fill-white" />
                  </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 text-white">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono">00:45 / {share.videoMeta.durationLabel}</span>
                    <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                      {share.videoMeta.resolution}
                    </span>
                  </div>
                  {/* Timeline bar with comment markers */}
                  <div className="relative mt-2 h-2 w-full rounded-full bg-white/30 cursor-pointer">
                    <div className="h-full w-1/4 rounded-full bg-primary" />
                    {/* Timestamp pins */}
                    {share.comments?.map((c) => (
                      <span
                        key={c.id}
                        style={{ left: `${(c.seconds / share.videoMeta!.durationSeconds) * 100}%` }}
                        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-1.5 rounded-full bg-amber-400 shadow-sm"
                        title={`${c.timeLabel}: ${c.content}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{share.title}</h2>
                  <p className="text-xs text-muted-foreground">Phát trực tiếp từ Studio không giảm chất lượng</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleDownload("Video_Highlight_4K.mp4")}
                  className="text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Tải Video Gốc (2.2 GB)
                </Button>
              </div>
            </div>

            {/* Right: Timestamp Comments Column */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Góp ý theo từng giây</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {share.comments?.length || 0} phản hồi
                </span>
              </div>

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary">
                    Mốc: 00:45
                  </span>
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="Tên của bạn (Cô dâu/Chú rể)"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Nhập yêu cầu sửa tại giây này..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  <Button type="submit" size="sm" className="h-8 text-xs shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </form>

              {/* Comments List */}
              <div className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {share.comments?.map((comment) => (
                  <div
                    key={comment.id}
                    onClick={() => setCurrentTime(comment.seconds)}
                    className="group cursor-pointer rounded-xl border border-border/70 bg-background/80 p-3 transition-colors hover:border-primary/50 hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-foreground">{comment.author}</span>
                      <span className="font-mono font-semibold text-primary rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px]">
                        {comment.timeLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{comment.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          PHOTO INSPECT & NOTE MODAL
          ========================================================================= */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
              <div>
                <p className="font-mono font-bold text-foreground text-sm">{selectedPhoto.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedPhoto.format} · {selectedPhoto.sizeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative max-h-[50vh] overflow-hidden bg-black flex items-center justify-center">
              <Image
                src={selectedPhoto.previewUrl}
                alt={selectedPhoto.name}
                width={1200}
                height={800}
                unoptimized
                className="max-h-[50vh] w-auto object-contain"
              />
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground">Ghi chú yêu cầu sửa ảnh này:</label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Ví dụ: Làm sáng da cô dâu, xóa bóng người đằng sau, chỉnh màu tone Hàn Quốc..."
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleSelect(selectedPhoto)}
                  className={`text-xs ${selectedPhoto.selected ? "border-rose-500 text-rose-500" : ""}`}
                >
                  <Heart className={`h-3.5 w-3.5 mr-1.5 ${selectedPhoto.selected ? "fill-rose-500" : ""}`} />
                  {selectedPhoto.selected ? "Bỏ chọn ảnh này" : "Thả tim chọn ảnh này"}
                </Button>

                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveNote} className="text-xs">
                    Lưu ghi chú
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          FINAL SUBMIT CONFIRMATION MODAL
          ========================================================================= */}
      {finalSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h3 className="mt-4 text-xl font-extrabold text-foreground">
              Đã gửi {selectedCount} ảnh chọn tới Studio!
            </h3>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Ứng dụng StudioCore Drive trên máy tính của studio đã nhận danh sách và tự động lọc sẵn các
              file RAW gốc tương ứng. Ekip sẽ tiến hành chỉnh sửa và thông báo cho bạn sớm nhất.
            </p>

            <Button
              className="mt-6 w-full"
              onClick={() => setFinalSubmitted(false)}
            >
              Hoàn tất
            </Button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-primary/40 bg-surface/95 px-4 py-3 text-xs font-semibold text-foreground shadow-2xl backdrop-blur-md animate-float">
          <HardDrive className="h-4 w-4 text-primary shrink-0" />
          <span>{downloadToast}</span>
        </div>
      )}
    </div>
  );
}
