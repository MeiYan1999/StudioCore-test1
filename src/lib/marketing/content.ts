import { getEnv } from "../env";

export const MARKETING_CONTACT = {
  email: "hello@studiocore.demo",
  phone: "028 0000 0001",
  address: "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
  note: "Thông tin liên hệ demo, không phải studio thật.",
};

export const MARKETING_NAV = [
  { href: "/#features", label: "Tính năng" },
  { href: "/pricing", label: "Gói cước" },
  { href: "/blog", label: "Blog" },
  { href: "/guide", label: "Hướng dẫn" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Liên hệ" },
];

export function siteUrl(): string {
  return getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

export type FeatureGroup = {
  key: string;
  title: string;
  description: string;
  icon: string;
  items: { title: string; description: string; icon: string }[];
};

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "business",
    title: "Quản lý kinh doanh",
    description: "Từ lead đến hợp đồng, đơn hàng và lịch chụp trong một nguồn dữ liệu.",
    icon: "briefcase",
    items: [
      { title: "CRM khách hàng", description: "Hồ sơ 360, lịch sử tương tác, công nợ và follow-up.", icon: "users" },
      { title: "Quản lý đơn hàng", description: "Đơn đa dịch vụ, cọc, thanh toán và timeline trạng thái.", icon: "receipt" },
      { title: "Lịch chụp chống trùng", description: "Kiểm tra phòng, photographer, makeup và buffer 30 phút.", icon: "calendar" },
      { title: "Dịch vụ & voucher", description: "Gói chụp, add-on, sản phẩm và mã giảm giá tập trung.", icon: "package" },
    ],
  },
  {
    key: "operations",
    title: "Vận hành và nhân sự",
    description: "Điều phối studio mỗi ngày, quản lý tài nguyên và công việc nội bộ.",
    icon: "layers",
    items: [
      { title: "Kho trang phục QR", description: "SKU, quét QR, thuê/trả và phí giặt/đền bù.", icon: "shirt" },
      { title: "Chấm công", description: "Check-in/out thủ công, GPS hoặc QR; ngày công cho bảng lương.", icon: "clock" },
      { title: "Lương & hoa hồng", description: "Rule snapshot, duyệt commission và khóa kỳ lương.", icon: "banknote" },
      { title: "Công việc nội bộ", description: "Board/list, deadline, assignee, comment và mention.", icon: "check" },
    ],
  },
  {
    key: "finance",
    title: "Tài chính và báo cáo",
    description: "Dòng tiền rõ ràng, công nợ kiểm soát và báo cáo có thể đối soát.",
    icon: "wallet",
    items: [
      { title: "Sổ quỹ thu chi", description: "Giao dịch gắn đơn/khách/chi nhánh, append-only để giữ audit.", icon: "wallet" },
      { title: "Công nợ & tuổi nợ", description: "0–30/31–60/61–90/90+ ngày, nhắc thu, xuất CSV.", icon: "scale" },
      { title: "Hóa đơn VAT", description: "Hóa đơn demo, trạng thái và bản in tiếng Việt.", icon: "file" },
      { title: "Báo cáo doanh thu", description: "Thực thu, dự kiến, chi phí, lợi nhuận và lấp đầy phòng.", icon: "chart" },
    ],
  },
  {
    key: "ai",
    title: "Kết nối và AI",
    description: "Giao ảnh, tích hợp drive và tự động hóa nhẹ nhưng trung thực.",
    icon: "sparkles",
    items: [
      { title: "Google Drive/NAS", description: "Drive demo local; OAuth adapter sẵn sàng khi có credentials.", icon: "cloud" },
      { title: "PhotoShare", description: "Link thả tim/chọn ảnh, ghi chú, copy mã và ZIP + manifest.", icon: "images" },
      { title: "Inbox Fanpage/Zalo", description: "Local inbox, AI auto-reply giới hạn chủ đề và human handoff.", icon: "message" },
      { title: "AI Hub", description: "Heuristic blur/sáng/gần trùng/burst; live provider có consent/cost guard.", icon: "sparkles" },
    ],
  },
];

