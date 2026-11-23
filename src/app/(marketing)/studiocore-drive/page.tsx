import Link from "next/link";
import {
  Bell,
  Download,
  FolderOpen,
  HardDrive,
  Heart,
  Link2,
  Lock,
  MousePointerClick,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientGlow } from "@/components/marketing/ambient-glow";
import { FloatingContact } from "@/components/marketing/floating-contact";
import { DriveDownloadButtons } from "@/components/drive/drive-download-buttons";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "StudioCore Drive — Gửi ảnh & video cho khách thẳng từ máy tính",
  description:
    "Ứng dụng StudioCore Drive cho Windows & macOS: chuột phải thư mục là có link gửi khách. Khách xem, chọn ảnh và tải ngay — không cần upload lên Google Drive.",
  path: "/studiocore-drive",
});

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Chuột phải là có link",
    desc: "Chuột phải thư mục trong Explorer hoặc Finder, chọn “Chia sẻ bằng StudioCore Drive”. Không chờ upload.",
  },
  {
    icon: Heart,
    title: "Khách chọn ảnh trên điện thoại",
    desc: "Khách bấm tim để chọn, xem ảnh lớn, gửi lời nhắn. Bạn đặt giới hạn số ảnh được chọn cho từng link.",
  },
  {
    icon: FolderOpen,
    title: "Tự lọc RAW theo ảnh khách chọn",
    desc: "Khi khách gửi lựa chọn, ứng dụng chép ảnh đã chọn kèm file RAW cùng tên ra thư mục riêng để hậu kỳ.",
  },
  {
    icon: Download,
    title: "Giao file gốc",
    desc: "Link giao file cho khách tải ảnh và video gốc trực tiếp từ máy studio, giữ nguyên chất lượng.",
  },
  {
    icon: Lock,
    title: "PIN và hạn dùng",
    desc: "Đặt mã PIN, ngày hết hạn, tạm dừng hoặc xóa link bất cứ lúc nào từ ứng dụng hoặc trang quản lý.",
  },
  {
    icon: Bell,
    title: "Báo ngay khi khách chọn xong",
    desc: "Ứng dụng hiện thông báo trên máy tính khi khách gửi lựa chọn, kèm danh sách mã ảnh cho Lightroom.",
  },
];

const STEPS = [
  { icon: Download, title: "Cài ứng dụng", desc: "Tải bộ cài cho Windows hoặc macOS và mở trên máy chứa ảnh." },
  { icon: Link2, title: "Kết nối studio", desc: "Vào Quản lý → StudioCore Drive, tạo mã kết nối và dán vào ứng dụng." },
  { icon: HardDrive, title: "Chia sẻ thư mục", desc: "Chọn thư mục, đặt PIN/hạn dùng nếu cần, sao chép link gửi khách." },
];

export default function StudioCoreDrivePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-surface py-16 lg:py-24">
        <AmbientGlow />
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <HardDrive className="h-3.5 w-3.5" aria-hidden />
            Ứng dụng cho Windows &amp; macOS
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Gửi ảnh cho khách thẳng từ máy tính studio
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            StudioCore Drive biến thư mục trên máy bạn thành link xem, chọn và tải ảnh. Ảnh gốc vẫn nằm trên máy studio,
            không phải upload lên dịch vụ lưu trữ nào.
          </p>
          <div className="mt-8">
            <DriveDownloadButtons />
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="outline">
                <Link href="/manage/drive">Mở trang quản lý</Link>
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            <Link className="underline underline-offset-4 hover:text-foreground" href="#mo-app-lan-dau">
              Hướng dẫn mở app lần đầu
            </Link>
          </p>
        </div>
      </section>

      <section id="mo-app-lan-dau" className="scroll-mt-24 border-b border-border bg-surface py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold">Mở ứng dụng lần đầu</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background p-6">
              <h3 className="text-lg font-semibold">macOS</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                StudioCore Drive chưa được Apple công chứng, nên lần đầu mở app macOS sẽ chặn. Chỉ cần cho phép một
                lần:
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Mở file .dmg, kéo StudioCore Drive vào thư mục Applications.</li>
                <li>Mở app. Khi macOS báo không mở được StudioCore Drive, bấm “Xong”.</li>
                <li>
                  Vào Cài đặt hệ thống › Quyền riêng tư &amp; Bảo mật, kéo xuống và bấm “Vẫn mở” cạnh dòng StudioCore
                  Drive bị chặn.
                </li>
                <li>Ở hộp thoại hỏi lại, bấm “Vẫn mở” lần nữa rồi nhập mật khẩu máy.</li>
                <li>
                  Nếu macOS hỏi cho “StudioCore Drive Safe Storage” dùng Chuỗi khóa (Keychain), nhập mật khẩu máy và
                  bấm “Luôn cho phép”. Ứng dụng dùng mục này để mã hóa khóa kết nối studio. Từ lần sau app mở bình
                  thường.
                </li>
              </ol>
              <p className="mt-4 text-xs text-muted-foreground">
                macOS 14 trở về trước: chuột phải vào app trong Applications › Mở › Mở.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-6">
              <h3 className="text-lg font-semibold">Windows</h3>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Nếu Windows báo “Windows đã bảo vệ PC của bạn”, bấm “Thông tin thêm”.</li>
                <li>Bấm “Vẫn chạy” rồi cài như bình thường.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h2 className="mt-4 text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold">Bắt đầu trong 3 bước</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, desc }, index) => (
              <li key={title} className="rounded-2xl border border-border p-6">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Icon className="h-4 w-4" aria-hidden />
                  Bước {index + 1}
                </p>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 sm:grid-cols-2 sm:px-6">
          <div className="rounded-2xl border border-border bg-surface p-6">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">Ảnh gốc không rời máy studio</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Máy chủ StudioCore chỉ chuyển tiếp ảnh khi khách đang xem và chỉ lưu tên tệp cùng lựa chọn của khách.
              Đường dẫn thư mục trên máy bạn không bao giờ được gửi ra ngoài.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <Timer className="h-6 w-6 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">Cần bật máy khi khách xem</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Link hoạt động khi máy studio đang bật, có mạng và ứng dụng đang chạy. Khi máy tắt, khách thấy thông báo
              studio đang ngoại tuyến; lựa chọn đã lưu vẫn được giữ.
            </p>
          </div>
        </div>
      </section>
      <FloatingContact />
    </>
  );
}
