import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Chính sách bảo mật — StudioCore (demo)",
  description:
    "Cách bản demo StudioCore xử lý dữ liệu, session, ảnh và thông tin liên hệ; giới hạn của môi trường demo.",
  path: "/privacy",
});

const SECTIONS = [
  {
    title: "1. Phạm vi",
    paragraphs: [
      "Chính sách này mô tả cách bản demo StudioCore xử lý dữ liệu trong môi trường local. Đây là tài liệu mẫu, không phải chính sách bảo mật chính thức cho một dịch vụ production.",
    ],
  },
  {
    title: "2. Dữ liệu được lưu",
    paragraphs: [
      "Dữ liệu demo: tenant, chi nhánh, tài khoản nhân sự, khách hư cấu, đơn hàng, lịch, album, giao dịch, công việc và cấu hình. Mật khẩu/PIN được băm bằng scrypt; mật khẩu thô không được lưu.",
      "Ảnh demo là ảnh synthetic. Khi bạn tự tải ảnh lên trong local, file được lưu trong thư mục uploads của máy chạy demo; không dùng dữ liệu ảnh thật trong seed.",
    ],
  },
  {
    title: "3. Mục đích xử lý",
    paragraphs: [
      "Dữ liệu được dùng để hiển thị luồng quản lý studio, kiểm thử phân quyền, tạo báo cáo và minh họa các tính năng. Không dùng dữ liệu demo để bán, quảng cáo hoặc gửi email thật.",
    ],
  },
  {
    title: "4. Session và cookie",
    paragraphs: [
      "Session dùng cookie httpOnly, ký JWT; một số luồng dùng cookie truy cập PhotoShare ngắn hạn. Bản demo read-only dùng session có cờ readOnly và quyền chỉ xem; thao tác ghi bị chặn ở server.",
      "Local adapter có thể ghi notification vào database và log terminal. Không có dịch vụ tracking quảng cáo trong mã demo.",
    ],
  },
  {
    title: "5. Chia sẻ dữ liệu",
    paragraphs: [
      "Các tích hợp live như Google Drive, email, Zalo, SMS, Fanpage và AI provider chưa được cấu hình. Khi chưa cấu hình, hệ thống hiển thị trạng thái chưa sẵn sàng và không gửi dữ liệu ra ngoài.",
      "AI local xử lý bằng sharp/rule-based trên server; provider live yêu cầu consent và cost guard trước khi gửi ảnh.",
    ],
  },
  {
    title: "6. Bảo mật",
    paragraphs: [
      "Mọi truy vấn nghiệp vụ có tenant scope; mutation quan trọng kiểm tra quyền và branch ở server. Upload kiểm tra định dạng/kích thước và chặn path traversal; PhotoShare kiểm tra token/mật khẩu/hạn.",
      "Không có hệ thống bảo mật nào tuyệt đối. Trước khi dùng production cần HTTPS, secret management, private storage, backup và rà soát bảo mật độc lập.",
    ],
  },
  {
    title: "7. Lưu trữ và xóa",
    paragraphs: [
      "Database demo nằm ở data/studiocore.db và có thể bị reset khi chạy migrate/seed. Backup JSON chỉ dành cho owner và loại bỏ hash mật khẩu/API key/token.",
      "Với dữ liệu production, cần định nghĩa thời hạn lưu, quy trình xóa và xử lý yêu cầu của chủ thể dữ liệu theo quy định áp dụng.",
    ],
  },
  {
    title: "8. Quyền và liên hệ",
    paragraphs: [
      "Trong demo, bạn có thể yêu cầu xem hoặc xóa dữ liệu local bằng cách reset database. Câu hỏi về quyền riêng tư gửi qua /contact.",
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
            Cập nhật: 03/11/2026 · Chính sách mẫu cho bản demo, không thay thế tư vấn pháp lý.
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
