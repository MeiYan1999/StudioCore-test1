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

Repo có Blueprint `render.yaml`: Docker web service `studiocore-meiyan1999`, region Singapore, plan Starter, persistent disk 1GB tại `/app/data`, health check `/login`, auto deploy từ `main`.

[Deploy to Render](https://render.com/deploy?repo=https://github.com/MeiYan1999/StudioCore-test1)

Sau khi kết nối Render với GitHub và duyệt Blueprint:

- Render tự sinh `AUTH_SECRET` và `TOKEN_ENCRYPTION_KEY`.
- Container chạy migration, sau đó seed demo idempotent khi `SEED_DEMO=true`; DB và uploads nằm trên persistent disk.
- URL dự kiến: https://studiocore-meiyan1999.onrender.com. Nếu tên service bị trùng, đổi `name` và `NEXT_PUBLIC_SITE_URL` trong `render.yaml` trước khi deploy.
- Persistent disk yêu cầu plan trả phí (Starter trở lên); free plan không giữ dữ liệu qua restart/redeploy.
- Đây là môi trường demo công khai với tài khoản demo. Production: đặt `SEED_DEMO=false`, vô hiệu hóa/đổi mật khẩu tài khoản demo, dùng private storage và PostgreSQL.

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

