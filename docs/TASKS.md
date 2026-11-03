# StudioCore — TASKS / PROGRESS

> Cập nhật: 03/11/2026 (Phase 7 hoàn tất — user đã nghiệm thu)
> Phase hiện tại: **PHASE 7 — QA VÀ BÀN GIAO (hoàn tất, đã nghiệm thu)**
> Trạng thái phase gate: **ĐẠT** — lint/typecheck/build/test pass; kiểm tra UI bằng Chrome thật pass
> Tài liệu liên quan: `PLAN.md`, `PROGRESS.md`, `HANDOFF.md`, `SPEC.md`, `UI_SYSTEM.md`

## 0. TRẠNG THÁI THỰC TẾ HIỆN TẠI

| Mục | Giá trị |
|---|---|
| Phase | 7 — QA và bàn giao |
| Module/tính năng | E2E chính thức, QA route/RBAC/tenant/branch, acceptance 25 kịch bản, security, docs bàn giao |
| File đã hoàn thành | Toàn bộ `src/`, `e2e/`, `tests/`, migrations 0000–0007, `docs/*`, screenshot marketing |
| Việc còn lại | Không — dự án hoàn tất theo phạm vi SPEC; live credentials cần bổ sung khi production |
| Kết quả kiểm tra | `lint` pass, `typecheck` pass, `build` pass (Next 16.4.4), **117/117 test pass**, **7/7 E2E pass** |
| Ứng dụng đã khởi tạo | Có — Next.js App Router, TypeScript strict, Tailwind, SQLite WAL |
| Dependency đã cài | Có; `npm audit --omit=dev` = 0 lỗ hổng production |
| Migration/seed đã chạy | Có; migrate 0000–0007, seed 2 lần idempotent |
| Git/commit/push/deploy | Đã commit/push GitHub; chưa deploy production |
| Phase 0 | Hoàn tất |
| Phase 1 | Hoàn tất |
| Phase 2 | Hoàn tất |
| Phase 3 | Hoàn tất |
| Phase 4 | Hoàn tất |
| Phase 5 | Hoàn tất |
| Phase 6 | Hoàn tất |
| Phase 7 | Hoàn tất — QA/bàn giao |

### Quy ước checklist

- `[x]` chỉ dùng khi công việc đã thực sự hoàn thành và đã kiểm chứng.
- `[ ]` là chưa làm hoặc chưa kiểm chứng xong.
- Mỗi phase có **phase gate** riêng; không chuyển phase khi còn lỗi hoặc placeholder.
- Không đánh dấu hoàn thành dựa trên compile hoặc giao diện đơn thuần.
- Mọi thay đổi phạm vi phải cập nhật `PLAN.md` trước, không tự cắt yêu cầu.

### Quy trình đóng phase (áp dụng cho Phase 4–7)

- [x] Chạy `npm run lint` — pass 100%.
- [x] Chạy `npm run typecheck` — pass 100%.
- [x] Chạy `npm run build` — pass 100%.
- [x] Chạy `npm run test` — pass; ghi số test và kết quả.
- [x] Chạy E2E khi phase đã có bộ E2E chính thức (từ Phase 7).
- [x] Chạy migration trên DB mới và seed hai lần; xác nhận idempotent.
- [x] Mở app thật bằng trình duyệt, kiểm tra route/flow của phase.
- [x] Kiểm tra 375/390/768/1024/1440 cho màn hình thuộc phase.
- [x] Grep `TODO`, `Coming soon`, `Not implemented`, `onClick={() => {}}` trong luồng chính — không còn.
- [x] Cập nhật checklist này, `PROGRESS.md` và `HANDOFF.md`.
- [x] Báo cáo ngắn: đã làm, file chính, test, còn lại; dừng chờ duyệt.

### Phụ thuộc giữa các phase

| Phase | Phụ thuộc | Ghi chú |
|---|---|---|
| 1 | Phase 0 được duyệt; Q1, Q2, Q9 được chốt | Không code trước khi chốt |
| 2 | Phase 1 | Cần auth/RBAC/tenant và seed nền |
| 3 | Phase 2 | Cần customer/order/service |
| 4 | Phase 2, 3 | Cần order, album link, appointment; không bắt buộc Phase 3 hoàn tất mới bắt đầu schema album, nhưng luồng album gắn order cần Phase 2 |
| 5 | Phase 2, 3, 4 | Cần payment, order, rental, album để đối soát |
| 6 | Phase 1–5 | Screenshot/landing phải lấy từ app thật; demo read-only cần auth |
| 7 | Tất cả | Chỉ chạy khi các phase trước đạt gate |

---

# PHASE 0 — KHẢO SÁT VÀ KẾ HOẠCH

## 0.1. Đọc tài liệu và khảo sát

- [x] **P0-01** Đọc đầy đủ `AGENTS.md` tại thư mục gốc.
  - Kết quả: đã đọc; ghi nhận quy trình phase, zero-placeholder, transaction, server-side security, UI states.
- [x] **P0-02** Đọc đầy đủ `studiocore/docs/SPEC.md`.
  - Kết quả: đã đọc toàn bộ 1.449 dòng; ghi nhận phạm vi A–N, Phase 0–7, mô hình dữ liệu, acceptance.
- [x] **P0-03** Đọc đầy đủ `studiocore/docs/UI_SYSTEM.md`.
  - Kết quả: đã đọc bản 1.1; ghi nhận token, font Be Vietnam Pro, app shell, component, trạng thái, responsive/accessibility.
- [x] **P0-04** Khảo sát cấu trúc thư mục thực tế.
  - Kết quả: chỉ có `AGENTS.md`, `studiocore/docs/SPEC.md`, `studiocore/docs/UI_SYSTEM.md`; không có `package.json`, `src/`, route, component, database, migration.
- [x] **P0-05** Khảo sát framework, dependency, database, route, component, style hiện có.
  - Kết quả: không có; dự án greenfield, không có code cũ cần bảo toàn.
- [x] **P0-06** Kiểm tra môi trường chạy.
  - Kết quả: Node.js v26.13.0; npm 11.20.0; pnpm không có; không phải git repository.
- [x] **P0-07** Ghi nhận điểm lệch đường dẫn giữa `AGENTS.md` (root) và docs thực tế (`studiocore/docs`).
  - Kết quả: đã ghi tại PLAN §0.1 và HANDOFF Q1.

## 0.2. Lập kế hoạch

- [x] **P0-08** Lập feature matrix P0/P1/P2 từ SPEC.
  - Kết quả: PLAN §8; chưa nghiên cứu website công khai (xem P0-30 và Q5).
- [x] **P0-09** Lập route map đầy đủ public/auth/manage/API.
  - Kết quả: PLAN §6.
- [x] **P0-10** Lập data model lõi, bảng bổ sung, ràng buộc/index và thiết kế booking transaction.
  - Kết quả: PLAN §5.
- [x] **P0-11** Lập permission matrix và chiến lược tenant/branch isolation server-side.
  - Kết quả: PLAN §4.
- [x] **P0-12** Lập adapter strategy, biến môi trường và hành vi khi thiếu credentials.
  - Kết quả: PLAN §9, §15.
- [x] **P0-13** Lập test plan và đối chiếu 25 kịch bản acceptance của SPEC.
  - Kết quả: PLAN §10.
- [x] **P0-14** Lập landing page section blueprint A.3/A.7.
  - Kết quả: PLAN §11.
- [x] **P0-15** Lập lộ trình Phase 0–7 với đầu ra, tiêu chí nghiệm thu, cách kiểm chứng.
  - Kết quả: PLAN §7.
- [x] **P0-16** Tạo `docs/PLAN.md`.
- [x] **P0-17** Tạo `docs/TASKS.md` (file này).
- [x] **P0-18** Tạo `docs/HANDOFF.md`.

## 0.3. Chốt quyết định Phase 0

> Ngày chốt: 03/11/2026 — user duyệt toàn bộ đề xuất Q1–Q11; Q5 áp dụng phương án A (bỏ qua nghiên cứu website đối thủ, SPEC là nguồn phạm vi).

