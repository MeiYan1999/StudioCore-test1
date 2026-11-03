Bạn là Principal Full-stack Engineer, UI/UX Lead và AI Systems Architect.

NHIỆM VỤ TỐI THƯỢNG
Xây dựng "StudioCore" — nền tảng SaaS quản lý studio chụp ảnh all-in-one, tương đương về năng lực và trải nghiệm với StudioBase.vn, chạy được thực tế tại thị trường Việt Nam.

Sản phẩm phải có:
- Landing page và website công khai hoàn chỉnh.
- Auth UI và ứng dụng quản trị nội bộ.
- Multi-tenant, đa chi nhánh, phân quyền chi tiết.
- Database migration, seed dữ liệu demo thuần Việt, tài khoản demo theo từng vai trò.
- Quy trình nghiệp vụ end-to-end từ lead đến giao ảnh và quyết toán.
- Giao diện tiếng Việt hiện đại, responsive, dễ dùng cho lễ tân, photographer, editor và kế toán.
- Adapter local-first để chạy demo không cần API key, sẵn sàng chuyển production.
- Kiểm thử thực chất, không chỉ compile.

PHẦN 0 — CÁC ĐIỀU KHOẢN BẤT BIẾN

0.1. EXECUTION PROTOCOL — CHỐNG QUÁ TẢI CONTEXT
- Bắt buộc tạo `PLAN.md` và `PROGRESS.md` trước khi viết code tính năng.
- `PROGRESS.md` là checklist `[ ]` gồm:
  - Phase hiện tại.
  - Module/tính năng đang làm.
  - File đã hoàn thành.
  - Việc còn lại.
  - Kết quả kiểm tra.
- Chỉ triển khai một phase tại một thời điểm. Không sinh toàn bộ dự án trong một lượt.
- Mỗi phase phải:
  1. Hoàn thành code của phase đó, không để placeholder.
  2. Chạy lint, typecheck, build nếu phase đã có route chạy được.
  3. Cập nhật `PROGRESS.md`.
  4. Báo cáo ngắn: đã làm gì, file nào, test gì, còn gì.
- Nếu context gần đầy:
  - Dừng ở ranh giới phase, không dừng giữa file.
  - Ghi trạng thái chính xác vào `PROGRESS.md`.
  - Lần tiếp theo đọc `PROGRESS.md` và tiếp tục từ đúng điểm dừng.
- Không đánh dấu `[x]` nếu chưa kiểm tra thực tế.
- Không chuyển phase khi còn lỗi build, route placeholder hoặc nút không có handler.

0.2. SANDBOX LOCAL-FIRST — KHÔNG ĐỂ CODE BỊ TẮC NGHẼN
- Ứng dụng phải chạy đầy đủ khi chưa có API key bên thứ ba.
- Storage local mặc định:
  - Lưu ảnh demo vào `/public/uploads/<tenant>/<album>/`.
  - Tự động tạo thư mục nếu chưa có.
  - Chỉ dùng ảnh demo/synthetic; không dùng PII hoặc ảnh khách thật.
  - Thêm `.gitignore` cho file upload phát sinh.
- PhotoShare trong sandbox được đọc ảnh từ `/public/uploads`, nhưng phải ghi rõ đây là môi trường demo.
- Production không được dùng `/public/uploads` cho ảnh khách thật; phải chuyển Storage Adapter sang private storage + signed URL hoặc route kiểm tra quyền.
- Payment sandbox:
  - Tạo trang giả lập thanh toán, ví dụ `/manage/settings/payments/sandbox`.
  - Hiển thị mã đơn, số tiền, nội dung chuyển khoản và VietQR.
  - Có nút "Xác nhận chuyển khoản thành công".
  - Nút gọi endpoint nội bộ `/api/mock/webhook/payment`.
  - Endpoint chỉ bật khi `NODE_ENV !== "production"`.
  - Webhook phải có secret/signature, idempotency key và chống replay.
  - Production phải tắt hoàn toàn endpoint giả lập.
- Messaging sandbox:
  - Ghi log ra terminal và lưu vào bảng `notifications`.
  - Không gọi mạng thật nếu chưa cấu hình.
- AI sandbox:
  - Dùng heuristic/rule-based hoặc sharp/OpenCV nếu có.
  - Ghi rõ kết quả là heuristic, không giả vờ là AI chính xác tuyệt đối.
- Không gọi API bên thứ ba ở module scope, lúc build hoặc lúc khởi động.
- Mọi adapter live phải lazy-init, có timeout, retry có kiểm soát và hiển thị lỗi rõ ràng.
- Nếu thiếu credentials, UI hiển thị "chưa cấu hình", app vẫn chạy bình thường.

0.3. ZERO-PLACEHOLDER — CẤM TUYỆT ĐỐI
- CẤM các đoạn mã rút gọn:
  - `// TODO: implement later`
  - `// ...existing code...`
  - `/* rest of logic */`
  - `throw new Error("Not implemented")` trong luồng chính.
- CẤM nút bấm giả:
  - `onClick={() => {}}`
  - Handler rỗng.
  - Form không có action hoặc action không xử lý dữ liệu.
- CẤM route trả về:
  - `<div>Coming soon</div>`
  - Trang trống không có chức năng.
  - Dữ liệu hard-code trong component thay vì đọc DB.
- Mọi tương tác chính phải có:
  - Server Action hoặc API Handler.
  - Validate input.
  - Kiểm tra session + permission.
  - Ghi/đọc database thật.
  - Trạng thái loading, success, error.
  - Audit log nếu là thao tác nhạy cảm.
- Nếu một tính năng chưa hỗ trợ:
  - Không render nút.
  - Hoặc render disabled kèm lý do rõ ràng.
  - Tuyệt đối không giả vờ thành công.
- Trước khi kết thúc phase, grep các chuỗi `TODO`, `Coming soon`, `Not implemented`, `onClick={() => {}}`; nếu còn trong luồng chính thì chưa hoàn thành.

0.4. DATABASE TRANSACTION LOCK — AN TOÀN CONCURRENCY
- Mọi thao tác tạo/sửa booking phải nằm trong transaction ghi.
- Không dùng pattern "đọc kiểm tra rồi insert" ngoài transaction.
- Khóa theo các khóa logic:
  - `(tenant_id, branch_id, room_id, slot)`
  - `(tenant_id, branch_id, staff_id, slot)`
- Kiểm tra overlap trong cùng transaction, bao gồm buffer 30 phút giữa hai ca.
- SQLite:
  - Dùng transaction ghi `BEGIN IMMEDIATE`.
  - Bổ sung mutex tiến trình theo khóa resource + slot nếu chạy nhiều request đồng thời trong cùng process.
  - Xử lý `SQLITE_BUSY` bằng retry ngắn và trả lỗi thân thiện.
- PostgreSQL:
  - Dùng exclusion constraint trên khoảng thời gian (`tstzrange` + `btree_gist`) cho phòng và nhân sự.
  - Hoặc advisory lock theo resource + slot.
- Booking phải có idempotency key để tránh tạo trùng khi client retry.
- Khi xung đột:
  - Trả HTTP 409 hoặc lỗi nghiệp vụ rõ ràng.
  - Gợi ý slot trống khác.
  - Không ghi đè lịch đã tồn tại.
- Bắt buộc có test:
  - Hai request đồng thời đặt cùng slot.
  - Kết quả: một request thành công, một request bị từ chối.
  - Không có bản ghi trùng trong database.
- Không tuyên bố "an toàn tuyệt đối" chỉ dựa vào mutex trong RAM. Phải có ràng buộc database, transaction và test đồng thời làm bằng chứng.

NGUYÊN TẮC SẢN PHẨM

1. FEATURE PARITY, ORIGINAL IMPLEMENTATION
- Tái hiện năng lực sản phẩm và information architecture.
- Không sao chép mã nguồn, file thiết kế, hình ảnh thương hiệu, nội dung marketing nguyên văn hoặc dữ liệu khách hàng của bên thứ ba.
- Chỉ nghiên cứu thông tin công khai. Không truy cập, scrape hoặc tái tạo vùng quản trị nội bộ của bên thứ ba.
- Dùng branding, nội dung và asset có quyền sử dụng.

2. SERVER-SIDE SECURITY
- Menu ẩn/hiện chỉ là UX.
- Mọi mutation, data fetching, export, download và API route phải kiểm tra session + permission ở server.
- Người không có quyền nhận HTTP 403 hoặc redirect an toàn.
- Mọi query phải scope theo tenant và chi nhánh được phép.
- Không tin dữ liệu client. Validate lại toàn bộ input ở server.

3. DATA INTEGRITY
- Tiền lưu dạng số nguyên VND; không dùng float.
- Timestamp lưu UTC; hiển thị theo Asia/Ho_Chi_Minh.
- Ngày hiển thị dd/MM/yyyy; giờ 24h.
- Mọi phép tính tiền, công nợ, hoa hồng, lương phải tính ở server.
- Migration có thể chạy lại; seed phải idempotent, không nhân đôi dữ liệu.
- Webhook thanh toán phải idempotent, không cộng tiền hai lần.

4. KHÔNG SECRET, KHÔNG THAO TÁC NGUY HIỂM
- Không đưa secret thật vào repo. Dùng `.env.local` và `.env.example`.
- Không tự commit, push, deploy hoặc xóa dữ liệu ngoài phạm vi được yêu cầu.
- Không dùng PII thật trong seed hoặc test.
- Không log token, PIN, mật khẩu, API key hoặc dữ liệu thanh toán nhạy cảm.

5. TIẾNG VIỆT LÀ MẶC ĐỊNH
- Copy, metadata, thông báo lỗi, email mẫu, hóa đơn và hợp đồng dùng tiếng Việt.
- Định dạng tiền VND, số điện thoại Việt Nam, địa chỉ Việt Nam.

