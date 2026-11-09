"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Heart, Send } from "lucide-react";

const DEMO_PHOTOS = [
  { id: "anh-001", code: "ANH-001", thumb: "anh-001-thumb.jpg" },
  { id: "anh-002", code: "ANH-002", thumb: "anh-002-thumb.jpg" },
  { id: "anh-003", code: "ANH-003", thumb: "anh-003-thumb.jpg" },
];

export function InteractivePhotoShareDemo({ demoPhotoBase }: { demoPhotoBase: string }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(["anh-001", "anh-002"]);
  const [likedIds, setLikedIds] = useState<string[]>(["anh-002"]);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleHeart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLikedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCopy = () => {
    const codes = selectedIds
      .map((id) => DEMO_PHOTOS.find((p) => p.id === id)?.code)
      .filter(Boolean)
      .join(", ");
    navigator.clipboard?.writeText(codes || "Chưa chọn ảnh");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="relative rounded-2xl border border-border bg-background p-4 shadow-xl transition-all hover:shadow-2xl sm:p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Album Cưới Hoàng &amp; Mai</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Trực tiếp
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Đã chọn <strong className="text-primary">{selectedIds.length}</strong> / {DEMO_PHOTOS.length} ảnh
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover active:scale-95"
        >
          {submitted ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Đã gửi studio!
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Gửi lựa chọn
            </>
          )}
        </button>
      </div>

      {submitted ? (
        <div className="my-3 rounded-xl bg-emerald-500/10 p-2.5 text-center text-xs font-medium text-emerald-600 transition-all animate-in fade-in dark:text-emerald-400">
          ✨ Studio đã nhận danh sách {selectedIds.length} ảnh chọn! Ekip bắt đầu xử lý ngay.
        </div>
      ) : null}

      <div className="mt-3.5 grid grid-cols-3 gap-2.5 sm:gap-3">
        {DEMO_PHOTOS.map((photo) => {
          const isSelected = selectedIds.includes(photo.id);
          const isLiked = likedIds.includes(photo.id);
          return (
            <div
              key={photo.id}
              onClick={() => toggleSelect(photo.id)}
              className={`group relative cursor-pointer overflow-hidden rounded-xl border transition-all duration-300 ${
                isSelected
                  ? "border-primary ring-2 ring-primary/40 shadow-md scale-[1.02]"
                  : "border-border hover:border-border/80"
              }`}
            >
              <Image
                src={`${demoPhotoBase}/duoi-ca/${photo.thumb}`}
                alt={photo.code}
                width={480}
                height={320}
                unoptimized
                className="h-auto w-full transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white shadow-xs backdrop-blur-xs">
                {photo.code}
              </span>

              {/* Heart button */}
              <button
                type="button"
                onClick={(e) => toggleHeart(e, photo.id)}
                aria-label="Thả tim"
                className="absolute right-1.5 top-1.5 rounded-full bg-white/85 p-1 shadow-xs transition-transform hover:scale-110 active:scale-90 dark:bg-black/80"
              >
                <Heart
                  className={`h-3.5 w-3.5 ${
                    isLiked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                  }`}
                />
              </button>

              <div className="absolute inset-x-1.5 bottom-1.5">
                <span
                  className={`block rounded-md py-1 text-center text-[10px] font-semibold transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-black/60 text-white backdrop-blur-xs hover:bg-black/80"
                  }`}
                >
                  {isSelected ? "✓ Đã chọn" : "+ Chọn ảnh"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted p-2.5 text-xs">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="text-muted-foreground">Mã ảnh:</span>
          <span className="font-mono font-medium text-foreground">
            {selectedIds.length > 0
              ? selectedIds
                  .map((id) => DEMO_PHOTOS.find((p) => p.id === id)?.code)
                  .join(", ")
              : "(Chưa chọn)"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition-all hover:bg-accent active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" />
              <span>Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Chép mã lọc</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
