import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Chính sách bảo mật — StudioCore",
  description:
    "Chính sách bảo mật thông tin và an toàn dữ liệu khách hàng trên nền tảng phần mềm SaaS StudioCore.",
  path: "/privacy",
});

const SECTIONS = [
  {
    title: "1. Nguyên tắc chung về bảo mật",
    paragraphs: [
      "StudioCore coi trọng và cam kết bảo vệ quyền riêng tư, bí mật kinh doanh cũng như dữ liệu cá nhân của các studio đối tác và khách hàng của studio.",
      "Chính sách này quy định cách thức chúng tôi thu thập, lưu trữ, xử lý và bảo vệ thông tin khi bạn sử dụng nền tảng StudioCore.",
    ],
  },
  {
    title: "2. Thu thập và mục đích sử dụng thông tin",
    paragraphs: [
      "Chúng tôi thu thập các thông tin cần thiết phục vụ việc khởi tạo và vận hành tài khoản studio: Họ tên người đại diện, số điện thoại liên hệ, địa chỉ email, tên studio, địa chỉ chi nhánh và thông tin tài khoản ngân hàng nhận thanh toán VietQR.",
      "Dữ liệu khách hàng do studio nhập vào hệ thống (họ tên cô dâu chú rể, số điện thoại, ngày cưới, số đo trang phục, hợp đồng dịch vụ) chỉ được sử dụng cho mục đích phục vụ nghiệp vụ nội bộ của chính studio đó.",
    ],
  },
  {
    title: "3. Bảo mật hình ảnh và tính năng PhotoShare",
    paragraphs: [
      "Hình ảnh tải lên hoặc liên kết qua Google Drive/NAS trong PhotoShare thuộc quyền sở hữu riêng của studio và khách hàng của studio.",
      "StudioCore áp dụng cơ chế phân quyền bảo mật: Link giao ảnh có thể đặt mã bảo vệ (passcode), giới hạn thời gian truy cập (TTL), watermark chống sao chép và quyền khóa tải file gốc khi khách chưa hoàn thành thanh toán.",
    ],
  },
  {
    title: "4. Cơ chế bảo vệ kỹ thuật và an toàn thông tin",
    paragraphs: [
      "Toàn bộ kết nối giữa trình duyệt của người dùng và máy chủ StudioCore được mã hóa theo tiêu chuẩn HTTPS/TLS 1.3.",
      "Mật khẩu quản trị và mã PIN nhân viên được băm bằng thuật toán bảo mật cao (scrypt), không lưu trữ dưới dạng văn bản thô. Phiên đăng nhập được quản lý bằng cookie httpOnly an toàn.",
      "Dữ liệu của từng studio được cô lập theo mô hình đa người thuê (Multi-tenant isolation) chặt chẽ, đảm bảo không có sự rò rỉ dữ liệu giữa các studio khác nhau.",
    ],
  },
  {
    title: "5. Quyền kiểm soát và trích xuất dữ liệu",
    paragraphs: [
      "Chủ studio có toàn quyền trích xuất dữ liệu danh sách khách hàng, báo cáo doanh thu, sổ quỹ thu chi ra định dạng file Excel / CSV hoặc sao lưu dữ liệu toàn diện bất kỳ lúc nào.",
      "Khi studio ngừng sử dụng dịch vụ hoặc có yêu cầu hủy tài khoản, chúng tôi sẽ hỗ trợ bàn giao toàn bộ dữ liệu và tiến hành xóa bỏ dữ liệu lưu trữ theo quy trình an toàn.",
    ],
  },
  {
    title: "6. Liên hệ phụ trách bảo mật",
    paragraphs: [
      "Nếu bạn có bất kỳ câu hỏi, thắc mắc hoặc yêu cầu nào liên quan đến chính sách bảo mật và an toàn thông tin, vui lòng liên hệ trực tiếp với chúng tôi:",
      "Hotline / Zalo: 0976 181 859 · Email: samstudio.hn@gmail.com · Địa chỉ: Hà Nội, Việt Nam.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[920px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pháp lý</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Chính sách bảo mật</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Áp dụng từ: 01/11/2026 · Cam kết an toàn dữ liệu khách hàng tuyệt đối tại StudioCore.
          </p>
        </div>
      </section>
      <article className="mx-auto max-w-[920px] space-y-7 px-4 py-10 sm:px-6 lg:px-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-2 text-sm leading-7 text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </>
  );
}