export const OPERATING_STEPS = [
  {
    number: "01",
    title: "Tạo tài khoản và chi nhánh",
    description: "Đăng ký tenant trial, chi nhánh đầu tiên và tài khoản owner thật.",
    icon: "building",
  },
  {
    number: "02",
    title: "Thêm khách, dịch vụ và nhân sự",
    description: "Chuẩn bị dữ liệu nền, phân vai và chi nhánh làm việc.",
    icon: "users",
  },
  {
    number: "03",
    title: "Tạo đơn và xếp lịch",
    description: "Chống trùng lịch, tính cọc và theo dõi trạng thái sản xuất.",
    icon: "calendar",
  },
  {
    number: "04",
    title: "Giao ảnh và thu thanh toán",
    description: "PhotoShare, lọc mã khách chọn, ZIP + manifest và đối soát công nợ.",
    icon: "images",
  },
];

export const SCREENSHOTS = [
  {
    key: "dashboard",
    path: "/marketing/dashboard.jpg",
    title: "Dashboard tổng quan",
    description: "Doanh thu, công nợ, lịch chụp và trạng thái đơn trong một màn hình.",
    width: 1440,
    height: 810,
  },
  {
    key: "orders",
    path: "/marketing/orders.jpg",
    title: "Quản lý đơn hàng",
    description: "Bộ lọc, trạng thái, thanh toán và timeline đơn hàng.",
    width: 1440,
    height: 810,
  },
  {
    key: "calendar",
    path: "/marketing/calendar.jpg",
    title: "Lịch hẹn và lịch chụp",
    description: "Calendar theo ngày/tuần/tháng, kiểm tra xung đột và check-in.",
    width: 1440,
    height: 810,
  },
  {
    key: "customers",
    path: "/marketing/customers.jpg",
    title: "CRM khách hàng",
    description: "Hồ sơ khách, tương tác, công nợ và task chăm sóc.",
    width: 1440,
    height: 810,
  },
  {
    key: "finance",
    path: "/marketing/finance.jpg",
    title: "Thu chi và tài chính",
    description: "Sổ quỹ, ngân sách, hóa đơn và báo cáo doanh thu.",
    width: 1440,
    height: 810,
  },
];

export const SHOWCASE_TABS = [
  { key: "dashboard", label: "Dashboard", screenshot: "dashboard", description: "Nhìn nhanh sức khỏe studio mỗi ngày." },
  { key: "orders", label: "Đơn hàng", screenshot: "orders", description: "Theo dõi từ cọc đến bàn giao, không bỏ sót trạng thái." },
  { key: "finance", label: "Chi phí", screenshot: "finance", description: "Thu chi, công nợ và lợi nhuận tạm tính có thể đối soát." },
  { key: "calendar", label: "Lịch chụp", screenshot: "calendar", description: "Xếp lịch an toàn theo phòng và nhân sự." },
];

export type Plan = {
  key: string;
  name: string;
  monthly: number;
  yearly: number;
  description: string;
  featured?: boolean;
  features: string[];
  cta: string;
  href: string;
};

export const PLANS: Plan[] = [
  {
    key: "trial",
    name: "Dùng thử",
    monthly: 0,
    yearly: 0,
    description: "Trải nghiệm đầy đủ luồng demo trong 14 ngày.",
    features: ["1 chi nhánh", "Tối đa 3 nhân sự", "CRM, đơn hàng, lịch chụp", "PhotoShare giới hạn"],
    cta: "Bắt đầu miễn phí",
    href: "/register",
  },
  {
    key: "basic",
    name: "Vận hành cơ bản",
    monthly: 499_000,
    yearly: 4_990_000,
    description: "Cho studio nhỏ cần quản lý khách, lịch và tài chính.",
    features: ["1 chi nhánh", "10 nhân sự", "CRM, đơn hàng, lịch", "Sổ quỹ, công nợ", "PhotoShare 5 album"],
    cta: "Tư vấn gói cơ bản",
    href: "/contact?plan=basic",
  },
  {
    key: "pro",
    name: "Chuyên nghiệp",
    monthly: 999_000,
    yearly: 9_990_000,
    description: "Phù hợp studio đang mở rộng, cần vận hành và báo cáo.",
    featured: true,
    features: ["3 chi nhánh", "30 nhân sự", "Toàn bộ CRM/đơn/lịch", "PhotoShare, Drive, filter", "Lương, hoa hồng, báo cáo", "AI Hub local"],
    cta: "Chọn gói Pro",
    href: "/register?plan=pro",
  },
  {
    key: "business",
    name: "Doanh nghiệp",
    monthly: 1_999_000,
    yearly: 19_990_000,
    description: "Cho chuỗi studio cần nhiều chi nhánh và kiểm soát sâu.",
    features: ["Chi nhánh không giới hạn", "Nhân sự không giới hạn", "Tích hợp Drive/AI mở rộng", "Audit, backup, phân quyền", "Hỗ trợ onboarding"],
    cta: "Liên hệ doanh nghiệp",
    href: "/contact?plan=business",
  },
];

