import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/marketing/pricing-section";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Bảng giá StudioCore (demo)",
  description:
    "So sánh 4 gói StudioCore cho studio nhỏ, đang mở rộng và chuỗi chi nhánh. Giá demo tham khảo, chưa phải báo giá chính thức.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Bảng giá demo</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Gói cước phù hợp mọi quy mô studio.
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Bắt đầu bằng gói dùng thử 14 ngày, sau đó chọn gói theo số chi nhánh,
              nhân sự và nhu cầu PhotoShare/báo cáo. Giá trên trang là giá demo để
              kiểm thử UI, chưa phải báo giá chính thức.
            </p>
          </div>
        </div>
      </section>
      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <PricingSection showComparison />
          <div className="mt-8 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-3">
            {[
              "Không cần thẻ tín dụng để dùng thử",
              "Dữ liệu seed là synthetic, không dùng PII thật",
              "Có thể nâng cấp hoặc dừng bất cứ lúc nào",
            ].map((item) => (
              <p key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                {item}
              </p>
            ))}
          </div>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">Bắt đầu dùng thử</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Liên hệ tư vấn</Link>
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Bản demo chưa có thanh toán gói cước thật; việc nâng cấp sẽ được tư vấn
            thủ công.
          </p>
        </div>
      </section>
    </>
  );
}