6. KHÔNG PHÁ VỠ CÔNG VIỆC HIỆN CÓ
- Khảo sát repo trước khi sửa.
- Tận dụng stack, component và dữ liệu hiện có nếu tương đương.
- Không rewrite toàn bộ nếu chỉ cần mở rộng.
- Migration phải additive; không xóa cột/bảng khi chưa có phương án rollback.
- Trước thao tác có khả năng mất dữ liệu, phải dừng và xác nhận.

ƯU TIÊN TRIỂN KHAI
P0 — Bắt buộc, chạy end-to-end:
- Auth, tenant, branch, RBAC.
- Dashboard.
- CRM.
- Dịch vụ, đơn hàng, thanh toán.
- Lịch chụp và chống trùng lịch.
- Album, upload, PhotoShare, ZIP + manifest.
- Tài chính cơ bản, công nợ, VietQR, webhook mock.
- Seed, demo accounts, kiểm thử.

P1 — Hoàn thiện vận hành:
- Kho trang phục QR.
- Hợp đồng, phiếu thu, hóa đơn.
- HR, chấm công, lương, hoa hồng.
- Tasks, tài liệu, thông báo, audit log.
- Báo cáo nâng cao, xuất CSV/PDF.
- Google Drive adapter, AI Hub, PhotoShare nâng cao.
- Tạo album từ Drive/NAS, link thả tim, copy mã ảnh.
- Lọc ảnh theo mã khách chọn từ folder máy tính.

P2 — Hoàn thiện sản phẩm SaaS:
- Landing page, website marketing, pricing, blog, guide, legal, SEO.
- Campaigns, inbox Fanpage/Zalo, AI auto-reply, phân tích quảng cáo.
- Báo cáo thuế mức demo.
- Multi-tenant onboarding.
- Responsive QA, accessibility, performance.
- Tài liệu bàn giao và checklist nghiệm thu.

Không được bỏ P0/P1/P2; chỉ triển khai theo thứ tự P0 → P1 → P2.

PHẠM VI CHỨC NĂNG CHI TIẾT

A. WEBSITE CÔNG KHAI VÀ LANDING PAGE — ĐẶC TẢ CHI TIẾT

A.0. MỤC TIÊU VÀ GIỚI HẠN
- Landing page phải tạo cảm giác tin cậy, chuyên nghiệp, hiện đại và phù hợp studio ảnh Việt Nam.
- Tái hiện cấu trúc, nhịp điệu và trải nghiệm tương đương StudioBase.vn.
- Không sao chép nguyên văn nội dung marketing, logo, hình ảnh, mã nguồn hoặc asset độc quyền.
- Dùng branding StudioCore, copy tiếng Việt được viết lại, ảnh sản phẩm lấy từ chính ứng dụng StudioCore.
- Không bịa số liệu khách hàng, logo đối tác hoặc testimonial. Nếu chưa có dữ liệu thật, dùng nội dung demo có nhãn rõ ràng hoặc bỏ trống.
- Không dùng ảnh người thật nếu chưa có quyền; có thể dùng avatar chữ cái, minh họa hoặc ảnh có giấy phép.
- Landing page phải là sản phẩm chạy được, không phải mockup tĩnh.

A.1. ROUTE VÀ PAGE MAP
- `/`: landing page chính.
- `/phan-mem-quan-ly-studio`: trang giải pháp quản lý studio.
- `/crm-studio-chup-anh`: trang giải pháp CRM studio.
- `/pricing`: bảng giá và so sánh gói.
- `/guide`: thư viện hướng dẫn.
- `/blog`: danh sách bài viết.
- `/blog/[slug]`: bài viết chi tiết.
- `/terms`: điều khoản sử dụng.
- `/privacy`: chính sách bảo mật.
- `/login`: đăng nhập.
- `/register`: đăng ký dùng thử.
- `/reset-password`: quên/đặt lại mật khẩu.
- `/demo`: chế độ xem demo read-only, không cần đăng ký.
- `/contact`: liên hệ hoặc form tư vấn nếu cần.

A.2. DESIGN SYSTEM
- Phong cách: SaaS hiện đại, sáng, sạch, nhiều khoảng trắng, ảnh studio là trung tâm.
- Nền: trắng và off-white.
- Primary: xanh navy/xanh dương tin cậy.
- Accent: cam ấm hoặc teal để làm nổi CTA.
- Text: slate đậm cho tiêu đề, slate nhạt cho mô tả.
- Border: xám nhạt, mảnh.
- Card: bo góc 12–16px, shadow nhẹ, hover nâng nhẹ.
- Typography: Be Vietnam Pro, Inter hoặc font hỗ trợ tiếng Việt tốt.
- Container: 1200–1280px.
- Spacing: hệ 8px.
- Nút: primary filled, secondary outline, ghost.
- Icon: Lucide, thống nhất stroke.
- Ảnh: tỷ lệ 16:9 hoặc 4:3, tối ưu WebP/AVIF, lazy load.
- Không dùng gradient quá rực hoặc hiệu ứng nặng.

A.3. CẤU TRÚC LANDING PAGE

1. HEADER
- Sticky header, nền trắng, shadow nhẹ khi scroll.
- Logo StudioCore bên trái.
- Menu:
  - Tính năng.
  - Gói cước.
  - Blog.
  - Hướng dẫn.
  - FAQ.
  - Liên hệ.
- Bên phải:
  - "Đăng nhập".
  - CTA "Đăng ký dùng thử".
- Mobile:
  - Hamburger menu.
  - Drawer trượt.
  - CTA cố định hoặc dễ thấy.
- Anchor link cuộn mượt đến section.
- Header không che nội dung khi scroll.

2. HERO SECTION
- Layout 2 cột desktop:
  - Trái: nội dung.
  - Phải: ảnh dashboard + card PhotoShare.
- Nội dung trái:
  - Eyebrow/badge: "Nền tảng quản lý studio all-in-one".
  - H1 nêu rõ giá trị: quản lý studio, CRM, lịch chụp và giao ảnh trong một hệ thống.
  - Subheadline 2–3 dòng.
  - CTA chính: "Dùng thử miễn phí".
  - CTA phụ: "Xem demo".
  - Trust bullets: không cần thẻ tín dụng, dữ liệu bảo mật, hỗ trợ tiếng Việt.
- Visual phải:
  - Ảnh dashboard thật của StudioCore.
  - Card nổi PhotoShare với ảnh, tim/chọn ảnh, mã ảnh.
  - Có thể thêm badge nhỏ "PhotoShare".
- Social proof dưới hero:
  - Số studio, số ảnh đã giao, đánh giá.
  - Chỉ dùng số liệu thật hoặc gắn nhãn demo.
- Mobile:
  - Nội dung xếp dọc.
  - CTA full-width.
  - Ảnh sản phẩm nằm dưới nội dung.

3. PAIN POINT → GIẢI PHÁP
- Tiêu đề: "Bạn đang gặp những vấn đề này?"
- Hai cột:
  - "Vấn đề của chủ studio":
    - Doanh thu, công nợ không rõ.
    - Lịch chụp trùng.
    - Khó theo dõi nhân viên.
  - "Vấn đề của nhân viên":
    - Nhập liệu lặp lại.
    - Tìm thông tin khách chậm.
    - Giao ảnh thủ công.
- Bên dưới:
  - "StudioCore giải quyết tất cả."
  - 3–4 giá trị: một nguồn dữ liệu, tự động hóa, báo cáo realtime, PhotoShare.

4. CÁC BƯỚC VẬN HÀNH
- Tiêu đề: "Vài bước để đi vào vận hành."
- 3–4 bước:
  1. Tạo tài khoản và chi nhánh.
  2. Thêm khách, dịch vụ và nhân sự.
  3. Tạo đơn và xếp lịch.
  4. Giao ảnh qua PhotoShare và thu thanh toán.
- Mỗi bước có số thứ tự, icon, mô tả ngắn.
- Có thể dùng timeline ngang desktop, dọc mobile.

5. TÍNH NĂNG NỔI BẬT
- Tiêu đề: "Hơn 20 tính năng cho mọi nhu cầu."
- Chia 4 nhóm:
  - Quản lý kinh doanh:
    - CRM khách hàng.
    - Quản lý đơn hàng.
    - Lịch chụp.
    - Sản phẩm/dịch vụ.
  - Vận hành và nhân sự:
    - Kho trang phục QR.
    - Chấm công.
    - Lương/hoa hồng.
    - Task.
  - Tài chính và báo cáo:
    - Thu chi.
    - Công nợ.
    - Hóa đơn.
    - Báo cáo doanh thu.
  - Kết nối và AI:
    - Google Drive.
    - PhotoShare.
    - Inbox Fanpage/Zalo.
    - AI Hub.
- Mỗi nhóm có 4–6 feature card.
- Card gồm icon, tiêu đề, mô tả 1–2 dòng.
- Có link "Xem tất cả tính năng".

6. PRODUCT SHOWCASE
- Tiêu đề: "Một nền tảng. Mọi hoạt động."
- Tabs:
  - Dashboard.
  - Đơn hàng.
  - Chi phí.
  - Lịch chụp.
- Click tab đổi ảnh screenshot tương ứng.
- Ảnh lớn, có khung trình duyệt hoặc card nổi.
- Có CTA "Mở demo chỉ xem — không cần đăng ký".
- Demo read-only:
  - Banner "Đây là dữ liệu demo".
  - Không cho sửa/xóa.
  - CTA đăng ký ở cuối.

7. SCREENSHOT GALLERY
- Tiêu đề: "Trực quan, dễ sử dụng."
- 5 card ảnh:
  - Dashboard tổng quan.
  - Quản lý đơn hàng.
  - Lịch hẹn và lịch chụp.
  - CRM khách hàng.
  - Thu chi và tài chính.
