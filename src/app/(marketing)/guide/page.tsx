import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingIcon } from "@/components/marketing/marketing-icons";
import { GUIDES } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Hướng dẫn sử dụng StudioCore",
  description:
    "Hướng dẫn bắt đầu, quản lý đơn hàng, CRM, lịch chụp, PhotoShare và tài chính trong StudioCore.",
  path: "/guide",
});

const GUIDE_SECTIONS = [
  {
    id: "bat-dau",
    title: "Bắt đầu với StudioCore",
    intro:
      "Tạo tenant, chi nhánh đầu tiên và tài khoản owner. Sau khi đăng ký, bạn có thể thêm nhân sự và cấu hình studio.",
    steps: [
      "Đăng ký tại /register với tên studio, email owner và mật khẩu.",
      "Vào Cài đặt studio để cập nhật địa chỉ, SĐT, MST và tài khoản ngân hàng.",
      "Mời nhân sự trong Người dùng, gán vai trò và chi nhánh.",
    ],
  },
  {
    id: "don-hang",
    title: "Quản lý đơn hàng",
    intro:
      "Đơn hàng là trung tâm của doanh thu, lịch chụp, album và công nợ. Tạo đơn đúng ngay từ đầu sẽ giúp báo cáo khớp.",
    steps: [
      "Chọn khách có sẵn hoặc tạo khách mới, chọn chi nhánh và dịch vụ.",
      "Ghi cọc và phương thức thanh toán; phần còn lại tự tính.",
      "Dùng timeline trạng thái để chuyển từ mới đến hoàn tất, không nhảy cóc.",
    ],
  },
  {
    id: "crm",
    title: "CRM khách hàng",
    intro:
      "Hồ sơ khách 360 gom tương tác, đơn, album, công nợ và task. Dùng phân khúc để biết khách nào cần chăm sóc.",
    steps: [
      "Ghi lại cuộc gọi/tin nhắn/follow-up ngay sau khi tương tác.",
      "Đặt follow-up tiếp theo và xem cảnh báo quá hạn trên dashboard.",
      "Tạo task từ hồ sơ khách để không quên việc chăm sóc.",
    ],
  },
  {
    id: "lich-chup",
    title: "Lịch chụp chống trùng",
    intro:
      "Lịch kiểm tra phòng, photographer, makeup, editor và buffer 30 phút trước khi xác nhận.",
    steps: [
      "Chọn chi nhánh, phòng và nhân sự trước khi chọn giờ.",
      "Nếu trùng, dùng slot gợi ý thay vì ghi đè lịch.",
      "Check-in/check-out để cập nhật trạng thái đơn và ngày công.",
    ],
  },
  {
    id: "photoshare",
    title: "PhotoShare & lọc ảnh",
    intro:
      "Tạo album, gửi link cho khách và nhận selection. Không cần đối chiếu tên file thủ công.",
    steps: [
      "Tạo album từ Drive demo, nhiều link hoặc upload; đặt quota và phí ảnh thêm.",
      "Gửi link, khách thả tim/chọn/ghi chú; studio khóa selection khi cần.",
      "Copy mã 4 định dạng hoặc mở trang lọc mã; xuất ZIP + manifest.csv.",
      "Dùng missing.txt để kiểm tra file không khớp trước khi giao.",
    ],
  },
  {
    id: "tai-chinh",
    title: "Tài chính & báo cáo",
    intro:
      "Sổ quỹ append-only giúp giữ audit. Công nợ, hóa đơn, lương và báo cáo dùng cùng nguồn giao dịch.",
    steps: [
      "Ghi thu/chi đúng category và chi nhánh; hoàn tiền là bút toán riêng.",
      "Đối soát công nợ theo tuổi nợ trước khi nhắc thu.",
      "Tạo hóa đơn, bảng lương và báo cáo; xuất CSV hoặc in khi cần.",
    ],
  },
];

export default function GuidePage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Guide</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Hướng dẫn sử dụng StudioCore.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Các hướng dẫn ngắn, thực tế theo luồng vận hành studio. Nếu bạn mới bắt
            đầu, hãy đọc phần Bắt đầu trước rồi mở demo read-only để xem dữ liệu mẫu.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/demo">Mở demo read-only</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">Tạo tài khoản</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background py-10">
        <div className="mx-auto grid max-w-[1240px] gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
          {GUIDES.map((guide) => (
            <Link
              key={guide.title}
              href={guide.href}
              className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-md"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <MarketingIcon name={guide.icon} className="h-4 w-4" />
              </span>
              <h2 className="mt-3 text-base font-semibold">{guide.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{guide.description}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                Đọc phần này <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-[920px] space-y-10 px-4 py-12 sm:px-6 lg:px-8">
        {GUIDE_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{section.intro}</p>
            <ul className="mt-4 space-y-2">
              {section.steps.map((step) => (
                <li key={step} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
                  {step}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="rounded-2xl border border-primary/30 bg-accent p-6">
          <h2 className="text-xl font-semibold">Cần xem trực tiếp?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Demo read-only mở dashboard với dữ liệu synthetic và chặn mọi thao tác
            ghi ở server. Bạn có thể đăng ký tenant riêng khi sẵn sàng.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild><Link href="/demo">Mở demo</Link></Button>
            <Button asChild variant="outline"><Link href="/contact">Liên hệ hỗ trợ</Link></Button>
          </div>
        </section>
      </div>
    </>
  );
}
