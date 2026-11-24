# StudioCore

[![CI/CD](https://github.com/MeiYan1999/StudioCore-test1/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/MeiYan1999/StudioCore-test1/actions/workflows/ci-cd.yml)

Nền tảng SaaS quản lý studio chụp ảnh. **Phase 0–7 đã hoàn tất**: auth, tenant, chi nhánh, RBAC, app shell, CRM, catalog, đơn hàng, thanh toán, hợp đồng/phiếu thu, calendar chống trùng, check-in/out, wardrobe QR, thiết bị, album/upload, PhotoShare, lọc ảnh theo mã khách chọn, Drive adapter, AI Hub local, sổ quỹ, hóa đơn/VietQR/webhook, commission/payroll/HR, báo cáo, tasks/docs/campaigns/inbox, settings/audit, landing marketing, public pages, onboarding, reset password, demo read-only, platform admin và QA/E2E bàn giao.

## Chạy local

Yêu cầu: Node.js >= 20.9, npm; Chrome cài sẵn nếu chạy E2E.

```bash
npm install
cp .env.example .env.local
# Đặt AUTH_SECRET bằng chuỗi ngẫu nhiên >= 32 ký tự, ví dụ:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run dev:demo
```

`npm run dev:demo` chạy migration + seed + dev server trong một lệnh. Mở http://localhost:3000.

Nếu muốn tách bước: `npm run db:migrate`, `npm run db:seed`, `npm run dev`.

Database demo nằm tại `data/studiocore.db`. Có thể chạy lại `npm run db:seed` nhiều lần; seed idempotent, không nhân đôi dữ liệu.

## Kiểm tra

```bash
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e
```

Kết quả Phase 7: lint/typecheck/build pass; **120/120 Vitest pass** (27 file); **7/7 Playwright E2E pass** trên Chrome hệ thống. `npm audit --omit=dev` báo 0 lỗ hổng production.

E2E mặc định dùng Chrome cài trên máy (`channel: chrome`) và tự khởi động dev server. Có thể đổi bằng `PLAYWRIGHT_CHANNEL` hoặc trỏ `E2E_BASE_URL` tới server đang chạy.

Mock payment webhook chỉ hoạt động ở development. Chạy `npm run dev` để thử sandbox tại `/manage/settings/payments/sandbox`; production cố ý trả 404 cho endpoint mock.

PhotoShare demo (sau khi seed): http://localhost:3000/share/demo-share-album-01 — album 12 ảnh synthetic có nhãn demo, quota 5 ảnh, phí ảnh thêm 150.000đ/ảnh khi bật.

## CI/CD

Workflow `.github/workflows/ci-cd.yml` chạy trên push/PR vào `main` và chạy tay:

- **CI**: `npm ci`, migrate + seed DB, lint, typecheck, Vitest, production build, Playwright E2E (Chromium trong CI, Chrome khi chạy local). Artifact Playwright được upload khi fail.
- **CD**: sau khi CI pass trên `main`, build Docker image và push lên GHCR với tag `latest` và tag SHA. Chưa tự deploy lên server vì chưa có target/credentials.

Image có thể chạy bằng Docker; container tự chạy migration trước `next start`, không tự seed dữ liệu demo:

```bash
docker run -d --name studiocore -p 3000:3000 \
  -e AUTH_SECRET="<chuoi-ngau-nhien-32-byte>" \
  -e TOKEN_ENCRYPTION_KEY="<chuoi-ngau-nhien-32-byte>" \
  -v studiocore-data:/app/data \
  -v studiocore-uploads:/app/public/uploads \
  ghcr.io/meiyan1999/studiocore-test1:latest
```

GHCR package mặc định có thể để private; đăng nhập `ghcr.io` trước khi pull nếu cần. Để deploy thật lên VPS/cloud, cần bổ sung bước deploy và secrets tương ứng.

## Deploy lên Render

Repo có Blueprint `render.yaml`: Docker web service `studiocore-test1`, region Singapore, gói Free không gắn disk, health check `/api/health`, tự deploy từ `main`.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/MeiYan1999/StudioCore-test1)

Sau khi kết nối Render với GitHub và duyệt Blueprint:

- `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` khai báo `sync: false` trong `render.yaml`: không commit giá trị, nhập trực tiếp trên Render Dashboard (Environment).
- `STORAGE_PROVIDER=r2` và `R2_BUCKET_NAME=studiocore-data` có sẵn trong Blueprint. Tạo bucket **private** với quyền đọc/ghi cho token R2, giữ nguyên bucket đang dùng khi chuyển gói và không bật URL công khai cho bucket chứa SQLite hoặc tài liệu.
- Container chỉ phục hồi SQLite từ `db/studiocore.db` khi chưa có DB cục bộ, sau đó chạy migration (và seed demo nếu bật `SEED_DEMO=true`). Nếu không truy cập được R2, container dừng thay vì mở DB mới. Ảnh và tài liệu tải lên được lưu trong R2.
- Ứng dụng kiểm tra commit SQLite mỗi 2 giây và gộp thay đổi vào một bản sao; vẫn kiểm tra mỗi phút và khi nhận tín hiệu dừng, không tải bản sao giống bản đã phục hồi/lưu. R2 chỉ nhận bản mới nếu ETag khớp bản instance đã phục hồi/lưu. Nếu mất phản hồi từ R2, ứng dụng đối chiếu SHA-256, định danh instance và thế hệ triển khai trước khi tiếp tục.
- Nếu DB cục bộ được giữ lại nhưng không có ETag đã ghi nhận, ứng dụng chỉ nhận ETag khi hai bản SQLite khớp. Khi hai bản khác nhau, tạm ngừng ghi, lưu riêng cả hai bản, đối chiếu và đưa bản đã xác nhận lên R2, rồi khởi động bằng bản đó trên filesystem mới.
- Render có thể chạy chồng hai instance khi redeploy hoặc Restart; thay đổi sau lúc instance mới tải bản sao không tự nhập vào instance mới. Trước mọi lần redeploy, tạm ngừng ghi, xác nhận các thay đổi cuối cùng đã có trong R2, rồi chỉ cho phép ghi lại sau khi instance mới hoạt động. Nếu instance mất trước khi upload thành công, những thay đổi chưa sao lưu có thể mất. Không chạy nhiều replica với các file SQLite độc lập.
- Với service hiện hữu, tạm ngừng ghi trước khi chuyển gói; xác nhận R2 có bản SQLite đầy đủ và lưu bản sao an toàn của dữ liệu cũ. Chép các ảnh chỉ có ở thư mục uploads vào R2 với nguyên đường dẫn tương đối, và tài liệu cũ trong `data/documents` vào tiền tố `documents/`. Sau đó gỡ disk (nếu có), chọn Free và đặt các biến trên trong Render Dashboard nếu service không được Blueprint quản lý.
- URL dự kiến: https://studiocore-test1.onrender.com. Nếu tên service bị trùng, đổi `name` và `NEXT_PUBLIC_SITE_URL` trong `render.yaml` trước khi deploy.
- Render Free xóa file cục bộ khi khởi động lại, deploy lại hoặc ngủ do không có truy cập; lượt truy cập đầu tiên sau khi ngủ phải chờ khởi động.
- Đây là môi trường demo công khai với tài khoản demo. Production: đặt `SEED_DEMO=false`, vô hiệu hóa/đổi mật khẩu tài khoản demo, dùng private storage và PostgreSQL.

### Tạo tài khoản quản trị nền tảng riêng

Trong Render → Environment, đặt `PLATFORM_ADMIN_LOGIN=admin` và `PLATFORM_ADMIN_PASSWORD_HASH` là hash scrypt do `hashSecret` của ứng dụng tạo. Tạo hash trên terminal riêng (Bash); mật khẩu từ 8 đến 128 ký tự, được nhập ẩn và không đặt trong lệnh hoặc file:

```bash
(
  IFS= read -rs -p 'Mật khẩu mới: ' password || exit 1
  printf '\n'
  printf '%s' "$password" | node --import tsx scripts/hash-platform-admin-password.ts
)
```

Giữ hash trong Render, không commit hoặc gửi qua chat. Khi container khởi động, ứng dụng tạo tài khoản sau restore và migrate, không cần seed demo và không thay mật khẩu tài khoản đã tồn tại. Đăng nhập bằng `admin` và mật khẩu tại `/login`; tài khoản này không có PIN. Đổi biến hash sau khi tạo **không** đặt lại mật khẩu.

## Chức năng đã có

- Đăng nhập email + mật khẩu hoặc mã nhân viên + PIN.
- Session cookie httpOnly, thu hồi phiên, rate limit/khóa tạm, audit đăng nhập.
- Multi-tenant, chi nhánh, RBAC server-side, tenant isolation.
- App shell responsive, theme sáng/tối/system, mobile drawer.
- Dashboard nền đọc dữ liệu thật từ seed.
- Quản lý người dùng, vai trò & quyền, phiên đăng nhập.
- CRM: danh sách/hồ sơ 360, tương tác, phân khúc, cảnh báo follow-up, CSV UTF-8 BOM.
- Dịch vụ, add-on, sản phẩm, voucher.
- Đơn hàng: khách có sẵn/khách mới, item động, voucher, phụ thu, giảm giá, cọc.
- Thanh toán thủ công, công nợ, timeline trạng thái, hủy đơn có kiểm soát.
- Hợp đồng và phiếu thu in A4; xác nhận hợp đồng nội bộ có audit.
- API export CSV khách hàng có kiểm tra quyền/tenant/branch.
- Lịch chụp ngày/tuần/tháng/timeline; phòng chụp; conflict check + buffer 30 phút; check-in/check-out.
- Booking transaction `BEGIN IMMEDIATE`, mutex, idempotency, slot gợi ý.
- Kho trang phục QR, thuê/trả, phí giặt/đền bù, lịch sử thuê.
- Thiết bị theo chi nhánh, trạng thái và lịch sử sử dụng.
- Album ảnh: tạo từ Drive demo/multi-link/upload, folder con, quota chọn, phí ảnh thêm, trạng thái và archive.
- Upload ảnh/ZIP; sharp kiểm tra định dạng, thumbnail 480×320 + preview 1440×960 có watermark; file runtime qua route kiểm tra key.
- PhotoShare `/share/[token]`: mật khẩu, hạn, thu hồi, token hash, gallery tab/folder, tim/chọn/ghi chú, quota, gửi selection, copy mã 4 định dạng.
- Studio xem/lock selection, notes CSV/TXT, ZIP + manifest + missing; giới hạn tải ảnh gốc.
- Lọc ảnh theo mã khách chọn: parser Excel/Zalo, chữ+số/chỉ số, ambiguous, File System Access + fallback ZIP, manifest/missing, lưu job.
- Drive/NAS adapter: local demo đầy đủ; Google OAuth/refresh token mã hóa/scan code sẵn sàng khi có credentials; NAS “chưa cấu hình”.
- AI Hub: local heuristic blur/exposure/near-duplicate/burst, job log/cost guard/consent, không giả vờ eye detection.
- Sổ quỹ thu/chi/hoàn, expenses, ngân sách, công nợ/tuổi nợ, hóa đơn VAT và in hóa đơn.
- Payment adapter manual/VietQR NAPAS; sandbox QR + mock webhook HMAC/idempotency; production tắt mock.
- Commission rule snapshot + duyệt/chi trả; payroll theo kỳ, lock kỳ, transaction lương; chấm công GPS/QR/thủ công, nghỉ phép.
- Báo cáo doanh thu/công nợ/chi phí/lợi nhuận/thuế, room utilization, KPI photographer/sale; dashboard mở rộng.
- Tasks board/list/comment/mention, documents private, campaigns ROAS/CPL, inbox local + AI auto-reply/handoff.
- Cài đặt studio/chi nhánh/template, trạng thái tích hợp, audit log + backup JSON an toàn; liên kết order/album/task/finance.
- Landing marketing 14 section, sticky header/mobile drawer, product tabs, screenshot gallery, PhotoShare showcase, pricing/FAQ/testimonials demo, SEO/JSON-LD/sitemap/robots.
- Public pages solution, pricing, guide, blog, legal, contact; contact request lưu DB có rate limit.
- Đăng ký tenant trial thật, reset password token local, demo read-only session bị chặn mutation ở server.
- Ảnh marketing capture từ app thật tại `public/marketing`.
- Platform admin `/platform`: quản lý tenant nền tảng, thống kê chi nhánh/nhân sự, yêu cầu liên hệ; tách khỏi dữ liệu tenant.

QA bàn giao Phase 7: E2E chính thức, kiểm tra route/RBAC/tenant/branch, 25 kịch bản acceptance, security test và docs bàn giao đã hoàn tất.

## Tài khoản demo

Mật khẩu chung: `Demo@123`. PIN 6 số dùng ở tab “Mã nhân viên & PIN”.

| Vai trò | Email | Mã nhân viên | PIN |
|---|---|---|---|
| Chủ studio | owner@studiocore.demo | SC-OWNER | 111111 |
| Quản lý chi nhánh | manager@studiocore.demo | SC-MANAGER | 222222 |
| Lễ tân / Sale | letan@studiocore.demo | SC-LETAN | 333333 |
| Photographer | photo@studiocore.demo | SC-PHOTO | 444444 |
| Photographer | photo2@studiocore.demo | SC-PHOTO2 | 555555 |
| Makeup artist | makeup@studiocore.demo | SC-MAKEUP | 666666 |
| Retoucher / Editor | retouch@studiocore.demo | SC-RETOUCH | 777777 |
| Kế toán | ketoan@studiocore.demo | SC-KETOAN | 888888 |
| Platform admin | platform@studiocore.demo | SC-PLATFORM | 000000 |

Tenant phụ dùng cho kiểm tra cách ly dữ liệu: `owner@studiobinhminh.demo` / mã `BM-OWNER` / PIN `999999` / mật khẩu `Demo@123`.

Dữ liệu, tên, số điện thoại, tài khoản ngân hàng và thông tin studio trong seed đều là hư cấu cho môi trường demo. Không dùng dữ liệu khách thật.

## Biến môi trường & credentials cần bổ sung

- Bắt buộc local: `AUTH_SECRET` (>= 32 byte ngẫu nhiên). Production bắt buộc thêm `TOKEN_ENCRYPTION_KEY`.
- Tùy chọn: `SESSION_TTL_HOURS`, `NEXT_PUBLIC_SITE_URL` (canonical/OG), `DATABASE_URL`.
- Google Drive live: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- AI live: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MONTHLY_BUDGET_VND`.
- Payment: `PAYMENT_PROVIDER`, `PAYMENT_WEBHOOK_SECRET`; credentials ngân hàng/VietQR bổ sung khi triển khai thật.
- Storage: `STORAGE_PROVIDER`; production cần bucket private + signed URL thay cho local public uploads.

Các adapter live được lazy-init; thiếu cấu hình sẽ hiển thị “chưa cấu hình”, không giả vờ thành công.

### Kết nối Google Calendar vào Lịch chụp

1. Trong [Google Cloud Console](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com), bật Google Calendar API. Cấu hình [Google Auth Platform](https://console.cloud.google.com/auth/overview) với quyền `calendar.events.owned.readonly`, rồi tạo OAuth client loại **Web application** riêng cho Calendar.
2. Thêm **Authorized redirect URI** chính xác theo `NEXT_PUBLIC_SITE_URL`: production là `https://www.studiocore.io.vn/api/calendar/google/callback`; local là `http://localhost:3000/api/calendar/google/callback`. Đặt `GOOGLE_CALENDAR_CLIENT_ID` và `GOOGLE_CALENDAR_CLIENT_SECRET` trong Render → Environment (hoặc `.env.local`). Giữ nguyên `TOKEN_ENCRYPTION_KEY` hiện tại để đọc được các kết nối sau khi khởi động lại. Nếu ứng dụng OAuth External ở trạng thái Testing, thêm tài khoản Google vào Test users; quyền có thể hết hạn sau 7 ngày.
3. Chủ studio vào **Lịch chụp → Đồng bộ Google Calendar**, nhập **Calendar ID** của một lịch Google do tài khoản kết nối sở hữu, chọn chi nhánh rồi cấp quyền đọc. Nên dùng lịch riêng cho studio vì tên và thời gian sự kiện sẽ hiển thị với người có quyền xem lịch ở chi nhánh đó. Để ngắt, bấm **Ngắt kết nối**; nếu muốn thu hồi cả quyền OAuth, gỡ ứng dụng Calendar riêng ở [kết nối Tài khoản Google](https://myaccount.google.com/connections).

Lịch chụp kiểm tra thay đổi khoảng 15 giây/lần khi tab đang hiển thị và cập nhật khi quay lại tab. Sự kiện Google chỉ để xem; không ghi vào hợp đồng, lịch đặt chỗ hay đặt phòng. Khi Render Free ngủ hoặc không có người xem, StudioCore không đồng bộ nền; khi mở Lịch chụp, StudioCore đọc lại Google cho khoảng ngày đang xem. Chiều StudioCore → Google vẫn là lịch đăng ký iCal và do Google quyết định thời điểm làm mới.

## Giới hạn hiện tại

- Kéo-thả calendar và camera QR scanner chưa triển khai; dùng form sửa giờ và máy quét bàn phím/nhập mã.
- Google Drive live, NAS/desktop helper, S3/R2, email/Zalo/SMS, Fanpage/Zalo connector và Meta/TikTok Ads chưa cấu hình; UI báo trung thực.
- PhotoShare demo dùng public uploads + route công khai; production cần private storage/signed URL.
- File System Access directory picker cần kiểm tra thủ công; fallback chọn thư mục/ZIP đã chạy E2E.
- AI live provider chưa kiểm chứng; eye detection chưa hỗ trợ.
- Sổ quỹ append-only; không sửa/xóa giao dịch tài chính, điều chỉnh bằng bút toán hoàn/chi mới.
- VietQR/webhook mock chỉ development; payment live chưa cấu hình.
- PDF dùng print-to-PDF trình duyệt; task attachment nâng cao chưa làm.
- Lighthouse mobile chưa chạy/không tuyên bố 90+; ảnh đã lazy/priority/dimensions.
- Reset password local hiển thị link thay vì gửi email.
- Contact request demo chưa có màn hình admin xử lý.
- Pricing/testimonials/số liệu marketing đều là demo có nhãn; không phải khách thật.
- E2E chính thức đã có (`npm run test:e2e`); E2E không thao tác được native FS directory picker nên fallback ZIP được dùng.
- PDF server-side chính thức chưa làm; hợp đồng/phiếu thu dùng print-to-PDF của trình duyệt.
- SQLite WAL là runtime demo; PostgreSQL là production path thiết kế, chưa test.


## Facebook Inbox và đặt lịch

Hướng dẫn migration, chạy local, kết nối Meta App, phân quyền, giữ chỗ và nghiệm thu nằm tại [Facebook Inbox](docs/facebook-inbox.md).