- Mỗi card có mô tả ngắn.
- Có thể mở lightbox.
- Ảnh phải là screenshot thật từ StudioCore.

8. PHOTOSHARE SHOWCASE
- Layout 2 cột:
  - Trái: mô tả.
  - Phải: mockup gallery PhotoShare.
- Nội dung:
  - Tạo album từ Google Drive/NAS.
  - Link thả tim/chọn ảnh.
  - Khách ghi chú từng ảnh.
  - Copy mã ảnh đã chọn.
  - Studio lọc ảnh theo mã khách chọn.
  - Xuất ZIP + manifest.
- CTA:
  - "Xem demo PhotoShare".
  - "Tìm hiểu PhotoShare".
- Hình ảnh:
  - Gallery có ảnh cưới/gia đình/baby.
  - Badge tim, checkbox, số ảnh đã chọn.
  - Nút copy mã.
- Không dùng ảnh khách thật nếu chưa có quyền.

9. PRICING
- Tiêu đề: "Gói cước phù hợp mọi quy mô studio."
- 4 gói:
  - Dùng thử.
  - Vận hành cơ bản.
  - Chuyên nghiệp (Pro).
  - Doanh nghiệp (Business).
- Mỗi card:
  - Tên gói.
  - Giá/tháng.
  - Mô tả ngắn.
  - Danh sách tính năng.
  - CTA.
- Gói Pro nổi bật.
- Có bảng so sánh chi tiết bên dưới.
- Có thể có toggle tháng/năm nếu làm giá năm.
- Giá demo phải ghi rõ nếu chưa chốt.
- CTA dẫn đến đăng ký/tư vấn.

10. TESTIMONIALS
- Tiêu đề: "Studio nói gì về StudioCore?"
- 3–6 testimonial card:
  - Avatar.
  - Tên.
  - Vai trò/studio.
  - Nội dung đánh giá.
  - Kết quả cụ thể nếu có.
- Nếu chưa có khách thật:
  - Dùng testimonial mô phỏng có nhãn "demo".
  - Hoặc bỏ section.
  - Không bịa logo/đánh giá.

11. FAQ
- Tiêu đề: "Câu hỏi thường gặp."
- Accordion, mỗi lần mở một câu.
- 8 câu:
  - Có miễn phí không?
  - Có cần kiến thức kỹ thuật không?
  - Nhân viên có dùng được không?
  - Dữ liệu có bảo mật không?
  - Tích hợp PhotoShare thế nào?
  - Hỗ trợ liên hệ ở đâu?
  - Dùng trên điện thoại được không?
  - Sau thời gian dùng thử thì sao?
- Có JSON-LD FAQPage.

12. HƯỚNG DẪN
- Tiêu đề: "Tài liệu hướng dẫn chi tiết."
- 3–6 card:
  - Bắt đầu.
  - Quản lý đơn hàng.
  - CRM.
  - Lịch chụp.
  - PhotoShare.
  - Tài chính.
- CTA "Xem hướng dẫn đầy đủ".

13. FINAL CTA
- Nền màu primary hoặc gradient nhẹ.
- Tiêu đề: "Bắt đầu quản lý studio ngay hôm nay."
- Subheadline ngắn.
- CTA chính: "Tạo tài khoản miễn phí".
- CTA phụ: "Xem gói cước".
- Không dùng form dài ở đây nếu đã có trang đăng ký.

14. FOOTER
- 4 cột:
  - Logo + mô tả ngắn.
  - Liên kết nhanh.
  - Hỗ trợ.
  - Liên hệ.
- Gồm:
  - Trang chủ.
  - Tính năng.
  - Bảng giá.
  - Đăng ký.
  - Điều khoản.
  - Bảo mật.
  - Đăng nhập.
  - Hỗ trợ kỹ thuật.
  - SĐT/email.
- Copyright.
- Không dùng thông tin liên hệ của StudioBase.

A.4. RESPONSIVE
- Desktop ≥1280px: container 1200–1280px, hero 2 cột, feature grid 4 cột.
- Tablet 768–1279px: hero 2 cột thu gọn hoặc 1 cột, feature grid 2 cột.
- Mobile <768px:
  - Header drawer.
  - Hero 1 cột.
  - CTA full-width.
  - Feature grid 1 cột.
  - Tabs cuộn ngang.
  - Pricing card xếp dọc.
  - Footer 1–2 cột.
- Không tràn ngang, không che CTA, không vỡ ảnh.
- Kiểm tra ở 390px, 768px, 1024px, 1440px.

A.5. INTERACTION VÀ MOTION
- Sticky header đổi shadow khi scroll.
- Smooth scroll cho anchor.
- Tabs đổi screenshot.
- FAQ accordion.
- Hover card nhẹ.
- Scroll reveal fade/slide nhẹ.
- Tôn trọng `prefers-reduced-motion`.
- Form đăng ký/tư vấn có validation, loading, success, error.
- Không dùng animation gây giật hoặc che nội dung.

A.6. SEO VÀ NỘI DUNG
- Mỗi trang có metadata riêng:
  - Title.
  - Description.
  - Canonical.
  - Open Graph.
  - Twitter card.
- JSON-LD:
  - Organization.
  - SoftwareApplication.
  - FAQPage.
- Sitemap và robots.
- H1 duy nhất mỗi trang.
- H2/H3 đúng thứ bậc.
- Alt text cho ảnh.
- Internal link giữa landing, pricing, guide, blog.
- Nội dung tiếng Việt tự nhiên, không nhồi keyword.
- Từ khóa chính:
  - Phần mềm quản lý studio chụp ảnh.
  - CRM studio.
  - Quản lý lịch chụp.
  - PhotoShare giao ảnh.
- Không copy nguyên văn nội dung StudioBase.

A.7. ACCEPTANCE TEST LANDING PAGE
1. Đủ các section theo thứ tự: Header, Hero, Pain point, Steps, Features, Product showcase, Screenshots, PhotoShare, Pricing, Testimonials, FAQ, Guide, Final CTA, Footer.
2. Không có lorem ipsum, nội dung placeholder hoặc ảnh giả dashboard.
3. Tất cả CTA hoạt động:
   - Đăng ký.
   - Đăng nhập.
   - Xem demo.
   - Xem pricing.
   - Liên hệ.
4. Header sticky và mobile menu hoạt động.
5. Tabs product showcase đổi ảnh đúng.
6. FAQ accordion hoạt động.
7. Pricing card và bảng so sánh hiển thị đúng.
8. Form đăng ký/tư vấn validate và có phản hồi.
9. Responsive 390px, 768px, 1024px, 1440px.
10. Không tràn ngang, không che CTA, không vỡ ảnh.
11. Metadata, OG, canonical, sitemap, robots hoạt động.
12. JSON-LD hợp lệ.
13. Ảnh tối ưu, lazy load, không CLS lớn.
14. Lighthouse mobile hướng tới 90+ nếu khả thi.
15. Không có lỗi console nghiêm trọng.
16. Không dùng logo, ảnh, nội dung hoặc thông tin liên hệ của StudioBase.
17. Screenshot sản phẩm lấy từ StudioCore thật.
18. Demo read-only không cho sửa/xóa dữ liệu.

B. TENANT, CHI NHÁNH, AUTH VÀ RBAC
- Multi-tenant với `tenant_id` trên mọi bảng nghiệp vụ.
- Mỗi tenant có nhiều chi nhánh; dữ liệu chi nhánh scope theo `branch_id`.
- Vai trò tối thiểu:
  - Platform admin.
  - Owner/chủ studio.
  - Manager/quản lý chi nhánh.
  - Receptionist/sale/lễ tân.
  - Photographer.
  - Makeup artist.
  - Retoucher/editor.
  - Accountant/kế toán.
- Đăng nhập linh hoạt:
  - Mã nhân viên + PIN cho nhân sự tác nghiệp nhanh.
  - Email + mật khẩu cho quản trị/kế toán.
- Hash PIN/mật khẩu bằng scrypt hoặc argon2.
- Session cookie httpOnly, secure, sameSite; ký HMAC/JWT.
- Rate limit đăng nhập, khóa tạm sau nhiều lần sai, audit log.
- Permission matrix server-side cho:
  - dashboard.view
  - orders.view/manage
  - schedule.view/manage
  - customers.view/manage
  - albums.view/manage
  - finance.view/manage
  - staff.view/manage
  - tasks.view/manage
  - reports.view
  - settings.view/manage
- Owner có thể chuyển chi nhánh; manager chỉ thấy chi nhánh được giao.
- Test cách ly tenant: tenant A không đọc/ghi được dữ liệu tenant B.
- Có trang quản lý người dùng, vai trò, phiên đăng nhập.

C. DASHBOARD VÀ APP SHELL
- Sidebar/topbar responsive, mobile drawer, breadcrumb, notification, theme sáng/tối.
- Dashboard realtime:
  - Doanh thu hôm nay/tháng, so với kỳ trước.
  - Tiền đã thu, công nợ, chi phí, lợi nhuận tạm tính.
  - Số đơn mới, đơn đang chụp, đang hậu kỳ, chờ giao.
  - Lịch chụp hôm nay/tuần.
  - Lead chưa xử lý, follow-up quá hạn, sinh nhật sắp tới.
  - KPI photographer/sale, top dịch vụ.
  - Biểu đồ doanh thu, trạng thái đơn, nguồn khách, tỷ lệ lấp đầy phòng.
- Empty state, loading skeleton, error state, quick action.
- Thông báo trong app: đơn mới, lịch sắp tới, thanh toán, task quá hạn.

