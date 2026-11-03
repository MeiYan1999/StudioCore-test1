# StudioCore — UI System

Version: 1.1 · Ngày: 02/11/2026 · Trạng thái: cập nhật font và màu theo tham chiếu StudioBase

Tài liệu này là nguồn quy chuẩn giao diện cho nền tảng SaaS quản lý studio ảnh StudioCore. Đây là quyết định thiết kế của dự án, không phải mô tả tính năng hay cam kết chất lượng của một skill bên ngoài.

## 1. Mục tiêu và thứ tự ưu tiên

1. Người dùng hoàn thành nghiệp vụ đúng, nhanh và hiểu kết quả.
2. Dữ liệu dễ đọc; trạng thái, quyền và hành động rõ ràng.
3. Các module dùng chung component và token.
4. Giao diện tinh gọn, chuyên nghiệp, có bản sắc studio ảnh.
5. Hiệu ứng chỉ hỗ trợ phản hồi và định hướng chú ý.

Đối tượng: chủ studio, quản lý, lễ tân/sale, photographer, editor, kế toán và khách xem PhotoShare. Tiếng Việt mặc định. Ưu tiên desktop cho vận hành; các luồng thiết yếu phải dùng được trên điện thoại.

## 2. Phạm vi và cách dùng skill

- UI/UX Pro Max: skill chính để hỗ trợ lựa chọn design system, accessibility, form, bảng, biểu đồ và responsive.
- Taste Skill: hỗ trợ art direction, bố cục và đánh giá trực quan, đặc biệt landing page, pricing, PhotoShare. Có thể dùng rà soát app khi tuân thủ tài liệu này.
- Không phụ thuộc skill để xác thực dữ liệu, kiểm tra quyền, thiết kế database hoặc triển khai nghiệp vụ.
- Không bật đồng thời nhiều hướng thiết kế độc lập cho cùng màn hình.
- Thứ tự xử lý xung đột: yêu cầu trực tiếp của người dùng → nghiệp vụ/bảo mật/accessibility bắt buộc → UI_SYSTEM.md → quy ước component hiện hữu → đề xuất skill.
- Khi cần đổi quy chuẩn: ghi lý do, phạm vi ảnh hưởng và cập nhật token/component dùng chung; tránh sửa cục bộ bằng giá trị rải rác.
- Nếu skill không có trong môi trường, tiếp tục theo đặc tả này và báo rõ; không tuyên bố đã sử dụng skill.

## 3. Hướng thiết kế

Phong cách: nền xám sáng hơi lạnh, card trắng, chữ xám đậm, bảng gọn, màu nhấn xanh dương theo tham chiếu StudioBase. Không dùng teal làm màu thương hiệu. Ảnh là điểm nhấn trên PhotoShare và marketing. App quản trị dành diện tích cho dữ liệu.

Không dùng gradient trang trí toàn dashboard, glassmorphism trên bảng, emoji thay icon, shadow nặng ở mọi card hoặc animation làm chậm thao tác. Một trang có một hành động chính nổi bật; hành động nguy hiểm tách khỏi nhóm thường dùng.

## 4. Design tokens

Dùng CSS custom properties làm nguồn duy nhất và ánh xạ vào theme Tailwind/component library hiện có. Không thay cấu hình framework khi chưa kiểm tra phiên bản trong repo.

### 4.1 Màu

Nguồn tham chiếu do người dùng chọn: https://studiobase.vn/studio, kiểm tra ngày 02/11/2026. Font được xác định từ HTML và CSS công khai; màu lấy từ biến theme `:root` và `.dark` trong stylesheet công khai của website. Đây là token toàn site, chưa phải kết quả đo computed style của từng component tại route /studio. Component có thể có override riêng. Chỉ tham chiếu font và màu; các quy tắc nghiệp vụ và bố cục StudioCore vẫn theo tài liệu này.

HSL là giá trị chuẩn để giữ đúng màu gốc; HEX bên dưới là quy đổi làm tròn cho tiện đọc.