- [x] **P0-19** Chốt Q1 — app root `studiocore/`; docs trong `studiocore/docs/`.
- [x] **P0-20** Chốt Q2 — tạo `PROGRESS.md` theo SPEC 0.1.
- [x] **P0-21** Chốt Q3 — mã trạng thái UI_SYSTEM + bổ sung `awaiting_selection`.
- [x] **P0-22** Chốt Q4 — ưu tiên UI_SYSTEM, không dùng teal làm màu thương hiệu.
- [x] **P0-23** Chốt Q5 — bỏ qua nghiên cứu website đối thủ; SPEC là nguồn phạm vi.
- [x] **P0-24** Chốt Q6 — dùng dữ liệu demo có nhãn cho branding/domain/contact/pricing/testimonial/legal.
- [x] **P0-25** Chốt Q7 — ảnh synthetic/AI có nhãn; screenshot thật từ app.
- [x] **P0-26** Chốt Q8 — local-first; adapter live chỉ test khi có credentials.
- [x] **P0-27** Chốt Q9 — SQLite WAL là runtime bàn giao; PostgreSQL là production path thiết kế.
- [x] **P0-28** Chốt Q10 — platform admin có `/platform`; `contact_requests` là bảng nền tảng.
- [x] **P0-29** Chốt phạm vi Phase 1: gồm dashboard nền + trang users/roles/sessions.
- [x] **P0-30** Chốt Q5 — không nghiên cứu website đối thủ (phương án A).
- [x] **P0-31** Đã tạo `PROGRESS.md` trước khi viết code Phase 1.
- [x] **P0-32** Đã cập nhật `HANDOFF.md` sau khi các quyết định được chốt.
- [x] **P0-33** Phase 0 gate: user duyệt kiến trúc/kế hoạch; Phase 0 hoàn tất.

---

# PHASE 1 — NỀN TẢNG

> Trạng thái: **HOÀN TẤT**.
> Phụ thuộc: Phase 0 đã duyệt; Q1/Q2/Q9/Q10/Q11 đã chốt.
> Mục tiêu: ứng dụng chạy được với auth/RBAC/tenant isolation, app shell và seed nền.

## 1.1. Khởi tạo và cấu hình