D. CRM KHÁCH HÀNG
- Hồ sơ khách 360:
  - Tên, SĐT, email, địa chỉ, ngày sinh, ngày kỷ niệm.
  - Số đo trang phục và ghi chú phục vụ makeup/trang phục.
  - Nguồn khách: Facebook, TikTok, Google, referral, walk-in, khác.
  - Hạng khách: standard, VIP, VVIP.
  - Trạng thái: lead, active, inactive, churned.
  - Người phụ trách, tags, ghi chú, follow-up tiếp theo, lần liên hệ cuối.
  - LTV, tổng đã thu, công nợ, số đơn, giá trị trung bình, đơn gần nhất.
  - Lịch sử đơn, album, task, đánh giá, timeline tương tác.
- Chuẩn hóa số điện thoại Việt Nam và chống trùng trong cùng tenant.
- Ghi nhận tương tác: gọi điện, tin nhắn, gặp mặt, ghi chú, follow-up.
- Tạo task nhắc chăm sóc từ hồ sơ khách.
- Phân khúc: VIP, khách mới 30 ngày, nguy cơ rời bỏ, sinh nhật tháng, còn công nợ, lead.
- Tìm kiếm theo tên/SĐT/email/tag/ghi chú.
- Lọc theo trạng thái, hạng, nguồn, người phụ trách, chi nhánh.
- Xuất CSV có bộ lọc, UTF-8 BOM, nhãn tiếng Việt.
- Cảnh báo follow-up quá hạn, khách lâu chưa quay lại, sinh nhật sắp tới.
- Không làm mất dữ liệu người dùng nhập khi validate lỗi.

E. DỊCH VỤ, SẢN PHẨM, TRANG PHỤC VÀ THIẾT BỊ
- Danh mục dịch vụ: cưới, baby, gia đình, lookbook, concept, sự kiện.
- Giá, thời lượng, mô tả, ảnh mẫu, trạng thái đang bán/ngừng bán.
- Combo, add-on, phụ phí, voucher.
- Kho trang phục:
  - SKU, mã QR, size, màu, tình trạng, ảnh.
  - Lịch cho thuê, người thuê, đơn hàng, tiền cọc.
  - Quét QR xuất kho, gắn vào đơn, quét QR nhận lại.
  - Tự động tính phí giặt ủi/đền bù nếu có sự cố.
- Quản lý thiết bị: máy ảnh, ống kính, đèn, phụ kiện; trạng thái và lịch sử sử dụng.
- Tồn kho cơ bản, cảnh báo thiếu/hỏng/mất.

F. ĐƠN HÀNG VÀ HỢP ĐỒNG
- Tạo đơn từ khách có sẵn hoặc khách mới.
- Đơn đa dịch vụ: gói chụp, phụ thu ngoài giờ, thuê trang phục, phí di chuyển, makeup, in ấn.
- Giảm giá, voucher, tiền cọc, đã thu, còn lại.
- Mã đơn tự sinh, chi nhánh, photographer, editor, makeup, ngày chụp, địa điểm.
- Trạng thái đơn:
  - Mới tiếp nhận.
  - Đã cọc.
  - Đã lên lịch.
  - Đã chụp xong.
  - Đang hậu kỳ.
  - Khách đang chọn ảnh.
  - Đã bàn giao.
  - Hoàn tất.
  - Hủy/hoàn tiền là trạng thái ngoại lệ có kiểm soát.
- Enforce transition matrix ở server; ghi audit log.
- Timeline trạng thái: ai đổi, khi nào, ghi chú.
- Gắn album, ảnh, task, giao dịch, hóa đơn.
- In/xuất phiếu thu, biên nhận, hợp đồng chụp ảnh tự động điền thông tin.
- Hợp đồng PDF/print; xác nhận điện tử nội bộ.
- Không gọi là "ký số hợp pháp" nếu chưa tích hợp nhà cung cấp CA.
- Cảnh báo đơn sắp tới, quá hạn giao, còn công nợ.
- Tìm kiếm, lọc, sắp xếp, phân trang.

G. LỊCH CHỤP VÀ ĐIỀU PHỐI TÀI NGUYÊN
- Calendar ngày/tuần/tháng; timeline view.
- Màu theo chi nhánh, phòng chụp, photographer.
- Tạo/sửa/hủy lịch; kéo thả hoặc đổi trạng thái nếu khả thi.
- Kiểm tra xung đột:
  - Cùng photographer trùng giờ.
  - Cùng phòng/studio trùng giờ.
  - Cùng makeup artist/editor nếu được phân công.
  - Thời gian đệm 30 phút giữa hai buổi.
  - Giờ làm việc, ngày nghỉ, lịch nghỉ phép.
- Gợi ý slot trống.
- Check-in/check-out buổi chụp; cập nhật trạng thái.
- Gửi thông báo nhắc lịch cho nhân sự và khách.
- Hỗ trợ đa chi nhánh.
- Mọi thao tác kiểm tra + tạo/cập nhật booking phải tuân thủ mục 0.4.
- Phải có test hai request đồng thời đặt cùng slot: một thành công, một bị từ chối.

H. QUẢN LÝ ẢNH, ALBUM VÀ GOOGLE DRIVE
- Album gắn đơn hàng/khách.
- Trạng thái album: chưa upload, đang xử lý, sẵn sàng, đã giao, lưu trữ.
- Upload ảnh, thumbnail, metadata, dung lượng, thứ tự, watermark.
- Phân loại raw/edit/delivery.
- Sandbox local: lưu ảnh demo vào `/public/uploads/<tenant>/<album>/`.
- Chỉ dùng ảnh demo/synthetic trong `/public/uploads`; không dùng ảnh khách thật hoặc PII.
- Production: Storage Adapter phải chuyển sang private storage + signed URL hoặc route kiểm tra quyền; không dùng `/public/uploads` cho ảnh khách thật.
- Kiểm tra MIME, extension, dung lượng; chống path traversal.
- Google Drive:
  - OAuth connect/callback/refresh token.
  - Mã hóa refresh token khi lưu.
  - Chọn folder, import ảnh, tạo thumbnail.
  - Lưu drive file id, folder id, trạng thái sync.
  - Xử lý rate limit/quota bằng backoff.
- Local Drive adapter cho môi trường dev.
- Có nút sync lại, xem lỗi sync, không giả vờ thành công khi chưa cấu hình.

I. PHOTOSHARE — TẠO ALBUM TỪ DRIVE/NAS, LINK THẢ TIM VÀ LỌC ẢNH THEO MÃ KHÁCH CHỌN

I.1. MỤC TIÊU VÀ NGUYÊN TẮC
- Tái hiện đầy đủ năng lực PhotoShare: tạo album từ Google Drive/NAS, chia tab theo thư mục con, gửi link khách thả tim/chọn ảnh, copy mã ảnh và lọc ảnh theo mã khách đã chọn từ folder trên máy tính.
- Triển khai bằng UI và mã nguồn gốc; không sao chép asset, nội dung hoặc mã nguồn độc quyền.
- Local-first: chạy được khi chưa có Google OAuth/API key.
- Sandbox lưu ảnh demo tại `/public/uploads/<tenant>/<album>/`.
- Production không dùng `/public/uploads` cho ảnh khách thật; phải dùng private storage + signed URL hoặc route kiểm tra quyền.
- Mọi lựa chọn ảnh, giới hạn chọn, phí ảnh thêm và quyền tải phải được kiểm tra ở server.
- Không tự động copy ảnh khi matching không chắc chắn.
- Không giả vờ browser đọc được ổ đĩa/NAS của người dùng.

I.2. ROUTE VÀ MÀN HÌNH
- `/manage/photos`: danh sách album.
- `/manage/photos/albums/new`: tạo album mới.
- `/manage/albums/[id]`: quản lý album, ảnh, lựa chọn.
- `/manage/albums/[id]/filter`: lọc ảnh theo mã khách chọn.
- `/share/[token]`: gallery công khai cho khách.
- `/manage/albums/[id]/notes`: xem ghi chú và mã ảnh.

I.3. TẠO ALBUM TỪ GOOGLE DRIVE / NAS
- Wizard 3 bước:
  1. Nguồn link ảnh.
  2. Thông tin khách và album.
  3. Số lượng chọn và giá ảnh thêm.

- Nguồn ảnh:
  - Tab "Thư Mục Drive / NAS":
    - Input dán link thư mục Google Drive hoặc NAS.
    - Nút "Quét Ảnh".
  - Tab "Dán Nhiều Link":
    - Cho phép dán nhiều link.
    - Mỗi link tương ứng một folder/section.
    - Hợp nhất ảnh và chống trùng theo `source_file_id` hoặc checksum.
  - Upload thư mục/ZIP cho demo hoặc khi không dùng Drive.

- Quét ảnh:
  - Parse link Drive để lấy folder id.
  - Chỉ chấp nhận domain Google Drive hợp lệ hoặc connector NAS đã cấu hình.
  - Kiểm tra URL, folder id và quyền truy cập.
  - Chống SSRF: không fetch URL tùy ý từ người dùng.
  - Liệt kê ảnh và thư mục con.
  - Hỗ trợ nhận diện thư mục con tự động.
  - Với folder cha có nhiều folder con:
    - Tab "Tất cả".
    - Mỗi thư mục con thành một tab riêng.
    - Ví dụ: Đuôi cá, Truyền thống, Váy phỏng, Lễ gia tiên, Tiệc tối, Gala.
    - Mỗi tab hiển thị số lượng ảnh.
  - Nếu nhiều link, gộp thành các tab theo nguồn.
  - Chống trùng ảnh khi quét lại.
  - Có trạng thái loading, lỗi quyền, lỗi link, lỗi quota.

