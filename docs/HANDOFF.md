# StudioCore — HANDOFF

> Cập nhật: 03/11/2026 (Phase 7 — bàn giao cuối, đã nghiệm thu)
> Phase hiện tại: **PHASE 7 — QA VÀ BÀN GIAO: HOÀN TẤT**
> Trạng thái bàn giao: **user đã nghiệm thu ngày 03/11/2026** (đã commit/push GitHub; chưa deploy production)
> Kiến trúc: đã được user duyệt; toàn bộ Phase 0–7 hoàn tất theo phạm vi SPEC.

---

## 1. TRẠNG THÁI THỰC TẾ

| Mục | Trạng thái |
|---|---|
| Phase 0–6 | Hoàn tất |
| Phase 7 | Hoàn tất — phase gate pass |
| Ứng dụng | Next.js 16.4.4, React 19, TypeScript strict, Tailwind 4, SQLite WAL |
| Database | Migration 0000–0007; reset sạch, seed 2 lần idempotent |
| Sessions/loginAttempts | 0 / 0 |
| Notifications/contact requests | 0 / 0 |
| Activity log | 2 bản ghi seed |
| Lint/typecheck/build | Pass (0 error, 0 warning) |
| Test | **120/120 Vitest pass** (27 file) + **7/7 Playwright E2E pass** |
| UI Chrome thật | Pass; route chính desktop/tablet/mobile |
| `npm audit --omit=dev` | 0 lỗ hổng production |
| Git/commit/push/deploy | Đã commit `597c6fa` + push `main`; chưa deploy production |

---

## 2. ĐÃ HOÀN THÀNH TRONG PHASE 7

### E2E chính thức

- `playwright.config.ts` + `e2e/` dùng Chrome hệ thống (`channel: chrome`), workers 1, dev server tự khởi động.
- `e2e/core.spec.ts`: owner route chính, smoke 49 route (manage, print, share), PhotoShare public, demo read-only, platform admin vào `/platform` và bị 403 ở dữ liệu tenant.
- `e2e/marketing.spec.ts`: landing đủ section/1 H1, tabs, FAQ, pricing, ảnh load, mobile menu, public pages, SEO/JSON-LD/sitemap/robots.

### RBAC, tenant, bảo mật

- `tests/integration/roles.test.ts`: permission matrix theo vai trò, mutation trái quyền bị từ chối ở server, tenant isolation và branch scope; có platform admin.
- `tests/unit/security.test.ts`: CSRF origin guard, SSRF khi parse link Drive, path traversal storage, XSS escaping.
- Platform admin: seed `platform@studiocore.demo`; route `/platform` (noindex) yêu cầu `tenants.manage`; login redirect đúng; loại khỏi staff/HR/payroll/task/inbox tenant-facing.
- Hardening: storage từ chối absolute key/path traversal; ảnh PhotoShare đầu tiên priority/eager cho LCP; `data-scroll-behavior`; build tracing cho storage runtime.

### QA và bàn giao

- Reset DB mới, migrate 0000–0007, seed hai lần; xác nhận idempotent và counts sạch.
- Dọn artifact test; giữ ảnh demo seed và 5 screenshot marketing thật.
- Cập nhật `README.md`, `TASKS.md`, `PLAN.md`, `PROGRESS.md`, `HANDOFF.md`; thêm `npm run dev:demo`.
- Grep placeholder: không còn `TODO`, `Coming soon`, `Not implemented`, `onClick={() => {}}`, `Lorem ipsum` trong `src`/`e2e`/`tests`/`scripts`.

---

## 3. FILE CHÍNH PHASE 7

- E2E: `playwright.config.ts`, `e2e/core.spec.ts`, `e2e/marketing.spec.ts`.
- Test: `tests/integration/roles.test.ts`, `tests/unit/security.test.ts`.
- Platform admin: `src/app/platform/page.tsx`, `src/lib/demo-accounts.ts`, seed `src/lib/db/seed.ts`, login `src/app/(auth)/login/*`.
- Hardening: `src/lib/storage/local-storage.ts`, `src/components/share/share-gallery.tsx`, `src/app/layout.tsx`.
- Scripts: `npm run test:e2e`, `npm run dev:demo`.
- Docs: `README.md`, `docs/TASKS.md`, `docs/PROGRESS.md`, `docs/PLAN.md`, `docs/HANDOFF.md`.