| Token | Light | Dark | Vai trò |
|---|---|---|---|
| --background | hsl(220 20% 96%) | hsl(220 20% 7%) | Nền ứng dụng |
| --surface | #FFFFFF | hsl(220 20% 10%) | Panel, form, bảng |
| --surface-muted | hsl(220 14% 96%) | hsl(215 28% 17%) | Header bảng, vùng phụ |
| --foreground | #333333 | hsl(213 31% 91%) | Chữ chính |
| --muted-foreground | hsl(215 16% 47%) | hsl(215 20% 65%) | Chữ phụ |
| --border | hsl(220 13% 91%) | hsl(215 28% 17%) | Phân tách trang trí |
| --input-border | #64748B | #94A3B8 | Biên input, điều chỉnh riêng cho khả năng nhận diện |
| --primary | hsl(211 100% 35%) | hsl(210 100% 50%) | CTA, trạng thái chọn |
| --primary-hover | hsl(211 100% 30%) | hsl(210 100% 45%) | Hover CTA |
| --primary-foreground | #FFFFFF | #0B1220 | Chữ CTA; dark được điều chỉnh để tăng tương phản |
| --secondary | hsl(210 100% 65%) | hsl(215 28% 17%) | Màu phụ |
| --accent | hsl(210 100% 95%) | hsl(215 28% 17%) | Nền chọn/hover nhẹ |
| --accent-foreground | hsl(211 100% 35%) | hsl(213 31% 91%) | Chữ trên accent |
| --focus | hsl(211 100% 35%) | hsl(210 100% 50%) | Focus ring |
| --danger | #B91C1C | #FCA5A5 | Semantic text/icon, điều chỉnh cho khả năng đọc |
| --success | #166534 | #86EFAC | Semantic text/icon, điều chỉnh cho khả năng đọc |
| --warning | #92400E | #FCD34D | Semantic text/icon, điều chỉnh cho khả năng đọc |
| --info | #1D4ED8 | #93C5FD | Semantic text/icon, điều chỉnh cho khả năng đọc |

Màu tham chiếu light quy đổi: primary ≈ #0056B2; hover ≈ #004A99; background ≈ #F3F4F7; muted ≈ #F3F4F6; border ≈ #E5E7EB; accent ≈ #E5F2FF; secondary ≈ #4DA6FF; muted text ≈ #65758B.

Các token thương hiệu/nền/chữ cơ bản ở trên lấy theo theme nguồn. Input border, chữ trên CTA dark và semantic text là điều chỉnh chủ động cho StudioCore, không phải giá trị trích nguyên bản. Nguồn dùng input border bằng border và chữ trắng trên primary ở cả hai theme. Không dùng secondary xanh nhạt với chữ trắng cỡ nhỏ. Muted text của nguồn cần kiểm tra trên từng nền; nếu không đạt tương phản, dùng foreground hoặc màu đậm hơn trong cùng họ màu.

Ví dụ khai báo token light (ánh xạ các token khác theo bảng):

```css
:root {
  --font-sans: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --background: hsl(220 20% 96%);
  --surface: #ffffff;
  --foreground: #333333;
  --primary: hsl(211 100% 35%);
  --primary-hover: hsl(211 100% 30%);
  --primary-foreground: #ffffff;
  --accent: hsl(210 100% 95%);
  --border: hsl(220 13% 91%);
}
body {
  font-family: var(--font-sans);
  background: var(--background);
  color: var(--foreground);
}
```

Snippet dùng màu CSS hoàn chỉnh: gọi `var(--primary)`, không bọc thêm `hsl()`. Nếu repo đang lưu HSL channels kiểu shadcn, chuyển đồng bộ sang `211 100% 35%` và gọi `hsl(var(--primary))`; không trộn hai định dạng.

Màu semantic dùng cho chữ/icon trên surface tương ứng. Không tự dùng màu semantic làm nền nút với chữ trắng, nhất là dark mode. Với badge, định nghĩa riêng background/foreground và kiểm tra từng cặp màu. Không dựa duy nhất vào màu để biểu thị trạng thái.

