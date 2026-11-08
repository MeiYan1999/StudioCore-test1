"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCREENSHOTS, SHOWCASE_TABS } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";

export function ProductShowcase() {
  const [active, setActive] = useState(SHOWCASE_TABS[0]?.key ?? "dashboard");
  const tab = SHOWCASE_TABS.find((item) => item.key === active) ?? SHOWCASE_TABS[0];
  const screenshot =
    SCREENSHOTS.find((item) => item.key === tab?.screenshot) ?? SCREENSHOTS[0];
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product showcase">
        {SHOWCASE_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active === item.key}
            onClick={() => setActive(item.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              active === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {screenshot ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Monitor className="h-3.5 w-3.5" aria-hidden />
              StudioCore · {tab?.label}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {tab?.description}
            </span>
          </div>
          <Image
            key={screenshot.key}
            src={screenshot.path}
            alt={screenshot.title}
            width={screenshot.width}
            height={screenshot.height}
            loading="lazy"
            className="h-auto w-full"
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/register">
            Dùng thử miễn phí 30 ngày
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/demo">Xem trải nghiệm thực tế</Link>
        </Button>
      </div>
    </div>
  );
}
