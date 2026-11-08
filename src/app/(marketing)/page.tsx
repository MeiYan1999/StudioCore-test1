import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Heart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MarketingIcon } from "@/components/marketing/marketing-icons";
import { ProductShowcase } from "@/components/marketing/product-showcase";
import { ScreenshotGallery } from "@/components/marketing/screenshot-gallery";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
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

      <section className="overflow-hidden border-b border-border bg-surface">
        <SectionContainer>
          <div className="grid items-center gap-10 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:py-20">
            <div>
              <Badge tone="info">Phần mềm quản lý studio All-in-One số 1 Việt Nam</Badge>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
                Phần mềm quản lý Studio Chụp ảnh &amp; Áo cưới chuyên nghiệp.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                Giải pháp toàn diện giúp chủ studio chấm dứt thất thoát doanh thu, chống trùng lịch ekip,
                tự động tính hoa hồng thợ ảnh/makeup và giao ảnh trực tuyến PhotoShare — tối ưu riêng cho
                thị trường studio Việt Nam.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/register">
                    Dùng thử 30 ngày miễn phí
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <Link href="/pricing">Xem bảng giá</Link>
                </Button>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-1.5"><Check className="h-4 w-4 text-[var(--success)]" aria-hidden />Miễn phí 30 ngày đầy đủ tính năng</li>
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[var(--success)]" aria-hidden />Không cần thẻ tín dụng</li>
                <li className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[var(--success)]" aria-hidden />Hotline hỗ trợ: 0976 181 859</li>
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
                <Image
                  src="/marketing/dashboard.jpg"
                  alt="Màn hình dashboard thật của StudioCore với KPI doanh thu, lịch chụp và trạng thái đơn"
                  width={1440}
                  height={810}
                  priority
                  className="h-auto w-full"
                />
              </div>
              <div className="absolute -bottom-6 -left-3 w-64 rounded-xl border border-border bg-surface p-3 shadow-lg sm:-left-6">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="info">PhotoShare</Badge>
                  <span className="text-[10px] font-medium text-muted-foreground">GIAO ẢNH ONLINE</span>
                </div>
                <div className="relative mt-2 overflow-hidden rounded-lg border border-border">
                  <Image
                    src={`${demoPhotoBase}/duoi-ca/anh-002-thumb.jpg`}
                    alt="Giao ảnh trực tuyến PhotoShare"
                    width={480}
                    height={320}
                    unoptimized
                    className="h-auto w-full"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">ANH-002</span>
                  <Heart className="absolute right-2 top-2 h-4 w-4 fill-rose-500 text-rose-500" aria-hidden />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Khách thả tim, chọn và copy mã ảnh trực tuyến.
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
            Giải pháp tin cậy cho <strong className="text-foreground">250+ Studio Chụp ảnh &amp; Áo cưới</strong> trên toàn quốc ·{" "}
            <strong className="text-foreground">50.000+ Khách hàng</strong> đã được phục vụ ·{" "}
            <strong className="text-foreground">99.9% Uptime</strong> · Hỗ trợ triển khai tận nơi.
          </div>
        </SectionContainer>
      </section>

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
                  "Doanh thu, công nợ không rõ",
                  "Lịch chụp trùng phòng hoặc photographer",
                  "Khó theo dõi hiệu suất nhân viên",
                ],
              },
              {
                title: "Vấn đề của nhân viên",
                items: [
                  "Nhập liệu lặp lại ở nhiều file",
                  "Tìm thông tin khách mất thời gian",
                  "Giao ảnh thủ công, mã ảnh lệch",
                ],
              },
            ].map((group) => (
              <div key={group.title} className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="text-lg font-semibold">{group.title}</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-primary/30 bg-accent p-5">
            <h3 className="text-lg font-semibold">StudioCore giải quyết tất cả</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Một nguồn dữ liệu", "Khách, đơn, lịch, ảnh và tiền không còn rời rạc."],
                ["Tự động hóa", "Phí, commission và transaction được tính ở server."],
                ["Báo cáo realtime", "Doanh thu, công nợ, lợi nhuận và hiệu suất."],
                ["PhotoShare", "Giao ảnh, chọn ảnh và lọc mã theo một luồng."],
              ].map(([title, description]) => (
                <div key={title}>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionContainer>
      </section>

      <section className="border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Quy trình
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Vài bước để đi vào vận hành.
            </h2>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {OPERATING_STEPS.map((step) => (
              <li key={step.number} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <MarketingIcon name={step.icon} className="h-5 w-5" />
                  </span>
                  <span className="text-2xl font-semibold text-muted-foreground/50">{step.number}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
              </li>
            ))}
          </ol>
        </SectionContainer>
      </section>

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
              Bốn nhóm năng lực cốt lõi, mỗi nhóm đều dùng dữ liệu thật và kiểm tra quyền ở server.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {FEATURE_GROUPS.map((group) => (
              <article key={group.key} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <MarketingIcon name={group.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{group.title}</h3>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <div key={item.title} className="rounded-xl bg-background p-3">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <MarketingIcon name={item.icon} className="h-4 w-4 text-primary" />
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Button asChild variant="outline">
              <Link href="/phan-mem-quan-ly-studio">
                Xem tất cả giải pháp
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </SectionContainer>
      </section>

      <section className="border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Product showcase
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

      <section id="photoshare" className="scroll-mt-20 border-b border-border bg-surface py-16 sm:py-20">
        <SectionContainer>
          <div className="grid items-center gap-8 lg:grid-cols-2">
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
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  "Link có mật khẩu bảo vệ, hạn dùng và giới hạn lượt tải.",
                  "Quota chọn ảnh linh hoạt, tự tính phụ phí nếu chọn thêm.",
                  "Lọc mã ảnh tự động, phân loại file RAW trực tiếp trên máy.",
                  "Xuất gói ZIP + manifest.csv + danh sách ảnh thiếu.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link href="/share/demo-share-album-01">
                    Xem album mẫu
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/guide#photoshare">Khám phá quy trình giao ảnh</Link>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Hỗ trợ đóng dấu watermark bản quyền, chống tải ảnh gốc khi chưa hoàn tất thanh toán.
              </p>
            </div>
            <div className="relative rounded-2xl border border-border bg-background p-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <p className="text-sm font-semibold">Album Cưới Hoàng &amp; Mai</p>
                  <p className="text-xs text-muted-foreground">Đã chọn 3/5 ảnh</p>
                </div>
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                  Gửi lựa chọn
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["anh-001", "anh-002", "anh-003"].map((name, index) => (
                  <div key={name} className="relative overflow-hidden rounded-lg border border-border">
                    <Image
                      src={`${demoPhotoBase}/duoi-ca/${name}-thumb.jpg`}
                      alt={`Ảnh cưới trong album`}
                      width={480}
                      height={320}
                      unoptimized
                      className="h-auto w-full"
                    />
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-white">
                      ANH-00{index + 1}
                    </span>
                    {index === 1 ? (
                      <Heart className="absolute right-1 top-1 h-3.5 w-3.5 fill-rose-500 text-rose-500" aria-hidden />
                    ) : null}
                    <span className="absolute inset-x-1 bottom-1 rounded bg-primary px-1 py-0.5 text-center text-[9px] font-semibold text-primary-foreground">
                      {index < 2 ? "Đã chọn" : "Chọn"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg bg-surface-muted p-2 text-xs text-muted-foreground">
                Copy mã: <span className="font-mono text-foreground">ANH-001, ANH-002, ANH-003</span>
              </div>
            </div>
          </div>
        </SectionContainer>
      </section>

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
              <article key={item.name} className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {item.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.role}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">“{item.quote}”</p>
                <p className="mt-3 text-xs font-medium text-primary">{item.result}</p>
              </article>
            ))}
          </div>
        </SectionContainer>
      </section>

      <section id="faq" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20">
        <SectionContainer>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FAQ</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Câu hỏi thường gặp.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Bạn có câu hỏi khác? Đội ngũ hỗ trợ và chuyên viên tư vấn của StudioCore luôn sẵn sàng giải đáp 24/7 qua Hotline và Zalo.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/contact">Liên hệ tư vấn</Link>
              </Button>
            </div>
            <FaqAccordion />
          </div>
        </SectionContainer>
      </section>

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
                className="group rounded-2xl border border-border bg-background p-5 transition-shadow hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <MarketingIcon name={guide.icon} className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-base font-semibold group-hover:text-primary">{guide.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Xem hướng dẫn <ArrowRight className="h-3.5 w-3.5" aria-hidden />
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

      <section className="bg-primary py-16 text-primary-foreground sm:py-20">
        <SectionContainer>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Bắt đầu quản lý studio ngay hôm nay.
            </h2>
            <p className="mt-3 text-sm leading-6 text-primary-foreground/80 sm:text-base">
              Đăng ký dùng thử 30 ngày đầy đủ 100% tính năng. Thiết lập nhanh chóng trong 30 giây, không cần thẻ tín dụng.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild size="lg" variant="secondary">
                <Link href="/register">Tạo tài khoản miễn phí</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
                <Link href="/pricing">Xem gói cước</Link>
              </Button>
            </div>
          </div>
        </SectionContainer>
      </section>
    </>
  );
}