---

## 4. KIỂM CHỨNG CUỐI

| Lệnh | Kết quả |
|---|---|
| `npm run lint` | Pass — 0 error/0 warning |
| `npm run typecheck` | Pass |
| `npm run build` | Pass — Next.js 16.4.4 |
| `npm start` production smoke | Pass — public pages 200; `/platform` 307 khi chưa đăng nhập; mock webhook POST 404 |
| `npm run test` | **120/120 pass**, 27 file (pass cả `TZ=UTC`) |
| `npm run test:e2e` | **7/7 pass**, Chrome hệ thống |
| `npm run db:migrate` trên DB mới | Pass — 0000–0007 |
| `npm run db:seed` hai lần | Pass, idempotent |
| `npm audit --omit=dev` | 0 lỗ hổng production |

### Số liệu seed sau reset

2 tenant, 3 chi nhánh, 10 nhân sự (8 demo + tenant phụ + platform admin), 10 khách, 10 tương tác, 5 dịch vụ, 6 add-on, 5 sản phẩm, 3 voucher, 6 đơn, 13 item, 5 payment, 4 phòng, 154 ca, 2 nghỉ phép, 6 lịch hẹn, 2 phiếu thuê, 15 trang phục, 5 thiết bị, 1 lý lịch thiết bị, 1 album, 1 nguồn, 3 folder, 12 ảnh, 168 role permission, 22 settings, 8 transaction, 3 expense, 2 budget, 2 invoice, 3 commission rule, 3 commission, 1 payroll, 6 attendance, 4 task, 2 comment, 2 document, 2 campaign, 2 conversation, 4 message, 2 activity log; 0 session/login attempt/notification/contact request.

---

## 5. ACCEPTANCE 25 KỊCH BẢN SPEC

| # | Kịch bản | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Lead → order → cọc → lịch → chụp → hậu kỳ → chọn → giao → thanh toán cuối | PASS | Flow Phase 2–5; test orders/order-completion; Chrome gate |
| 2 | Hai request booking đồng thời cùng slot | PASS | Test appointments concurrent |
| 3 | Nhân viên không có quyền bị chặn ở server | PASS | `roles.test.ts`; E2E platform 403 |
| 4 | Tenant A không đọc dữ liệu tenant B | PASS | `roles.test.ts` tenant isolation |
| 5 | PhotoShare token/password/expiry/revoke | PASS | `albums.test.ts` token/password/expiry/revoke |
| 6 | Tim/chọn/ghi chú/gửi selection; copy mã 4 định dạng | PASS | Phase 4 Chrome gate; unit format copy; E2E gallery |
| 7 | Vượt quota; phí ảnh thêm vào order/payment | PASS | `albums.test.ts` quota/extra fee/payment request |
| 8 | Studio khóa selection; khách không sửa | PASS | `albums.test.ts` khóa/mở selection |
| 9 | Album Drive 3 folder con + tab đúng số lượng | PASS | Phase 4 Chrome gate (demo Drive 3 folder) |
| 10 | Rescan không trùng; ảnh xóa marked missing | PASS | `albums.test.ts` rescan/missing |
| 11 | Parse mã từ Excel/Zalo nhiều định dạng | PASS | `filter-codes.test.ts` parser |
| 12 | Chế độ “chỉ số” đúng; ambiguous không tự copy | PASS | `filter-codes.test.ts` numeric/ambiguous |
| 13 | Folder RAW+JPG; lọc RAW/JPG/PNG/tất cả | PASS | `filter-codes.test.ts` numeric/format filter; Phase 4 gate |
| 14 | Tạo folder “Ảnh khách chọn”; không xóa/di chuyển file gốc | PARTIAL | Logic client-side đã có; FS Access picker cần thao tác tay, chưa tự động hóa |
| 15 | Browser không hỗ trợ FS Access → fallback folder/ZIP | PASS | Phase 4 fallback ZIP; `photo-filter` test |
| 16 | ZIP + manifest + missing khớp | PASS | Phase 4 Chrome gate; album ZIP/manifest test |
| 17 | Watermark/derivative; chặn tải ảnh gốc nếu gói không cho | PASS | `albums.test.ts` download limit/watermarked |
| 18 | Demo lưu public uploads; production private storage/signed URL | PARTIAL | Demo local hoàn chỉnh; production mới ở mức thiết kế/tài liệu |
| 19 | Webhook gửi lặp không cộng tiền hai lần | PASS | `finance.test.ts` idempotency/replay |
| 20 | Thuê/trả trang phục QR; phí giặt/đền bù | PASS | `wardrobe.test.ts`; Phase 3 Chrome gate |
| 21 | Tính lương/hoa hồng → duyệt → khóa kỳ | PASS | `payroll.test.ts` payroll lock |
| 22 | Báo cáo doanh thu/công nợ khớp giao dịch | PASS | `finance.test.ts` reconcile/report |
| 23 | Responsive mobile/tablet; form dài/bảng cuộn ngang | PASS | Chrome 375/390/768/1024/1440; E2E responsive |
| 24 | Public page metadata/SEO cơ bản | PASS | E2E metadata/JSON-LD/sitemap/robots |
| 25 | Landing đủ section/CTA/không lorem/asset sai quyền | PASS | E2E landing; ảnh marketing từ app thật |

