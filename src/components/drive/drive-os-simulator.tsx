"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Apple,
  CheckCircle2,
  Copy,
  ExternalLink,
  Folder,
  HardDrive,
  Heart,
  Maximize2,
  Minus,
  Monitor,
  Play,
  Video,
  X,
} from "lucide-react";
import { BrandApertureIcon } from "@/components/brand/brand-logo";

interface DemoItem {
  id: string;
  name: string;
  type: "album" | "folder" | "video";
  filesCount: string;
  size: string;
  shareId: string;
}

const ITEMS: DemoItem[] = [
  {
    id: "item-1",
    name: "Cưới Minh & Lan — Ngoại Cảnh",
    type: "album",
    filesCount: "1.248 file RAW",
    size: "32.4 GB",
    shareId: "cuoi-minh-lan-dalat",
  },
  {
    id: "item-2",
    name: "Kỷ yếu 12A1 — Trọn bộ",
    type: "folder",
    filesCount: "248 file in",
    size: "3.1 GB",
    shareId: "ky-yeu-12a1-folder",
  },
  {
    id: "item-3",
    name: "Highlight Phóng sự cưới 4K.mp4",
    type: "video",
    filesCount: "1 video 4K",
    size: "2.2 GB",
    shareId: "highlight-cuoi-minh-lan-video",
  },
  {
    id: "item-4",
    name: "Beauty Hà Hương — Retouch",
    type: "album",
    filesCount: "185 file RAW",
    size: "5.8 GB",
    shareId: "cuoi-minh-lan-dalat",
  },
];

export function DriveOsSimulator() {
  const [os, setOs] = useState<"mac" | "windows">("mac");
  const [selectedId, setSelectedId] = useState<string>("item-1");
  const [showMenu, setShowMenu] = useState<boolean>(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const activeItem = ITEMS.find((i) => i.id === selectedId) || ITEMS[0];

  const handleAction = () => {
    const url = `${window.location.origin}/drive/${activeItem.shareId}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(url);
    setTimeout(() => {
      setCopiedLink(null);
    }, 3500);
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* OS Mode Switcher */}
      <div className="flex items-center justify-between pb-3">
        <div className="inline-flex rounded-xl border border-border/80 bg-surface/80 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setOs("mac")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              os === "mac"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Apple className="h-3.5 w-3.5" />
            <span>macOS Finder</span>
          </button>
          <button
            type="button"
            onClick={() => setOs("windows")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              os === "windows"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Windows Explorer</span>
          </button>
        </div>

        <span className="hidden text-xs text-muted-foreground sm:inline-block">
          💡 Click vào thư mục hoặc các nút menu để thử nghiệm copy link
        </span>
      </div>

      {/* OS Window Frame */}
      <div className="overflow-hidden rounded-2xl border border-border/90 bg-surface shadow-2xl transition-all">
        {/* Title Bar */}
        <div className="flex h-10 items-center justify-between border-b border-border/70 bg-surface-muted/60 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {os === "mac" ? (
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-xs" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80 shadow-xs" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-xs" />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5 text-primary" />
                <span>File Explorer — StudioCore Drive</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="hidden sm:inline">D:\StudioCore-Data\2026</span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              ● Live Sync
            </span>
          </div>

          {os === "windows" ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Minus className="h-3.5 w-3.5" />
              <Maximize2 className="h-3 w-3" />
              <X className="h-3.5 w-3.5" />
            </div>
          ) : (
            <div className="w-10" />
          )}
        </div>

        {/* Window Content: Folder List + Context Menu */}
        <div className="relative min-h-[320px] p-4 sm:p-6 bg-gradient-to-b from-surface to-background/50">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {ITEMS.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setShowMenu(true);
                  }}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-primary/60 bg-primary/10 shadow-sm"
                      : "border-border/60 bg-surface/60 hover:border-border hover:bg-surface-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        item.type === "video"
                          ? "bg-fuchsia-500/10 text-fuchsia-600"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      {item.type === "video" ? (
                        <Video className="h-5 w-5" />
                      ) : (
                        <Folder className="h-5 w-5 fill-amber-500/30" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-foreground sm:text-sm">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.filesCount} · {item.size}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {item.type === "video" ? "Video" : item.type === "folder" ? "Folder" : "Album"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Interactive Context Menu Popup */}
          {showMenu && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-primary/30 bg-surface/95 p-2 shadow-2xl backdrop-blur-xl sm:w-80 sm:absolute sm:top-20 sm:right-8 sm:mt-0">
              <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xs">
                  <BrandApertureIcon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">StudioCore Drive</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {os === "mac" ? "Finder Quick Actions" : "Menu chuột phải Explorer"}
                  </p>
                </div>
              </div>

              <div className="space-y-1 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={handleAction}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <span className="flex items-center gap-2">
                    <Heart className="h-3.5 w-3.5 text-rose-500" />
                    Tạo link Album (chọn ảnh)
                  </span>
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={handleAction}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5 text-amber-500" />
                    Link Thư mục (xem &amp; tải .zip)
                  </span>
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={handleAction}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <span className="flex items-center gap-2">
                    <Play className="h-3.5 w-3.5 text-fuchsia-500" />
                    Link Video (góp ý theo giây)
                  </span>
                  <Copy className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>

              <div className="border-t border-border/70 p-2">
                <Link
                  href={`/drive/${activeItem.shareId}`}
                  target="_blank"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <span>Mở xem thử giao diện khách</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Copy Toast Indicator */}
          {copiedLink && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">Đã copy link gửi khách!</span>
                <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline truncate max-w-xs">
                  {copiedLink}
                </span>
              </div>
              <Link
                href={`/drive/${activeItem.shareId}`}
                target="_blank"
                className="underline font-bold"
              >
                Mở link →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