- Xem trước album:
  - Thumbnail, tên file, folder.
  - Tab "Tất cả", "Đã chọn", "Ghi chú" kèm số lượng.
  - Bộ lọc theo thư mục con.
  - Lazy load, phân trang, không tải toàn bộ ảnh gốc.
  - Có nút quét lại.

- Thông tin album:
  - Tiêu đề album.
  - Tên khách hàng.
  - SĐT/email nếu có.
  - Gắn đơn hàng/hợp đồng nếu có.
  - Ghi chú nội bộ.
  - Chi nhánh.

- Số lượng chọn và giá ảnh thêm:
  - Nhập số ảnh khách được chọn.
  - Nút chọn nhanh: 5, 10, 15, 20, 25, 30, 40, 50.
  - Checkbox "Thu phí khi khách chọn thêm ảnh".
  - Mặc định tắt để tránh khách hiểu nhầm nếu studio không thu phí.
  - Nếu bật, nhập đơn giá ảnh thêm.
  - Khi khách vượt quota:
    - Hiển thị số ảnh vượt.
    - Đơn giá.
    - Tổng phí.
    - Yêu cầu xác nhận trước khi gửi.
  - Phí ảnh thêm phải ghi nhận vào order item/add-on hoặc payment request; không chỉ hiển thị UI.

- Sau khi tạo album:
  - Sinh token công khai khó đoán.
  - Có nút copy link.
  - Có thể đặt mật khẩu, ngày hết hạn, giới hạn tải.
  - Có thể thu hồi/gia hạn link.
  - Trạng thái album: chưa upload, đang xử lý, sẵn sàng, đã giao, lưu trữ.
  - Phân loại raw/edit/delivery.

- Google Drive:
  - OAuth connect/callback/refresh.
  - Scope tối thiểu, ưu tiên drive.readonly hoặc drive.file.
  - Mã hóa refresh token khi lưu DB.
  - Cache metadata/thumbnail có thời hạn.
  - Xử lý rate limit/quota bằng backoff.
  - Khi quét lại:
    - Giữ selection cũ.
    - Ảnh bị xóa khỏi Drive được đánh dấu missing.
    - Không tự xóa lựa chọn của khách.

- NAS:
  - Browser không được giả vờ đọc trực tiếp đường dẫn NAS.
  - Dùng local/desktop adapter hoặc helper.
  - Nếu chưa hỗ trợ, hiển thị "chưa cấu hình"; không báo thành công giả.

I.4. LINK THẢ TIM, CHỌN ẢNH VÀ COPY MÃ
- Link công khai `/share/[token]`, khách không cần đăng nhập.
- Hỗ trợ mật khẩu, ngày hết hạn, thu hồi, gia hạn.
- Gallery:
  - Tab "Tất cả".
  - Tab "Đã chọn".
  - Tab "Ghi chú".
  - Bộ lọc theo thư mục con.
  - Số lượng ảnh từng tab.
  - Lazy load, responsive, fullscreen.
- Khách có thể:
  - Thả tim/đánh dấu yêu thích.
  - Chọn ảnh để studio chỉnh sửa.
  - Ghi chú từng ảnh.
  - Xem số ảnh đã chọn / giới hạn.
  - Gửi lựa chọn.
  - Copy mã ảnh đã chọn.
- Copy mã ảnh:
  - Mỗi ảnh có `photo.code` ổn định, duy nhất trong album.
  - Nếu filename trùng, hệ thống sinh code duy nhất; không dùng số thứ tự dễ lệch.
  - Nút copy từng ảnh và copy toàn bộ ảnh đã chọn.
  - Hỗ trợ 4 định dạng:
    - Xuống dòng.
    - Dấu phẩy.
    - Dấu cách.
    - Có đuôi file.
  - Có thể copy kèm ghi chú hoặc chỉ mã.
  - Có nút copy link album.
- Studio có thể:
  - Xem khách đã chọn ảnh nào, ghi chú gì, thời điểm nào.
  - Xem số ảnh vượt quota và phí phát sinh.
  - Copy danh sách mã ảnh khách đã chọn.
  - Khóa/mở lựa chọn.
  - Xuất ZIP ảnh đã chọn kèm `manifest.csv`.
  - Sinh `missing.txt` nếu có mã không khớp ảnh gốc.
- Selection status:
  - `draft`: khách đang chọn.
  - `submitted`: khách đã gửi.
  - `locked`: studio đã khóa.
  - Lưu `submitted_at`, `locked_at`.
  - Sau khi khóa, khách không sửa được nếu studio chưa mở lại.
  - Mọi thay đổi phải ghi audit log.
- Bảo mật:
  - Watermark render phía server hoặc ảnh derivative, không chỉ phủ CSS.
  - Chặn tải ảnh gốc nếu gói không cho phép.
  - Không lộ ảnh khách khác.
  - Kiểm tra token, mật khẩu, hạn dùng và quyền tải ở server.

I.5. LỌC MÃ HÌNH KHÁCH CHỌN
- Trang `/manage/albums/[id]/filter` hoặc `/manage/photos/filter`.
- Mục tiêu: lấy mã ảnh khách đã chọn và lọc đúng file gốc từ folder ảnh trên máy tính.

- Bước 1 — Chọn nguồn mã ảnh:
  - Dropdown "Chọn Nguồn Khách Hàng / Album / Hợp Đồng".
  - Tìm theo mã HĐ, tên album, tên khách.
  - Badge "X mã hợp lệ".
  - Chế độ lựa chọn:
    - "Chữ và số": so khớp chính xác basename/code.
    - "Chỉ lấy số": trích xuất phần số để so khớp.
  - Textarea hỗ trợ:
    - Excel.
    - Zalo.
    - Xuống dòng.
    - Dấu phẩy.
    - Dấu cách.
    - Có hoặc không có đuôi file.
    - Số thứ tự.
  - Nút copy nhanh 4 định dạng:
    - Xuống dòng.
    - Dấu phẩy.
    - Dấu cách.
    - Có đuôi file.

- Bước 2 — So khớp thông minh:
  - Chuẩn hóa Unicode, trim, lowercase.
  - Bỏ đường dẫn, bỏ đuôi file.
  - Exact basename trước.
  - Nếu "Chỉ lấy số": so khớp numeric token ở cuối hoặc token số duy nhất.
  - Nếu một mã khớp nhiều file:
    - Đánh dấu ambiguous.
    - Không tự copy.
    - Cho người dùng chọn thủ công.
  - Nếu trùng mã:
    - Chỉ copy một lần.
    - Báo duplicate.
  - Nếu không khớp:
    - Đưa vào missing.
    - Cho tải `missing.txt`.
  - AI matching nếu bật:
    - Chỉ gợi ý.
    - Không tự copy khi chưa xác nhận.
    - Exact matching luôn được ưu tiên.

- Bước 3 — Chọn folder ảnh gốc:
  - Nút "Chọn thư mục ảnh gốc trên PC".
  - Hiển thị tên folder đã chọn.
  - Nếu browser hỗ trợ File System Access API:
    - Dùng `showDirectoryPicker`.
    - Quét đệ quy.
    - Chỉ đọc file khi người dùng cấp quyền.
  - Nếu không hỗ trợ:
    - Fallback upload thư mục qua `webkitdirectory`.
    - Hoặc upload ZIP.
    - Hoặc desktop helper/CLI.
  - Tuyệt đối không giả vờ server đọc được ổ đĩa của người dùng.
  - NAS/RAW dung lượng lớn ưu tiên desktop helper; không upload toàn bộ lên server nếu không cần.

- Bước 4 — Cấu hình đầu ra:
  - Checkbox "Tạo thư mục ảnh khách chọn ở trong thư mục ảnh gốc", mặc định bật.
  - Tên folder con mặc định: "Ảnh khách chọn".
  - Cho phép đổi tên.
  - Hoặc chọn thư mục đầu ra riêng.
  - Chỉ copy, không xóa/di chuyển file gốc.
  - Nếu file đích tồn tại:
    - Hỏi ghi đè.
    - Hoặc bỏ qua.
    - Hoặc đổi tên.

- Bước 5 — Định dạng file:
  - "Tất cả (RAW & JPG)".
  - "Chỉ lấy RAW".
  - "Chỉ lấy JPG/PNG".
  - Giữ nguyên extension gốc.

- Bước 6 — Chạy lọc:
  - Nút "BẮT ĐẦU LỌC ẢNH TỪ MÁY TÍNH".
  - Chỉ bật khi có mã hợp lệ và đã chọn folder.
  - Progress: đã quét, đã khớp, đã copy, missing, lỗi.
  - Có thể hủy giữa chừng.
  - Khi xong:
    - Tạo `manifest.csv`.
    - Tạo `missing.txt`.
    - Hiển thị tổng kết.
    - Nếu browser fallback, cho tải ZIP.
    - Nếu local/desktop, mở folder đầu ra.

- Trang "Xem Ghi Chú & Mã Ảnh":
  - Liệt kê mã ảnh khách đã chọn.
  - Ghi chú từng ảnh.
  - Copy toàn bộ mã.
  - Xuất CSV/TXT.
  - Điều hướng về album/đơn hàng.

- Lưu job lọc:
  - Album/khách hàng.
  - Chế độ lựa chọn.
  - Số mã nhập vào.
  - Số mã hợp lệ.
  - Số file đã copy.
  - Số missing/ambiguous/duplicate.
  - Định dạng file.
  - Tên folder đầu ra.
  - Trạng thái, thời gian, người thực hiện.
  - Không lưu đường dẫn tuyệt đối của máy khách nếu không cần.