Kết quả: **23 PASS, 2 PARTIAL, 0 FAIL**. Hai mục PARTIAL do giới hạn môi trường/thuộc production path, không phải lỗi chức năng demo.

Landing A.7: đã kiểm tra mục 1–13, 15–17; mục 14 Lighthouse chưa đo; mục 18 demo mutation đã chặn server-side và có test.

---

## 6. TÀI KHOẢN DEMO

Mật khẩu chung: `Demo@123`; PIN dùng tab “Mã nhân viên & PIN”.

| Vai trò | Email | Mã | PIN |
|---|---|---|---|
| Chủ studio | owner@studiocore.demo | SC-OWNER | 111111 |
| Quản lý chi nhánh | manager@studiocore.demo | SC-MANAGER | 222222 |
| Lễ tân / Sale | letan@studiocore.demo | SC-LETAN | 333333 |
| Photographer | photo@studiocore.demo | SC-PHOTO | 444444 |
| Photographer | photo2@studiocore.demo | SC-PHOTO2 | 555555 |
| Makeup | makeup@studiocore.demo | SC-MAKEUP | 666666 |
| Retoucher | retouch@studiocore.demo | SC-RETOUCH | 777777 |
| Kế toán | ketoan@studiocore.demo | SC-KETOAN | 888888 |
| Platform admin | platform@studiocore.demo | SC-PLATFORM | 000000 |

Tenant phụ: `owner@studiobinhminh.demo` / `BM-OWNER` / PIN `999999` / `Demo@123`.

---

## 7. GIỚI HẠN / CHƯA KIỂM CHỨNG

- Chưa có credentials live: Google Drive OAuth/scan, NAS/desktop helper, S3/R2, email/Zalo/SMS, Fanpage/Zalo connector, Meta/TikTok Ads, payment production, AI provider live.
- Lighthouse mobile chưa đo; không tuyên bố 90+.
- PostgreSQL runtime chưa test; SQLite WAL là runtime bàn giao.
- File System Access directory picker kiểm tra thủ công; fallback ZIP đã E2E.
- Production cần private storage/signed URL thay cho public uploads demo.
- Sổ quỹ append-only; điều chỉnh bằng bút toán hoàn/chi mới.
- Mock webhook chỉ development; production trả 404.
- PDF dùng print-to-PDF trình duyệt; task attachment nâng cao chưa làm.
- Contact request chưa có màn hình admin xử lý.
- Pricing/testimonials/số liệu marketing là demo có nhãn.
- Đã commit/push GitHub; chưa deploy production.

---

## 8. QUYẾT ĐỊNH ĐÃ CHỐT

