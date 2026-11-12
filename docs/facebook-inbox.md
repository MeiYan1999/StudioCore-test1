# Facebook Inbox, đặt lịch và chốt đơn

## Chạy local

Dùng Node theo package.json, chạy `npm ci`, sao chép `.env.example` thành `.env.local`, cấu hình `AUTH_SECRET`, sau đó chạy `npm run db:migrate` và `npm run dev`. Với cơ sở dữ liệu thử riêng, đặt `DATABASE_URL=./data/omni-review.db` khi chạy migrate, seed và dev. `npm run db:seed` tạo tài khoản demo được mô tả trong README chính. Không seed dữ liệu vào cơ sở dữ liệu studio thật.

Migration `0009_misty_gunslinger.sql` bổ sung bảng transport Facebook, OAuth state, cấu hình gói công khai, booking token, giữ chỗ, ghi chú, mẫu trả lời và khóa chống thu cọc lặp. Migration có trigger để các đường tạo lịch cũ cũng tôn trọng tài nguyên đang được giữ bởi Inbox. Sao lưu SQLite và khóa token trước khi triển khai. Giữ SQLite trên persistent disk, một ứng dụng sử dụng cùng một file. Không triển khai nhiều replica với các file SQLite độc lập.

Mở **Cài đặt → Kênh bán hàng · Facebook**. Chủ studio chọn gói dịch vụ hiện có, tài nguyên phòng hoặc photographer, giờ mở cửa, ngày nghỉ, thời gian dọn set, thời hạn giữ chỗ và cọc tối thiểu. Link công khai có dạng `/book/{serviceId}`. Lịch tạo tại đây xuất hiện trong Lịch chụp ngày/tuần/tháng hiện có.

## Meta App

1. Tạo Meta App có Facebook Login và Messenger, gắn Page thử do bạn quản lý. Khai báo domain và callback HTTPS chính xác tại `META_REDIRECT_URI`, dạng `https://your-domain/api/facebook/callback`. Local cần tunnel HTTPS do bạn cấu hình.
2. Đặt `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`. Sinh khóa bằng `openssl rand -base64 32` và đặt `META_TOKEN_KEY`. Token Page được mã hóa AES-256-GCM trong database. Khóa phải ổn định qua restart/deploy. Không đưa secret vào biến `NEXT_PUBLIC_*`.
3. Đặt `META_GRAPH_VERSION` thành phiên bản Graph đang được App hỗ trợ và đã kiểm tra trên Meta App Dashboard. Mã nguồn yêu cầu giá trị rõ ràng dạng `vNN.0`. Trong lần triển khai này, changelog chính thức trả HTTP 429, nên chưa xác minh được phiên bản mới nhất. Không dùng phiên bản trong test giả lập làm bằng chứng tương thích Meta thật.
4. Đăng ký callback webhook `https://your-domain/api/facebook/webhook` cho object Page, verify token bằng `META_VERIFY_TOKEN`. Đăng ký `messages`, `messaging_postbacks`, `message_echoes`, `message_deliveries`, `message_reads`, kiểm tra những field này được App/version chấp nhận. Message/postback ngoài định dạng hỗ trợ được bỏ qua, ảnh được lưu link từ payload.
5. Đăng nhập Facebook từ Cài đặt, chọn chi nhánh, cấp `pages_show_list`, `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`. Ứng dụng liệt kê Page có token, chủ studio bấm Kết nối trang để subscribe. Mỗi Page thuộc một studio trên instance này. Page đang thuộc studio khác sẽ không được tiếp quản qua OAuth.
6. Đặt `APP_URL` thành URL HTTPS công khai để link đặt lịch mở đúng website. Thử nhận/gửi bằng tài khoản có role trong App trước.
7. Để phục vụ người dùng ngoài role thử nghiệm, chuẩn bị App Review/Advanced Access theo quyền thực tế của App, business verification khi Meta yêu cầu, URL chính sách riêng tư và hướng dẫn/xử lý xóa dữ liệu. Quay video đăng nhập, chọn Page, nhận tin, gửi phản hồi, ngắt kết nối. Cấp tài khoản reviewer theo quy trình Meta. Việc duyệt App và callback thật cần thực hiện trên tài khoản Meta của chủ hệ thống.