J. AI HUB VÀ PHÂN TÍCH ẢNH
- Cấu hình provider, API key, model, chi phí, ngân sách, bật/tắt từng tính năng.
- Tính năng:
  - Lọc ảnh mờ.
  - Lọc ảnh thiếu sáng/quá sáng.
  - Phát hiện nhắm mắt.
  - Phát hiện ảnh trùng/ảnh gần giống.
  - Gợi ý ảnh đẹp nhất trong burst.
  - So khớp ảnh khách chọn với ảnh gốc.
  - AI tư vấn/trả lời tin nhắn.
  - Phân tích hiệu quả quảng cáo.
- Khi chưa có API key:
  - Dùng local heuristic với sharp/OpenCV/face detection nếu có.
  - Ghi rõ kết quả là heuristic, không gọi là AI chính xác tuyệt đối.
  - Không giả vờ đã phân tích nhắm mắt nếu chỉ đọc metadata.
- Có log AI job, chi phí ước tính, trạng thái, lỗi.
- Không gửi ảnh khách lên provider bên thứ ba nếu tenant chưa bật và chưa có consent.
- AI auto-reply không được thực hiện hành động nguy hiểm, không lộ secret, phải có human handoff.

K. TÀI CHÍNH, KẾ TOÁN VÀ HOA HỒNG
- Sổ quỹ thu chi, danh mục thu/chi, ngân sách.
- Giao dịch gắn đơn hàng/khách/nhân viên/chi nhánh.
- Phương thức: tiền mặt, chuyển khoản, VietQR, thẻ, ví điện tử.
- Thu cọc, thu đợt 2, thanh toán dứt điểm, hoàn tiền.
- Công nợ khách, tuổi nợ, nhắc thu.
- Hóa đơn: tạo, in, trạng thái, VAT/TNCN mức demo.
- Payment Adapter:
  - `manual`: ghi nhận thủ công.
  - `vietqr`: tạo payload NAPAS hợp lệ, kiểm tra bank BIN/tài khoản/số tiền/nội dung.
  - `sepay`/`payos`: khi có credentials.
- Trang giả lập thanh toán `/manage/settings/payments/sandbox` và endpoint `/api/mock/webhook/payment`.
- Mock webhook chỉ bật ở development, có secret, idempotency key, chống replay.
- Không cho mock webhook chạy ở production.
- Commission Engine:
  - Cố định theo buổi.
  - % giá trị đơn.
  - Theo vai trò photographer/makeup/sale.
  - Có effective date, trạng thái chờ duyệt/đã duyệt/đã trả.
  - Không tính lại lịch sử khi đổi rule nếu chưa migration rõ.
- Báo cáo:
  - Doanh thu thực thu so với doanh thu dự kiến.
  - Công nợ, tuổi nợ.
  - Chi phí, lợi nhuận.
  - Doanh thu theo chi nhánh/dịch vụ/nhân viên.
  - Tỷ lệ lấp đầy phòng, hiệu suất photographer.
  - Báo cáo thuế mức demo, xuất CSV/PDF.

L. NHÂN SỰ, CHẤM CÔNG, LƯƠNG
- Hồ sơ nhân viên, mã nhân viên, vai trò, chi nhánh, trạng thái.
- Ca làm việc, lịch làm, nghỉ phép.
- Chấm công GPS/QR hoặc thủ công; lưu thời gian, vị trí, thiết bị.
- Bảng lương: lương cơ bản, ngày công, hoa hồng, thưởng, khấu trừ.
- KPI photographer/sale: số buổi, doanh thu, tỷ lệ chốt, đơn hoàn tất.
- Quyền xem lương chỉ owner/admin/kế toán.
- Có trạng thái nháp/chờ duyệt/đã duyệt/đã trả.
- Audit log khi sửa lương/hoa hồng.

M. CÔNG VIỆC, TÀI LIỆU, CHIẾN DỊCH VÀ INBOX
- Task board/list:
  - Assignee, priority, deadline, trạng thái todo/doing/review/done.
  - Gắn đơn hàng/khách/album.
  - Bình luận, mention, file đính kèm nếu khả thi.
  - Nhắc deadline, task quá hạn.
- Tài liệu: upload/link, danh mục, quyền truy cập, phiên bản.
- Chiến dịch:
  - Nguồn khách, ngân sách, chi phí quảng cáo.
  - Lead, đơn hàng, doanh thu, ROAS.
  - Adapter phân tích quảng cáo; không giả vờ gọi Meta API khi chưa có token.
- Inbox Fanpage/Zalo:
  - Lưu hội thoại, gắn khách hàng.
  - Phân công nhân viên, trạng thái chưa trả lời/đang xử lý/đã trả lời.
  - Gửi tin qua adapter; local inbox cho dev.
  - AI auto-reply có bật/tắt, giới hạn chủ đề, chuyển người thật khi không chắc.
  - Không scrape dữ liệu từ tài khoản không có quyền.

N. CẤU HÌNH, THÔNG BÁO VÀ AUDIT
- Cấu hình studio: tên, logo, địa chỉ, SĐT, email, website, mã số thuế, tài khoản ngân hàng, giờ làm việc.
- Cấu hình chi nhánh, phòng chụp, dịch vụ, voucher, mẫu thông báo.
- Cấu hình tích hợp Drive, AI, Fanpage, Zalo, thanh toán.
- Quản lý người dùng, vai trò, quyền, phiên đăng nhập.
- Thông báo in-app/email/Zalo/SMS; trạng thái đã đọc.
- Audit log cho:
  - Đăng nhập/thất bại.
  - Thay đổi quyền.
  - Thay đổi giá, thanh toán, hoa hồng, lương.
  - Hủy đơn, hoàn tiền, xóa/archive dữ liệu.
  - Truy cập link PhotoShare nhạy cảm.
- Backup/export dữ liệu demo.
- Cấu hình AI cost guard.

LUỒNG NGHIỆP VỤ PHẢI CHẠY END-TO-END
1. Lead mới → tư vấn → tạo khách → tạo đơn → thu cọc → xếp lịch không xung đột.
2. Buổi chụp → check-in → cập nhật trạng thái → upload ảnh → tạo album PhotoShare.
3. Gửi link khách → khách xem/thả tim/chọn ảnh → studio nhận selection → copy mã/xuất ZIP + manifest.
4. Chỉnh sửa → duyệt → giao ảnh → thu phần còn lại → hoàn tất đơn → gửi đánh giá.
5. Hoàn tất đơn → cập nhật doanh thu, công nợ, KPI, hoa hồng, báo cáo.
6. Lịch trùng photographer/phòng → hệ thống chặn, gợi ý slot khác.
7. Nhân viên không có quyền → bị chặn ở server, không chỉ ẩn menu.
8. Đăng nhập sai nhiều lần → bị rate limit, có audit log.
9. Thanh toán webhook gửi lặp → chỉ ghi nhận một lần.
10. Tenant A không đọc/ghi được dữ liệu tenant B.
11. Khách thuê trang phục → quét QR xuất kho → trả lại → tính phí giặt/đền bù.
12. Kế toán tính lương/hoa hồng → duyệt → chi trả → khóa kỳ lương.
13. Tạo album từ link Drive có thư mục con → khách thả tim/chọn → lọc mã ảnh từ folder gốc trên máy tính.

MÔ HÌNH DỮ LIỆU TỐI THIỂU
Tất cả bảng nghiệp vụ phải có `tenant_id`; bảng thuộc chi nhánh có `branch_id`.

- tenants: id, name, slug, status, plan, created_at.
- branches: id, tenant_id, name, address, phone, timezone, working_hours, status.
- staff: id, tenant_id, code, name, role, pin_hash, password_hash, email, phone, active.
- staff_branches: staff_id, branch_id, tenant_id.
- role_permissions: role, permission, tenant_id.
- customers: id, tenant_id, branch_id, name, phone, email, address, birthday, measurements, source, tier, status, tags, owner_id, follow_up_at, last_contact_at, notes.
- customer_interactions: id, tenant_id, customer_id, type, content, occurred_at, created_by.
- services: id, tenant_id, branch_id, name, category, price, duration_minutes, description, active.
- service_addons: id, service_id, tenant_id, name, price, active.
- products: id, tenant_id, sku, name, category, price, stock, status.
- wardrobe_items: id, tenant_id, branch_id, sku, qr_code, name, size, color, status, rental_price, deposit_price, image.
- wardrobe_rentals: id, tenant_id, wardrobe_item_id, order_id, customer_id, checked_out_at, due_at, returned_at, condition_out, condition_in, cleaning_fee, damage_fee, deposit.
- orders: id, tenant_id, branch_id, code, customer_id, status, photographer_id, editor_id, makeup_id, scheduled_at, location, subtotal, surcharge, discount, total, deposit, paid, remaining, notes.
- order_items: id, tenant_id, order_id, service_id, name, quantity, unit_price, total.
- payments: id, tenant_id, order_id, amount, method, status, reference, paid_at, idempotency_key.
- invoices: id, tenant_id, order_id, invoice_no, tax_code, subtotal, vat, total, status, issued_at.
- rooms: id, tenant_id, branch_id, name, capacity, status.
- appointments: id, tenant_id, branch_id, order_id, room_id, photographer_id, start_at, end_at, status, buffer_minutes.
- staff_shifts: id, tenant_id, branch_id, staff_id, start_at, end_at, role.
- attendance: id, tenant_id, staff_id, branch_id, check_in_at, check_out_at, method, latitude, longitude.
- leave_requests: id, tenant_id, staff_id, start_at, end_at, status, reason.
- payrolls: id, tenant_id, period, staff_id, base_salary, work_days, commission, bonus, deduction, net, status.
- commissions: id, tenant_id, order_id, staff_id, rule_id, amount, status, approved_by.
- transactions: id, tenant_id, branch_id, type, category, amount, order_id, customer_id, staff_id, method, description, occurred_at.
- expenses: id, tenant_id, branch_id, category, amount, vendor, description, occurred_at, created_by.
- albums:
  - id, tenant_id, branch_id, order_id, customer_id, title.
  - source_type: drive | nas | upload | multi_link.
  - source_url, drive_folder_id.
  - recursive_scan: boolean.
  - selection_limit.
  - extra_photo_enabled: boolean.
  - extra_photo_price: integer VND.
  - allow_favorites: boolean.
  - allow_notes: boolean.
  - selection_status: draft | submitted | locked.
  - selection_submitted_at, selection_locked_at.
  - token, password_hash, expires_at, status.
