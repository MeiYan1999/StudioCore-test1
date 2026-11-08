import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingSection } from "@/components/marketing/pricing-section";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Bảng giá StudioCore — Phần mềm quản lý studio chụp ảnh",
  description:
    "Bảng giá các gói phần mềm quản lý studio: Vận hành cơ bản, Chuyên nghiệp (Pro) và Doanh nghiệp. Dùng thử 30 ngày miễn phí.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Bảng giá dịch vụ</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              Gói cước linh hoạt cho mọi quy mô studio.
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Bắt đầu với 30 ngày dùng thử miễn phí 100% tính năng. Sau đó nâng cấp gói theo số lượng chi nhánh,
              nhân sự và nhu cầu PhotoShare. Hỗ trợ thanh toán 3, 6 hoặc 12 tháng (tiết kiệm 20%).
            </p>
          </div>
        </div>
      </section>
      <section className="bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
          <PricingSection showComparison />
          <div className="mt-8 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-3">
            {[
              "Dùng thử 30 ngày không cần thẻ tín dụng",
              "Dữ liệu studio được cô lập và bảo mật 100%",
              "Hỗ trợ đào tạo & chuyển đổi dữ liệu miễn phí",
            ].map((item) => (
              <p key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                {item}
              </p>
            ))}
          </div>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">Đăng ký dùng thử 30 ngày</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Liên hệ tư vấn trực tiếp</Link>
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Hotline/Zalo tư vấn giải pháp: <strong className="text-foreground">0976 181 859</strong> · Email: <strong className="text-foreground">samstudio.hn@gmail.com</strong>
          </p>
        </div>
      </section>
    </>
  );
}
