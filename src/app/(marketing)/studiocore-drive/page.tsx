import Link from "next/link";
import { Apple, Folder, Heart, Lock, Monitor, Play, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpotlightCard } from "@/components/marketing/spotlight-card";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "StudioCore Drive — Gửi ảnh và video từ máy tính cho khách",
  description:
    "Chia sẻ thư mục từ Windows và macOS, nhận lựa chọn và ghi chú của khách, lọc ảnh RAW/JPG ngay trên máy tính. Cần Node.js LTS và máy tính đang chạy.",
  path: "/studiocore-drive",
});

const features = [
  {
    icon: Folder,
    title: "Bốn kiểu link",
    description:
      "Album chọn ảnh, album chỉ xem, video và thư mục tải về. File gốc vẫn ở máy tính của studio.",
  },
  {
    icon: Heart,
    title: "Chọn ảnh và ghi chú",
    description:
      "Khách thả tim, ghi chú từng ảnh và chốt lựa chọn. Studio đặt giới hạn số ảnh và có thể mở lại cho khách chọn.",
  },
  {
    icon: Play,
    title: "Video và góp ý",
    description:
      "Phát video bằng trình phát của trình duyệt, tua theo byte range và ghi chú theo mốc thời gian. Khả năng phát phụ thuộc định dạng và codec của trình duyệt.",
  },
  {
    icon: Scissors,
    title: "Lọc RAW / JPG",
    description:
      "Lấy mã khách chọn hoặc dán mã thủ công, xem trước kết quả và copy vào thư mục. Không ghi đè file; kèm báo cáo ghi chú và mã không tìm thấy.",
  },
  {
    icon: Lock,
    title: "Kiểm soát link",
    description:
      "PIN tùy chọn, ngày hết hạn, tạm dừng, thu hồi và quyền tải bản gốc. Chỉ người có link và PIN (nếu đặt) mới truy cập được.",
  },
  {
    icon: Monitor,
    title: "Quản lý máy tính",
    description:
      "Giao diện cục bộ trên trình duyệt, nhật ký truy cập, cache ảnh xem trước và thông báo khi khách chốt. Web quản trị hiển thị các máy và link trong studio.",
  },
];

export default function StudioCoreDrivePage() {
  return (
    <>
      <section className="border-b border-border bg-surface py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            StudioCore Drive
          </p>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-6xl">
            Ảnh ở máy bạn.
            <br />
            Trải nghiệm dành cho khách.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Tạo link ảnh, video hoặc thư mục từ máy tính. Khách xem, chọn ảnh, ghi chú và tải file
            theo quyền studio cấp — không cần tải toàn bộ ảnh gốc lên máy chủ StudioCore.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <a href="/downloads/StudioCore-Drive-Windows.zip" download>
                <Monitor className="size-4" />
                Tải cho Windows
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="/downloads/StudioCore-Drive-macOS.zip" download>
                <Apple className="size-4" />
                Tải cho macOS
              </a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Cần Node.js LTS (tối thiểu 18). Bộ cài dạng ZIP, chưa ký số; tích hợp Windows/macOS cần
            được kiểm tra trên máy của bạn.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Máy tính phải bật, ứng dụng và đường truyền phải hoạt động khi khách xem hoặc tải. Tốc
            độ phụ thuộc mạng và máy tính của studio.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold">Từ gửi link đến nhận ảnh khách chọn</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <SpotlightCard key={title} className="p-6">
              <Icon className="size-6 text-primary" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>
      <section className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-3xl font-bold">Cài đặt và kết nối</h2>
          <ol className="mt-6 list-decimal space-y-4 pl-6 text-sm leading-7">
            <li>
              Cài{" "}
              <a
                className="text-primary underline"
                href="https://nodejs.org"
                target="_blank"
                rel="noreferrer"
              >
                Node.js LTS từ nodejs.org
              </a>
              . Tải ZIP cho hệ điều hành của bạn và giải nén toàn bộ.
            </li>
            <li>
              Windows: chạy <code>windows/install.bat</code>. macOS: chạy{" "}
              <code>install.command</code>. Trình cài đặt đăng ký menu người dùng và mở GUI trên
              trình duyệt. Nếu macOS từ chối launcher chưa ký, có thể chạy trực tiếp{" "}
              <code>StudioCore Drive.app/Contents/MacOS/app-launcher</code> trong ~/Applications.
            </li>
            <li>
              Trong{" "}
              <Link className="text-primary underline" href="/manage/drive">
                Quản lý Drive
              </Link>
              , thêm máy tính và sao chép khóa kết nối một lần. Dán vào{" "}
              <strong>Cài đặt → Khóa kết nối</strong> trong ứng dụng rồi lưu.
            </li>
            <li>
              Chọn <strong>Tạo link mới</strong>, hoặc dùng menu chuột phải Windows / Finder Quick
              Actions trên macOS. Chọn thư mục, quyền tải và PIN nếu cần, rồi gửi link cho khách.
            </li>
          </ol>
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Đường truyền dùng Cloudflare Tunnel. Quick tunnel có thể gặp giới hạn hoặc lỗi từ nhà
            cung cấp; cấu hình named tunnel cần tên miền, token và ingress trỏ đúng cổng media. Ảnh
            RAW được xem trước từ JPEG nhúng nếu có, không phải xử lý ảnh cảm biến đầy đủ.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-2xl font-bold">Phạm vi hiện tại</h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Danh sách file được quét lúc tạo link; thêm hoặc xóa file sau đó không tự đồng bộ vào link
          cũ. Lựa chọn trên cùng album dùng chung, không tách hồ sơ từng người xem. Đồng bộ Google
          Drive, dịch vụ NAS độc lập và thanh toán khách hàng chưa được triển khai trong ứng dụng
          Drive.
        </p>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Link là quyền truy cập: chỉ gửi cho người nhận phù hợp, đặt PIN khi cần và thu hồi khi
          xong. HTTPS bảo vệ đường truyền qua dịch vụ tunnel; đây không phải mã hóa đầu-cuối giữa
          hai thiết bị.
        </p>
        <div className="mt-8">
          <Button asChild>
            <Link href="/manage/drive">Mở quản lý Drive</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
