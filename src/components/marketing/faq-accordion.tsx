"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQS } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-2">
      {FAQS.map((faq, index) => {
        const expanded = open === index;
        return (
          <div key={faq.question} className="rounded-xl border border-border bg-surface">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
              aria-expanded={expanded}
              aria-controls={`faq-panel-${index}`}
              onClick={() => setOpen(expanded ? null : index)}
            >
              {faq.question}
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
                aria-hidden
              />
            </button>
            {expanded ? (
              <div id={`faq-panel-${index}`} className="border-t border-border px-4 py-3 text-sm leading-6 text-muted-foreground">
                {faq.answer}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