Light là mặc định lần đầu. Lưu lựa chọn light/dark/system của người dùng; khi chọn system thì theo thiết bị. Khởi tạo theme trước khi render để giảm nháy. Đo tương phản thực tế sau khi có opacity, overlay, hover và disabled; bảng token không thay thế kiểm chứng.

### 4.2 Typography

- Font chính đã xác minh: Be Vietnam Pro. Font stack: `"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- HTML nguồn tải Be Vietnam Pro weight 300/400/500/600/700/800. StudioCore chỉ tải 400/500/600/700 trước; thêm 300/800 khi có component sử dụng. Ưu tiên self-host hoặc cơ chế font của framework; dùng display swap, tránh chặn chữ khi tải font.
- Nguồn cũng khai báo Playfair Display italic 500/600/700, nhưng chưa xác minh nó được dùng ở thành phần nào của /studio. Không áp dụng font này cho bảng, form hoặc điều hướng; chỉ bổ sung khi thiết kế marketing thực sự cần.
- CSS body nguồn đặt 13px. StudioCore giữ body 14px/22px để dễ đọc; compact desktop có thể dùng 13px cho bảng phụ khi đã kiểm tra. Font giống nguồn, kích thước là lựa chọn có chủ đích cho sản phẩm.
- Body: 14px/22px desktop; form mobile: tối thiểu 16px.
- Page title: 24px/32px, weight 600; mobile 22px/30px.
- Section title: 18px/26px, weight 600.
- Label/button: 14px/20px, weight 500.
- Caption: 12px/18px; chỉ dùng cho thông tin phụ.
- Số tiền, KPI, giờ và bảng số dùng tabular-nums, căn phải khi cùng cột.
- Kiểm tra đủ dấu tiếng Việt, không cắt dấu trên/dưới dòng.

### 4.3 Spacing, hình khối và layer

- Thang khoảng cách: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- Page padding: mobile 16px; tablet 24px; desktop 32px.
- Gap form/card: 16–24px. Header trang cách nội dung 24px.
- Radius: input/button 8px; card/dialog 12px; badge pill.
- Shadow: chỉ dropdown, popover, drawer/dialog hoặc phần tử cần nổi; card thường dùng border.
- Layer: base 0; sticky 10; dropdown 30; drawer 40; modal 50; toast 60. Dùng primitive quản lý portal/focus thay vì tăng z-index tùy tiện.
- Icon: Lucide hoặc bộ SVG thống nhất; 16px trong bảng, 20px cho điều hướng; icon trang trí aria-hidden.

## 5. App shell và điều hướng

- Desktop từ 1024px: sidebar 240px; có thể thu còn 72px nếu cung cấp tooltip và accessible name.
- Dưới 1024px: sidebar thành drawer, đóng bằng Escape, trả focus về nút mở và đóng sau khi chọn route.
- Topbar cao tối thiểu 64px; cho phép nội dung tăng chiều cao khi zoom hoặc wrap.
- Nội dung vận hành rộng tối đa 1600px, căn giữa; bảng/lịch cần thiết có thể dùng toàn chiều rộng. Trang đọc/cấu hình tối đa 960px.
- Mỗi trang có h1, mô tả ngắn nếu cần, hành động chính và bộ lọc gần vùng dữ liệu.
- Breadcrumb chỉ khi hữu ích cho phân cấp, không lặp lại menu vô nghĩa.

| Nhóm | Module |
|---|---|
| Tổng quan | Dashboard |
| Kinh doanh | Khách hàng/CRM, Đơn hàng, Dịch vụ, Marketing |
| Sản xuất | Lịch chụp, Album/PhotoShare, Công việc |
| Vận hành | Nhân sự, Chấm công, Kho/trang phục |
| Tài chính | Thu chi, Công nợ, Hóa đơn, Lương/hoa hồng |
| Hệ thống | Báo cáo, Tích hợp/AI Hub, Cấu hình, Nhật ký |

Menu hiển thị theo quyền; server vẫn kiểm tra session, permission, tenant/chi nhánh và phạm vi bản ghi. Không coi việc ẩn menu là kiểm soát truy cập.

## 6. Component và tương tác

### 6.1 Buttons

- Variant: primary, secondary, ghost, destructive; size mặc định cao 40px, compact 32px ở desktop.
- Mobile: vùng chạm mục tiêu 44×44px; icon nhỏ có hit area mở rộng.
- Loading có spinner và nhãn mô tả; chặn submit lặp trong thời gian gửi.
- Disabled chỉ khi có lý do; giải thích điều kiện còn thiếu bằng text gần hành động.
- Nút chỉ icon phải có accessible name; tooltip không thay label truy cập.

### 6.2 Forms

- Label luôn hiện; placeholder chỉ đưa ví dụ.
- Hiển thị ký hiệu bắt buộc kèm quy ước; helper text nói đúng định dạng mong đợi.
- Validate tại client để phản hồi sớm và tại server để đảm bảo dữ liệu; giữ nguyên dữ liệu nhập khi lỗi.
- Lỗi ngay dưới trường, liên kết aria-describedby và aria-invalid; form dài có error summary dẫn tới trường lỗi đầu tiên.
- Một cột trên mobile; desktop tối đa hai cột cho trường liên quan. Ghi chú dài chiếm cả hàng.
- Tiền có nhãn VND; parser không gửi chuỗi đã định dạng vào phép tính.
- PIN/mật khẩu cho phép password manager và paste; có nút hiện/ẩn với nhãn rõ.
- Form dài cảnh báo khi rời trang nếu có thay đổi chưa lưu; không chặn sau khi lưu thành công.
- Form tạo đơn hiển thị tổng tiền, đã thu và còn phải thu; các giá trị lấy từ quy tắc nghiệp vụ thống nhất.

### 6.3 Data tables

- Toolbar: tìm kiếm, bộ lọc, số kết quả, xóa lọc, export theo quyền.
- Search debounce khoảng 300ms; hủy/loại kết quả cũ, thể hiện loading khi chờ. Lưu filter/sort/page vào URL khi không chứa dữ liệu nhạy cảm.
- Pagination phía server cho dữ liệu lớn; mặc định 20 dòng, lựa chọn 20/50/100.
- Header sticky trong đúng scroll container; không che hàng đầu khi cuộn hoặc zoom.
- Row cao tối thiểu 48px; chế độ compact 40px cho desktop, không ép trên mobile.
- Tên căn trái; số tiền căn phải; ngày/giờ định dạng nhất quán.
- Sort có nút bàn phím và aria-sort. Checkbox chọn hàng có tên rõ.
- Bulk action chỉ xuất hiện khi có selection; nêu số lượng/phạm vi. Đổi bộ lọc thì xóa selection, trừ khi có cơ chế chọn toàn bộ kết quả được giải thích rõ.
- Mobile: ưu tiên cột tên/trạng thái/hành động, chi tiết mở riêng; nếu cần bảng đầy đủ, cuộn ngang trong vùng bảng có dấu hiệu nhận biết. Không làm cả trang cuộn ngang.
- Không làm toàn bộ hàng chỉ dùng được bằng click; liên kết tên bản ghi phải truy cập bằng bàn phím.

### 6.4 Dialog, drawer và phản hồi

- Drawer cho xem nhanh; trang riêng cho hồ sơ hoặc form nhiều bước; dialog cho quyết định ngắn.
- Modal có title, focus trap, đóng bằng Escape khi phù hợp và trả focus. Không xếp chồng nhiều modal.
- Xác nhận hành động phá hủy ghi đúng đối tượng và hậu quả. Với thao tác không thể hoàn tác có tác động lớn, yêu cầu xác nhận rõ hơn theo nghiệp vụ.
- Thành công đơn giản: toast ngắn; lỗi chặn nghiệp vụ: thông báo tại nơi thao tác, có cách thử lại. Không chỉ dùng toast cho lỗi cần xử lý lâu.
- Thông báo bất đồng bộ dùng live region phù hợp, tránh đọc lặp liên tục.

## 7. Trạng thái nghiệp vụ

Mỗi trạng thái gồm mã ổn định, nhãn tiếng Việt và semantic tone. DB/service/UI dùng chung mapping. Không dùng label tiếng Việt làm khóa. Bảng dưới chỉ quy định hiển thị; quyền chuyển trạng thái thuộc service nghiệp vụ.

| Mã đơn hàng | Nhãn | Tone |
|---|---|---|
| new | Mới | neutral |
| deposit_received | Đã cọc | info |
| confirmed | Đã xác nhận | info |
| scheduled | Đã lên lịch | info |
| shooting | Đang chụp | info |
| awaiting_edit | Chờ chỉnh sửa | warning |
| editing | Đang chỉnh sửa | info |
| awaiting_approval | Chờ duyệt | warning |
| delivered | Đã giao | success |
| completed | Hoàn tất | success |
| cancelled | Đã hủy | neutral |

Trạng thái thanh toán tách khỏi trạng thái sản xuất: Chưa thu / Thu một phần / Đã thu đủ / Hoàn tiền theo dữ liệu tài chính. Cờ quá hạn và còn nợ là thuộc tính riêng, không tự thay trạng thái đơn. Mã chưa biết phải có fallback rõ và được ghi nhận để sửa mapping.

## 8. Mẫu màn hình chính

### Dashboard

- Hàng đầu 3–4 KPI quan trọng theo vai trò; không ép đủ card khi thiếu dữ liệu.
- Mỗi KPI có kỳ đo, đơn vị và cơ sở so sánh. Thiếu kỳ trước thì ghi chưa đủ dữ liệu.
- Phân biệt tiền đã thu, giá trị đơn, công nợ và lợi nhuận. Không gọi tiền cọc là lợi nhuận.
- Ưu tiên lịch hôm nay, việc quá hạn và khoản cần thu trước biểu đồ trang trí.
- Biểu đồ có nhãn/legend, mô tả hoặc bảng dữ liệu thay thế; không dùng màu duy nhất phân biệt chuỗi. Không vẽ 3D.

### CRM và đơn hàng

- Danh sách có tìm tên/SĐT/mã và bộ lọc hữu ích; hồ sơ dùng tab Tổng quan, Đơn hàng, Album, Tương tác khi đủ dữ liệu.
- SĐT có hành động gọi/sao chép rõ; che dữ liệu khi vai trò không được xem.
- Chi tiết đơn có thông tin khách, gói chụp, lịch, tiến độ, thanh toán và timeline; hành động chính phụ thuộc trạng thái/quyền.
- Timeline hiển thị người thực hiện và thời điểm; không tự tạo lịch sử giả.

### Lịch chụp

- View ngày/tuần/tháng; bộ lọc chi nhánh, photographer, phòng.
- Mobile mặc định agenda/list; tránh thu nhỏ lịch tuần đến mức không đọc được.
- Event có giờ, tên khách/mã đơn và người phụ trách theo quyền.
- Kéo thả phải có cách sửa giờ bằng form; server kiểm tra trùng giờ và buffer, thất bại thì phục hồi vị trí cũ và giải thích xung đột.
- Hiển thị rõ lịch hủy, giờ nghỉ và ngày hiện tại, không chỉ bằng màu.

### Album và PhotoShare

- Gallery ưu tiên ảnh, nền yên tĩnh; thumbnail có aspect ratio ổn định để giảm nhảy layout.
- Ảnh chọn có icon, viền và bộ đếm; nút gửi lựa chọn tách khỏi thao tác đánh dấu ảnh.
- Nêu rõ giới hạn gói và trạng thái đã lưu/đang lưu/lỗi; hỗ trợ thử lại và tránh ghi đè selection mới bằng phản hồi cũ.
- Fullscreen có điều hướng bàn phím, đóng bằng Escape và trả focus về thumbnail.
- Download chỉ hiện khi được phép; server kiểm tra token, expiry, password và quyền tải. Link hợp lệ không đồng nghĩa được truy cập toàn bộ album khác.
- Các trạng thái hết hạn, yêu cầu mật khẩu, chưa có ảnh, thiếu ảnh và lỗi tải có màn hình riêng.

### Tích hợp và AI Hub

- Trạng thái riêng: Chưa cấu hình, Đã kết nối, Mất kết nối, Lỗi, Đang đồng bộ.
- Local/demo/fallback phải có nhãn; không báo kết nối hoặc AI xử lý thành công khi chưa chạy.
- Không hiện secret thật; field khóa đã lưu dùng giá trị che và thao tác thay thế rõ.

## 9. Loading, empty, error và đồng bộ

| Tình huống | Cách hiển thị |
|---|---|
| Tải lần đầu | Skeleton đúng hình khối, có thông báo loading truy cập được |
| Đổi filter/page | Giữ cấu trúc, đánh dấu đang cập nhật và tránh thao tác trên dữ liệu cũ |
| Chưa có dữ liệu | Giải thích + CTA tạo mới theo quyền |
| Không có kết quả lọc | Hiện bộ lọc hiện tại + Xóa bộ lọc |
| Lỗi mạng/server | Thông báo dễ hiểu + Thử lại; giữ dữ liệu nhập |
| Không có quyền | 403 hoặc thông báo đúng ngữ cảnh, không lộ dữ liệu |
| Bản ghi không tồn tại | 404 hoặc trạng thái bản ghi đã bị xóa |
| Tích hợp thiếu cấu hình | Nêu bước cấu hình và người có quyền thực hiện |

Tài chính, đổi quyền và thao tác không thể hoàn tác chờ server xác nhận. Optimistic UI chỉ dùng với thao tác dễ phục hồi như đánh dấu ảnh/task; phải rollback và thông báo khi lỗi. Không đưa stack trace hoặc secret ra giao diện.

## 10. Responsive, accessibility và motion

- Kiểm tra các viewport 375, 768, 1024, 1440px cùng nội dung thực tế dài; breakpoint theo chỗ bố cục cần thay đổi.
- Hỗ trợ zoom 200%; không mất nút chính, chữ, focus hoặc nội dung form. Tránh height cố định chứa text.
- Mục tiêu nghiệm thu WCAG 2.2 AA: tương phản text thường ít nhất 4.5:1, text lớn ít nhất 3:1; thành phần giao diện quan trọng 3:1 theo ngữ cảnh áp dụng.
- Có skip link, landmark, heading đúng cấp, label, focus rõ và thứ tự tab hợp lý.
- Touch target tối thiểu theo tiêu chí áp dụng; dự án đặt mục tiêu 44×44px trên mobile, không dùng kích thước icon làm hit area.
- Tooltip có cách mở bằng focus; không giấu hướng dẫn quan trọng chỉ trong hover.
- Motion thông thường 120–200ms cho opacity/transform. Không animation liên tục trên app vận hành.
- Tôn trọng prefers-reduced-motion; bỏ parallax, chuyển động lớn và transition không cần thiết. Không làm mất phản hồi trạng thái khi giảm motion.

## 11. Ngôn ngữ và định dạng dữ liệu

- Nhãn trực tiếp: Tạo đơn hàng, Lưu thay đổi, Thu cọc, Gửi lựa chọn; tránh OK hoặc Xử lý nếu thiếu nghĩa.
- Lỗi nói vấn đề và hướng xử lý: “Photographer đã có lịch 14:00–15:00. Chọn khung giờ khác.”
- Ngày dd/MM/yyyy; giờ HH:mm; dùng định dạng locale vi-VN và timezone Asia/Ho_Chi_Minh khi hiển thị.
- DB lưu thời điểm UTC; lịch một ngày phải chuyển đúng biên ngày theo múi giờ nghiệp vụ.
- Tiền lưu integer VND; format bằng Intl.NumberFormat. Ví dụ hiển thị 1.250.000 ₫.
- Thiếu dữ liệu dùng “Chưa có” hoặc dấu gạch theo ngữ cảnh; không biến null thành 0 khi hai giá trị khác nghĩa.
- Dữ liệu demo phải hư cấu, nhãn demo rõ ở môi trường demo; không hard-code dữ liệu nghiệp vụ trong component production.

## 12. Quy tắc triển khai

- Next.js/React/TypeScript, Tailwind và component library theo repo hiện tại. Dùng primitive có sẵn cho dialog, menu, tabs, tooltip; không tự viết lại nếu không có lý do.
- Đề xuất phân lớp: token/theme → UI primitives → component nghiệp vụ → page/module. Điều chỉnh đường dẫn theo cấu trúc repo, không tạo hệ thống song song.
- Component dùng chung: PageHeader, FilterBar, DataTable, StatusBadge, Money, DateTime, EmptyState, ErrorState, PermissionGate (chỉ phục vụ UX), ConfirmDialog, PhotoGrid.
- UI nhận dữ liệu qua props/query/service, không chứa logic tính tiền/permission quan trọng riêng lẻ.
- Pagination/filter server-side, lazy load gallery, thumbnail thay ảnh gốc ở grid. Chỉ dùng virtualization khi quy mô dữ liệu cần và vẫn bảo toàn keyboard access.
- Kiểm tra font, ảnh và chart có làm layout shift hoặc tăng bundle bất hợp lý; dùng client component khi thực sự cần tương tác.
- Lưu trạng thái filter tiện lợi nhưng không đưa token, secret, ghi chú riêng hoặc PII không cần thiết vào URL/log.

## 13. Quy trình và tiêu chí nghiệm thu

1. Đọc repo và yêu cầu module; xác định vai trò, dữ liệu, quyền và tác vụ chính.
2. Dùng token/component hiện có, thiết kế đầy đủ loading/empty/error/success và responsive.
3. Triển khai luồng thật, kiểm tra quyền và validation tại server.
4. Chạy kiểm tra phù hợp của repo: lint, typecheck, build và test luồng nghiệp vụ liên quan.
5. Mở app thật tại các viewport nêu trên; kiểm tra nội dung dài, bàn phím, focus, modal, cuộn bảng và theme.
6. Nếu dùng Taste để rà soát, giữ nguyên quy tắc nghiệp vụ và design system; sửa các lỗi trực quan có bằng chứng từ màn hình thực tế.
7. Báo rõ đã kiểm tra gì, kết quả và giới hạn; không đánh dấu pass khi chưa chạy.

Checklist trước khi bàn giao:

- [ ] Luồng chính hoạt động, không có nút giả hoặc thông báo thành công giả.
- [ ] Màu/font/spacing/component thống nhất; đủ dấu tiếng Việt.
- [ ] Đọc được bảng và thao tác được trên mobile, không tràn ngang toàn trang.
- [ ] Form giữ dữ liệu khi lỗi; submit không bị lặp; tiền/ngày/múi giờ đúng.
- [ ] Có empty/loading/error/permission state; filter có thể xóa.
- [ ] Không lộ dữ liệu vượt quyền; thao tác nhạy cảm chờ server xác nhận.
- [ ] Keyboard/focus/contrast/reduced-motion đã kiểm tra theo phạm vi thay đổi.
- [ ] Dark mode được kiểm tra nếu module/theme được bàn giao có hỗ trợ.
- [ ] Kiểm tra mã và trình duyệt đã chạy, có ghi nhận phần chưa kiểm chứng.

## 14. Chỉ dẫn ngắn cho coding agent

> Đọc UI_SYSTEM.md trước mọi thay đổi giao diện StudioCore. Giữ font Be Vietnam Pro và bảng màu xanh dương theo StudioBase trong mục 4; không tự chọn lại palette hoặc đổi sang teal. Dùng UI/UX Pro Max để hỗ trợ thiết kế hệ thống và UX; dùng Taste Skill khi cần art direction hoặc rà soát trực quan trong giới hạn tài liệu này. Ưu tiên luồng nghiệp vụ, khả năng đọc và thao tác. Tái sử dụng token/component, triển khai đủ các trạng thái và kiểm tra trên trình duyệt thật. Không tự đổi design system, không dùng dữ liệu hoặc thành công giả để che phần chưa triển khai. Báo rõ phần đã kiểm tra và phần còn thiếu.