- album_sources: id, tenant_id, album_id, provider, source_url, external_folder_id, display_name, recursive, status, last_synced_at.
- album_folders: id, tenant_id, album_id, source_id, external_id, name, relative_path, photo_count, sort_order.
- photos:
  - id, tenant_id, album_id, folder_id.
  - code, filename, relative_path.
  - storage_key, thumbnail_key.
  - source_file_id.
  - width, height, size.
  - is_raw: boolean.
  - checksum.
  - watermarked, status.
- photo_selections:
  - id, tenant_id, album_id, photo_id.
  - favorite: boolean.
  - selected: boolean.
  - note.
  - code_snapshot.
  - extra_fee: integer VND.
  - created_at, updated_at.
  - Unique constraint: album_id + photo_id.
- drive_connections: id, tenant_id, provider, refresh_token_encrypted, folder_id, status, last_synced_at.
- photo_filter_jobs:
  - id, tenant_id, album_id, customer_id, order_id.
  - mode: alphanumeric | numeric_only.
  - input_codes.
  - parsed_count, matched_count, missing_count, ambiguous_count, duplicate_count.
  - output_mode: subfolder | external_folder | zip.
  - output_folder_name.
  - file_type: all | raw | jpg_png.
  - status: pending | running | completed | failed | cancelled.
  - created_by, started_at, finished_at, error.
- photo_filter_items:
  - id, tenant_id, job_id.
  - input_code.
  - matched_photo_id.
  - matched_filename.
  - status: matched | missing | ambiguous | duplicate | copied | failed.
  - message.
- campaigns: id, tenant_id, branch_id, name, source, budget, spend, leads, orders, revenue, start_at, end_at.
- tasks: id, tenant_id, branch_id, title, description, assignee_id, order_id, customer_id, priority, status, due_at, created_by.
- task_comments: id, tenant_id, task_id, author_id, content, created_at.
- documents: id, tenant_id, branch_id, name, category, storage_key, visibility, uploaded_by.
- conversations: id, tenant_id, branch_id, customer_id, channel, assigned_to, status, last_message_at.
- messages: id, tenant_id, conversation_id, direction, content, sent_at, external_id.
- ai_jobs: id, tenant_id, type, provider, status, input_ref, output_ref, estimated_cost, error.
- notifications: id, tenant_id, user_id, type, title, content, read_at, link.
- activity_logs: id, tenant_id, actor_id, action, entity, entity_id, metadata, created_at.
- settings: id, tenant_id, branch_id, key, value.

Yêu cầu dữ liệu:
- Khóa chính ổn định; foreign key rõ ràng.
- Index cho tenant_id, branch_id, phone, order code, status, scheduled_at, created_at.
- Unique constraint cho tenant + phone, tenant + order code, tenant + invoice_no, album + photo code.
- Soft delete/archive cho dữ liệu nghiệp vụ quan trọng.
- Timestamp UTC; format Asia/Ho_Chi_Minh khi hiển thị.
- Tiền integer VND; không float.
- Seed idempotent, chạy lại không nhân đôi.

TECH STACK VÀ KIẾN TRÚC
- Next.js App Router, Server Components mặc định.
- Client Components chỉ khi cần tương tác DOM/state.
- TypeScript strict; CẤM `any`.
- Tailwind CSS, Lucide React, shadcn/Base UI hoặc tương đương.
- Sonner toast, Recharts/Chart.js.
- PostgreSQL hoặc SQLite WAL + Drizzle ORM/Prisma.
- Mặc định SQLite WAL + Drizzle cho local demo; thiết kế adapter để chuyển PostgreSQL.
- Zod cho mọi form và input server.
- Service layer tách khỏi UI.
- Server Actions cho mutation; API route cho webhook/export/upload/download.
- Không import server-only module vào Client Component.
- Nếu framework có breaking changes, đọc tài liệu trong node_modules trước khi code.
- Dùng proxy/middleware đúng chuẩn phiên bản framework.
- Có `.env.example`; không commit `.env.local`.
- Có script lint, typecheck, build, test, seed, migrate.

CẤU TRÚC GỢI Ý
src/
  app/
    (marketing)/
    (auth)/
    (app)/
      manage/
        dashboard/
        orders/
        calendar/
        customers/
        services/
        wardrobe/
        photos/
        albums/
        finance/
        staff/
        tasks/
        reports/
        campaigns/
        inbox/
        settings/
        activity-log/
    share/[token]/
    api/
      uploads/
      webhooks/
      exports/
  components/
    ui/
    layout/
    shared/
    manage/
    marketing/
  lib/
    db/
    auth/
    services/
    adapters/
    validators/
    utils/
  content/
scripts/
  seed.ts
  seed-demo.ts
docs/

Điều chỉnh theo repo hiện có; không rewrite nếu không cần.

ADAPTER CHI TIẾT
1. Storage Adapter
- `STORAGE_PROVIDER=local|s3|r2`.
- Local sandbox: `/public/uploads/<tenant>/<album>/`.
- Production: private storage + signed URL hoặc route kiểm tra quyền.
- Tạo thumbnail, kiểm tra MIME/dung lượng, chống path traversal.
- Thêm `.gitignore` cho file upload phát sinh.

2. Google Drive Adapter
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- OAuth connect/callback/refresh.
- Mã hóa refresh token khi lưu DB.
- Local adapter đọc thư mục demo.
- Hiển thị trạng thái connected/disconnected/error rõ ràng.
- Hỗ trợ quét folder con, metadata, thumbnail.
- Xử lý rate limit/quota.

3. Payment Adapter
- `PAYMENT_PROVIDER=manual|vietqr|sepay|payos`.
- Manual ghi nhận thủ công.
- VietQR tạo payload NAPAS hợp lệ; validate bank BIN/tài khoản/số tiền/nội dung.
- Mock webhook `/api/mock/webhook/payment` chỉ bật ở development.
- Webhook phải có secret/signature, idempotency key, chống replay.
- Production dùng provider thật; tắt endpoint mock.

4. Messaging Adapter
- `MESSAGING_PROVIDER=local|zalo|facebook|smtp`.
- Local: ghi DB + log terminal, không gửi thật.
- Live: Zalo ZNS/Facebook/SMTP khi có credentials.
- Không giả vờ gửi thành công nếu thiếu cấu hình.

5. AI Adapter
- `AI_PROVIDER=local|openai|gemini|...`.
- Local: sharp/OpenCV/face detection nếu có; rule-based fallback.
- Live: provider API khi có key.
- Có cost guard, log job, trạng thái, lỗi.
- Không gửi ảnh khách lên provider khi chưa bật consent.

6. Notification Adapter
- In-app mặc định.
- Email/Zalo/SMS khi có cấu hình.
- Lưu notification vào DB; trạng thái đã đọc/chưa đọc.

BẢO MẬT VÀ RIÊNG TƯ
- Hash PIN/mật khẩu bằng scrypt/argon2.
- Session cookie httpOnly, secure, sameSite.
- Rate limit đăng nhập và API nhạy cảm.
- CSRF protection cho form/API.
- Validate input server-side bằng Zod.
- Chống SQL injection, XSS, path traversal, SSRF, upload độc hại.
- Tenant isolation ở mọi query.
- Không trả stack trace hoặc secret ra client.
- Không log token, PIN, mật khẩu, API key, số tài khoản đầy đủ.
- PhotoShare token khó đoán; kiểm tra hạn/mật khẩu/quyền tải.
- Watermark/derivative ảnh; không chỉ che bằng CSS.
- Không cho server đọc đường dẫn tuyệt đối trên máy khách.
- File System Access API chỉ chạy client-side; không gửi path lên server.
- Audit log cho thay đổi tài chính, quyền, lương, hủy đơn, hoàn tiền, selection lock.
- Backup/export có kiểm soát quyền.
- Không dùng PII thật trong seed/test.

UX/UI
- Tiếng Việt mặc định.
- Phong cách SaaS hiện đại, sạch, chuyên nghiệp, phù hợp studio ảnh.
- Design token thống nhất: màu, typography, spacing, radius, shadow.
- Sidebar nhóm: Kinh doanh, Sản xuất, Vận hành, Tài chính, Hệ thống.
- Bảng dữ liệu: sticky header, filter, search, pagination, empty state.
- Form: label, helper text, validation, loading/success/error.
- Skeleton loading, toast, dialog xác nhận.
- Responsive desktop/tablet/mobile.
- Bàn phím, focus ring, aria-label, contrast, reduced motion.
- Định dạng VND, ngày dd/MM/yyyy, giờ 24h.
- Không dùng logo/tên thương hiệu StudioBase nếu chưa được cấp phép.
- Public page có SEO metadata, OG image, sitemap, robots.
- Landing page tuân thủ đặc tả A.0–A.7.

KIỂM THỬ VÀ ACCEPTANCE
Bắt buộc chạy:
- `npm run lint`.
- `npm run typecheck`.
- `npm run build`.
- Test unit cho tính tiền, công nợ, hoa hồng, trạng thái đơn, chuẩn hóa SĐT.
- Test integration cho RBAC, tenant isolation, PhotoShare token, webhook idempotency.
- Test E2E/Playwright cho luồng chính.
- Test thủ công bằng trình duyệt thật.

