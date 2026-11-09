import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingIcon } from "@/components/marketing/marketing-icons";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { ScreenshotGallery } from "@/components/marketing/screenshot-gallery";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { AmbientGlow } from "@/components/marketing/ambient-glow";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { LiquidGlassCard } from "@/components/marketing/liquid-glass-card";
import { InteractiveHeroPhotoShare } from "@/components/marketing/interactive-hero-photoshare";
import { FloatingScheduleCard } from "@/components/marketing/floating-schedule-card";
import { TransformationMatrix } from "@/components/marketing/transformation-matrix";
import { BentoGridFeatures } from "@/components/marketing/bento-grid-features";
import { InteractivePhotoShareDemo } from "@/components/marketing/interactive-photoshare-showcase";
import { FloatingContact } from "@/components/marketing/floating-contact";
import {
  FAQS,
  GUIDES,
  OPERATING_STEPS,
  TESTIMONIALS,
} from "@/lib/marketing/content";
import {
  faqJsonLd,
  marketingMetadata,
  organizationJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "StudioCore — Hệ điều hành Quản lý Studio Chụp ảnh & Áo cưới Đột phá",
  description:
    "Phần mềm SaaS chuyên sâu cho studio ảnh cưới, gia đình & phóng sự: Lịch chụp chống trùng ekip, hợp đồng số ký tay VietQR, PhotoShare Zero-Storage và kế toán thuế HKD.",
  path: "/",
});

const demoPhotoBase = "/api/files/tenant-demo/album-demo-01";

function SectionContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">{children}</div>;
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }}
      />

      {/* =========================================================================
          HERO SECTION: High-Impact Centered Layout + 3D Command Stage
          ========================================================================= */}
      <section className="relative overflow-hidden border-b border-border bg-surface pt-12 pb-16 lg:pt-20 lg:pb-24">
        <AmbientGlow />
        <SectionContainer>
          <div className="mx-auto max-w-4xl text-center">
            {/* Shimmer Pill Badge with Live Beacon */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-primary/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span>StudioCore 2.0 • Nền tảng Điều hành Studio Đột phá</span>
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </div>

            {/* Display Typography */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl sm:leading-[1.12]">
              Vận hành Studio Tinh gọn.{" "}
              <span className="block mt-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                Trao khoảnh khắc trọn vẹn.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Giải pháp SaaS all-in-one chuyên sâu cho Studio Cưới, Phim trường &amp; Áo cưới: Lịch chụp
              chống trùng ekip, hợp đồng số ký tay VietQR, PhotoShare chọn ảnh RAW 30 giây và kế toán thuế
              Hộ kinh doanh.
            </p>

            {/* Centered CTA Buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full shadow-xl shadow-primary/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-primary/35 active:scale-[0.98] sm:w-auto"
              >
                <Link href="/register">
                  Dùng thử 30 ngày miễn phí
                  <ArrowRight className="h-4 w-4 ml-1.5" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-border/80 bg-surface/80 backdrop-blur-md transition-all duration-300 hover:bg-accent/60 active:scale-[0.98] sm:w-auto"
              >
                <Link href="#photoshare">Trải nghiệm PhotoShare</Link>
              </Button>
            </div>

            {/* Trust Checklist */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Check className="h-4 w-4 text-[var(--success)]" aria-hidden />
                Miễn phí 30 ngày đầy đủ tính năng
              </li>
              <li className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <ShieldCheck className="h-4 w-4 text-[var(--success)]" aria-hidden />
                Không cần thẻ tín dụng
              </li>
              <li className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
                Hotline hỗ trợ: 0976 181 859
              </li>
            </ul>
          </div>

          {/* 3D Multi-Widget Command Center Console */}
          <div className="relative mx-auto mt-12 max-w-5xl sm:mt-16">
            <LiquidGlassCard className="p-2 sm:p-3 shadow-2xl">
              <div className="overflow-hidden rounded-2xl border border-white/60 dark:border-white/10">
                <Image
                  src="/marketing/dashboard.jpg"
                  alt="Màn hình bảng điều khiển điều hành trung tâm StudioCore với KPI doanh thu, lịch chụp và đơn hàng"
                  width={1440}
                  height={810}
                  priority
                  className="h-auto w-full transition-transform duration-700 hover:scale-[1.01]"
                />
              </div>
            </LiquidGlassCard>

            {/* Floating Left: Schedule Anti-Conflict Card */}
            <FloatingScheduleCard />

            {/* Floating Right: Interactive PhotoShare Picker */}
            <InteractiveHeroPhotoShare demoPhotoBase={demoPhotoBase} />
          </div>

          {/* Social Proof Trust Bar */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/80 pt-6 text-center text-xs text-muted-foreground sm:gap-x-8">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Tin cậy bởi <strong className="text-foreground">250+ Studio &amp; Áo cưới</strong>
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Phục vụ <strong className="text-foreground">50.000+ Khách hàng</strong>
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <strong className="text-foreground">99.9% Uptime Cam kết</strong>
            </span>
            <span className="hidden sm:inline">·</span>
            <span>Hỗ trợ chuyển đổi dữ liệu 1-1 miễn phí</span>
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          TRANSFORMATION MATRIX: Traditional vs StudioCore (Interactive Before/After)
          ========================================================================= */}
      <section className="border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Bước nhảy vọt vận hành
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Từ thủ công rời rạc đến hệ thống tự động thông minh.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              So sánh sự khác biệt rõ nét khi chuyển đổi từ quy trình ghi sổ tay, chat Zalo sang nền tảng
              quản trị số hóa StudioCore.
            </p>
          </div>

          <div className="mt-12">
            <TransformationMatrix />
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          ASYMMETRIC BENTO GRID: Core Capabilities
          ========================================================================= */}
      <section id="features" className="scroll-mt-20 border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Hệ tính năng chuyên sâu
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Thiết kế chuẩn mực cho Studio &amp; Áo cưới Việt Nam.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Không dàn trải tính năng thừa thãi. Mọi module đều giải quyết triệt để bài toán doanh thu,
              tiến độ và chi phí cho từng ca chụp.
            </p>
          </div>

          <div className="mt-12">
            <BentoGridFeatures />
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          OPERATING STEPS: 4-Step Rollout Workflow
          ========================================================================= */}
      <section className="border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Quy trình triển khai
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Bắt đầu vận hành trong 4 bước đơn giản.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Thiết lập dữ liệu ban đầu trong 30 giây, đội ngũ StudioCore đồng hành hướng dẫn tận tình.
            </p>
          </div>

          <ol className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {OPERATING_STEPS.map((step) => (
              <li
                key={step.number}
                className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <MarketingIcon name={step.icon} className="h-6 w-6" />
                  </span>
                  <span className="font-mono text-3xl font-extrabold text-muted-foreground/25 transition-colors group-hover:text-primary/40">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </SectionContainer>
      </section>

      {/* =========================================================================
          PRODUCT SHOWCASE: Interactive Multi-Tab Workspace
          ========================================================================= */}
      <section className="border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Giao diện thực tế
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Một nền tảng. Mọi hoạt động.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Khám phá các góc làm việc chuyên nghiệp được tối ưu cho từng bộ phận trong studio.
            </p>
          </div>
          <div className="mt-12">
            <ProductShowcase />
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          PHOTOSHARE ZERO-STORAGE LIVE DEMO
          ========================================================================= */}
      <section id="photoshare" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge tone="info">PhotoShare™ Live Demo</Badge>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Giao ảnh Zero-Storage — Khách duyệt ảnh tức thì, Studio lọc RAW 30 giây.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                Tạo album trực tiếp từ Google Drive hoặc upload, gửi link bảo mật cho khách hàng. Khách
                thả tim và ghi chú ảnh cần sửa trên điện thoại; studio sao chép mã ảnh hoặc lọc file gốc
                tự động ngay trên máy tính chỉ trong 30 giây.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Link có mật khẩu bảo vệ, hạn dùng và giới hạn lượt tải.",
                  "Quota chọn ảnh linh hoạt, tự tính phụ phí nếu chọn thêm.",
                  "Lọc mã ảnh tự động, phân loại file RAW trực tiếp trên máy.",
                  "Xuất gói ZIP + manifest.csv + danh sách ảnh thiếu.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Link href="/share/demo-share-album-01">
                    Mở album trải nghiệm
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/guide#photoshare">Khám phá quy trình giao ảnh</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Hỗ trợ đóng dấu watermark bản quyền, chống tải ảnh gốc khi chưa hoàn tất thanh toán.
              </p>
            </div>

            {/* Interactive PhotoShare Demonstration Component */}
            <div>
              <InteractivePhotoShareDemo demoPhotoBase={demoPhotoBase} />
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          SCREENSHOT GALLERY
          ========================================================================= */}
      <section className="border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Ảnh chụp màn hình
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Trực quan, tinh gọn &amp; dễ làm quen.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Thiết kế giao diện hiện đại theo tiêu chuẩn Apple VisionOS, thân thiện với cả nhân viên mới
              và khách hàng.
            </p>
          </div>
          <div className="mt-12">
            <ScreenshotGallery />
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          PRICING SECTION
          ========================================================================= */}
      <section id="pricing" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Bảng giá dịch vụ
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Gói cước linh hoạt cho mọi quy mô studio.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Cam kết giá niêm yết minh bạch, không phụ phí ẩn. Tiết kiệm 20% khi thanh toán gói năm.
            </p>
          </div>
          <div className="mt-12">
            <PricingSection showComparison />
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          TESTIMONIALS: High-Trust Verified Studios
          ========================================================================= */}
      <section className="border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Đánh giá từ khách hàng
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Studio nói gì về StudioCore?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Hơn 250+ studio ảnh cưới, gia đình và phóng sự đã tin tưởng sử dụng StudioCore để vận hành
              chuyên nghiệp hơn mỗi ngày.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <SpotlightCard key={item.name} className="flex flex-col justify-between p-7">
                <div>
                  <div className="flex items-center gap-1 text-amber-500 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground italic">“{item.quote}”</p>
                </div>
                <div className="mt-6 border-t border-border/60 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-xs">
                      {item.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.role}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
                    {item.result}
                  </span>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          FAQ SECTION
          ========================================================================= */}
      <section id="faq" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">FAQ</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
                Câu hỏi thường gặp.
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Bạn có câu hỏi khác? Đội ngũ hỗ trợ và chuyên viên tư vấn của StudioCore luôn sẵn sàng giải đáp
                24/7 qua Hotline và Zalo.
              </p>
              <Button asChild variant="outline" className="mt-6 transition-all hover:bg-accent">
                <Link href="/contact">Liên hệ tư vấn trực tiếp</Link>
              </Button>
            </div>
            <FaqAccordion />
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          GUIDES SECTION
          ========================================================================= */}
      <section className="border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Hướng dẫn</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Tài liệu hướng dẫn chi tiết.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES.map((guide) => (
              <Link
                key={guide.title}
                href={guide.href}
                className="group rounded-3xl border border-border bg-background p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <MarketingIcon name={guide.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-bold text-foreground group-hover:text-primary transition-colors">
                  {guide.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-6">{guide.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  Xem hướng dẫn <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline">
              <Link href="/guide">Xem trung tâm hướng dẫn đầy đủ</Link>
            </Button>
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          FINAL CALL TO ACTION BANNER: Vibrant Royal Violet Aurora
          ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-800 py-20 text-white sm:py-24">
        <div className="pointer-events-none absolute inset-0 -z-0 opacity-25">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
          <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-pink-400 blur-3xl" />
        </div>
        <SectionContainer>
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Bắt đầu nâng tầm studio ngay hôm nay.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/85 sm:text-lg">
              Đăng ký dùng thử 30 ngày đầy đủ 100% tính năng. Thiết lập nhanh chóng trong 30 giây, không cần thẻ tín dụng.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-white text-violet-950 shadow-xl transition-all duration-300 hover:bg-white/95 hover:scale-105 active:scale-95"
              >
                <Link href="/register">Tạo tài khoản miễn phí</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white transition-all hover:bg-white/10 active:scale-95"
              >
                <Link href="/pricing">Xem bảng giá gói cước</Link>
              </Button>
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* Floating Hotline & Zalo Contact Capsule */}
      <FloatingContact />
    </>
  );
}