export const PRICING_COMPARISON = [
  { feature: "Chi nhánh", trial: "1", basic: "1", pro: "3", business: "Không giới hạn" },
  { feature: "Nhân sự", trial: "3", basic: "10", pro: "30", business: "Không giới hạn" },
  { feature: "CRM & đơn hàng", trial: "Có", basic: "Có", pro: "Có", business: "Có" },
  { feature: "Lịch chống trùng", trial: "Có", basic: "Có", pro: "Có", business: "Có" },
  { feature: "PhotoShare", trial: "5 album", basic: "20 album", pro: "Không giới hạn", business: "Không giới hạn" },
  { feature: "Lọc mã ảnh + ZIP", trial: "Dùng thử", basic: "Có", pro: "Có", business: "Có" },
  { feature: "Lương/hoa hồng", trial: "—", basic: "—", pro: "Có", business: "Có" },
  { feature: "Báo cáo nâng cao", trial: "Cơ bản", basic: "Cơ bản", pro: "Đầy đủ", business: "Đầy đủ" },
  { feature: "Audit & backup", trial: "—", basic: "—", pro: "Có", business: "Có" },
  { feature: "AI Hub", trial: "Local", basic: "Local", pro: "Local", business: "Local + live (cấu hình)" },
];

export const FAQS = [
  {
    question: "StudioCore có miễn phí không?",
    answer:
      "Có gói dùng thử 14 ngày và bản demo read-only. Giá trên trang pricing là giá demo, chưa phải báo giá chính thức; hãy liên hệ để chốt gói phù hợp.",
  },
  {
    question: "Tôi cần kiến thức kỹ thuật để dùng không?",
    answer:
      "Không. Giao diện tiếng Việt, form có hướng dẫn và dữ liệu mẫu giúp bắt đầu nhanh. Phần cài đặt local cần làm theo README nếu bạn tự triển khai.",
  },
  {
    question: "Nhân viên có dùng được không?",
    answer:
      "Có. Hệ thống có phân quyền owner, quản lý, lễ tân, photographer, makeup, retoucher, kế toán; kiểm tra quyền ở server, không chỉ ẩn nút.",
  },
  {
    question: "Dữ liệu của tôi có bảo mật không?",
    answer:
      "Bản demo chạy local với SQLite và session httpOnly. Production cần private storage, HTTPS, backup và cấu hình secret riêng; không dùng dữ liệu khách thật trong seed.",
  },
  {
    question: "PhotoShare hoạt động thế nào?",
    answer:
      "Studio tạo album, gửi link có token/mật khẩu/hạn dùng cho khách. Khách thả tim, chọn ảnh và ghi chú; studio nhận selection, lọc file gốc theo mã và xuất ZIP kèm manifest.",
  },
  {
    question: "Hỗ trợ liên hệ ở đâu?",
    answer:
      "Dùng form liên hệ trên website hoặc thông tin demo ở footer. Đây là môi trường demo, không có tổng đài thật.",
  },
  {
    question: "Dùng trên điện thoại được không?",
    answer:
      "Có. Landing, PhotoShare và các màn hình vận hành chính được kiểm tra ở 375–1440px; bảng dữ liệu cho phép cuộn ngang trên mobile.",
  },
  {
    question: "Sau thời gian dùng thử thì sao?",
    answer:
      "Bạn có thể chọn gói phù hợp hoặc dừng dùng. Bản demo hiện chưa có thanh toán thật; đội ngũ sẽ tư vấn thủ công.",
  },
];

