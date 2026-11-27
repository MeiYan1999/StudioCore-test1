import Link from "next/link";
import { MARKETING_CONTACT } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Hướng dẫn xóa dữ liệu người dùng — StudioCore",
  description:
    "Cách yêu cầu xóa dữ liệu Facebook Messenger và dữ liệu cá nhân mà StudioCore lưu trữ thay cho các studio.",
  path: "/data-deletion",
});

const SECTIONS = [
  {
    title: "1. Dữ liệu Facebook mà StudioCore lưu trữ",
    paragraphs: [
      "Khi một studio kết nối Fanpage với Inbox của StudioCore, hệ thống nhận và lưu các dữ liệu sau để nhân viên studio trả lời tin nhắn: mã định danh Messenger của bạn trong phạm vi Fanpage (PSID), tên và ảnh đại diện công khai trên Messenger, nội dung tin nhắn và tệp đính kèm bạn trao đổi với Fanpage, trạng thái đã nhận / đã xem.",
      "Với người quản trị Fanpage, StudioCore lưu tên, mã Fanpage và mã truy cập Fanpage (được mã hóa) để nhận và gửi tin nhắn thay cho Fanpage.",
      "StudioCore không bán và không dùng các dữ liệu này cho mục đích quảng cáo.",
    ],
  },
  {
    title: "2. Cách yêu cầu xóa dữ liệu",
    paragraphs: [
      `Gửi email tới ${MARKETING_CONTACT.email} với tiêu đề "Yêu cầu xóa dữ liệu", hoặc nhắn Zalo / gọi ${MARKETING_CONTACT.phone}.`,
      "Trong yêu cầu, vui lòng ghi: tên Facebook của bạn, tên Fanpage hoặc studio bạn đã nhắn tin, và dữ liệu muốn xóa (toàn bộ hoặc một phần).",
      "Bạn cũng có thể yêu cầu trực tiếp studio mà bạn đã nhắn tin; studio sẽ chuyển yêu cầu cho StudioCore.",
    ],
  },
  {
    title: "3. Thời gian và phạm vi xử lý",
    paragraphs: [
      "Chúng tôi xác nhận đã nhận yêu cầu trong vòng 3 ngày làm việc và hoàn tất việc xóa trong vòng 30 ngày kể từ khi xác minh được người yêu cầu.",
      "Dữ liệu được xóa gồm hội thoại Messenger, tên, ảnh đại diện và mã định danh Messenger của bạn trong StudioCore. Bản sao lưu hệ thống chứa dữ liệu này sẽ được ghi đè trong chu kỳ sao lưu tiếp theo.",
      "Chứng từ mà studio phải giữ theo quy định pháp luật (ví dụ hóa đơn, hợp đồng đã ký) có thể được studio lưu lại trong thời hạn luật yêu cầu.",
    ],
  },
  {
    title: "4. Ngắt kết nối Fanpage (dành cho chủ studio)",
    paragraphs: [
      'Chủ studio có thể ngắt kết nối Fanpage bất kỳ lúc nào trong phần cài đặt Fanpage của Inbox; StudioCore sẽ xóa mã truy cập Fanpage ngay lập tức và ngừng nhận tin nhắn mới.',
      'Bạn cũng có thể gỡ quyền của ứng dụng trong Facebook tại Cài đặt → Tiện ích tích hợp cho doanh nghiệp. Để xóa các hội thoại đã lưu, gửi yêu cầu theo mục 2.',
    ],
  },
];

export default function DataDeletionPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[920px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pháp lý</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Hướng dẫn xóa dữ liệu người dùng
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Áp dụng cho dữ liệu Facebook Messenger và dữ liệu cá nhân lưu trên StudioCore.
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
        <p className="text-sm leading-7 text-muted-foreground">
          Xem thêm{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Chính sách bảo mật
          </Link>
          .
        </p>
      </article>
    </>
  );
}
