"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Copy, Heart, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function InteractiveHeroPhotoShare({ demoPhotoBase }: { demoPhotoBase: string }) {
  const [liked, setLiked] = useState(true);
  const [likeCount, setLikeCount] = useState(18);
  const [copied, setCopied] = useState(false);

  const handleToggleLike = () => {
    if (liked) {
      setLiked(false);
      setLikeCount((prev) => prev - 1);
    } else {
      setLiked(true);
      setLikeCount((prev) => prev + 1);
    }
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText("ANH-002");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="liquid-glass absolute -bottom-6 -left-3 w-72 rounded-3xl p-4 shadow-2xl transition-all duration-300 hover:shadow-primary/20 sm:-left-6 animate-float">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge tone="info" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            PhotoShare
          </Badge>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        </div>
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">
          GIAO ẢNH LIVE
        </span>
      </div>

      <div className="group relative mt-2.5 overflow-hidden rounded-xl border border-border">
        <Image
          src={`${demoPhotoBase}/duoi-ca/anh-002-thumb.jpg`}
          alt="Giao ảnh trực tuyến PhotoShare"
          width={480}
          height={320}
          unoptimized
          className="h-auto w-full transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-2 top-2 rounded-md bg-black/75 px-2 py-0.5 font-mono text-[10px] font-medium text-white shadow-sm backdrop-blur-xs">
          ANH-002
        </span>

        {/* Interactive Heart Button */}
        <button
          type="button"
          onClick={handleToggleLike}
          aria-label={liked ? "Bỏ thích ảnh" : "Thả tim chọn ảnh"}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow-md backdrop-blur-xs transition-transform active:scale-90 dark:bg-black/80"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              liked ? "fill-rose-500 text-rose-500 scale-110" : "text-muted-foreground"
            }`}
          />
          <span className="text-[11px] font-bold text-foreground">{likeCount}</span>
        </button>

        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-lg bg-black/60 px-2.5 py-1.5 text-[10px] text-white backdrop-blur-sm">
          <span>Khách đã duyệt</span>
          <span className="font-semibold text-emerald-400">Đã chọn 4/12</span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Khách thả tim, chọn và copy mã ảnh.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10px] font-medium text-accent-foreground transition-all hover:bg-accent/80 active:scale-95"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-600" />
              <span>Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Chép mã</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
