import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  title: "Điều khoản sử dụng — StudioCore",
  description:
    "Điều khoản sử dụng nền tảng phần mềm SaaS quản lý studio chụp ảnh & áo cưới StudioCore.",
  path: "/terms",
});

const SECTIONS = [
  {
    title: "1. Phạm vi dịch vụ",
    paragraphs: [
      "StudioCore là nền tảng SaaS (Software as a Service) cung cấp các giải pháp công nghệ toàn diện cho studio ảnh cưới, studio gia đình & bé, nhiếp ảnh gia và các đơn vị cung cấp dịch vụ trang phục cưới tại Việt Nam.",
      "Dịch vụ bao gồm: Hệ thống quản trị quan hệ khách hàng (CRM), quản lý đơn hàng & hợp đồng điện tử ký tay, điều phối lịch chụp chống trùng, quản lý kho váy cưới & đạo cụ qua mã QR, nền tảng giao ảnh trực tuyến PhotoShare Zero-Storage và phân hệ báo cáo tài chính, thuế hộ kinh doanh.",
    ],
  },
  {
    title: "2. Tài khoản và trách nhiệm người dùng",
    paragraphs: [
      "Khách hàng (Chủ studio hoặc người đại diện được ủy quyền) chịu trách nhiệm bảo mật thông tin tài khoản, mật khẩu quản trị và mã PIN của nhân sự trong studio. Mọi hoạt động phát sinh dưới tài khoản của bạn sẽ thuộc trách nhiệm của bạn.",
      "Bạn cam kết cung cấp thông tin trung thực, chính xác khi đăng ký tài khoản và chỉ cấp quyền truy cập hệ thống cho nhân sự hợp pháp của studio theo các vai trò phân quyền (Manager, Sale, Photo, Makeup, Kế toán).",
    ],
  },
  {
    title: "3. Quyền sở hữu dữ liệu",
    paragraphs: [
      "Bạn giữ toàn bộ quyền sở hữu trí tuệ và quyền tài sản đối với toàn bộ dữ liệu bạn đưa vào hệ thống, bao gồm danh sách khách hàng, thông tin đơn hàng, số đo trang phục, bảng giá dịch vụ và các tệp hình ảnh lưu trữ.",
      "StudioCore cam kết không bán, không thương mại hóa, không tiết lộ dữ liệu của khách hàng cho bất kỳ bên thứ ba nào, trừ khi có yêu cầu bằng văn bản từ cơ quan pháp luật có thẩm quyền theo quy định của pháp luật Việt Nam.",
    ],
  },
  {
    title: "4. Gói cước và thanh toán",
    paragraphs: [
      "StudioCore cung cấp chương trình dùng thử miễn phí 30 ngày với đầy đủ tính năng để khách hàng trải nghiệm thực tế. Hết thời gian dùng thử, khách hàng có thể lựa chọn đăng ký một trong các gói dịch vụ (Cơ bản, Pro, Doanh nghiệp) theo biểu phí niêm yết trên website.",
      "Chi phí dịch vụ được thanh toán định kỳ theo chu kỳ 1 tháng, 6 tháng, 12 tháng hoặc theo thỏa thuận hợp đồng dịch vụ. Khi thanh toán thành công, hệ thống sẽ tự động gia hạn thời hạn sử dụng tương ứng.",
    ],
  },
  {
    title: "5. Cam kết chất lượng dịch vụ (SLA)",
    paragraphs: [
      "StudioCore nỗ lực duy trì tính sẵn sàng của hệ thống với mục tiêu thời gian hoạt động (uptime) đạt tối thiểu 99.9%. Hệ thống được sao lưu dữ liệu tự động định kỳ hàng ngày để phòng ngừa rủi ro gián đoạn.",
      "Trong trường hợp cần bảo trì định kỳ, nâng cấp hạ tầng hoặc cập nhật tính năng mới, chúng tôi sẽ thông báo trước qua email hoặc bảng tin thông báo trên ứng dụng.",
    ],
  },
  {
    title: "6. Quy định sử dụng và giới hạn trách nhiệm",
    paragraphs: [
      "Người dùng không được sử dụng StudioCore vào các mục đích vi phạm pháp luật, truyền bá mã độc, tấn công từ chối dịch vụ hoặc cố ý can thiệp vào tính toàn vẹn của hệ thống.",
      "StudioCore không chịu trách nhiệm đối với các tranh chấp phát sinh giữa studio và khách hàng của studio liên quan đến chất lượng sản phẩm chụp ảnh, tranh chấp tiền cọc hoặc thỏa thuận dân sự ngoài phạm vi phần mềm.",
    ],
  },
  {
    title: "7. Hỗ trợ khách hàng và điều chỉnh điều khoản",
    paragraphs: [
      "Đội ngũ hỗ trợ kỹ thuật và chăm sóc khách hàng của StudioCore phục vụ qua Hotline / Zalo: 0976 181 859 và Email: samstudio.hn@gmail.com từ 08:30 đến 21:00 hàng ngày.",
      "StudioCore có quyền điều chỉnh các điều khoản này để phù hợp với định hướng phát triển sản phẩm và quy định pháp luật. Nội dung cập nhật sẽ được thông báo công khai trên website.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-[920px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Pháp lý</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Điều khoản dịch vụ</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Áp dụng từ: 01/11/2026 · Nền tảng quản lý Studio chụp ảnh &amp; Áo cưới StudioCore.
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
