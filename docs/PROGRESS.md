# StudioCore — PROGRESS

> Cập nhật: 03/11/2026 (Phase 7 — bàn giao, đã nghiệm thu)
> Phase hiện tại: **PHASE 7 — QA VÀ BÀN GIAO: HOÀN TẤT**
> Trạng thái dự án: **Hoàn tất theo phạm vi SPEC** — user đã nghiệm thu bản bàn giao ngày 03/11/2026.
> Tài liệu liên quan: `PLAN.md`, `TASKS.md`, `HANDOFF.md`, `SPEC.md`, `UI_SYSTEM.md`

## 1. Trạng thái phase

| Mục | Giá trị |
|---|---|
| Phase 0–6 | Hoàn tất |
| Phase 7 | Hoàn tất — QA, E2E, acceptance, reset DB, docs |
| Ứng dụng | Next.js 16.4.4, React 19, TypeScript strict, Tailwind 4, SQLite WAL |
| Database | Migration 0000–0007; seed sạch, idempotent; 0 session/login attempt/notification/contact request |
| Test | **120/120 Vitest pass** (27 file) + **7/7 Playwright E2E pass** |
| Lint/typecheck/build | Pass (0 error, 0 warning) |
| UI Chrome thật | Pass; route chính desktop/tablet/mobile |
| Production audit | 0 lỗ hổng production |
| CI/CD | GitHub Actions CI + Docker GHCR pass (run `41601698630`) |
| Git/commit/push/deploy | Đã commit/push GitHub; chưa deploy production |

## 2. Đã hoàn thành trong Phase 7

### E2E và QA

- Bộ E2E chính thức `e2e/` + `playwright.config.ts` dùng Chrome hệ thống: owner route chính, smoke 49 route, PhotoShare public, demo read-only, platform admin, landing responsive/tabs/FAQ/pricing, mobile menu/public pages, SEO/JSON-LD/sitemap/robots.
- Role matrix server-side: owner/manager/receptionist/photographer/makeup/retoucher/accountant/platform admin; mutation trái quyền bị từ chối; tenant isolation và branch scope có test.
- Security test: CSRF origin guard, SSRF khi parse link Drive, path traversal storage, XSS escaping; booking đồng thời, webhook lặp, payroll lock, đối soát báo cáo đã có test từ các phase trước.
- Platform admin: seed tài khoản `platform@studiocore.demo`, route `/platform` quản lý tenant, login redirect đúng, tenant-facing staff/HR/payroll/task/inbox loại trừ platform admin.
- Sửa lỗi phát hiện khi QA: storage từ chối key tuyệt đối/path traversal; login page hiển thị tài khoản platform; LCP ảnh PhotoShare; scroll behavior; build tracing cho storage runtime.

### Dữ liệu và bàn giao

- Reset DB mới, migrate 0000–0007, seed hai lần liên tiếp: số liệu không đổi.
- Dọn artifact test (`public/uploads/tenant-test`, `data/documents`), giữ ảnh demo seed và ảnh marketing.
- Cập nhật `README.md`, `TASKS.md`, `PLAN.md`, `PROGRESS.md`, `HANDOFF.md`; thêm script `npm run dev:demo` (migrate + seed + dev).
- Grep placeholder trong `src`/`e2e`/`tests`/`scripts`: không còn `TODO`, `Coming soon`, `Not implemented`, `onClick={() => {}}`, `Lorem ipsum`.

## 3. Kiểm chứng cuối

- `npm run lint`: pass, 0 error/0 warning.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4.
- `npm start` production smoke: public pages 200; `/platform` 307 khi chưa đăng nhập; mock webhook POST 404.
- `npm run test`: **120/120 pass**, 27 file (pass cả `TZ=UTC`).
- `npm run test:e2e`: **7/7 pass** trên Chrome hệ thống.
- `npm run db:migrate` trên DB mới + `npm run db:seed` hai lần: pass, idempotent.
- `npm audit --omit=dev`: 0 lỗ hổng production.
- GitHub Actions: CI (lint/typecheck/test/build/E2E) và CD (Docker image GHCR) pass; CI Linux/UTC phát hiện và sửa bug range tháng theo timezone.
- Acceptance 25 kịch bản SPEC: 23 PASS, 2 PARTIAL (FS Access copy folder cần thao tác tay; production private storage mới ở mức thiết kế/tài liệu).
- Landing A.7: đã kiểm tra 1–13, 15–17; mục 14 Lighthouse chưa đo; mục 18 demo mutation chặn server-side.

## 4. Dữ liệu sau bàn giao

- 2 tenant, 3 chi nhánh, 10 nhân sự (8 demo + tenant phụ + platform admin), 10 khách.
- 5 dịch vụ, 6 add-on, 5 sản phẩm, 3 voucher, 6 đơn, 13 item, 5 payment.
- 4 phòng, 154 ca, 2 nghỉ phép, 6 lịch hẹn, 2 phiếu thuê, 15 trang phục, 5 thiết bị.
- 1 album, 3 folder, 12 ảnh synthetic, 22 settings, 168 role permission.
- 8 transaction, 3 expense, 2 budget, 2 invoice, 3 commission rule, 3 commission, 1 payroll, 6 attendance.
- 4 task, 2 comment, 2 document, 2 campaign, 2 conversation, 4 message; 2 activity log seed.
- 0 session, 0 login attempt, 0 notification, 0 contact request.

## 5. Giới hạn / deferral

- Chưa kiểm chứng live do thiếu credentials: Google Drive OAuth/scan, NAS/desktop helper, S3/R2, email/Zalo/SMS, Fanpage/Zalo connector, Meta/TikTok Ads, payment production, AI provider live.
- Lighthouse mobile chưa đo/không tuyên bố 90+.
- PostgreSQL runtime chưa test; SQLite WAL là runtime bàn giao, PostgreSQL là production path thiết kế.
- File System Access directory picker cần thao tác tay; fallback ZIP đã E2E.
- Ảnh demo dùng public uploads + route kiểm tra key; production cần private storage/signed URL.
- Sổ quỹ append-only; điều chỉnh bằng bút toán hoàn/chi mới, không sửa/xóa giao dịch.
- Mock webhook chỉ development; production cố ý 404.
- PDF dùng print-to-PDF trình duyệt.
- Contact request demo chưa có màn hình admin xử lý.
- Pricing/testimonials/số liệu marketing đều là demo có nhãn.

## 6. Bước tiếp theo

1. User nghiệm thu bản bàn giao Phase 7.
2. Khi có môi trường/credentials thật: cấu hình `.env.local`, bổ sung adapter live, chạy Lighthouse/PostgreSQL, kiểm tra FS Access thủ công.
3. Chưa deploy production cho đến khi có target/credentials.