Landing page:
- Chạy toàn bộ acceptance test A.7.
- Kiểm tra 390px, 768px, 1024px, 1440px.
- Kiểm tra CTA, tabs, FAQ, pricing, form, SEO.
- Không có placeholder, ảnh giả dashboard hoặc asset không có quyền.

Các kịch bản bắt buộc:
1. Lead → order → deposit → schedule → shoot → edit → select → deliver → final payment.
2. Hai request booking đồng thời cùng slot → một thành công, một bị chặn.
3. Nhân viên không có quyền → bị chặn ở server.
4. Tenant A không truy cập dữ liệu tenant B.
5. PhotoShare đúng token/mật khẩu/hạn; sai token bị từ chối.
6. Khách thả tim/chọn ảnh, ghi chú, gửi selection; studio copy mã ảnh ở 4 định dạng.
7. Khách vượt quota; phí ảnh thêm được tính và ghi nhận vào đơn hàng/payment.
8. Studio khóa selection; khách không sửa được khi chưa mở lại.
9. Tạo album từ link Drive có 3 thư mục con; tab "Tất cả" + 3 tab con đúng số lượng.
10. Quét lại folder không tạo trùng; ảnh bị xóa được đánh dấu missing.
11. Dán mã ảnh từ Excel/Zalo với xuống dòng, dấu phẩy, dấu cách, có/không đuôi file; parse đúng.
12. Chế độ "Chỉ lấy số" lọc đúng; ambiguous không tự copy.
13. Folder gốc RAW + JPG; lọc "Chỉ lấy RAW", "Chỉ lấy JPG/PNG", "Tất cả" đúng.
14. Tạo folder "Ảnh khách chọn" trong folder gốc; file gốc không bị xóa/di chuyển.
15. Browser không hỗ trợ File System Access API; fallback upload thư mục/ZIP hoạt động.
16. ZIP + manifest + missing khớp chính xác.
17. Watermark/derivative hiển thị đúng; không tải được ảnh gốc nếu gói không cho phép.
18. Ảnh demo lưu `/public/uploads`; production dùng private storage/signed URL.
19. Webhook thanh toán gửi lặp → không cộng tiền hai lần.
20. Thuê/trả trang phục QR → tính đúng phí giặt/đền bù.
21. Tính lương/hoa hồng → duyệt → khóa kỳ lương.
22. Báo cáo doanh thu/công nợ khớp giao dịch.
23. Responsive mobile/tablet; form dài và bảng cuộn ngang hoạt động.
24. Public page có metadata/SEO cơ bản.
25. Landing page đủ section, CTA hoạt động, không lorem, không asset sai quyền.

Không được báo hoàn thành nếu chỉ compile hoặc chỉ có giao diện.

QUY TRÌNH THỰC THI THEO PHASE

PHASE 0 — KHẢO SÁT VÀ KẾ HOẠCH
- Khảo sát repo, framework, dependency, database, route, component, style.
- Nghiên cứu website công khai để lập feature matrix; không đụng vùng quản trị nội bộ.
- Tạo `PLAN.md`:
  - Mục tiêu, giả định, rủi ro.
  - Feature matrix P0/P1/P2.
  - Route map.
  - Data model.
  - Permission matrix.
  - Adapter strategy.
  - Kế hoạch test.
  - Landing page section blueprint.
- Tạo `PROGRESS.md` dạng checklist.
- Dừng lại báo cáo kế hoạch và kiến trúc để xác nhận.

PHASE 1 — NỀN TẢNG
- Khởi tạo/cấu hình project, TypeScript strict, Tailwind, shadcn/Base UI.
- Thiết kế schema multi-tenant, migration.
- Seed nền: tenant demo chính, tenant phụ tối thiểu, 2 chi nhánh, 8 nhân sự đủ vai, 10 khách, 5 gói chụp, 15 bộ trang phục.
- Auth, session, RBAC, rate limit.
- App shell, sidebar, topbar, theme, error/loading/empty states.
- Chạy lint/typecheck/build.
- Báo cáo checkpoint và tiếp tục nếu không có blocker.

PHASE 2 — CRM, DỊCH VỤ, ĐƠN HÀNG
- CRM đầy đủ.
- Dịch vụ, add-on, voucher.
- Đơn hàng, thanh toán, trạng thái, timeline.
- Hợp đồng/phiếu thu PDF/print.
- Seed dữ liệu CRM/order.
- Test CRUD, validation, permission, chống trùng SĐT.

PHASE 3 — LỊCH CHỤP VÀ KHO TRANG PHỤC
- Calendar/timeline.
- Phòng, photographer, makeup, editor.
- Conflict check + transaction lock + buffer theo mục 0.4.
- Check-in/check-out.
- Wardrobe QR, rental, return, phí.
- Test hai booking đồng thời.
- Test phân quyền theo chi nhánh.

PHASE 4 — ẢNH, DRIVE, PHOTOSHARE, AI
- Upload/storage adapter, local `/public/uploads`.
- Album, thumbnail, watermark.
- Tạo album từ Drive/NAS, quét folder con, preview, chọn nhanh quota.
- Link thả tim/chọn ảnh, ghi chú, copy mã 4 định dạng.
- Lọc mã ảnh khách chọn: chữ+số/chỉ số, folder gốc, folder đích, RAW/JPG, manifest/missing.
- Google Drive OAuth, refresh token, sync, missing.
- ZIP + manifest + missing.
- AI Hub, local fallback, matching.
- Test token, selection, export, upload security, local folder fallback.

PHASE 5 — TÀI CHÍNH, NHÂN SỰ, VẬN HÀNH
- Sổ quỹ, thu chi, công nợ, hóa đơn.
- VietQR, mock webhook, idempotency.
- Commission engine.
- HR, chấm công, lương.
- Tasks, documents, campaigns, inbox, reports, settings, audit.
- Test tính tiền, hoa hồng, webhook, báo cáo.

PHASE 6 — WEBSITE CÔNG KHAI VÀ LANDING PAGE
- Triển khai landing page theo A.0–A.7.
- Header, hero, pain point, steps, features, product showcase, screenshots, PhotoShare, pricing, testimonials, FAQ, guide, final CTA, footer.
- Trang giải pháp, pricing, guide, blog, legal, auth UI.
- SEO, responsive, accessibility, performance.
- Kiểm tra mobile/tablet.
- Không dùng asset/nội dung không có quyền.
- Chạy acceptance test A.7.

PHASE 7 — QA VÀ BÀN GIAO
- Chạy toàn bộ test.
- Chạy app thật và kiểm tra bằng trình duyệt.
- Kiểm tra tất cả route chính, phân quyền, tenant isolation.
- Kiểm tra landing page trên desktop/tablet/mobile.
- Cập nhật README:
  - Cách chạy bằng một lệnh.
  - Migration/seed.
  - Tài khoản demo theo vai trò, PIN/mật khẩu.
  - Biến môi trường.
  - Giới hạn hiện tại và credentials cần bổ sung.
- Đánh dấu `[x]` trong PROGRESS.md.
- Báo cáo route, file chính, test results, known limitations.

QUY TẮC LÀM VIỆC
- Khảo sát trước khi viết.
- Không hỏi lại những điều đã nêu; đưa ra giả định hợp lý.
- Chỉ hỏi khi thiếu credentials, thiếu quyết định thương hiệu hoặc cần thao tác phá hủy dữ liệu.
- Không tự commit/push/deploy.
- Không xóa dữ liệu/bảng/cột nếu chưa có xác nhận và rollback.
- Cập nhật PROGRESS.md sau mỗi phase.
- Nếu context hạn chế, chia nhỏ theo phase/file; không cắt bớt phạm vi.
- Không báo hoàn thành khi còn placeholder hoặc build lỗi.

DEFINITION OF DONE
- Ứng dụng chạy được bằng một lệnh rõ ràng.
- Migration và seed chạy được trên database mới.
- Có tài khoản demo cho từng vai trò.
- Auth, session, RBAC và tenant isolation hoạt động.
- CRM, đơn hàng, lịch, dịch vụ, album, tài chính, nhân sự, task CRUD được.
- Luồng lead → hoàn tất đơn chạy end-to-end.
- Tạo album từ Drive/NAS, tab thư mục con, link thả tim/chọn ảnh hoạt động.
- Copy mã ảnh đúng 4 định dạng; khách gửi selection; studio khóa/mở được.
- Lọc ảnh theo mã khách chọn từ folder máy tính hoạt động với File System Access API hoặc fallback.
- ZIP/manifest/missing chạy end-to-end.
- Booking conflict bị chặn đúng.
- Webhook thanh toán idempotent.
- Dashboard/báo cáo đọc dữ liệu thật.
- Landing page đủ section theo A.3, pass A.7.
- Public pages có SEO, responsive, không placeholder.
- Có export CSV/PDF/ZIP cần thiết.
- Có adapter local/live rõ ràng cho Drive, payment, messaging, AI.
- Có audit log cho thao tác nhạy cảm.
- Có kiểm thử unit/integration/E2E hoặc manual test được ghi lại.
- Responsive desktop/tablet/mobile.
- Lint, typecheck, build pass.
- README đầy đủ; không có secret/PII/asset không có quyền.
- Không còn nút giả, route placeholder hoặc TODO trong luồng chính.

BẮT ĐẦU NGAY
Bắt đầu từ PHASE 0:
1. Khảo sát repo hiện tại.
2. Lập PLAN.md và PROGRESS.md.
3. Đề xuất route map, data model, permission matrix, landing page blueprint và thứ tự triển khai.
4. Dừng lại báo cáo kế hoạch để xác nhận.
5. Sau khi được xác nhận, triển khai tiếp Phase 1 và các phase tiếp theo.