- Local-first: SQLite WAL runtime demo; adapter live lazy-init, báo “chưa cấu hình” trung thực.
- Demo read-only dùng `sessions.read_only` + quyền `.view`, chặn mutation ở server.
- Booking dùng `BEGIN IMMEDIATE`, mutex, retry `SQLITE_BUSY`, buffer 30 phút, idempotency.
- Sổ quỹ append-only để bảo toàn audit.
- Platform admin là vai trò nền tảng, tách khỏi dữ liệu tenant; `contact_requests` là bảng platform-level.
- Ảnh marketing capture từ app thật; ảnh album demo là synthetic có nhãn.
- Seed chỉ dùng dữ liệu hư cấu; không secret/PII thật.

---

## 9. DEFINITION OF DONE

- [x] Chạy bằng lệnh rõ ràng: `npm install` → cấu hình `.env.local` → `npm run dev:demo`.
- [x] Migration/seed chạy trên DB mới; seed idempotent.
- [x] Tài khoản demo đủ vai trò, gồm platform admin.
- [x] Auth/session/RBAC/tenant isolation server-side.
- [x] CRM, đơn, lịch, dịch vụ, album, tài chính, nhân sự, task CRUD.
- [x] Luồng lead → hoàn tất đơn end-to-end.
- [x] Album Drive/NAS, tab folder con, PhotoShare tim/chọn/ghi chú.
- [x] Copy mã 4 định dạng; gửi selection; khóa/mở.
- [x] Lọc mã khách chọn với FS Access hoặc fallback.
- [x] ZIP/manifest/missing end-to-end.
- [x] Booking conflict chặn đúng; webhook idempotent.
- [x] Dashboard/báo cáo đọc dữ liệu thật.
- [x] Landing đủ section; public pages SEO/responsive/không placeholder.
- [x] Export CSV/PDF/ZIP cần thiết.
- [x] Adapter local/live rõ ràng cho Drive/payment/messaging/AI.
- [x] Audit log thao tác nhạy cảm.
- [x] Unit/integration/E2E + manual test được ghi lại.
- [x] Responsive desktop/tablet/mobile.
- [x] Lint/typecheck/build pass.
- [x] README đầy đủ; không secret/PII/asset sai quyền.
- [x] Không nút giả/route placeholder/TODO trong luồng chính.

---

## 10. BƯỚC TIẾP THEO

1. Phase 7 đã được user nghiệm thu ngày 03/11/2026.
2. Khi triển khai thật: bổ sung `.env.local`, credentials adapter live, private storage, PostgreSQL, Lighthouse/FS Access manual.
3. Không commit/push/deploy cho đến khi có chỉ đạo.

---

## 11. CI/CD

- `.github/workflows/ci-cd.yml` chạy CI trên push/PR `main`: npm ci, migrate + seed, lint, typecheck, Vitest, build, Playwright Chromium E2E.
- CI Linux/UTC đã phát hiện lỗi range tháng phụ thuộc timezone; code dùng mốc UTC+7 cố định (`getVietnamMonthRange`) cho payroll/commission/budget/report.
- Sau khi CI pass trên `main`: build Docker image và push GHCR (`latest` + tag SHA). Chưa tự deploy lên server.
- GitHub Actions run `41601698630` đã pass cả job CI và job build/push image.
- `Dockerfile` chạy migration trước `next start`, seed demo khi `SEED_DEMO=true`; cần mount `/app/data` và truyền `AUTH_SECRET`/`TOKEN_ENCRYPTION_KEY`.
- Live deploy vẫn cần target (VPS/cloud) và secrets tương ứng.

---

## 12. RENDER

- `render.yaml` tạo Docker web service tại Singapore, plan Starter, disk 1GB mount `/app/data`, health check `/login`, auto deploy từ `main`.
- Uploads chuyển vào `/app/data/uploads` qua `UPLOAD_ROOT`; entrypoint chown disk, migrate, seed demo nếu `SEED_DEMO=true`.
- Chưa tạo service trên Render vì môi trường này không có Render API key; deploy qua blueprint link trong README.
- Demo công khai dùng tài khoản seed; production phải tắt seed, đổi/vô hiệu hóa demo account và chuyển private storage/PostgreSQL.
