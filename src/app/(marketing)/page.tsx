import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleAlert,
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
import { InteractiveHeroPhotoShare } from "@/components/marketing/interactive-hero-photoshare";
import { InteractivePhotoShareDemo } from "@/components/marketing/interactive-photoshare-showcase";
import { FloatingContact } from "@/components/marketing/floating-contact";
import {
  FAQS,
  FEATURE_GROUPS,
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
  title: "StudioCore — Phần mềm Quản lý Studio Chụp ảnh & Áo cưới All-in-One",
  description:
    "Phần mềm quản lý studio ảnh cưới, gia đình & phóng sự chuyên nghiệp: CRM khách hàng, lịch chụp chống trùng, hợp đồng số, kho váy cưới QR, PhotoShare giao ảnh trực tuyến và kế toán thuế HKD.",
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

      {/* Hero Section with Ambient Glow & Floating Interactive Preview */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <AmbientGlow />
        <SectionContainer>
          <div className="grid items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div>
              {/* Shimmer Badge with Live Ping Beacon */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-primary/10">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span>Phần mềm quản lý studio All-in-One số 1 Việt Nam</span>
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </div>

              <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.14] tracking-tight text-foreground sm:text-5xl lg:text-5xl">
                Phần mềm quản lý Studio Chụp ảnh &amp; Áo cưới chuyên nghiệp.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Giải pháp toàn diện giúp chủ studio chấm dứt thất thoát doanh thu, chống trùng lịch ekip,
                tự động tính hoa hồng thợ ảnh/makeup và giao ảnh trực tuyến PhotoShare — tối ưu riêng cho
                thị trường studio Việt Nam.
              </p>

              {/* Action Buttons with Micro-interactions */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="w-full shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-primary/35 active:scale-[0.98] sm:w-auto"
                >
                  <Link href="/register">
                    Dùng thử 30 ngày miễn phí
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full transition-all duration-300 hover:bg-accent/60 active:scale-[0.98] sm:w-auto"
                >
                  <Link href="/pricing">Xem bảng giá</Link>
                </Button>
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
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

            {/* Dashboard & Interactive Floating Widget */}
            <div className="group relative mx-auto w-full max-w-xl">
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-all duration-500 group-hover:border-primary/40 group-hover:shadow-primary/10">
                <Image
                  src="/marketing/dashboard.jpg"
                  alt="Màn hình dashboard thật của StudioCore với KPI doanh thu, lịch chụp và trạng thái đơn"
                  width={1440}
                  height={810}
                  priority
                  className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.01]"
                />
              </div>

              {/* Floating Levitation PhotoShare Widget */}
              <InteractiveHeroPhotoShare demoPhotoBase={demoPhotoBase} />
            </div>
          </div>

          {/* Social Proof Trust Bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border/80 py-4 text-center text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Tin cậy bởi <strong className="text-foreground">250+ Studio &amp; Áo cưới</strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Phục vụ <strong className="text-foreground">50.000+ Khách hàng</strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <strong className="text-foreground">99.9% Uptime</strong>
            </span>
            <span>·</span>
            <span>Hỗ trợ chuyển đổi dữ liệu 1-1 tận nơi</span>
          </div>
        </SectionContainer>
      </section>

      {/* Pain Points vs Solutions with Spotlight Cards */}
      <section className="border-b border-border bg-background py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Vấn đề thường gặp
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Bạn đang gặp những vấn đề này?
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {[
              {
                title: "Vấn đề của chủ studio",
                items: [
                  "Doanh thu, công nợ không rõ ràng, sổ sách thất lạc",
                  "Lịch chụp trùng phòng hoặc trùng thợ chụp / makeup",
                  "Khó kiểm soát hiệu suất và tính hoa hồng nhân viên",
                  "Gửi ảnh qua Zalo giảm dung lượng, khách phàn nàn",
                ],
              },
              {
                title: "Vấn đề của nhân viên",
                items: [
                  "Nhập liệu lặp lại ở nhiều file Excel và nhóm chat",
                  "Tìm thông tin số đo trang phục, ngày cưới của khách mất thời gian",
                  "Giao ảnh thủ công, đối chiếu mã ảnh nhầm lẫn",
                  "Không biết lịch chụp ca hôm nay, phải hỏi quản lý",
                ],
              },
            ].map((group) => (
              <SpotlightCard key={group.title} className="p-6">
                <h3 className="text-lg font-semibold">{group.title}</h3>
                <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            ))}
          </div>

          <SpotlightCard
            spotlightColor="rgba(59, 130, 246, 0.2)"
            className="mt-6 border-primary/30 bg-accent p-6"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">StudioCore giải quyết tất cả</h3>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Một nguồn dữ liệu", "Khách, đơn hàng, lịch, ảnh và dòng tiền không còn rời rạc."],
                ["Tự động hóa", "Phí, hoa hồng và các giao dịch cọc được tính tự động ở server."],
                ["Báo cáo realtime", "Theo dõi doanh thu, công nợ, lợi nhuận và hiệu suất tức thì."],
                ["PhotoShare Zero-Storage", "Giao ảnh, khách chọn và lọc mã RAW theo một luồng khép kín."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-xl bg-background/60 p-3.5 backdrop-blur-xs">
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </SectionContainer>
      </section>

      {/* Operating Steps */}
      <section className="border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Quy trình
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Bắt đầu đi vào vận hành trong 4 bước.
            </h2>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {OPERATING_STEPS.map((step) => (
              <li
                key={step.number}
                className="group rounded-2xl border border-border bg-background p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform duration-300 group-hover:scale-110">
                    <MarketingIcon name={step.icon} className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-2xl font-bold text-muted-foreground/30 transition-colors group-hover:text-primary/50">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold group-hover:text-primary transition-colors">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-6">{step.description}</p>
              </li>
            ))}
          </ol>
        </SectionContainer>
      </section>

      {/* Features Grid with Spotlight Effect */}
      <section id="features" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Tính năng
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Hơn 20 tính năng cho mọi nhu cầu.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Bốn nhóm năng lực cốt lõi giúp số hóa toàn bộ khâu tiếp nhận, sản xuất đến quyết toán.
            </p>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {FEATURE_GROUPS.map((group) => (
              <SpotlightCard key={group.key} className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-xs">
                    <MarketingIcon name={group.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{group.title}</h3>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <div
                      key={item.title}
                      className="group rounded-xl border border-transparent bg-background/80 p-3.5 transition-all duration-200 hover:border-border hover:bg-background hover:shadow-xs hover:translate-x-0.5"
                    >
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <MarketingIcon name={item.icon} className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-5">{item.description}</p>
                    </div>
                  ))}
                </div>
              </SpotlightCard>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline" className="transition-all hover:bg-accent hover:border-primary/30">
              <Link href="/phan-mem-quan-ly-studio">
                Xem chi tiết giải pháp tổng thể
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </SectionContainer>
      </section>

      {/* Product Showcase Tabs */}
      <section className="border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Giao diện thực tế
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Một nền tảng. Mọi hoạt động.
            </h2>
          </div>
          <div className="mt-8">
            <ProductShowcase />
          </div>
        </SectionContainer>
      </section>

      {/* Screenshots Gallery */}
      <section className="border-b border-border bg-background py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Screenshots
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Trực quan, dễ sử dụng.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Giao diện hiện đại, tối giản và tối ưu trải nghiệm người dùng trên cả máy tính, tablet và điện thoại.
            </p>
          </div>
          <div className="mt-8">
            <ScreenshotGallery />
          </div>
        </SectionContainer>
      </section>

      {/* PhotoShare Interactive Section */}
      <section id="photoshare" className="scroll-mt-20 border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Badge tone="info">PhotoShare</Badge>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">
                Giao ảnh trực tuyến Zero-Storage — Khách chọn ảnh tức thì.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Tạo album trực tiếp từ Google Drive hoặc upload, gửi link bảo mật cho khách hàng. Khách
                thả tim và ghi chú ảnh cần sửa trên điện thoại; studio sao chép mã ảnh hoặc lọc file gốc
                tự động ngay trên máy tính chỉ trong 30 giây.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "Link có mật khẩu bảo vệ, hạn dùng và giới hạn lượt tải.",
                  "Quota chọn ảnh linh hoạt, tự tính phụ phí nếu chọn thêm.",
                  "Lọc mã ảnh tự động, phân loại file RAW trực tiếp trên máy.",
                  "Xuất gói ZIP + manifest.csv + danh sách ảnh thiếu.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <Button asChild className="shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Link href="/share/demo-share-album-01">
                    Xem album mẫu
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/guide#photoshare">Khám phá quy trình giao ảnh</Link>
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Hỗ trợ đóng dấu watermark bản quyền, chống tải ảnh gốc khi chưa hoàn tất thanh toán.
              </p>
            </div>

            {/* Interactive PhotoShare Demonstration */}
            <div>
              <InteractivePhotoShareDemo demoPhotoBase={demoPhotoBase} />
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Bảng giá
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Gói cước phù hợp mọi quy mô studio.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cam kết giá niêm yết minh bạch, không phí ẩn. Tiết kiệm 20% khi thanh toán 12 tháng.
            </p>
          </div>
          <div className="mt-8">
            <PricingSection showComparison />
          </div>
        </SectionContainer>
      </section>

      {/* Testimonials with Spotlight Cards & Star Ratings */}
      <section className="border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Khách hàng đánh giá
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Studio nói gì về StudioCore?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Hơn 250+ studio ảnh cưới, gia đình và phóng sự đã tin tưởng sử dụng StudioCore để vận hành chuyên nghiệp hơn mỗi ngày.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <SpotlightCard key={item.name} className="flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-center gap-1 text-amber-500 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-500" />
                    ))}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground italic">“{item.quote}”</p>
                </div>
                <div className="mt-5 border-t border-border/60 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                      {item.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.role}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
                    {item.result}
                  </span>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20">
        <SectionContainer>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FAQ</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Câu hỏi thường gặp.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Bạn có câu hỏi khác? Đội ngũ hỗ trợ và chuyên viên tư vấn của StudioCore luôn sẵn sàng giải đáp 24/7 qua Hotline và Zalo.
              </p>
              <Button asChild variant="outline" className="mt-4 transition-all hover:bg-accent">
                <Link href="/contact">Liên hệ tư vấn</Link>
              </Button>
            </div>
            <FaqAccordion />
          </div>
        </SectionContainer>
      </section>

      {/* Guides Section */}
      <section className="border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hướng dẫn</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Tài liệu hướng dẫn chi tiết.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDES.map((guide) => (
              <Link
                key={guide.title}
                href={guide.href}
                className="group rounded-2xl border border-border bg-background p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-transform group-hover:scale-110">
                  <MarketingIcon name={guide.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                  {guide.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground leading-6">{guide.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Xem hướng dẫn <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link href="/guide">Xem hướng dẫn đầy đủ</Link>
            </Button>
          </div>
        </SectionContainer>
      </section>

      {/* Final Call To Action Banner with Ambient Glow */}
      <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground sm:py-20">
        <div className="pointer-events-none absolute inset-0 -z-0 opacity-20">
          <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-white blur-3xl" />
          <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-sky-300 blur-3xl" />
        </div>
        <SectionContainer>
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Bắt đầu quản lý studio ngay hôm nay.
            </h2>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/85 sm:text-base">
              Đăng ký dùng thử 30 ngày đầy đủ 100% tính năng. Thiết lập nhanh chóng trong 30 giây, không cần thẻ tín dụng.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Link href="/register">Tạo tài khoản miễn phí</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white transition-all hover:bg-white/10 active:scale-95"
              >
                <Link href="/pricing">Xem gói cước</Link>
              </Button>
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* Floating Hotline & Zalo Contact Pill */}
      <FloatingContact />
    </>
  );
}
