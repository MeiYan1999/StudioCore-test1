import Link from "next/link";
import {
  Apple,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Folder,
  HardDrive,
  Heart,
  HelpCircle,
  Lock,
  Monitor,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AmbientGlow } from "@/components/marketing/ambient-glow";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { LiquidGlassCard } from "@/components/marketing/liquid-glass-card";
import { DriveOsSimulator } from "@/components/drive/drive-os-simulator";
import { FloatingContact } from "@/components/marketing/floating-contact";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "StudioCore Drive — Gửi ảnh & video cho khách thẳng từ máy tính | Không upload, không cần Google Drive",
  description:
    "Ứng dụng StudioCore Drive cho Windows & macOS: chuột phải thư mục là có link gửi khách. Khách xem, tải ảnh gốc RAW/JPG, chọn ảnh và xem video ngay — không upload, không cần Google Drive.",
  path: "/studiocore-drive",
});

function SectionContainer({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">{children}</div>;
}

export default function StudioCoreDrivePage() {
  return (
    <>
      {/* =========================================================================
          HERO SECTION: High-Impact Direct-From-PC Drive Announcement
          ========================================================================= */}
      <section className="relative overflow-hidden border-b border-border bg-surface pt-12 pb-16 lg:pt-20 lg:pb-24">
        <AmbientGlow />
        <SectionContainer>
          <div className="mx-auto max-w-4xl text-center">
            {/* Shimmer Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary shadow-xs backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-primary/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Ứng dụng cho Windows &amp; macOS · Công nghệ Zero-Cloud</span>
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </div>

            {/* Display Heading */}
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl sm:leading-[1.12]">
              Gửi ảnh &amp; video cho khách{" "}
              <span className="block mt-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">
                thẳng từ máy tính.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Không upload, không cần Google Drive. Chuột phải vào thư mục trên máy tính hoặc ổ NAS — khách
              có ngay link để xem, tải ảnh gốc RAW/JPG, chọn ảnh và xem video tức thì.
            </p>

            {/* Platform Download Actions */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full shadow-xl shadow-primary/25 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
              >
                <a href="#download">
                  <Monitor className="h-4 w-4 mr-2" />
                  Tải cho Windows (64-bit)
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full border-border/80 bg-surface/80 backdrop-blur-md transition-all duration-300 hover:bg-accent/60 active:scale-[0.98] sm:w-auto"
              >
                <a href="#download">
                  <Apple className="h-4 w-4 mr-2" />
                  Tải cho macOS (Apple &amp; Intel)
                </a>
              </Button>
            </div>

            {/* Advantage Badges */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Check className="h-4 w-4 text-emerald-500" />
                Không giới hạn dung lượng
              </li>
              <li className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Check className="h-4 w-4 text-emerald-500" />
                Ảnh RAW (.CR3, .ARW, .NEF) &amp; JPG
              </li>
              <li className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Check className="h-4 w-4 text-emerald-500" />
                Video phát ngay như YouTube
              </li>
              <li className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Check className="h-4 w-4 text-emerald-500" />
                Tiếng Việt &amp; English
              </li>
            </ul>
          </div>

          {/* Interactive OS Simulator */}
          <div className="mt-12 sm:mt-16">
            <DriveOsSimulator />
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            🔒 Dữ liệu ở nguyên trên máy tính / ổ NAS của bạn — StudioCore không lưu ảnh gốc của studio.
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          3 LINK TYPES: Đủ kiểu link cho mọi việc gửi khách
          ========================================================================= */}
      <section className="border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Linh hoạt đa mục đích
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Đủ kiểu link cho mọi nhu cầu gửi khách.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Chọn kiểu link phù hợp với từng show — khách mở trên iPhone, Android hay máy tính đều cực kỳ mượt mà.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Link Type 1: Thư mục (Xem & Tải) */}
            <SpotlightCard className="flex flex-col justify-between p-7">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <Folder className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-foreground">Link Thư mục (Folder)</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Khách xem và tải từng file hoặc cả thư mục (.zip). Phù hợp nhất để giao trọn bộ ảnh đã chỉnh,
                  file thiết kế in ấn photobook hoặc tài liệu hợp đồng.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-foreground/90">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Tải từng ảnh hoặc toàn bộ file gốc</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Đóng gói tự động tải cả thư mục (.zip)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Giữ nguyên cấu trúc các thư mục con</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 border-t border-border/70 pt-4">
                <Link
                  href="/drive/ky-yeu-12a1-folder"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Xem demo Link Thư mục →
                </Link>
              </div>
            </SpotlightCard>

            {/* Link Type 2: Album ảnh (Xem & Chọn ảnh) */}
            <SpotlightCard className="flex flex-col justify-between p-7 ring-2 ring-primary/30">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
                    <Heart className="h-6 w-6" />
                  </div>
                  <Badge tone="info">Phổ biến nhất</Badge>
                </div>

                <h3 className="mt-5 text-xl font-bold text-foreground">Link Album (Xem &amp; Chọn)</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Giao diện lướt ảnh sang trọng cho khách xem toàn màn hình, thả tim chọn ảnh duyệt,
                  ghi chú từng tấm và bấm chốt danh sách để studio lọc file RAW.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-foreground/90">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Xem ảnh nhanh gấp 10 lần Google Drive</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Chọn ảnh theo quota (ví dụ: 40/800 ảnh)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Báo chuông ngay lập tức khi khách chốt</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 border-t border-border/70 pt-4">
                <Link
                  href="/drive/cuoi-minh-lan-dalat"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Xem demo Album chọn ảnh →
                </Link>
              </div>
            </SpotlightCard>

            {/* Link Type 3: Video Player (Góp ý theo giây) */}
            <SpotlightCard className="flex flex-col justify-between p-7">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-500">
                  <Play className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-foreground">Link Video (Review)</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Trang xem video chuẩn YouTube phát trực tiếp từ máy tính/NAS studio. Tua mượt mà,
                  không giảm độ phân giải, kèm công cụ góp ý chỉnh sửa đúng từng giây.
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-foreground/90">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Phát video 4K/FullHD không chờ upload</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Góp ý theo timestamp (01:24 &quot;cắt đoạn này&quot;)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Hỗ trợ tải video gốc chất lượng cao nhất</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 border-t border-border/70 pt-4">
                <Link
                  href="/drive/highlight-cuoi-minh-lan-video"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Xem demo Video Player →
                </Link>
              </div>
            </SpotlightCard>
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          CUSTOMER PERSPECTIVE: Phía khách hàng
          ========================================================================= */}
      <section className="border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge tone="success">Trải nghiệm khách hàng số 1</Badge>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Khách mở link là xem được ngay. Không cần cài đặt gì.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                Không bắt khách phải đăng nhập tài khoản Google rắc rối hay tải app dung lượng nặng.
                Ảnh hiện siêu tốc trên điện thoại, hỗ trợ xem toàn màn hình, tải trực tiếp vào Cuộn Camera (Photos).
                Video phát ngay lập tức không giật lag.
              </p>

              <div className="mt-6 space-y-3.5">
                {[
                  "Giao diện chuẩn hóa cho iPhone, iPad và điện thoại Android.",
                  "Tải từng ảnh hoặc cả album ảnh nét căng 100% về máy.",
                  "Khách thả tim, ghi chú chi tiết từng tấm ảnh cần sửa da, dáng, màu.",
                  "Xem video mượt mà và gửi góp ý trực tiếp gắn liền mốc thời gian.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-1" />
                    <span className="text-sm text-foreground/90">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile Visual Card */}
            <div className="relative mx-auto w-full max-w-sm">
              <LiquidGlassCard className="p-4 shadow-2xl">
                <div className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-inner">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-foreground">Studio Gửi Bạn</span>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Đã chọn 14/40
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-bold text-foreground">Cưới Minh &amp; Lan (Đà Lạt)</p>
                  <p className="text-[11px] text-muted-foreground">Chạm vào ảnh để thả tim hoặc ghi chú</p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="group relative aspect-square overflow-hidden rounded-lg bg-surface-muted border border-border/60"
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                          ANH-{i.toString().padStart(3, "0")}
                        </div>
                        {i <= 3 && (
                          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] text-white">
                            ♥
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button className="mt-4 w-full shadow-md text-xs h-9">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Chốt 14 ảnh gửi Studio
                  </Button>
                </div>
              </LiquidGlassCard>
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          8 CORE CAPABILITIES: Làm ít hơn, gửi khách nhanh hơn
          ========================================================================= */}
      <section className="border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Tính năng đột phá
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Làm ít hơn, gửi khách nhanh hơn.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Giải phóng hoàn toàn thời gian của photographer và retoucher khỏi các thao tác upload thủ công nhàm chán.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Zap,
                title: "Không upload, không chờ",
                desc: "Ảnh và video nằm nguyên trên máy tính hoặc ổ NAS. Khách mở link là xem ngay, không tốn dung lượng đám mây.",
              },
              {
                icon: Clock,
                title: "Link trong vài giây",
                desc: "Thư mục hàng nghìn ảnh RAW/JPG có link gần như tức thì, ảnh xem trước nhẹ được tạo dần mượt mà ở nền.",
              },
              {
                icon: HardDrive,
                title: "Tải ảnh gốc RAW / JPG",
                desc: "Khách tải từng ảnh hoặc cả thư mục (.zip). Hỗ trợ chuẩn file RAW gốc Canon, Sony, Nikon, Fuji hoặc JPG nét nhất.",
              },
              {
                icon: Heart,
                title: "Chọn ảnh & Ghi chú",
                desc: "Khách duyệt ảnh thả tim, ghi chú từng tấm, nhiều người trong gia đình cùng xem và chọn trên 1 album.",
              },
              {
                icon: Play,
                title: "Video xem cực nhanh",
                desc: "Trang xem kiểu YouTube: tua mượt, toàn màn hình, tải video gốc và góp ý chỉnh sửa đúng từng giây.",
              },
              {
                icon: RefreshCw,
                title: "Tự đồng bộ thư mục",
                desc: "Thêm, sửa, xóa ảnh trong máy tính là link của khách tự cập nhật theo thời gian thực mà không phải gửi lại link.",
              },
              {
                icon: Lock,
                title: "Khóa link tức thì",
                desc: "Bật tắt quyền tải ảnh gốc, đặt mật khẩu bảo vệ hoặc thu hồi link chỉ với 1 click chuột.",
              },
              {
                icon: Server,
                title: "Nhiều máy, dùng chung NAS",
                desc: "Cài app trên nhiều máy tính khác nhau trong studio, dùng chung kho dữ liệu mạng hoặc ổ cứng di động.",
              },
            ].map((feat) => (
              <SpotlightCard key={feat.title} className="p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <feat.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-bold text-foreground">{feat.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{feat.desc}</p>
              </SpotlightCard>
            ))}
          </div>

          {/* Special Retouch Auto-filter Banner */}
          <div className="mt-8 rounded-3xl border border-primary/30 bg-gradient-to-r from-primary/10 via-violet-500/10 to-surface p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Khách chốt ảnh — App báo chuông và lọc sẵn ảnh gốc!
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Với link chọn ảnh, app nhận danh sách khách duyệt, tự tìm file RAW/JPG tương ứng và copy ra thư mục riêng để bạn chỉnh luôn.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link href="/manage/drive">Thử quản lý Drive trong Studio</Link>
              </Button>
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          COMPARISON TABLE: Vì sao không dùng Google Drive?
          ========================================================================= */}
      <section className="border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              So sánh trực quan
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Vì sao không nên dùng Google Drive?
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Thấy rõ sự khác biệt giữa phương thức tải lên đám mây truyền thống và StudioCore Drive.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {/* Google Drive Column */}
            <div className="rounded-3xl border border-red-200/60 bg-red-50/20 dark:border-red-950 dark:bg-red-950/10 p-6 sm:p-8">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-lg">
                <XCircle className="h-5 w-5" />
                <span>Google Drive / Dropbox</span>
              </div>
              <ul className="mt-6 space-y-4 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>Upload hàng chục GB, chờ hàng giờ đồng hồ</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>Tốn dung lượng cloud, phải mua thêm hàng tháng</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>Khách khó chọn ảnh, phải nhắn mã từng tấm qua Zalo</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>File RAW không xem trước được, tải về rất chậm</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <XCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>Sửa ảnh xong phải xóa đi upload lại từ đầu</span>
                </li>
              </ul>
            </div>

            {/* StudioCore Drive Column */}
            <div className="rounded-3xl border border-primary/40 bg-gradient-to-br from-primary/[0.04] to-surface p-6 sm:p-8 shadow-md">
              <div className="flex items-center gap-2 text-primary font-bold text-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span>StudioCore Drive</span>
              </div>
              <ul className="mt-6 space-y-4 text-sm text-foreground/90 font-medium">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Có link ngay trong 3 giây, không cần upload</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Không tốn 1 đồng dung lượng đám mây</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Khách thả tim, ghi chú ảnh trực tiếp trên link</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Xem trước RAW siêu nét, tải RAW hoặc JPG linh hoạt</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>Sửa ảnh trong máy tính là link của khách tự động cập nhật</span>
                </li>
              </ul>
            </div>
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          3-STEP WORKFLOW: Cách dùng (Chưa tới một phút)
          ========================================================================= */}
      <section className="border-b border-border bg-background py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Cách dùng</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Ba bước, chưa tới một phút.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Cài app & Đăng nhập",
                desc: "Đăng nhập bằng tài khoản StudioCore (Google hoặc dán Connect Key). App tự động chạy nền không tốn RAM.",
              },
              {
                step: "02",
                title: "Chuột phải thư mục / video",
                desc: "Windows: Menu chuột phải › StudioCore Drive. macOS: Finder › Thao tác nhanh (Quick Actions).",
              },
              {
                step: "03",
                title: "Copy link gửi khách",
                desc: "Gửi qua Zalo, Messenger, SMS... Khách mở link trên điện thoại là xem, tải hoặc duyệt ảnh ngay lập tức.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-3xl border border-border bg-surface p-6 shadow-xs transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <span className="font-mono text-3xl font-black text-primary/40">{item.step}</span>
                <h3 className="mt-4 text-base font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          FAQ SECTION
          ========================================================================= */}
      <section className="border-b border-border bg-surface py-16 sm:py-24">
        <SectionContainer>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Hỏi đáp</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
              Câu hỏi thường gặp về StudioCore Drive.
            </h2>
          </div>

          <div className="mt-12 mx-auto max-w-3xl space-y-4">
            {[
              {
                q: "Máy tính của studio có cần phải bật không?",
                a: "Có. Do ảnh và video nằm nguyên trên máy tính của bạn nên máy cần bật và có kết nối mạng khi khách mở link. Ứng dụng chạy nền cực nhẹ, tắt cửa sổ app vẫn hoạt động. Nếu studio có ổ NAS, có thể đặt 1 máy cắm 24/7 để phục vụ cho cả ekip.",
              },
              {
                q: "Ảnh của khách có bị đưa lên mạng công cộng không?",
                a: "Hoàn toàn không. StudioCore không bao giờ lưu trữ ảnh gốc của bạn lên cloud. Đường truyền được mã hóa end-to-end bảo mật tối đa, chỉ người có link và mật khẩu mới xem được.",
              },
              {
                q: "Khách có tải được file ảnh gốc RAW không?",
                a: "Được. Bạn có toàn quyền bật hoặc tắt tính năng cho phép tải file RAW gốc hoặc cả thư mục .zip cho từng link cụ thể.",
              },
              {
                q: "Dùng trên máy Mac và Windows như thế nào?",
                a: "StudioCore Drive có phiên bản native hoàn chỉnh cho cả Windows 10/11 và macOS (hỗ trợ chip M1/M2/M3/M4 và Intel). Thao tác tích hợp thẳng vào menu chuột phải của hệ điều hành.",
              },
              {
                q: "Nhiều máy tính trong studio dùng chung một tài khoản được không?",
                a: "Được. Nhiều máy tính có thể kết nối chung vào 1 tài khoản StudioCore của studio. Tất cả các link chia sẻ và thông báo khách duyệt ảnh sẽ được đồng bộ tập trung trên bảng điều khiển quản trị.",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-border bg-background p-5">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" />
                  {faq.q}
                </h3>
                <p className="mt-2 text-xs leading-6 text-muted-foreground pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </SectionContainer>
      </section>

      {/* =========================================================================
          DOWNLOAD & FINAL CTA BANNER
          ========================================================================= */}
      <section id="download" className="relative overflow-hidden bg-gradient-to-r from-violet-700 via-indigo-700 to-purple-800 py-20 text-white sm:py-24">
        <SectionContainer>
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Gửi show tiếp theo bằng StudioCore Drive.
            </h2>
            <p className="mt-4 text-base leading-7 text-white/85 sm:text-lg">
              Cài đặt trong 1 phút. Dùng ngay với tài khoản StudioCore của bạn.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-white text-violet-950 shadow-xl transition-all hover:bg-white/95 hover:scale-105 active:scale-95"
              >
                <Link href="/manage/drive">
                  <Monitor className="h-4 w-4 mr-2" />
                  Tải cho Windows (Installer)
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white transition-all hover:bg-white/10 active:scale-95"
              >
                <Link href="/manage/drive">
                  <Apple className="h-4 w-4 mr-2" />
                  Tải cho macOS (.dmg)
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-white/60">
              Miễn phí trải nghiệm đầy đủ tính năng trong 30 ngày cùng StudioCore SaaS.
            </p>
          </div>
        </SectionContainer>
      </section>

      <FloatingContact />
    </>
  );
}
