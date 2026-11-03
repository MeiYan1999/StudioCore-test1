import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Điều khoản sử dụng — StudioCore (demo)",
  description:
    "Điều khoản sử dụng bản demo StudioCore: phạm vi demo, tài khoản, dữ liệu, thanh toán và giới hạn trách nhiệm.",
  path: "/terms",
});

const SECTIONS = [
  {
    title: "1. Phạm vi và tính chất demo",
    paragraphs: [
      "StudioCore trong kho mã này là sản phẩm demo phục vụ phát triển và kiểm thử. Một số tích hợp như Google Drive live, email, Zalo, SMS, Fanpage và thanh toán thật chưa được cấu hình hoặc chưa được kiểm chứng.",
      "Tài liệu này là nội dung mẫu cho môi trường demo, không phải tư vấn pháp lý và không thay thế hợp đồng chính thức giữa các bên.",
    ],
  },
  {
    title: "2. Tài khoản và trách nhiệm người dùng",
    paragraphs: [
      "Bạn chịu trách nhiệm bảo vệ thông tin đăng nhập, PIN và thiết bị truy cập. Không chia sẻ tài khoản owner cho người không có trách nhiệm.",
      "Bạn cần có quyền hợp pháp đối với dữ liệu khách hàng và ảnh tải lên. Không sử dụng demo để lưu PII thật, ảnh người thật hoặc dữ liệu nhạy cảm.",
    ],
  },
  {
    title: "3. Dữ liệu demo",
    paragraphs: [
      "Seed data gồm khách hàng, số điện thoại, studio, nhà cung cấp và tài khoản ngân hàng hư cấu. Ảnh trong album demo là ảnh synthetic có nhãn, không phải ảnh khách hàng thật.",
      "Bạn có thể đặt lại database demo bằng quy trình migrate/seed. Việc reset sẽ xóa dữ liệu phát sinh trong môi trường local.",
    ],
  },
  {
    title: "4. Thanh toán và giá",
    paragraphs: [
      "Giá gói cước trên website là giá demo, chưa phải báo giá chính thức. Mock webhook chỉ hoạt động trong development và không xử lý tiền thật.",
      "Payment request, hóa đơn và báo cáo thuế trong demo không thay thế chứng từ kế toán hay tờ khai thuế hợp pháp.",
    ],
  },
  {
    title: "5. Sử dụng được chấp nhận",
    paragraphs: [
      "Không dùng hệ thống để gửi spam, tấn công, dò quét trái phép, xâm phạm dữ liệu người khác hoặc vượt qua kiểm tra phân quyền.",
      "Không tải lên mã độc, tệp thực thi không rõ nguồn gốc hoặc nội dung vi phạm quyền sở hữu trí tuệ.",
    ],
  },
  {
    title: "6. Sở hữu trí tuệ",
    paragraphs: [
      "Branding, giao diện và mã nguồn StudioCore thuộc dự án demo này. Không sao chép nội dung, logo hoặc asset độc quyền của bên thứ ba.",
      "Ảnh do người dùng tải lên vẫn thuộc quyền của người dùng; bạn cấp cho hệ thống quyền xử lý cần thiết để tạo thumbnail/preview và phục vụ luồng album.",
    ],
  },
  {
    title: "7. Giới hạn trách nhiệm",
    paragraphs: [
      "Demo được cung cấp “nguyên trạng” cho mục đích học tập/kiểm thử. Không có cam kết về tính sẵn sàng, khả năng chịu tải production hoặc phù hợp cho một mục đích cụ thể.",
      "Trước khi dùng production, cần rà soát bảo mật, backup, lưu trữ private, pháp lý dữ liệu và các tích hợp thật.",
    ],
  },
  {
    title: "8. Liên hệ và cập nhật",
    paragraphs: [
      "Câu hỏi về điều khoản có thể gửi qua trang /contact. Nội dung có thể được cập nhật khi sản phẩm thay đổi; phiên bản mới sẽ hiển thị trên trang này.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[920px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pháp lý</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Điều khoản sử dụng</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cập nhật: 03/11/2026 · Tài liệu mẫu cho bản demo, không thay thế tư vấn pháp lý.
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
