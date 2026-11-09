"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";
import { MARKETING_CONTACT } from "@/lib/marketing/content";

export function FloatingContact() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 250) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (dismissed || !visible) return null;

  return (
    <aside
      aria-label="Liên hệ hỗ trợ nhanh"
      className="liquid-glass fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full p-1.5 shadow-2xl transition-all duration-300 hover:shadow-primary/25 animate-in fade-in slide-in-from-bottom-5"
    >
      <a
        href={`tel:${MARKETING_CONTACT.phone.replace(/\s/g, "")}`}
        className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover active:scale-95"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <Phone className="h-3.5 w-3.5" />
        <span>Hotline: {MARKETING_CONTACT.phone}</span>
      </a>

      <a
        href={`https://zalo.me/${MARKETING_CONTACT.phone.replace(/\s/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-all hover:bg-accent active:scale-95"
      >
        <MessageCircle className="h-3.5 w-3.5 text-blue-600" />
        <span className="hidden sm:inline">Zalo tư vấn</span>
      </a>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Đóng tiện ích hỗ trợ"
        className="rounded-full p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
