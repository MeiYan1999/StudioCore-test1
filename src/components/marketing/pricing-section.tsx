"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PLANS,
  PRICING_COMPARISON,
} from "@/lib/marketing/content";
import { cn, formatVnd } from "@/lib/utils";

export function PricingSection({ showComparison = true }: { showComparison?: boolean }) {
  const [yearly, setYearly] = useState(false);
  return (
    <div>
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setYearly(false)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Theo tháng
          </button>
          <button
            type="button"
            onClick={() => setYearly(true)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium",
              yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Theo năm (tiết kiệm 2 tháng)
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Bảng giá minh bạch — Miễn phí 30 ngày trải nghiệm đầy đủ tính năng — Tiết kiệm 20% khi thanh toán 12 tháng.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <article
            key={plan.key}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md",
              plan.featured
                ? "border-primary ring-2 ring-primary/20"
                : "border-border",
            )}
          >
            {plan.featured ? (
              <Badge tone="info" className="absolute -top-3 left-1/2 -translate-x-1/2">
                Phổ biến
              </Badge>
            ) : null}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {plan.monthly === 0
                ? "0 ₫"
                : `${formatVnd(yearly ? plan.yearly : plan.monthly)}`}
              {plan.monthly > 0 ? (
                <span className="text-sm font-normal text-muted-foreground">
                  /{yearly ? "năm" : "tháng"}
                </span>
              ) : null}
            </p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={plan.featured ? "primary" : "outline"}
              className="mt-5 w-full"
            >
              <Link href={plan.href}>{plan.cta}</Link>
            </Button>
          </article>
        ))}
      </div>

      {showComparison ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">So sánh gói StudioCore (giá demo)</caption>
            <thead className="bg-surface-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  Tính năng
                </th>
                {PLANS.map((plan) => (
                  <th key={plan.key} scope="col" className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PRICING_COMPARISON.map((row) => (
                <tr key={row.feature}>
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {row.feature}
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{row.trial}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.basic}</td>
                  <td className="px-4 py-3 text-foreground">{row.pro}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.business}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