- [x] **P1-01** Khởi tạo Next.js App Router trong app root đã chốt; kiểm tra version thực tế trong `node_modules` trước khi code.
- [x] **P1-02** Cấu hình npm scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`, `db:seed:demo`.
  - Ghi chú: E2E chính thức (`test:e2e`) được bổ sung ở Phase 7; Phase 1 dùng Vitest và kiểm tra trình duyệt thật.
- [x] **P1-03** Bật TypeScript strict; cấm `any`; cấu hình path alias; đảm bảo server-only modules không lọt vào client.
- [x] **P1-04** Tạo `.env.example`, `.gitignore` (bao gồm `.env.local`, `public/uploads/*` phát sinh, giữ `.gitkeep`), README khung chạy local.
- [x] **P1-05** Cấu hình ESLint và kiểm tra `lint` chạy được trên code khởi tạo.
- [x] **P1-06** Xác minh driver SQLite tương thích Node thực tế; cấu hình singleton connection, WAL, `busy_timeout`; cấu hình external package nếu framework yêu cầu.

## 1.2. Design system và UI primitives

- [x] **P1-07** Cài Tailwind + shadcn/Base UI + Lucide + Sonner đúng phiên bản tương thích.
- [x] **P1-08** Khai báo design tokens theo UI_SYSTEM §4: màu light/dark, font Be Vietnam Pro, spacing, radius, shadow, layer; không trộn HSL channels và mã màu đầy đủ.
- [x] **P1-09** Tải font Be Vietnam Pro 400/500/600/700 bằng self-host/`next/font`, `display: swap`; kiểm tra dấu tiếng Việt.
- [x] **P1-10** Triển khai theme light/dark/system, lưu lựa chọn, khởi tạo trước render để giảm nháy.
- [x] **P1-11** Tạo UI primitives: button, input, textarea, select, label, table, dialog, sheet, alert-dialog, dropdown, tabs, tooltip, badge, skeleton, toast; form dùng native form + Label/Input.
- [x] **P1-12** Tạo shared components đang dùng: PageHeader, DataTable, StatusBadge, Money, DateTime, EmptyState, ErrorState, PermissionGate, ConfirmDialog, SubmitButton. `FilterBar` chuyển sang Phase 2 (Module CRM) và `PhotoGrid` chuyển sang Phase 4 (Album) vì Phase 1 chưa có dữ liệu dùng; không tạo component chết.
- [x] **P1-13** Tạo trang lỗi 403, 404, lỗi hệ thống; skip link, landmark, focus ring; kiểm tra zoom 200%.

## 1.3. Database và seed nền

- [x] **P1-14** Thiết kế và tạo migration nền: `tenants`, `branches`, `staff`, `staff_branches`, `role_permissions`, `sessions`, `password_reset_tokens`, `login_attempts`, `customers`, `services`, `wardrobe_items`, `settings`, `activity_logs`.
- [x] **P1-15** Thêm index/unique constraint nền: tenant+phone, tenant+staff code, tenant+branch, tenant+permission; soft delete/archive cho bảng cần thiết.
- [x] **P1-16** Viết seed idempotent: tenant demo chính, tenant phụ tối thiểu, 2 chi nhánh, 8 nhân sự đủ vai, 10 khách, 5 gói chụp, 15 bộ trang phục, role/permission, settings.
- [x] **P1-17** Tạo tài khoản demo theo vai trò; ghi PIN/mật khẩu demo vào tài liệu, không dùng PII thật.
- [x] **P1-18** Chạy `db:migrate` trên DB mới và `db:seed` hai lần; xác nhận không nhân đôi dữ liệu.

## 1.4. Auth, session, RBAC

- [x] **P1-19** Hash PIN/mật khẩu bằng scrypt + salt riêng; so sánh constant-time; không log PIN/mật khẩu.
- [x] **P1-20** Triển khai đăng nhập mã nhân viên + PIN và email + mật khẩu; validate Zod; lỗi không tiết lộ tài khoản tồn tại.
- [x] **P1-21** Session cookie httpOnly, secure ở production, sameSite phù hợp, ký HMAC; lưu `sessions`; hết hạn/thu hồi/rotation.
- [x] **P1-22** Rate limit đăng nhập theo IP + định danh và API nhạy cảm; khóa tạm sau nhiều lần sai; ghi audit thành công/thất bại.
- [x] **P1-23** Service `ActorContext`; enforce tenant, branch, permission, readOnly ở server cho mọi service/action/API; kiểm tra CSRF/Origin cho mutation và API.
- [x] **P1-24** Seed/role_permissions theo ma trận §4.3; kiểm tra quyền đọc từ DB, không hard-code UI.
- [x] **P1-25** Trang quản lý người dùng: tạo/sửa nhân sự, vai trò, chi nhánh, active, reset PIN/mật khẩu có kiểm soát.
- [x] **P1-26** Trang quản lý vai trò/quyền và phiên đăng nhập: xem/thu hồi phiên; audit thay đổi quyền.
- [x] **P1-27** Branch switcher: owner chọn tất cả/chi nhánh; manager/chỉ được giao; server validate active branch.

## 1.5. App shell và dashboard nền

- [x] **P1-28** App shell desktop sidebar 240px nhóm Tổng quan/Hệ thống; nút thu 72px là tùy chọn của UI_SYSTEM, chưa triển khai Phase 1 vì chưa có đủ module để cần thu gọn.
- [x] **P1-29** Mobile drawer dưới 1024px: hamburger, đóng Escape, trả focus, đóng sau khi chọn route; CTA dễ thấy.
- [x] **P1-30** Topbar 64px: breadcrumb, branch switcher, theme toggle, notification đọc từ DB, user menu, logout.
- [x] **P1-31** Menu chỉ hiển thị module đã triển khai và quyền tương ứng; server vẫn kiểm tra quyền.
- [x] **P1-32** Dashboard nền đọc dữ liệu thật từ seed: chỉ số có nguồn dữ liệu ở Phase 1; skeleton/empty/error; quick action thật.
- [x] **P1-33** Notification nền: bảng `notifications`, `readAt`; topbar đọc DB và empty state trung thực. Chưa có nguồn tạo thông báo nên chưa thêm action mark-read; sẽ hoàn thiện ở Phase 3/5.
- [x] **P1-34** Kiểm tra responsive app shell 375/390/768/1024/1440; không tràn ngang toàn trang.

## 1.6. Kiểm thử và bàn giao Phase 1

- [x] **P1-35** Unit test: hash/verify PIN, session ký/hết hạn, chuẩn hóa SĐT, permission mapping.
- [x] **P1-36** Integration test: đăng nhập hai phương thức, rate limit/khóa tạm, session thu hồi, RBAC 403/404, tenant isolation, branch scope.
- [x] **P1-37** Chạy phase gate đầy đủ; ghi kết quả lint/typecheck/build/test.
- [x] **P1-38** Mở app thật kiểm tra login, shell, menu, dashboard, 403/404, mobile drawer.
- [x] **P1-39** Cập nhật `TASKS.md`/`PROGRESS.md`/`HANDOFF.md`; báo cáo checkpoint; dừng chờ duyệt trước Phase 2.

### Kết quả Phase 1 gate (03/11/2026)

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4, 10 route (bao gồm `/`, `/login`, dashboard và 3 trang settings).
- `npm run test`: 6 file, **31/31 test pass**.
- Migration trên DB mới + seed 2 lần: 2 tenant, 3 chi nhánh, 9 nhân sự (8 demo + 1 tenant phụ), 10 khách, 5 dịch vụ, 15 trang phục, 164 role permission, 14 settings; sessions/loginAttempts = 0; idempotent.
- Chrome thật (Playwright): login email + PIN, dashboard, tạo/sửa nhân sự, cập nhật quyền, thu hồi phiên, chuyển chi nhánh, manager bị 403, sai mật khẩu, dark mode, mobile drawer; viewport 375/390/768/1024/1440 không tràn ngang; không có HTTP lỗi hoặc console error. Production `next start`: `/login` 200, route không tồn tại 404.
- `npm audit --omit=dev`: 0 lỗ hổng production; 20 moderate chỉ thuộc dev dependencies.
- Deferral có chủ đích: `FilterBar` Phase 2, `PhotoGrid` Phase 4, E2E chính thức Phase 7.

---

# PHASE 2 — CRM, DỊCH VỤ, ĐƠN HÀNG

> Trạng thái: **HOÀN TẤT**.
> Phụ thuộc: Phase 1 đạt gate.
> Mục tiêu: luồng lead → khách → đơn → cọc chạy thật; CRM và danh mục đầy đủ.

## 2.1. Schema và seed

- [x] **P2-01** Migration CRM/đơn hàng: `customer_interactions`, `service_addons`, `products`, `vouchers`, `orders`, `order_items`, `order_status_history`, `payments`.
  - Ghi chú: `payment_requests` để Phase 4 (phí ảnh thêm), `invoices` để Phase 5 (hóa đơn/VAT).
- [x] **P2-02** Index/unique: tenant+phone chuẩn hóa, tenant+order code, tenant+voucher code, tenant+SKU; soft delete cho customer/order.
  - Ghi chú: unique invoice_no sẽ thêm khi tạo bảng invoices ở Phase 5.
- [x] **P2-03** Seed CRM/order: khách, tương tác, dịch vụ/add-on/voucher, đơn mẫu ở nhiều trạng thái, payment cọc/thu một phần; idempotent.

## 2.2. CRM

- [x] **P2-04** Danh sách khách: search tên/SĐT/email/tag/ghi chú; filter trạng thái/hạng/nguồn/người phụ trách/chi nhánh; pagination server-side; skeleton/empty/error.
- [x] **P2-05** Hồ sơ khách 360: thông tin, số đo, nguồn, hạng, trạng thái, tags, owner, follow-up, LTV, đã thu, công nợ, số đơn, giá trị trung bình, đơn gần nhất.
- [x] **P2-06** Tab Tổng quan/Đơn hàng/Tương tác; timeline tương tác thật; không tạo lịch sử giả.
  - Ghi chú: tab Album để Phase 4 khi module album/PhotoShare được triển khai.
- [x] **P2-07** Tạo/sửa khách bằng Sheet; validate, giữ dữ liệu khi lỗi; chuẩn hóa SĐT VN; chống trùng tenant+phone.
- [x] **P2-08** Ghi nhận tương tác: gọi/tin nhắn/gặp/ghi chú/follow-up; cập nhật `last_contact_at`, `follow_up_at`.
- [x] **P2-09** Phân khúc: VIP, khách mới 30 ngày, nguy cơ rời bỏ, sinh nhật tháng, còn công nợ, lead; filter tương ứng.
- [x] **P2-10** Cảnh báo follow-up quá hạn; phân khúc nguy cơ rời bỏ, sinh nhật tháng, khách mới 30 ngày; cảnh báo khách lâu chưa quay lại dựa trên trạng thái/last contact ở Phase 5 báo cáo.
- [x] **P2-11** Xuất CSV có filter (bao gồm phân khúc), UTF-8 BOM, header tiếng Việt, kiểm tra quyền/tenant/branch.
- [x] **P2-12** Ghi chú tích hợp: “Tạo task nhắc chăm sóc từ hồ sơ khách” được triển khai ở Phase 5 (P5-25); không render nút giả trước đó.

## 2.3. Dịch vụ, sản phẩm, voucher

- [x] **P2-13** CRUD dịch vụ: danh mục cưới/baby/gia đình/lookbook/concept/sự kiện; giá, thời lượng, mô tả, ảnh mẫu, trạng thái bán/ngừng.
- [x] **P2-14** CRUD add-on/combo/phụ phí; voucher (mã, giá trị/%, điều kiện, hạn, trạng thái).
- [x] **P2-15** CRUD sản phẩm cơ bản: SKU, tên, danh mục, giá, tồn kho, trạng thái.
- [x] **P2-16** UI danh mục dùng DataTable + Sheet; kiểm tra permission, validation.
  - Ghi chú: dùng trạng thái active/inactive thay xóa cứng; chưa có archive vì migration chỉ additive.

## 2.4. Đơn hàng

- [x] **P2-17** Tạo đơn từ khách có sẵn hoặc khách mới trong cùng luồng; validate server; giữ dữ liệu khi lỗi.
- [x] **P2-18** Đơn đa dịch vụ: gói chụp, add-on, sản phẩm, phụ thu, makeup, in ấn, item tự nhập; order_items đúng.
  - Ghi chú: thuê trang phục sẽ nối vào order item ở Phase 3 khi có module wardrobe rental.
- [x] **P2-19** Giảm giá, voucher, cọc, đã thu, còn lại; tính toán server bằng integer VND; hiển thị rõ.
- [x] **P2-20** Sinh mã đơn unique tenant; gán chi nhánh, photographer/editor/makeup, ngày chụp, địa điểm.
- [x] **P2-21** Danh sách đơn: search/filter/pagination server-side; status badge; filter chi nhánh/trạng thái/khách; sắp xếp mặc định mới nhất.
- [x] **P2-22** Chi tiết đơn: khách, items, lịch, phân công, tiến độ, thanh toán, timeline; action theo trạng thái/quyền.
- [x] **P2-23** Transition matrix server; chặn chuyển sai; ghi `order_status_history` + audit; hủy đơn có Alert Dialog và lý do bắt buộc.
- [x] **P2-24** Ghi nhận thanh toán thủ công: cọc/đợt 2/thanh toán dứt điểm; cập nhật paid/remaining trong transaction; audit.
  - Ghi chú: hoàn tiền là ngoại lệ có kiểm soát, thuộc Phase 5 cùng sổ quỹ.
- [x] **P2-25** Cảnh báo đơn sắp tới, lịch đã qua, còn công nợ trên chi tiết đơn; cột còn lại được làm nổi bật.
  - Ghi chú: “quá hạn giao” cần trường hạn giao riêng, sẽ bổ sung cùng báo cáo Phase 5.
- [x] **P2-26** In phiếu thu, biên nhận, hợp đồng từ dữ liệu đơn; xác nhận điện tử nội bộ có audit; không gọi là ký số hợp pháp.
- [x] **P2-27** Kiểm tra tiếng Việt/font trên bản in; print CSS A4; không lộ dữ liệu ngoài quyền.
  - Ghi chú: dùng print-to-PDF của trình duyệt; server-side PDF export chính thức để Phase 7 nếu cần.

## 2.5. Kiểm thử và bàn giao Phase 2

- [x] **P2-28** Unit test: subtotal/surcharge/discount/voucher/deposit/paid/remaining; transition matrix; chuẩn hóa SĐT; mã đơn.
- [x] **P2-29** Integration test: permission/tenant/branch; chống trùng SĐT; thanh toán cập nhật đúng; chuyển trạng thái sai bị chặn.
- [x] **P2-30** UI flow: tạo khách → tạo đơn → cọc → thanh toán → trạng thái → hợp đồng/phiếu thu; phần lịch/xung đột hoàn tất ở Phase 3 và E2E chính thức ở Phase 7.
- [x] **P2-31** Chạy phase gate; mở app thật kiểm tra CRM/đơn/print; cập nhật tài liệu; báo cáo và dừng.

### Kết quả Phase 2 gate (03/11/2026)

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4; build có các route CRM, catalog, orders, contract/receipt và API export.
- `npm run test`: 10 file, **52/52 test pass**.
- Migration Phase 2 trên DB mới + seed 2 lần: 10 khách, 10 tương tác, 5 dịch vụ, 6 add-on, 5 sản phẩm, 3 voucher, 6 đơn, 13 order item, 26 timeline, 5 payment, 168 role permission; idempotent.
- Chrome thật (Playwright): tạo/sửa khách, tương tác, CSV; tạo dịch vụ/add-on/sản phẩm/voucher; tạo đơn với voucher + cọc; thu tiền; đổi trạng thái; xác nhận hợp đồng; in phiếu thu; photographer bị chặn nút quản lý và 403 ở server; viewport 375/390/768/1024/1440 không tràn ngang; không lỗi HTTP/console.
- `npm audit --omit=dev`: 0 lỗ hổng production.
- Deferral có chủ đích: conflict lịch/transaction Phase 3; album tab Phase 4; invoice/refund/báo cáo Phase 5; E2E chính thức Phase 7.

---

# PHASE 3 — LỊCH CHỤP VÀ KHO TRANG PHỤC

> Trạng thái: **HOÀN TẤT**.
> Phụ thuộc: Phase 2 đạt gate.
> Mục tiêu: lịch chụp chống trùng an toàn, điều phối tài nguyên, kho trang phục QR.

## 3.1. Schema, seed và calendar

- [x] **P3-01** Migration: `rooms`, `appointments` (gồm `idempotency_key`), `staff_shifts`, `leave_requests`, `wardrobe_rentals`, `equipment`, `equipment_usages`.
- [x] **P3-02** Index/unique: tenant+branch+room+time, tenant+branch+staff+time, tenant+idempotency key; index status/start_at.
- [x] **P3-03** Seed phòng, ca làm, lịch mẫu, trang phục, thiết bị; idempotent.
- [x] **P3-04** Calendar ngày/tuần/tháng/timeline; lọc chi nhánh/photographer/phòng; màu theo chi nhánh/phòng/người.
- [x] **P3-05** Mobile mặc định agenda/list; event có giờ, khách/mã đơn, người phụ trách theo quyền; hiển thị lịch hủy/ngày hiện tại bằng cả nhãn và màu.
- [x] **P3-06** Tạo/sửa/hủy lịch bằng form; lỗi xung đột giữ form và hiển thị lý do.
  - Ghi chú: kéo-thả trên calendar chưa triển khai; dùng form sửa giờ làm fallback theo UI_SYSTEM.

## 3.2. Chống trùng lịch và transaction

- [x] **P3-07** Service kiểm tra overlap phòng, photographer, makeup, editor; buffer 30 phút; giờ làm việc/ngày nghỉ/leave.
- [x] **P3-08** Transaction `BEGIN IMMEDIATE`; kiểm tra + insert trong cùng transaction; unique idempotency key.
- [x] **P3-09** Mutex tiến trình theo resource+slot; retry `SQLITE_BUSY` ngắn; lỗi thân thiện.
- [x] **P3-10** Trả lỗi nghiệp vụ xung đột kèm slot trống gợi ý; không ghi đè lịch; audit thay đổi/hủy.
  - Ghi chú: Server Action trả error state + suggestions; HTTP 409 sẽ dùng khi có API booking công khai.
- [x] **P3-11** Integration test hai request đồng thời cùng slot: một thành công, một 409, DB đúng 1 bản ghi.
- [x] **P3-12** Test bổ sung cho room và photographer; test buffer; test quyền chi nhánh; test idempotency retry.
- [x] **P3-13** Ghi chú PostgreSQL: thiết kế exclusion constraint `tstzrange`/`btree_gist` cho production path.
  - Ghi chú: đã ghi trong PLAN; chưa code/test PostgreSQL theo Q9.

## 3.3. Check-in/out, nhắc lịch, trang phục, thiết bị

- [x] **P3-14** Check-in/check-out buổi chụp; cập nhật trạng thái đơn/lịch; audit; hiển thị trạng thái rõ.
- [x] **P3-15** Tạo notification nội bộ cho nhân sự được phân công khi tạo/sửa/hủy lịch; lưu DB, trạng thái đã đọc/chưa đọc.
  - Ghi chú: nhắc khách qua Zalo/SMS/email cần Messaging Adapter live ở Phase 5; local không giả vờ gửi.
- [x] **P3-16** Kho trang phục CRUD: SKU, QR code, size, màu, tình trạng, ảnh, giá thuê/cọc.
- [x] **P3-17** QR xuất kho/nhận lại: hiển thị QR, tìm/quét bằng máy quét bàn phím qua ô tìm kiếm; lưu condition out/in.
  - Ghi chú: chưa dùng camera scanner; fallback nhập mã QR đã hoạt động.
- [x] **P3-18** Tính phí giặt/đền bù; cọc; cập nhật order item/total/remaining; audit; test phí.
- [x] **P3-19** Thiết bị CRUD, trạng thái, lịch sử sử dụng read-only; cảnh báo trạng thái bảo trì.
  - Ghi chú: thao tác xuất/nhập thiết bị theo ca sẽ bổ sung ở Phase 5 cùng vận hành/HR.
- [x] **P3-20** Chạy phase gate; UI booking/check-in/rental; manual calendar mobile; cập nhật tài liệu; báo cáo và dừng.

### Kết quả Phase 3 gate (03/11/2026)

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4; có route calendar, rooms, wardrobe, rentals, equipment.
- `npm run test`: 12 file, **63/63 test pass**.
- Migration Phase 3 trên DB mới + seed 2 lần: 4 phòng, 154 ca làm, 2 nghỉ phép, 6 lịch hẹn, 2 phiếu thuê, 5 thiết bị, 1 lịch sử thiết bị; idempotent.
- Chrome thật (Playwright): 4 view calendar; tạo lịch; conflict + suggestions; check-in/out; tạo phòng; tạo trang phục + QR; cho thuê; nhận lại + phí giặt; phiếu thuê; tạo thiết bị; photographer bị chặn nút quản lý; viewport 375/390/768/1024/1440 không tràn ngang; không lỗi HTTP/console.
- `npm audit --omit=dev`: 0 lỗ hổng production.
- Deferral có chủ đích: kéo-thả calendar, camera QR scanner, nhắc khách live, thao tác thiết bị theo ca, PostgreSQL runtime, E2E chính thức.

---

# PHASE 4 — ẢNH, DRIVE, PHOTOSHARE, AI

> Trạng thái: **HOÀN TẤT**.
> Phụ thuộc: Phase 2 tối thiểu; nên hoàn tất Phase 3 cho luồng lịch.
> Mục tiêu: album, upload, PhotoShare, lọc ảnh theo mã khách chọn, Drive/NAS, AI Hub.

## 4.1. Storage và album

- [x] **P4-01** Storage Adapter interface local/s3/r2; local demo lưu `/public/uploads/<tenant>/<album>/`; production path private storage/signed URL; `.gitignore` file phát sinh, giữ `.gitkeep`.
- [x] **P4-02** Upload API: MIME magic/extension/size, path traversal, tên file an toàn; thumbnail bằng sharp; watermark derivative server-side.
- [x] **P4-03** Migration PhotoShare: `albums` (trạng thái, source_type, source_url, drive_folder_id, recursive_scan, selection_limit, extra_photo_enabled/price, allow_favorites/notes, selection_status/timestamps, token_hash/password/expiry/status), `album_sources`, `album_folders`, `photos` (code, filename, relative_path, storage_key, thumbnail_key, source_file_id, width/height/size, is_raw, checksum, watermarked, status), `photo_selections` (favorite, selected, note, code_snapshot, extra_fee, unique album+photo), `drive_connections`, `photo_filter_jobs`, `photo_filter_items`.
- [x] **P4-03b** Index/unique: album+photo code, album+photo_id selection, album token hash, tenant/source_file_id/checksum; soft delete/archive ảnh/album.
- [x] **P4-04** Album CRUD + trạng thái chưa upload/đang xử lý/sẵn sàng/đã giao/lưu trữ; phân loại raw/edit/delivery.
- [x] **P4-05** Tạo album demo từ ảnh synthetic có nhãn; seed album/photo/folder; idempotent.
- [x] **P4-06** Album list `/manage/photos`; DataTable states; filter trạng thái/khách/đơn/chi nhánh.

## 4.2. Wizard tạo album và nguồn ảnh

- [x] **P4-07** Wizard 3 bước: nguồn ảnh; thông tin khách/album/đơn/chi nhánh/ghi chú; số lượng chọn + phí ảnh thêm.
- [x] **P4-08** Tab “Thư mục Drive/NAS”: validate link, parse folder id, chỉ domain hợp lệ/connector đã cấu hình; chống SSRF; nút quét ảnh.
- [x] **P4-09** Tab “Dán nhiều link”: mỗi link một section; hợp nhất, chống trùng `source_file_id`/checksum.
- [x] **P4-10** Upload folder/ZIP cho demo/không dùng Drive; validate và lưu local.
- [x] **P4-11** Quét folder con tự động; tab “Tất cả” + tab từng folder kèm số lượng; trạng thái loading/lỗi quyền/link/quota.
- [x] **P4-12** Preview album: thumbnail, filename, folder; tab Tất cả/Đã chọn/Ghi chú; lazy load/phân trang; nút quét lại.
- [x] **P4-13** Rescan giữ selection cũ; ảnh bị xóa đánh dấu missing; không tự xóa lựa chọn khách.
- [x] **P4-14** Quota chọn nhanh 5/10/15/20/25/30/40/50; checkbox phí ảnh thêm mặc định tắt; tính vượt quota và xác nhận.
- [x] **P4-15** Phí ảnh thêm ghi vào order item/add-on hoặc payment request; không chỉ hiển thị UI; audit.
- [x] **P4-16** Sau tạo album: token khó đoán, copy link, mật khẩu, hạn, giới hạn tải, thu hồi/gia hạn; audit truy cập nhạy cảm.

## 4.3. Google Drive/NAS adapter

- [x] **P4-17** Local Drive adapter đọc thư mục demo synthetic; trạng thái local/demo rõ.
- [x] **P4-18** Google OAuth connect/callback/refresh; scope tối thiểu `drive.readonly`/`drive.file`; mã hóa refresh token bằng `TOKEN_ENCRYPTION_KEY`.
- [x] **P4-19** Quét folder/metadata/thumbnail; cache có TTL; xử lý rate limit/quota bằng backoff.
- [x] **P4-20** Lưu drive file id/folder id/sync status; nút sync lại, hiển thị lỗi sync; không giả vờ thành công khi chưa cấu hình.
- [x] **P4-21** NAS: không cho browser/server giả đọc đường dẫn NAS; local/desktop adapter hoặc trạng thái “chưa cấu hình” trung thực.
- [x] **P4-22** Test local adapter; test live khi có credentials (nếu không, ghi rõ chưa kiểm chứng).

## 4.4. PhotoShare công khai

- [x] **P4-23** `/share/[token]`: xác thực token hash, mật khẩu, expiry, revoke; rate limit; không lộ album/khách khác.
- [x] **P4-24** Gallery tab Tất cả/Đã chọn/Ghi chú; filter folder; số lượng từng tab; responsive; lazy load; fullscreen bàn phím/Escape/trả focus.
- [x] **P4-25** Khách thả tim, chọn ảnh, ghi chú từng ảnh; hiển thị số đã chọn/giới hạn; optimistic UI có rollback khi lỗi.
- [x] **P4-26** Gửi selection: server validate quyền, quota, trạng thái; lưu submitted_at; cập nhật trạng thái album/đơn phù hợp.
- [x] **P4-27** Copy mã từng ảnh/toàn bộ; 4 định dạng xuống dòng/phẩy/khoảng trắng/có đuôi; tùy chọn kèm ghi chú; copy link album.
- [x] **P4-28** Studio xem ảnh đã chọn/ghi chú/thời điểm, số ảnh vượt quota và phí phát sinh; copy danh sách mã; khóa/mở selection; lưu locked_at; audit.
- [x] **P4-29** Trang `/manage/albums/[id]/notes`: mã ảnh, ghi chú, copy toàn bộ, xuất CSV/TXT, điều hướng album/đơn.
- [x] **P4-30** ZIP ảnh đã chọn + `manifest.csv` + `missing.txt`; streaming; kiểm tra quyền/token; test khớp.
- [x] **P4-31** Watermark/derivative; chặn tải ảnh gốc nếu gói không cho phép; không chỉ phủ CSS.
- [x] **P4-32** Nhãn “Đây là môi trường demo” ở album/PhotoShare demo; không lẫn ảnh thật/PII.

## 4.5. Lọc ảnh theo mã khách chọn

- [x] **P4-33** Trang `/manage/albums/[id]/filter` và `/manage/photos/filter`; dropdown nguồn khách/album/hợp đồng; tìm kiếm; badge số mã hợp lệ.
- [x] **P4-34** Parse textarea: Excel/Zalo, xuống dòng, phẩy, khoảng trắng, đuôi file, số thứ tự; Unicode normalize/trim/lowercase; duplicate; nút copy nhanh 4 định dạng.
- [x] **P4-35** Chế độ chữ+số exact basename; chế độ chỉ số lấy numeric token cuối/duy nhất; ambiguous đánh dấu, không tự copy.
- [x] **P4-36** Chọn folder gốc: File System Access API `showDirectoryPicker`, quét đệ quy, chỉ đọc khi user cấp quyền; không gửi absolute path lên server.
- [x] **P4-37** Fallback `webkitdirectory`/ZIP/desktop helper; thông báo rõ browser không hỗ trợ; không giả vờ server đọc ổ đĩa.
- [x] **P4-38** Cấu hình output: checkbox tạo folder con “Ảnh khách chọn” trong folder gốc, đổi tên/chọn folder khác; chỉ copy, không xóa/di chuyển; xử lý file đích tồn tại (hỏi ghi đè/bỏ qua/đổi tên).
- [x] **P4-39** Định dạng file: tất cả/RAW/JPG-PNG; giữ extension gốc.
- [x] **P4-40** Chạy lọc: nút chỉ bật khi có mã hợp lệ + folder; progress đã quét/khớp/copy/missing/lỗi; hủy giữa chừng.
- [x] **P4-41** Kết quả: manifest.csv, missing.txt, tổng kết; fallback tải ZIP; local mở folder; lưu job/items aggregate, không lưu absolute path.
- [x] **P4-42** Unit test parse/matching/numeric/ambiguous/duplicate; integration job; E2E FS Access + fallback; test RAW/JPG.

## 4.6. AI Hub

- [x] **P4-43** Cấu hình provider/key/model/chi phí/ngân sách/bật tắt từng tính năng; secret che, thay thế có kiểm soát.
- [x] **P4-44** Local heuristic: blur, thiếu sáng/quá sáng, near-duplicate, gợi ý burst; nhãn “heuristic”.
- [x] **P4-45** Phát hiện nhắm mắt: chỉ khi có model phù hợp; nếu không, hiển thị “chưa hỗ trợ”, không giả vờ đọc metadata là phát hiện.
- [x] **P4-46** Matching ảnh khách chọn với ảnh gốc: exact trước, AI chỉ gợi ý, không tự copy khi chưa xác nhận.
- [x] **P4-47** AI job log/trạng thái/chi phí ước tính/lỗi; cost guard; consent tenant trước khi gửi ảnh ra provider.
- [x] **P4-48** Live adapter lazy-init, timeout/retry; thiếu key hiển thị “chưa cấu hình”; không gọi mạng lúc build.

## 4.7. Kiểm thử và bàn giao Phase 4

- [x] **P4-49** Integration: token/password/expiry/revoke; selection/quota/lock; extra fee; upload security; tenant isolation album/ảnh.
- [x] **P4-50** Integration: ZIP/manifest/missing; rescan dedupe/missing; filter job; watermark/download.
- [x] **P4-51** E2E PhotoShare + filter; manual FS Access/fallback; kiểm tra ảnh demo và nhãn.
- [x] **P4-52** Chạy phase gate; cập nhật tài liệu; báo cáo và dừng.

### Kết quả Phase 4 gate (03/11/2026)

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4; có các route album, PhotoShare, filter, AI, integrations, uploads và file serving.
- `npm run test`: 18 file, **84/84 test pass**.
- Migration Phase 4 trên DB mới (`0000–0005`) + seed 2 lần: 1 album, 3 folder, 12 ảnh synthetic, 22 settings; idempotent.
- Chrome thật (Playwright + Chrome hệ thống): PhotoShare chọn 3 ảnh/thả tim/ghi chú/gửi; owner xem selection; AI local scan; notes; fallback ZIP filter (quét 12, khớp 3, copy 3, missing 0); ZIP+manifest và CSV; wizard tạo album; upload API + thumbnail; AI Hub settings; tích hợp Google/NAS trạng thái chưa cấu hình; viewport 375/390/768/1024 không tràn ngang; không lỗi HTTP/console sau khi chuyển file serving sang route.
- `npm audit --omit=dev`: 0 lỗ hổng production.
- Đã sửa lỗi production phát hiện khi kiểm thử: file upload mới trong `public/uploads` bị Next trả 404 sau build → chuyển sang route `/api/files/[...key]`.
- Chưa kiểm chứng live: Google Drive OAuth/scan khi không có credentials thật; NAS chưa cấu hình; File System Access directory picker không thể thao tác tự động trong headless (fallback ZIP đã E2E). S3/R2 interface chỉ báo chưa cấu hình.
- Deferral có chủ đích: E2E chính thức Phase 7; thanh toán thực cho phí ảnh thêm Phase 5 (hiện tạo payment request pending); desktop helper NAS; private storage/signed URL production.

---

# PHASE 5 — TÀI CHÍNH, NHÂN SỰ, VẬN HÀNH

> Trạng thái: **HOÀN TẤT**.
> Phụ thuộc: Phase 2, 3, 4.
> Mục tiêu: tài chính, webhook, hoa hồng/lương, HR, tasks/docs/campaigns/inbox, settings, báo cáo, audit.

## 5.1. Schema và tài chính

- [x] **P5-01** Migration: `transactions`, `expenses`, `budgets`, `invoices` hoàn chỉnh, `commission_rules`, `commissions`, `payrolls`, `attendance`, `leave_requests` UI, `payment_webhook_events`, `tasks`, `task_comments`, `documents`, `campaigns`, `conversations`, `messages`, `ai_jobs`, `notifications`, `activity_logs` mở rộng.
- [x] **P5-02** Sổ quỹ thu chi: CRUD, danh mục, ngân sách, gắn đơn/khách/nhân viên/chi nhánh; phương thức tiền mặt/chuyển khoản/VietQR/thẻ/ví.
- [x] **P5-03** Thu cọc/đợt 2/thanh toán dứt điểm/hoàn tiền; transaction + audit; số dư đúng.
- [x] **P5-04** Công nợ khách, tuổi nợ, nhắc thu; filter/sort/export.
- [x] **P5-05** Hóa đơn: tạo/in, trạng thái, VAT/TNCN mức demo; unique invoice_no; PDF/print tiếng Việt.
- [x] **P5-06** Payment Adapter manual/VietQR; payload NAPAS hợp lệ; validate BIN/tài khoản/số tiền/nội dung.
- [x] **P5-07** Trang `/manage/settings/payments/sandbox`: mã đơn, số tiền, nội dung, VietQR; nút xác nhận gọi endpoint nội bộ.
- [x] **P5-08** Mock webhook `/api/mock/webhook/payment`: chỉ development; secret/signature, timestamp, event id unique, idempotency, chống replay; production disabled/404.
- [x] **P5-09** `payment_webhook_events` lưu event/provider/payload hash/trạng thái; xử lý lặp trả 200 no-op; test gửi lặp chỉ một payment.
- [x] **P5-10** Test webhook sai signature/timestamp/replay; test production env tắt endpoint; audit.

## 5.2. Hoa hồng, lương, HR

- [x] **P5-11** Commission rules: cố định/%/vai trò/effective date/trạng thái; snapshot khi tính; không tính lại lịch sử khi đổi rule.
- [x] **P5-12** Commission rows: chờ duyệt/đã duyệt/đã trả; approved_by; audit.
- [x] **P5-13** HR hồ sơ nhân viên, mã, vai trò, chi nhánh, trạng thái; ca làm, lịch làm, nghỉ phép.
- [x] **P5-14** Chấm công GPS/QR/thủ công; lưu check-in/out, vị trí, thiết bị; audit.
- [x] **P5-15** Bảng lương: lương cơ bản, ngày công, hoa hồng, thưởng, khấu trừ, net; trạng thái nháp/chờ duyệt/đã duyệt/đã trả; khóa kỳ lương.
- [x] **P5-16** Phân quyền xem lương chỉ owner/admin/kế toán; audit khi sửa lương/hoa hồng.
- [x] **P5-17** KPI photographer/sale: số buổi, doanh thu, tỷ lệ chốt, đơn hoàn tất.

## 5.3. Báo cáo, dashboard, vận hành

- [x] **P5-18** Báo cáo doanh thu thực thu/dự kiến, công nợ/tuổi nợ, chi phí/lợi nhuận, theo chi nhánh/dịch vụ/nhân viên, tỷ lệ lấp đầy phòng, hiệu suất photographer.
- [x] **P5-19** Báo cáo thuế mức demo, xuất CSV/PDF; đối soát với transactions/payments; test khớp số.
- [x] **P5-20** Dashboard đầy đủ KPI, so sánh kỳ trước, đơn mới/đang chụp/hậu kỳ/chờ giao, lịch hôm nay/tuần, lead/follow-up/sinh nhật, top dịch vụ; biểu đồ có legend/bảng thay thế.
- [x] **P5-21** Tasks board/list: assignee, priority, deadline, todo/doing/review/done; gắn order/customer/album; comments/mention/attachment nếu khả thi; nhắc quá hạn.
- [x] **P5-22** Documents: upload/link, danh mục, quyền, phiên bản; storage an toàn.
- [x] **P5-23** Campaigns: nguồn, ngân sách, spend, leads, orders, revenue, ROAS; adapter quảng cáo trạng thái chưa cấu hình, không giả gọi Meta.
- [x] **P5-24** Inbox Fanpage/Zalo local: hội thoại, gắn khách, phân công, trạng thái chưa trả lời/đang xử lý/đã trả lời; AI auto-reply bật/tắt, giới hạn chủ đề, human handoff, không lộ secret.
- [x] **P5-25** CRM → tạo task nhắc chăm sóc từ hồ sơ khách; task hiển thị ở board và hồ sơ.
- [x] **P5-26** Notifications in-app/email/Zalo/SMS adapter; template tiếng Việt; trạng thái đã đọc; local ghi log; không báo gửi thành công nếu thiếu cấu hình; gửi yêu cầu đánh giá sau hoàn tất đơn và lưu phản hồi vào `customer_interactions` nếu có.
- [x] **P5-27** Settings: studio, logo, địa chỉ, SĐT, email, website, MST, tài khoản ngân hàng, giờ làm; chi nhánh, phòng, dịch vụ, voucher, mẫu thông báo.
- [x] **P5-28** Settings tích hợp Drive/AI/Fanpage/Zalo/payment; trạng thái chưa cấu hình/đã kết nối/mất kết nối/lỗi/đang đồng bộ.
- [x] **P5-29** Users/roles/permissions/sessions; audit log UI có filter cho đăng nhập/thất bại, đổi quyền, đổi giá, thanh toán, hoa hồng, lương, hủy đơn/hoàn tiền/xóa/archive, truy cập PhotoShare nhạy cảm; backup/export dữ liệu demo có kiểm soát quyền.
- [x] **P5-30** AI cost guard cấu hình; log job; không gửi ảnh khách khi chưa consent.
- [x] **P5-35** Gửi yêu cầu đánh giá sau hoàn tất đơn; lưu phản hồi vào `customer_interactions`; notification/audit.
- [x] **P5-36** Liên kết album/ảnh, tasks, transactions, invoices vào chi tiết đơn; kiểm tra luồng end-to-end.

## 5.4. Kiểm thử và bàn giao Phase 5

- [x] **P5-37** Unit: tiền/công nợ/hoa hồng/lương/VAT; commission rule snapshot; payroll lock.
- [x] **P5-38** Integration: webhook idempotency/replay; báo cáo đối soát; phân quyền lương; transaction rollback; settings permission.
- [x] **P5-39** E2E: thanh toán sandbox → webhook → đơn đã thu; hoa hồng → duyệt → lương; task từ CRM.
- [x] **P5-40** Chạy phase gate; manual finance/HR/settings; cập nhật tài liệu; báo cáo và dừng.

### Kết quả Phase 5 gate (03/11/2026)

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4; có các route finance, invoices, debts, commissions, payroll, staff/attendance/leave, reports, tasks, documents, campaigns, inbox, settings/studio, activity-log, sandbox và API webhook/export.
- `npm run test`: 23 file, **106/106 test pass**.
- Migration Phase 5 trên DB mới (`0000–0006`) + seed 2 lần: thêm 8 transaction, 3 expense, 2 budget, 2 invoice, 3 commission rule, 3 commission, 1 payroll, 6 attendance, 4 task, 2 comment, 2 document, 2 campaign, 2 conversation, 4 message; idempotent.
- Chrome thật (dev server vì mock webhook chỉ bật development): ghi chi phí; sandbox VietQR → webhook → replay no-op; tạo hóa đơn VAT; duyệt commission; tạo payroll cộng commission; tạo task từ hồ sơ CRM; AI local auto-reply; check-in/out; lưu cấu hình studio; reports; audit + backup JSON; viewport 375/390/768/1024 không tràn ngang; không lỗi HTTP/console sau khi sửa input step và overflow grid.
- `npm audit --omit=dev`: 0 lỗ hổng production.
- Thiết kế ghi nhận: sổ quỹ là append-only (tạo/đọc + điều chỉnh bằng bút toán hoàn/chi mới), không sửa/xóa giao dịch tài chính để bảo toàn audit; ghi rõ trong docs thay vì thêm CRUD phá audit trail.
- Chưa kiểm chứng live: email/Zalo/SMS adapter (chưa cấu hình); Meta/TikTok Ads (chưa cấu hình); VietQR production cần `PAYMENT_PROVIDER=vietqr` + credentials ngân hàng thật; mock webhook cố ý 404 ở production.
- Deferral có chủ đích: E2E chính thức Phase 7; PDF server-side dùng print-to-PDF trình duyệt; attachments task nâng cao có thể bổ sung sau; PostgreSQL runtime chưa test.

---

# PHASE 6 — WEBSITE CÔNG KHAI VÀ LANDING PAGE

> Trạng thái: **HOÀN TẤT**.
> Phụ thuộc: Phase 1–5 đủ dữ liệu/screenshot thật.
> Mục tiêu: landing A.0–A.7, public pages, auth UI, onboarding, demo read-only, SEO, responsive.

## 6.1. Marketing và landing

- [x] **P6-01** Marketing shell/layout, tokens, font, ảnh, header/footer dùng chung; không asset không quyền.
- [x] **P6-02** Header sticky, menu, mobile drawer, anchor scroll, CTA; shadow khi scroll; không che nội dung.
- [x] **P6-03** Hero 2 cột, badge, H1, subheadline, CTA, trust bullets; ảnh dashboard thật + card PhotoShare; social proof chỉ dùng số liệu thật hoặc nhãn demo.
- [x] **P6-04** Pain point → giải pháp; steps; feature grid 4 nhóm; link xem tất cả.
- [x] **P6-05** Product showcase tabs Dashboard/Đơn hàng/Chi phí/Lịch chụp; ảnh thật; CTA demo read-only.
- [x] **P6-06** Screenshot gallery 5 ảnh thật, mô tả, lightbox.
- [x] **P6-07** PhotoShare showcase 2 cột; Drive/NAS, thả tim, ghi chú, copy mã, lọc, ZIP/manifest; CTA “Xem demo PhotoShare”/“Tìm hiểu PhotoShare”; ảnh synthetic có quyền.
- [x] **P6-08** Pricing 4 gói, Pro nổi bật, bảng so sánh, toggle năm nếu có; CTA dẫn đăng ký/tư vấn; giá demo ghi rõ.
- [x] **P6-09** Testimonials 3–6 card có nhãn demo hoặc bỏ; không bịa logo/đánh giá.
- [x] **P6-10** FAQ 8 câu accordion + JSON-LD FAQPage; guide cards; final CTA; footer 4 cột.
- [x] **P6-11** Trang `/phan-mem-quan-ly-studio`, `/crm-studio-chup-anh`, `/pricing`, `/guide`, `/blog`, `/blog/[slug]`, `/terms`, `/privacy`, `/contact`.
- [x] **P6-12** Blog/guide/legal có nội dung tiếng Việt thật, không lorem; legal được review, không tuyên bố pháp lý sai.
- [x] **P6-13** Contact form validate, lưu `contact_requests` (tạo migration bảng cấp nền tảng), phản hồi loading/success/error; rate limit/CSRF.

## 6.2. Auth UI, onboarding, demo read-only

- [x] **P6-14** `/login` hoàn thiện UI theo token; `/register` tạo tenant/owner/chi nhánh giao dịch thật; `/reset-password` token thật qua adapter local.
- [x] **P6-15** Multi-tenant onboarding: slug unique, plan trial, chi nhánh đầu tiên, seed tối thiểu, transaction; audit.
- [x] **P6-16** `/demo` tạo phiên read-only ephemeral; banner “Đây là dữ liệu demo”; server chặn mọi mutation; CTA đăng ký cuối.
- [x] **P6-17** Demo không lộ PII/secret; dữ liệu synthetic; giới hạn truy cập.
- [x] **P6-18** Đăng ký/đăng nhập/reset có validation, loading, success, error; không fake email gửi.

## 6.3. SEO, ảnh, responsive, acceptance

- [x] **P6-19** Metadata riêng từng trang: title/description/canonical/OG/Twitter; `NEXT_PUBLIC_SITE_URL`.
- [x] **P6-20** JSON-LD Organization/SoftwareApplication/FAQPage hợp lệ; sitemap/robots; H1 duy nhất; heading đúng; alt text; internal link.
- [x] **P6-21** Screenshot thật từ app (Playwright capture) sau Phase 1–5; ảnh demo synthetic/AI có nhãn/nguồn; không ảnh giả dashboard.
- [x] **P6-22** Responsive 375/390/768/1024/1440; không tràn ngang, không che CTA, không vỡ ảnh; tabs cuộn ngang mobile.
- [x] **P6-23** Accessibility: keyboard, focus, contrast, reduced motion, skip link, form labels; kiểm tra dark mode nếu hỗ trợ.
- [x] **P6-24** Performance: ảnh WebP/AVIF/lazy, font swap, không CLS lớn; Lighthouse mobile hướng 90+ nếu khả thi.
- [x] **P6-25** Chạy acceptance A.7 đầy đủ 18 mục; CTA/tabs/FAQ/pricing/form/SEO; không lỗi console nghiêm trọng.
- [x] **P6-26** Chạy phase gate; cập nhật tài liệu; báo cáo và dừng.

### Kết quả Phase 6 gate (03/11/2026)

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4; landing, solution, pricing, guide, blog, legal, contact, auth, demo route, sitemap/robots.
- `npm run test`: 24 file, **110/110 test pass** (thêm onboarding/reset/contact/demo read-only).
- Migration Phase 6 (`0007`) trên DB mới + seed 2 lần: thêm `contact_requests`, `sessions.read_only`; idempotent.
- Chrome thật: landing đủ 14 section/1 H1; ảnh thật từ app; sticky header; mobile drawer; product tabs; FAQ một câu mở; pricing toggle/comparison; screenshot lightbox; responsive 390/768/1024/1440; public pages 200; contact form lưu DB; đăng ký tenant trial + auto login; reset token thật + login mật khẩu mới; `/demo` read-only banner; JSON-LD/sitemap/robots.
- `npm audit --omit=dev`: 0 lỗ hổng production.
- Ảnh marketing được capture từ app thật tại `public/marketing/{dashboard,orders,calendar,customers,finance}.jpg`; không dùng ảnh dashboard giả. Ảnh PhotoShare/synthetic lấy từ album demo có nhãn.
- Giới hạn đã ghi nhận: Lighthouse mobile chưa chạy trong môi trường này (không cài Lighthouse), nên chưa tuyên bố 90+; image optimization/lazy/priority/CLS dimensions đã áp dụng. Email/Zalo/SMS live chưa cấu hình; local reset hiển thị link thay vì gửi email. Testimonials/số liệu đều có nhãn demo. Contact request chưa có màn hình admin xử lý trong bản demo. E2E chính thức Phase 7.
- Acceptance A.7: đã kiểm tra 1–13, 15–17; mục 14 Lighthouse mới là hướng tới, chưa đo; mục 18 demo mutation đã chặn ở service/test.

---

# PHASE 7 — QA VÀ BÀN GIAO

> Trạng thái: **HOÀN TẤT**.
> Phụ thuộc: Phase 0–6 đạt gate.

- [x] **P7-01** Chạy toàn bộ lint/typecheck/build/test/test:e2e trên trạng thái cuối.
- [x] **P7-02** Chạy migration + seed trên database mới; seed hai lần; xác nhận idempotent.
- [x] **P7-03** Chạy app thật, kiểm tra tất cả route chính desktop/tablet/mobile.
- [x] **P7-04** Kiểm tra phân quyền từng vai trò ở server: owner/manager/receptionist/photographer/makeup/retoucher/accountant/platform admin.
- [x] **P7-05** Kiểm tra tenant isolation và branch scope trên module trọng yếu; ghi bằng chứng test.
- [x] **P7-06** Kiểm tra 25 kịch bản acceptance của SPEC; ghi pass/fail/chưa kiểm chứng.
- [x] **P7-07** Kiểm tra landing A.7 desktop/tablet/mobile; CTA, tabs, FAQ, pricing, form, SEO, không lorem/asset sai quyền.
- [x] **P7-08** Kiểm tra PhotoShare token/password/expiry/lock/quota/watermark/ZIP; filter FS Access/fallback.
- [x] **P7-09** Kiểm tra webhook lặp, booking đồng thời, payroll lock, báo cáo đối soát; kiểm tra XSS/CSRF/SSRF/path traversal ở các luồng liên quan.
- [x] **P7-10** Grep `TODO`, `Coming soon`, `Not implemented`, `onClick={() => {}}`; không còn trong luồng chính.
- [x] **P7-11** Cập nhật README: chạy một lệnh, migration/seed, tài khoản demo/PIN, biến môi trường, giới hạn, credentials cần bổ sung.
- [x] **P7-12** Cập nhật `TASKS.md`/`PROGRESS.md` và `HANDOFF.md`; đánh dấu `[x]` chỉ cho việc đã kiểm chứng.
- [x] **P7-13** Báo cáo cuối: route, file chính, test results, known limitations, phần chưa kiểm chứng.
- [x] **P7-14** Đối chiếu Definition of Done trong SPEC; phase gate và bàn giao.

### Kết quả Phase 7 gate (03/11/2026)

- `npm run lint`: pass, 0 error/0 warning.
- `npm run typecheck`: pass.
- `npm run build`: pass — Next.js 16.4.4 (Turbopack); toàn bộ route public/auth/manage/API/print/platform build thành công.
- `npm start` production smoke: `/`, `/login`, `/sitemap.xml`, `/robots.txt` trả 200; `/platform` 307 về `/login` khi chưa đăng nhập; `POST /api/mock/webhook/payment` trả 404 ở production.
- `npm run test`: 26 file, **117/117 test pass** (unit + integration).
- `npm run test:e2e`: **7/7 E2E pass** trên Chrome hệ thống — owner route chính, smoke 49 route, PhotoShare public, demo read-only, platform admin, landing responsive/tabs/FAQ/pricing, mobile menu/public pages, SEO/JSON-LD/sitemap/robots.
- Migration trên DB mới + seed 2 lần: idempotent; 2 tenant, 3 chi nhánh, 10 nhân sự (gồm platform admin), 10 khách, 6 đơn, 4 phòng, 6 lịch hẹn, 12 ảnh, 22 settings, 168 role permission, 8 transaction, 1 payroll, 4 task, 2 document, 2 campaign; `sessions`/`login_attempts`/`notifications`/`contact_requests` = 0 sau reset; 2 activity log seed.
- Role matrix server-side: 3 test tích hợp cho permission matrix, mutation bị từ chối, tenant isolation/branch scope; E2E xác nhận platform admin vào `/platform` và bị 403 ở dữ liệu tenant.
- Security: 4 test cho CSRF origin guard, SSRF khi parse link Drive, path traversal storage, XSS escaping; booking đồng thời, webhook lặp, payroll lock và đối soát báo cáo đã có test từ Phase 3–5.
- Grep `TODO`/`Coming soon`/`Not implemented`/`onClick={() => {}}`/`Lorem ipsum`: không còn trong `src`, `e2e`, `tests`, `scripts`.
- `npm audit --omit=dev`: 0 lỗ hổng production.
- Git/commit/push/deploy: đã commit/push GitHub; chưa deploy production.
- Chưa kiểm chứng live (cần credentials): Google Drive OAuth/scan, NAS/desktop helper, S3/R2, email/Zalo/SMS, Fanpage/Zalo connector, Meta/TikTok Ads, payment production, AI provider live.
- Chưa đo Lighthouse mobile; chưa test PostgreSQL runtime; File System Access directory picker kiểm tra thủ công, fallback ZIP đã E2E.

---

## LỊCH SỬ CẬP NHẬT

| Ngày | Phase | Thay đổi | Kết quả kiểm tra |
|---|---|---|---|
| 03/11/2026 | 0 | Đọc tài liệu, khảo sát repo, tạo PLAN/TASKS/HANDOFF | Repo greenfield; chưa có app |
| 03/11/2026 | 0 | User duyệt Q1–Q11; tạo PROGRESS; Phase 0 hoàn tất | Tài liệu và quyết định đã chốt |
| 03/11/2026 | 1 | Triển khai Next.js, schema SQLite, seed, auth/session/RBAC, app shell, dashboard, users/roles/sessions, test | lint/typecheck/build pass; 31/31 test pass; Chrome UI pass |
| 03/11/2026 | 2 | CRM 360, catalog, đơn hàng, voucher, thanh toán, trạng thái, hợp đồng/phiếu thu, seed và test | lint/typecheck/build pass; 52/52 test pass; Chrome UI pass |
| 03/11/2026 | 3 | Lịch chụp, conflict transaction/buffer, check-in/out, phòng, wardrobe QR/rental, thiết bị, seed và test | lint/typecheck/build pass; 63/63 test pass; Chrome UI pass |
| 03/11/2026 | 4 | Storage/upload, album, PhotoShare, ZIP/manifest, lọc mã khách chọn, Drive/NAS adapter, AI Hub, seed và test | lint/typecheck/build pass; 84/84 test pass; Chrome UI pass |
| 03/11/2026 | 5 | Sổ quỹ, hóa đơn/VietQR/webhook, commission/payroll/HR, báo cáo, tasks/docs/campaigns/inbox, settings/audit, seed và test | lint/typecheck/build pass; 106/106 test pass; Chrome UI pass |
| 03/11/2026 | 6 | Marketing landing 14 section, public pages, onboarding, reset password, demo read-only, SEO, screenshot thật, test | lint/typecheck/build pass; 110/110 test pass; Chrome UI pass |
| 03/11/2026 | 7 | E2E chính thức, platform admin `/platform`, role/tenant/branch QA, security test, acceptance 25 kịch bản, reset DB, docs bàn giao | lint/typecheck/build pass; 117/117 test + 7/7 E2E pass; audit 0 |