export const TESTIMONIALS = [
  {
    name: "Studio Hoa Nắng",
    role: "Studio cưới · dữ liệu demo",
    quote:
      "Trước đây lịch chụp nằm trong nhiều file. Bản demo StudioCore gom khách, đơn và lịch vào một chỗ, đỡ phải hỏi lại nhau mỗi ngày.",
    result: "Mô phỏng quy trình 3 chi nhánh",
  },
  {
    name: "Ảnh Viên Studio",
    role: "Studio gia đình · dữ liệu demo",
    quote:
      "Phần PhotoShare là điểm mình thích nhất: khách tự chọn và ghi chú, studio chỉ cần copy mã hoặc xuất manifest để lọc ảnh.",
    result: "Mô phỏng giao ảnh theo mã",
  },
  {
    name: "Mây Studio",
    role: "Studio baby · dữ liệu demo",
    quote:
      "Báo cáo công nợ và tuổi nợ giúp nhìn rõ đơn nào cần nhắc thu. Đây là đánh giá mô phỏng cho môi trường demo, không phải khách thật.",
    result: "Mô phỏng báo cáo công nợ",
  },
];

export const GUIDES = [
  { title: "Bắt đầu với StudioCore", description: "Tạo tenant, chi nhánh, owner và cấu hình studio.", icon: "rocket", href: "/guide#bat-dau" },
  { title: "Quản lý đơn hàng", description: "Tạo đơn, thu cọc, theo dõi trạng thái và công nợ.", icon: "receipt", href: "/guide#don-hang" },
  { title: "CRM khách hàng", description: "Hồ sơ 360, tương tác, phân khúc và task chăm sóc.", icon: "users", href: "/guide#crm" },
  { title: "Lịch chụp chống trùng", description: "Phòng, photographer, buffer và check-in.", icon: "calendar", href: "/guide#lich-chup" },
  { title: "PhotoShare & lọc ảnh", description: "Gửi link, nhận selection, lọc mã và ZIP manifest.", icon: "images", href: "/guide#photoshare" },
  { title: "Tài chính & báo cáo", description: "Sổ quỹ, hóa đơn, công nợ, lương và báo cáo.", icon: "wallet", href: "/guide#tai-chinh" },
];

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readMinutes: number;
  sections: { heading?: string; paragraphs: string[] }[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "checklist-van-hanh-studio-chup-anh",
    title: "Checklist vận hành studio chụp ảnh từ lead đến giao ảnh",
    description:
      "Một checklist thực tế để studio không bỏ sót bước từ tư vấn, cọc, lịch chụp đến giao ảnh và thu phần còn lại.",
    category: "Vận hành",
    date: "2026-11-01",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Một studio nhỏ thường bắt đầu bằng sổ tay, tin nhắn và vài file Excel. Khi lượng khách tăng, vấn đề không còn là chụp đẹp mà là thông tin nằm rải rác. Checklist dưới đây giúp chuẩn hóa luồng làm việc mà không cần thay đổi toàn bộ cách vận hành ngay lập tức.",
        ],
      },
      {
        heading: "1. Tư vấn và lưu lead",
        paragraphs: [
          "Ghi tên, số điện thoại, nguồn khách và nhu cầu chính. Đặt lịch follow-up thay vì chỉ nhắn một lần. Một lead không phản hồi hôm nay có thể quay lại sau hai tuần nếu studio còn thông tin để chăm sóc.",
          "Nếu khách đã có trong hệ thống, kiểm tra lịch sử tương tác và công nợ trước khi báo giá để tránh tư vấn trùng hoặc bỏ qua ưu đãi cũ.",
        ],
      },
      {
        heading: "2. Tạo đơn và thu cọc",
        paragraphs: [
          "Đơn hàng cần có dịch vụ, số lượng, đơn giá, phụ thu và giảm giá rõ ràng. Ghi nhận cọc ngay khi nhận tiền, kèm phương thức và tham chiếu. Phần còn lại phải được nhìn thấy trên hồ sơ khách và báo cáo công nợ.",
          "Không nên ghi cọc bằng một ghi chú rời. Khi có nhiều đơn trong ngày, ghi chú rời rất dễ thất lạc và làm sai số tiền còn lại.",
        ],
      },
      {
        heading: "3. Xếp lịch và kiểm tra tài nguyên",
        paragraphs: [
          "Trước khi xác nhận giờ chụp, kiểm tra phòng, photographer, makeup và editor nếu có. Cần buffer giữa hai ca để tránh khách trước về muộn làm lệch toàn bộ ngày.",
          "Check-in/check-out giúp biết buổi chụp thực tế bắt đầu và kết thúc khi nào, làm dữ liệu cho chấm công và lịch sử sử dụng thiết bị.",
        ],
      },
      {
        heading: "4. Giao ảnh và thu phần còn lại",
        paragraphs: [
          "Tạo album, gửi link PhotoShare có mật khẩu hoặc hạn dùng nếu cần. Khách chọn ảnh, thả tim và ghi chú. Studio khóa selection, copy mã hoặc lọc file gốc theo mã khách đã chọn.",
          "Khi bàn giao, xuất ZIP kèm manifest để đối chiếu. Thu phần còn lại, cập nhật trạng thái đơn và gửi yêu cầu đánh giá. Sau đó đối soát doanh thu, công nợ và hoa hồng trong báo cáo.",
        ],
      },
    ],
  },
  {
    slug: "giam-trung-lich-chup-studio",
    title: "Cách giảm trùng lịch chụp khi studio có nhiều nhân sự",
    description:
      "Trùng photographer, phòng hoặc makeup thường đến từ kiểm tra thủ công. Đây là cách xử lý bằng dữ liệu và thứ tự ưu tiên.",
    category: "Lịch chụp",
    date: "2026-10-28",
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          "Trùng lịch không chỉ gây khó chịu cho khách. Nó làm photographer phải chạy giữa hai buổi, makeup không kịp chuẩn bị và doanh thu có thể bị giảm vì phải dời lịch. Với studio có nhiều chi nhánh, kiểm tra bằng mắt gần như không thể chính xác.",
        ],
      },
      {
        heading: "Kiểm tra theo từng tài nguyên",
        paragraphs: [
          "Một buổi chụp cần phòng, photographer và có thể cả makeup/editor. Mỗi tài nguyên có lịch riêng. Nếu chỉ kiểm tra photographer, studio có thể bỏ sót phòng đã bị giữ hoặc makeup đang ở chi nhánh khác.",
          "Dùng buffer 30 phút giữa hai ca để dọn phòng, đổi ánh sáng và tránh khách trước kéo dài. Buffer phải được tính trong kiểm tra xung đột, không chỉ hiển thị trên giao diện.",
        ],
      },
      {
        heading: "Khóa dữ liệu khi xác nhận",
        paragraphs: [
          "Kiểm tra rồi mới ghi là chưa đủ nếu hai người thao tác cùng lúc. Cần transaction và khóa theo tài nguyên/khung giờ để một yêu cầu thành công, yêu cầu còn lại nhận lỗi rõ ràng.",
          "Khi xung đột, trả về khung giờ trống gợi ý thay vì chỉ báo lỗi. Lễ tân có thể chọn ngay một slot khác mà không phải mở lịch thủ công.",
        ],
      },
      {
        heading: "Theo dõi sau khi chạy",
        paragraphs: [
          "Ghi nhận lý do đổi/hủy lịch để biết khung giờ nào thường xuyên bị dời. Báo cáo lấp đầy phòng giúp quyết định có cần mở thêm ca hoặc thêm phòng vào cuối tuần hay không.",
        ],
      },
    ],
  },
  {
    slug: "photoshare-quy-trinh-giao-anh",
    title: "PhotoShare: quy trình giao ảnh ít thao tác cho studio",
    description:
      "Từ link thả tim đến ZIP + manifest: cách giảm qua lại khi khách chọn ảnh và studio lọc file gốc.",
    category: "PhotoShare",
    date: "2026-10-20",
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          "Giao ảnh thủ công thường gồm nhiều bước: gửi folder, nhận danh sách bằng tin nhắn, đối chiếu tên file và copy từng ảnh. PhotoShare biến các bước này thành một luồng có mã ảnh ổn định và dữ liệu lựa chọn lưu ở server.",
        ],
      },
      {
        heading: "Chuẩn bị album",
        paragraphs: [
          "Studio tạo album từ Drive/NAS hoặc upload, chia folder con và đặt quota ảnh khách được chọn. Nên bật phí ảnh thêm nếu studio có thu phí vượt quota; nếu không, để tắt để tránh khách hiểu nhầm.",
          "Mỗi ảnh có mã ổn định và ảnh preview có watermark. Không dùng số thứ tự dễ lệch khi danh sách thay đổi.",
        ],
      },
      {
        heading: "Khách chọn ảnh",
        paragraphs: [
          "Khách mở link, xem theo folder, thả tim và ghi chú từng ảnh. Hệ thống hiển thị số ảnh đã chọn trên quota. Khi vượt quota, khách thấy số ảnh vượt và phí trước khi gửi; phí được ghi nhận vào yêu cầu thanh toán, không chỉ hiện trên giao diện.",
          "Studio có thể khóa selection sau khi khách gửi để tránh thay đổi ngoài ý muốn. Link có thể đặt mật khẩu, hạn dùng, giới hạn tải và thu hồi.",
        ],
      },
      {
        heading: "Lọc file gốc",
        paragraphs: [
          "Sau khi khách gửi, studio copy danh sách mã ở 4 định dạng hoặc mở trang lọc. Trang lọc đọc folder ảnh gốc trên máy, so khớp basename hoặc chỉ số, đánh dấu missing/ambiguous và chỉ copy khi người dùng xác nhận.",
          "Kết quả gồm manifest.csv và missing.txt. Với fallback ZIP, studio tải gói kết quả về thay vì để server giả đọc ổ đĩa của khách.",
        ],
      },
      {
        heading: "Bàn giao và đối soát",
        paragraphs: [
          "Xuất ZIP ảnh khách đã chọn kèm manifest, ghi nhận thanh toán phần còn lại và hoàn tất đơn. Nếu có phí ảnh thêm, kiểm tra payment request tương ứng trong chi tiết album trước khi chốt.",
        ],
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export const SOLUTION_PAGES = {
  studio: {
    path: "/phan-mem-quan-ly-studio",
    title: "Phần mềm quản lý studio chụp ảnh",
    description:
      "StudioCore gom CRM, đơn hàng, lịch chụp, album, PhotoShare và tài chính vào một hệ thống cho studio Việt Nam.",
    eyebrow: "Giải pháp all-in-one",
    h1: "Điều hành studio từ lead đến giao ảnh trong một hệ thống",
    intro:
      "Không cần ghép nhiều file rời. StudioCore giữ khách, đơn, lịch, ảnh và dòng tiền trong cùng một nguồn dữ liệu, có phân quyền và kiểm tra ở server.",
    problems: [
      "Doanh thu, công nợ và chi phí nằm ở nhiều nơi.",
      "Lịch chụp trùng phòng hoặc photographer.",
      "Ảnh giao thủ công, mã ảnh không thống nhất.",
      "Nhân sự khó biết việc nào cần làm tiếp theo.",
    ],
    outcomes: [
      "Một hồ sơ khách 360 với đơn, album, task và công nợ.",
      "Lịch chụp transaction, buffer và slot gợi ý.",
      "PhotoShare + lọc mã + ZIP manifest cho giao ảnh.",
      "Sổ quỹ, báo cáo và audit cho quản trị.",
    ],
  },
  crm: {
    path: "/crm-studio-chup-anh",
    title: "CRM studio chụp ảnh",
    description:
      "Quản lý lead, lịch sử tư vấn, follow-up, công nợ và task chăm sóc khách trong một CRM dành cho studio ảnh.",
    eyebrow: "CRM chuyên ngành",
    h1: "CRM hiểu studio ảnh, không chỉ là danh bạ",
    intro:
      "Mỗi khách có lịch sử tương tác, đơn hàng, album và công nợ. Lễ tân và chủ studio nhìn cùng một dữ liệu, nhưng quyền thao tác được kiểm tra ở server.",
    problems: [
      "Lead đến từ nhiều kênh nhưng không có người theo dõi.",
      "Thông tin tư vấn cũ nằm trong tin nhắn cá nhân.",
      "Không biết khách còn công nợ hay đã lâu chưa quay lại.",
      "Task chăm sóc bị quên sau vài ngày.",
    ],
    outcomes: [
      "Hồ sơ khách với nguồn, hạng, tag và người phụ trách.",
      "Timeline tương tác và cảnh báo follow-up.",
      "Phân khúc VIP/mới/nguy cơ rời bỏ/sinh nhật/công nợ.",
      "Task chăm sóc hiển thị ở board và hồ sơ khách.",
    ],
  },
} as const;
