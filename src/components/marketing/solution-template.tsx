import Link from "next/link";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingIcon } from "@/components/marketing/marketing-icons";
import { FEATURE_GROUPS } from "@/lib/marketing/content";

export function SolutionTemplate({
  data,
}: {
  data: {
    eyebrow: string;
    h1: string;
    title: string;
    intro: string;
    problems: readonly string[];
    outcomes: readonly string[];
  };
}) {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <Badge tone="info">{data.eyebrow}</Badge>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {data.h1}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {data.intro}
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Dùng thử miễn phí
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">Xem demo read-only</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/pricing">Xem bảng giá</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-14 sm:py-18">
        <div className="mx-auto grid max-w-[1240px] gap-5 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-xl font-semibold">Vấn đề đang gặp</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {data.problems.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-accent p-5">
            <h2 className="text-xl font-semibold">StudioCore thay đổi điều gì</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {data.outcomes.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface py-14 sm:py-18">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Năng lực</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Một nền tảng, nhiều nhóm tính năng.</h2>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.key} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <MarketingIcon name={group.icon} className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-semibold">{group.title}</h3>
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <li key={item.title} className="rounded-lg bg-surface p-3">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-14 text-primary-foreground sm:py-18">
        <div className="mx-auto max-w-[1240px] px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold">{data.title} — bắt đầu từ dữ liệu thật.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-primary-foreground/80">
            Tạo tenant trial hoặc mở bản demo read-only. Không cần thẻ tín dụng,
            không dùng dữ liệu khách thật trong seed.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild size="lg" variant="secondary">
              <Link href="/register">Tạo tài khoản</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              <Link href="/contact">Liên hệ tư vấn</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