Nguồn đã đối chiếu ngày 2026-11-11 gồm bộ Messenger API do Meta phát hành trên [Postman](https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api?entity=folder-22794852-5aa79b9c-3d12-48e3-8dd6-1ac6b29bcfbc) và yêu cầu quyền/Advanced Access ở [Conversations API](https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a). Cần kiểm tra lại [changelog Graph API](https://developers.facebook.com/docs/graph-api/changelog/) và [webhooks Messenger](https://developers.facebook.com/docs/messenger-platform/webhooks/) trước khi bật production vì hai trang này bị giới hạn truy cập trong phiên triển khai.

Luồng giao diện tham khảo thao tác xem đơn và soạn xác nhận ngay tại chat từ [Sapo Chat OmniAI](https://help.sapo.vn/tao-va-theo-doi-don-hang-tren-chat-omniai).

## Quy tắc vận hành

- Quyền owner quản lý Page và cấu hình công khai. Nhân viên chỉ đọc/thao tác hội thoại được phân công. Cọc yêu cầu thêm `finance.manage` trên server, cộng quyền thao tác hội thoại và lịch. Khách hàng cùng số điện thoại được tái sử dụng khi tạo đơn, nhưng liên kết hồ sơ vào hội thoại cần nhân viên xác nhận.
- Tin mới được refresh mỗi 5 giây khi tab đang hiển thị. Cửa sổ gửi MVP là 24 giờ từ tin nhắn inbound cuối của khách. Các ngoại lệ, tag, quảng cáo hay paid marketing chưa được bật. Cả server và composer chặn gửi ngoài cửa sổ.
- Gửi ảnh qua URL HTTPS công khai. Meta tải ảnh trực tiếp. Khi gửi ảnh, payload là ảnh, nội dung draft không được gửi kèm trong cùng message.
- Webhook được kiểm tra HMAC-SHA256 trên raw bytes trước khi parse. `mid` chống trùng. Timestamp lấy max, echo không mở lại cửa sổ 24 giờ. Echo có metadata đối chiếu request gửi. Mất phản hồi HTTP sau gửi được đánh dấu chưa rõ kết quả, kiểm tra Messenger trước khi gửi lại để tránh trùng.
- Yêu cầu đặt hợp lệ được giữ chỗ ngay trong transaction `IMMEDIATE`, tạo một đơn chính và một appointment. Giữ chỗ hết hạn không chặn availability. Hệ thống cập nhật trạng thái hết hạn khi mở Inbox, xem lịch hoặc tạo booking tiếp theo. Lịch đã nhận cọc một phần mà hết hạn vẫn giải phóng tài nguyên, tiền đã nhận còn nguyên trong sổ quỹ để xử lý với khách.
- Thời gian lưu UTC milliseconds, nhập/hiển thị giờ Việt Nam. Slot cách nhau 30 phút, tối đa 180 ngày tới. Đặt lịch kiểm tra giờ gói, ngày nghỉ, nghỉ phép được duyệt, phòng và photographer, gồm thời gian dọn set. Giờ làm của gói là lịch công khai được owner thiết lập.
- Link từ chat chứa token ngẫu nhiên 256 bit, database chỉ lưu SHA-256, có hạn 24 giờ và dùng cho một booking. Nguồn Facebook gắn đúng hội thoại/Page. Website trực tiếp có nguồn Website. Khi link đã dùng, khách cần liên hệ studio đổi lịch.
- Cọc yêu cầu khác cọc thực nhận. Thu cọc ghi payment, sổ quỹ, người xác nhận và thời điểm. Đủ cọc chuyển trạng thái confirmed. Mã tham chiếu ngân hàng cùng studio chống ghi nhận lại. Nếu không có mã tham chiếu, request key chống lặp cùng request.
- Đổi lịch kiểm tra tài nguyên trong transaction và cập nhật giờ đơn. Hủy cập nhật cả appointment và order. Khoản thu đã ghi nhận được giữ để xử lý hoàn tiền theo nghiệp vụ tài chính hiện có.

## Nghiệm thu và giới hạn xác minh

`npm test -- tests/integration/omnichannel.test.ts` kiểm tra chữ ký, mã hóa, webhook lặp/sai thứ tự, echo, quyền tenant/assignee, giữ chỗ lặp/tranh cùng giờ, trigger trên lịch cũ, xác nhận cọc lặp/thiếu quyền, hết hạn, gửi Meta thất bại và mất quyền. HTTP Meta được mock trong test. Database test chạy migration thật.

Kiểm tra thực tế trên Page thử sau khi cấu hình App gồm khách nhắn Page, owner phân công, nhân viên trả lời, gửi link, khách chọn giờ, xác nhận cọc, xem lịch cập nhật và soạn/gửi xác nhận. Tiếp tục thử token hết quyền, webhook replay, hai trình duyệt đặt cùng giờ và đặt trực tiếp website.

Chưa có nghiệm thu Meta thật trong phiên triển khai. Chưa xác minh App Review, phiên bản Graph hiện hành, callback Internet và subscribed fields trên App thực tế. Các trạng thái kết nối trong dữ liệu kiểm thử không chứng minh đã kết nối Meta. Phần duyệt nội dung và gửi thật cần kiểm tra bằng Page thử trước khi đưa vào vận hành.
