"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCREENSHOTS } from "@/lib/marketing/content";

export function ScreenshotGallery() {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const current = SCREENSHOTS.find((item) => item.key === openKey) ?? null;

  useEffect(() => {
    if (!openKey) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    window.addEventListener("keydown", handler);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(timer);
      triggerRef.current?.focus();
    };
  }, [openKey]);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENSHOTS.map((shot) => (
          <article key={shot.key} className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <button
              type="button"
              className="block w-full"
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setOpenKey(shot.key);
              }}
              aria-label={`Mở ảnh ${shot.title}`}
            >
              <Image
                src={shot.path}
                alt={shot.title}
                width={shot.width}
                height={shot.height}
                loading="lazy"
                className="h-auto w-full border-b border-border"
              />
            </button>
            <div className="p-3">
              <h3 className="text-sm font-semibold">{shot.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{shot.description}</p>
            </div>
          </article>
        ))}
      </div>

      {current ? (
        <div
          className="fixed inset-0 z-50 flex bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={current.title}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col rounded-xl bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{current.title}</p>
                <p className="text-xs text-muted-foreground">{current.description}</p>
              </div>
              <Button
                ref={closeRef}
                variant="ghost"
                size="icon"
                aria-label="Đóng ảnh"
                onClick={() => setOpenKey(null)}
              >
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <div className="overflow-auto p-3">
              <Image
                src={current.path}
                alt={current.title}
                width={current.width}
                height={current.height}
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
