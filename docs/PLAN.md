# StudioCore — KẾ HOẠCH TRIỂN KHAI (PLAN)

> Trạng thái: **ĐÃ ĐƯỢC USER DUYỆT ngày 03/11/2026** — Phase 0–7 đã hoàn tất và được nghiệm thu; dự án bàn giao theo phạm vi SPEC.
> Ngày lập: 03/11/2026
> Nguồn bắt buộc: `AGENTS.md` (thư mục gốc), `docs/SPEC.md`, `docs/UI_SYSTEM.md`.
> Vị trí tài liệu: các file quản lý được đặt tại `studiocore/docs/` — cùng thư mục với `SPEC.md` và `UI_SYSTEM.md`. Đây là đề xuất, chờ xác nhận tại Quyết định Q1 trong `HANDOFF.md`.

---

## 0. KẾT QUẢ KHẢO SÁT BAN ĐẦU

### 0.1. Cấu trúc thực tế

Tính đến 03/11/2026, thư mục dự án chỉ có:

```text
D:\m\Dự Án Mới Nhú\
├── AGENTS.md
└── studiocore\
    └── docs\
        ├── SPEC.md
        └── UI_SYSTEM.md
```

- Không có `package.json`, `src/`, `app/`, `node_modules/`, migration, route, component hay style nào.
- Không phải git repository; không có lịch sử commit để đối chiếu.
- Không có code cũ cần bảo toàn. Vì vậy Phase 1 sẽ là khởi tạo mới, không phải mở rộng repo có sẵn.
- Môi trường thực tế: Node.js v26.13.0, npm 11.20.0; `pnpm` không có. Sẽ dùng npm và ghi rõ `engines` khi khởi tạo.
- `AGENTS.md` nằm ở thư mục gốc, nhưng `docs/SPEC.md` và `docs/UI_SYSTEM.md` nằm trong `studiocore/docs/`. Đây là điểm lệch đường dẫn cần chốt (Q1).

### 0.2. Tài liệu đã đọc

| Tài liệu | Trạng thái | Ghi chú |
|---|---|---|
| `AGENTS.md` | Đã đọc đầy đủ | Quy trình phase, zero-placeholder, transaction, bảo mật server-side, UI states |
| `studiocore/docs/SPEC.md` | Đã đọc đầy đủ | Đặc tả sản phẩm, phạm vi A–N, mô hình dữ liệu, tech stack, Phase 0–7, acceptance |
| `studiocore/docs/UI_SYSTEM.md` | Đã đọc đầy đủ | Token, typography, app shell, component, trạng thái, responsive, accessibility |

Không thiếu tài liệu bắt buộc. Không sửa nội dung ba tài liệu nguồn trong lượt này.

### 0.3. Kết luận khảo sát

Đây là dự án **greenfield**. Mọi quyết định về framework, database, thư mục, route, component và style đều phải được tạo mới ở Phase 1. Kế hoạch dưới đây bám sát SPEC, không tự cắt bớt phạm vi và không thay thế yêu cầu bằng giả định.

---

## 1. TÓM TẮT YÊU CẦU VÀ PHẠM VI

StudioCore là nền tảng SaaS quản lý studio chụp ảnh all-in-one, tiếng Việt mặc định, chạy thực tế tại Việt Nam, tương đương năng lực và trải nghiệm với StudioBase.vn nhưng triển khai gốc.

Phạm vi bắt buộc:

- Website công khai và landing page hoàn chỉnh theo A.0–A.7.
- Auth UI, ứng dụng quản trị nội bộ, app shell responsive.
- Multi-tenant, đa chi nhánh, RBAC chi tiết, kiểm tra ở server.
- Quy trình end-to-end: lead → khách → đơn → cọc → lịch → chụp → hậu kỳ → chọn ảnh → giao ảnh → thu tiền → hoàn tất → báo cáo/hoa hồng.
- CRM, dịch vụ/sản phẩm, kho trang phục QR, đơn hàng, hợp đồng, lịch chụp chống trùng, album, PhotoShare, lọc ảnh theo mã khách chọn, AI Hub, tài chính, nhân sự, tasks, tài liệu, campaigns, inbox, cấu hình, thông báo, audit.
- Adapter local-first: chạy đầy đủ khi không có API key; adapter live lazy-init, có timeout/retry/lỗi rõ ràng.
- Seed dữ liệu demo thuần Việt, tài khoản demo theo vai trò, test thực chất.

Ưu tiên theo SPEC: P0 → P1 → P2, không bỏ mục nào. Thứ tự triển khai theo Phase 0–7.

---

## 2. NGUYÊN TẮC BẤT BIẾN

1. **Zero-placeholder:** không TODO, không nút giả, không route “Coming soon”, không thành công giả. Tính năng chưa làm thì không render nút hoặc disabled kèm lý do.
2. **Server-side security:** ẩn/hiện menu chỉ là UX; mọi mutation, fetch, export, download, API route đều kiểm tra session, permission, tenant và branch ở server.
3. **Data integrity:** tiền là integer VND; timestamp UTC, hiển thị Asia/Ho_Chi_Minh; tính tiền/công nợ/hoa hồng/lương ở server; migration additive; seed idempotent; webhook idempotent.
4. **Concurrency:** mọi tạo/sửa booking nằm trong transaction ghi; SQLite dùng `BEGIN IMMEDIATE`; có mutex theo resource + slot; retry `SQLITE_BUSY`; test hai request đồng thời.
5. **Local-first:** mặc định SQLite WAL, storage local, payment/messaging/AI/Drive adapter local; live adapter chỉ khi có credentials.
6. **Không secret/PII thật:** dùng `.env.local`, `.env.example`; seed/test bằng dữ liệu hư cấu; không log token, PIN, mật khẩu, API key, số tài khoản đầy đủ.
7. **Tiếng Việt mặc định:** copy, metadata, lỗi, email, hóa đơn, hợp đồng; định dạng VND, SĐT Việt Nam, ngày dd/MM/yyyy, giờ 24h.
8. **Feature parity, original implementation:** chỉ nghiên cứu thông tin công khai; không sao chép mã, asset, nội dung marketing, logo, dữ liệu khách của bên thứ ba; không truy cập vùng quản trị nội bộ của họ.
9. **Không phá vỡ dữ liệu:** migration additive; thao tác xóa/khôi phục phải xác nhận; backup/export có kiểm soát quyền.

---

## 3. KIẾN TRÚC ĐỀ XUẤT

### 3.1. Sơ đồ phân lớp

```text
Browser / Public share
        │
Next.js App Router (Server Components mặc định)
        │  Server Actions (mutation) + API Routes (webhook/upload/export/download)
        ▼
Service layer (nghiệp vụ, transaction, permission, audit)
        │
Repository / Drizzle ORM (tenant scope bắt buộc)
        │
SQLite WAL (demo/local)  ──►  PostgreSQL (production path)
        │
Adapter layer: Storage | Drive | Payment | Messaging | AI | Notification
```

Nguyên tắc:

- UI không chứa logic tính tiền/permission quan trọng.
- Client Component chỉ dùng khi cần tương tác DOM/state.
- Không import server-only module vào Client Component.
- Service layer là nơi duy nhất xử lý nghiệp vụ, transaction, kiểm tra quyền và ghi audit.
- Mọi query đi qua repository có tham số tenant/branch bắt buộc; không truy vấn trực tiếp từ page/component.

### 3.2. Tech stack đề xuất

| Thành phần | Lựa chọn đề xuất | Lý do | Ghi chú |
|---|---|---|---|
| Framework | Next.js App Router, bản stable mới nhất tại Phase 1 | SPEC yêu cầu; Server Components + Server Actions phù hợp | Khóa version sau khi đọc tài liệu trong `node_modules`; không đoán API |
| Ngôn ngữ | TypeScript strict, cấm `any` | SPEC | `tsc --noEmit` trong CI/phase gate |
| UI | Tailwind CSS + shadcn/Base UI (Radix primitives) + Lucide | SPEC + UI_SYSTEM | Dùng token CSS, không tạo hệ thống song song |
| Font | Be Vietnam Pro 400/500/600/700, self-host hoặc `next/font` | UI_SYSTEM | `display: swap`; kiểm tra dấu tiếng Việt |
| Biểu đồ | Recharts | SPEC | Có legend, mô tả/bảng dữ liệu thay thế |
| Toast | Sonner | SPEC | Lỗi nghiệp vụ hiển thị tại nơi thao tác, không chỉ toast |
| ORM / DB | Drizzle ORM + SQLite WAL (`better-sqlite3` hoặc driver tương thích Node 26) | SPEC mặc định SQLite cho demo | Thiết kế dialect-portable; xác minh driver ở Phase 1 |
| Validation | Zod cho form và input server | SPEC | Schema dùng chung client/server khi phù hợp |
| Auth | Session cookie httpOnly + JWT ký HMAC (`jose`), scrypt của `node:crypto` | SPEC cho phép scrypt/argon2 | Có bảng `sessions` để thu hồi; rate limit + khóa tạm |
| Upload/ảnh | `sharp` cho thumbnail/watermark/đọc metadata | SPEC | Watermark server-side, không chỉ CSS |
| ZIP | `archiver` hoặc thư viện streaming tương đương | SPEC | Manifest CSV + missing.txt |
| PDF/print | Print CSS cho hợp đồng/phiếu thu; PDF server-side khi cần export | SPEC | Font tiếng Việt phải nhúng/định nghĩa đúng |
| Test | Vitest (unit/integration) + Playwright (E2E) | SPEC | Integration dùng DB tạm; E2E chạy app thật |
| Package manager | npm | Có sẵn; `pnpm` không có | Ghi `engines` Node/npm |

Các thư viện cụ thể (tên package, version) sẽ được chốt ở Phase 1 sau khi kiểm tra khả năng tương thích với Next.js/Node thực tế. Không cài dependency trong lượt này.

### 3.3. Cấu trúc thư mục dự kiến

```text
studiocore/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   ├── (auth)/
│   │   ├── (app)/manage/...
│   │   ├── share/[token]/
│   │   ├── platform/                 # đề xuất cho platform admin, chờ duyệt
│   │   └── api/
│   │       ├── uploads/
│   │       ├── webhooks/
│   │       ├── mock/webhook/payment/
│   │       ├── exports/
│   │       └── downloads/
│   ├── components/
│   │   ├── ui/                       # primitives
│   │   ├── layout/                   # app shell, marketing shell
│   │   ├── shared/                   # PageHeader, DataTable, Money, ...
│   │   ├── manage/
│   │   └── marketing/
│   ├── lib/
│   │   ├── db/                       # schema, migrations, seed, repositories
│   │   ├── auth/                     # session, RBAC, PIN/password, rate limit
│   │   ├── services/                 # nghiệp vụ theo domain
│   │   ├── adapters/                 # storage, drive, payment, messaging, ai, notification
│   │   ├── validators/               # Zod schemas
│   │   └── utils/                    # money, datetime, phone, photo-code
│   └── content/                      # blog, guide, legal, marketing copy
├── scripts/
│   ├── seed.ts
│   └── seed-demo.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
│   ├── uploads/                      # demo only, .gitignore file phát sinh
│   └── brand/
├── docs/
│   ├── SPEC.md
│   ├── UI_SYSTEM.md
│   ├── PLAN.md
│   ├── TASKS.md
│   └── HANDOFF.md
├── .env.example
└── package.json
```

Nếu Q1 chọn app root khác, cấu trúc này sẽ được ánh xạ lại trước Phase 1.

### 3.4. Quy ước kỹ thuật

- Mọi mutation dùng Server Action hoặc API route; validate Zod ở server; trả lỗi có mã và thông điệp tiếng Việt.
- API route dùng cho webhook, upload, export, download và các luồng cần streaming; mutation thường dùng Server Action.
- Mọi thao tác nhạy cảm ghi `activity_logs` trong cùng transaction nghiệp vụ khi có thể.
- Không gọi API bên thứ ba ở module scope, lúc build hoặc lúc khởi động; adapter live lazy-init, timeout, retry có kiểm soát.
- Không trả stack trace/secret ra client; lỗi hệ thống ghi log server, client nhận thông báo an toàn.
- Kiểm tra CSRF: SameSite + kiểm tra Origin cho Server Action/API; rate limit API nhạy cảm.
- Mọi route có loading/empty/error/forbidden state theo UI_SYSTEM.

---

## 4. CÁCH LY DỮ LIỆU VÀ PHÂN QUYỀN Ở SERVER

### 4.1. ActorContext

Mỗi request đã đăng nhập được chuyển thành một context bất biến ở server:

```text
ActorContext
- sessionId
- tenantId
- staffId
- role
- allowedBranchIds
- activeBranchId
- readOnly            # demo read-only
- permissions         # đọc từ role_permissions tại server
```

Quy tắc:

- Service function bắt buộc nhận `ActorContext`; không có context thì không thực thi.
- `activeBranchId` phải nằm trong `allowedBranchIds`; owner có thể chọn “Tất cả chi nhánh”, các vai trò khác chỉ chọn chi nhánh được giao.
- `readOnly` chặn mọi mutation ở server (demo mode), không chỉ ẩn nút.
- Session lưu trong bảng `sessions` để có thể thu hồi; cookie httpOnly, secure ở production, sameSite phù hợp, ký HMAC.

### 4.2. Cách ly tenant và chi nhánh

- Mọi bảng nghiệp vụ có `tenant_id`; bảng thuộc chi nhánh có `branch_id`.
- Repository bắt buộc nhận `tenantId` và tự thêm điều kiện; không cho phép truy vấn theo id đơn lẻ mà thiếu tenant.
- Bản ghi thuộc tenant khác trả **404** (không lộ sự tồn tại); thiếu quyền trong cùng tenant trả **403**.
- Mọi export/download/ZIP/ảnh/API đều kiểm tra tenant, branch, quyền và token tương ứng.
- Test bắt buộc: tenant A không đọc/ghi được dữ liệu tenant B ở mọi module trọng yếu.
- Platform admin không mặc định đọc dữ liệu nghiệp vụ của tenant; nếu cần hỗ trợ, dùng cơ chế impersonation có audit và thời hạn (đề xuất, chờ duyệt).

### 4.3. Ma trận phân quyền đề xuất

Ký hiệu: **X** = được phép; **V** = chỉ xem; **–** = không có quyền. Đây là ma trận khởi tạo đề xuất, có thể chỉnh khi duyệt.

| Quyền | Platform admin | Owner | Manager | Lễ tân/Sale | Photographer | Makeup | Retoucher/Editor | Kế toán |
|---|---|---|---|---|---|---|---|---|
| dashboard.view | – | X | X | X | X | X | X | X |
| orders.view | – | X | X | X | X | V | X | V |
| orders.manage | – | X | X | X | – | – | – | – |
| schedule.view | – | X | X | X | X | X | V | – |
| schedule.manage | – | X | X | X | – | – | – | – |
| customers.view | – | X | X | X | V* | V* | – | V* |
| customers.manage | – | X | X | X | – | – | – | – |
| albums.view | – | X | X | X | X | V | X | – |
| albums.manage | – | X | X | – | X | – | X | – |
| finance.view | – | X | V | – | – | – | – | X |
| finance.manage | – | X | – | – | – | – | – | X |
| staff.view | – | X | X | – | – | – | – | X |
| staff.manage | – | X | X | – | – | – | – | – |
| tasks.view | – | X | X | X | X | X | X | X |
| tasks.manage | – | X | X | X | X | X | X | X |
| reports.view | – | X | X | – | – | – | – | X |
| settings.view | – | X | X | – | – | – | – | V |
| settings.manage | – | X | – | – | – | – | – | – |
| payroll.view (mở rộng) | – | X | – | – | – | – | – | X |
| payroll.manage (mở rộng) | – | X | – | – | – | – | – | X |
| audit.view (mở rộng) | – | X | – | – | – | – | – | X |
| integrations.manage (mở rộng) | – | X | – | – | – | – | – | – |
| tenants.manage (nền tảng) | X | – | – | – | – | – | – | – |

`V*`: chỉ xem trường cần thiết; che SĐT/email/ghi chú nhạy cảm theo vai trò. Quy tắc che dữ liệu được thực hiện ở server khi serialize response, không chỉ CSS.

Quy tắc bổ sung:

- Phase 2 bổ sung quyền `catalog.manage` cho owner/manager để quản lý dịch vụ, add-on, sản phẩm và voucher; các vai trò khác xem danh mục qua `orders.view`.
- Chỉ owner, kế toán được xem lương/hoa hồng; manager không xem lương nhân viên ngoài phạm vi được giao.
- Sửa giá, thanh toán, hoa hồng, lương, hủy đơn, hoàn tiền, khóa selection, đổi quyền đều ghi audit.
- Quyền được đọc từ DB (`role_permissions`), không hard-code chỉ trong UI.
- Platform admin chỉ quản lý vòng đời tenant/gói/trạng thái nền tảng; không tự động xem CRM/tài chính của tenant.

### 4.4. Rate limit, session và audit

- Đăng nhập sai nhiều lần: rate limit theo IP + định danh, khóa tạm, ghi audit; thông báo không tiết lộ tài khoản có tồn tại hay không.
- PIN 6 số và mật khẩu đều hash bằng scrypt với salt riêng; so sánh constant-time.
- Session có thời hạn, thu hồi được, danh sách phiên trong trang quản lý người dùng.
- Audit log tối thiểu: đăng nhập/thất bại, đổi quyền, đổi giá, thanh toán, hoa hồng, lương, hủy đơn, hoàn tiền, xóa/archive, truy cập link PhotoShare nhạy cảm.

---

## 5. MÔ HÌNH DỮ LIỆU LÕI

### 5.1. Nguyên tắc chung

- Khóa chính ổn định (UUID/ULID); foreign key rõ ràng.
- `tenant_id` trên mọi bảng nghiệp vụ; `branch_id` trên bảng thuộc chi nhánh.
- Tiền: integer VND; không float. Timestamp: UTC; hiển thị Asia/Ho_Chi_Minh.
- Soft delete/archive (`archived_at`) cho dữ liệu quan trọng; không xóa cứng tùy tiện.
- Index cho `tenant_id`, `branch_id`, phone, order code, status, scheduled_at, created_at.
- Unique: `(tenant_id, phone)`, `(tenant_id, code)` cho đơn/nhân viên, `(tenant_id, invoice_no)`, `(album_id, photo code)`, `(album_id, photo_id)` cho selection.
- Migration additive; seed idempotent bằng upsert/khóa ổn định.

### 5.2. Nhóm bảng theo domain

**Tenant & identity**

`tenants`, `branches`, `staff`, `staff_branches`, `role_permissions`, `sessions`, `password_reset_tokens`, `login_attempts`, `activity_logs`, `settings`.

**CRM**

`customers`, `customer_interactions`.

**Danh mục & kho**

`services`, `service_addons`, `products`, `vouchers`, `wardrobe_items`, `wardrobe_rentals`, `equipment`, `equipment_usages`.

**Đơn hàng & thanh toán**

`orders`, `order_items`, `order_status_history`, `payments`, `payment_webhook_events`, `payment_requests`, `invoices`.

**Lịch & nhân sự vận hành**

`rooms`, `appointments`, `staff_shifts`, `attendance`, `leave_requests`, `payrolls`, `commissions`, `commission_rules`.

**Tài chính**

`transactions`, `expenses`, `budgets`.

**Ảnh & PhotoShare**

`albums`, `album_sources`, `album_folders`, `photos`, `photo_selections`, `drive_connections`, `photo_filter_jobs`, `photo_filter_items`.

**Marketing & vận hành**

`campaigns`, `tasks`, `task_comments`, `documents`, `conversations`, `messages`, `ai_jobs`, `notifications`, `contact_requests`.

### 5.3. Bảng bổ sung ngoài danh sách tối thiểu trong SPEC

Các bảng/cột sau là **đề xuất bổ sung** để đáp ứng yêu cầu SPEC. Phase 1 đã tạo `sessions`, `password_reset_tokens`, `login_attempts`; các bảng còn lại sẽ được tạo ở phase tương ứng:

| Bổ sung | Lý do |
|---|---|
| `sessions` | SPEC yêu cầu quản lý phiên đăng nhập và thu hồi |
| `password_reset_tokens` | Luồng `/reset-password` phải thật, không giả |
| `login_attempts` | Rate limit/khóa tạm đăng nhập có bằng chứng DB |
| `order_status_history` | SPEC yêu cầu timeline trạng thái: ai đổi, khi nào, ghi chú |
| `vouchers` | SPEC yêu cầu voucher nhưng không có trong danh sách tối thiểu |
| `commission_rules` | `commissions.rule_id` cần bảng rule có effective date/trạng thái |
| `payment_webhook_events` | Idempotency + chống replay cần lưu event id duy nhất |
| `payment_requests` | Ghi nhận phí ảnh thêm khi album chưa gắn order |
| `equipment`, `equipment_usages` | SPEC E yêu cầu quản lý thiết bị và lịch sử sử dụng |
| `budgets` | SPEC K yêu cầu ngân sách |
| `contact_requests` | Form `/contact` phải lưu dữ liệu thật (bảng cấp nền tảng, không tenant) |
| `staff.code`, `pin_hash`, `password_hash` | Đã có trong SPEC; dùng unique theo tenant |
| `appointments.idempotency_key` | SPEC 0.4 yêu cầu booking có idempotency key |
| `albums.token_hash` | Không lưu token công khai dạng thô nếu có thể; tra cứu bằng hash |
| `photos.checksum`, `source_file_id` | Chống trùng khi quét Drive/upload |
| `staff.working_hours`/`branches.working_hours` | Kiểm tra giờ làm việc; có thể lưu JSON trong settings/branches |
| `document_versions` (cân nhắc) | SPEC M yêu cầu phiên bản tài liệu; có thể làm ở Phase 5 |

### 5.4. Thiết kế chống trùng lịch (SPEC 0.4)

**SQLite (mặc định demo):**

1. Mở transaction ghi `BEGIN IMMEDIATE`.
2. Trong cùng transaction, kiểm tra overlap cho:
   - phòng: `(tenant_id, branch_id, room_id, khoảng thời gian)`
   - photographer, makeup, editor, retoucher được phân công: `(tenant_id, branch_id, staff_id, khoảng thời gian)`
3. Buffer 30 phút giữa hai ca: mở rộng khoảng thời gian ứng viên 30 phút mỗi phía khi so sánh.
4. Kiểm tra giờ làm việc, ngày nghỉ, lịch nghỉ phép đã duyệt.
5. Chèn appointment với `idempotency_key` unique theo tenant; nếu trùng key, trả bản ghi cũ hoặc 409 theo ngữ nghĩa retry.
6. Nếu xung đột: rollback, trả 409 kèm slot trống gợi ý; không ghi đè.
7. Bọc thêm mutex tiến trình theo khóa `(tenant, branch, resourceType, resourceId, slot)` để giảm `SQLITE_BUSY`; mutex chỉ là lớp phụ, không phải bằng chứng an toàn.
8. Retry ngắn khi `SQLITE_BUSY`, sau đó trả lỗi thân thiện.

**PostgreSQL (production path):**

- Dùng `tstzrange` + `btree_gist` exclusion constraint cho phòng và từng nhân sự được phân công.
- Hoặc advisory lock theo resource + slot.
- Giữ unique idempotency key và kiểm tra nghiệp vụ tương tự.

**Test bắt buộc:** hai request đồng thời cùng slot, kết quả một thành công/một bị từ chối; đếm bản ghi trong DB đúng 1; có test thêm cho phòng và photographer.

### 5.5. Trạng thái đơn hàng (đề xuất hợp nhất)

UI_SYSTEM §7 quy định mã ổn định; SPEC F liệt kê nhãn nghiệp vụ. Đề xuất dùng mã UI_SYSTEM làm chuẩn và bổ sung `awaiting_selection`:

| Mã | Nhãn hiển thị | Tone | Ghi chú |
|---|---|---|---|
| new | Mới tiếp nhận | neutral | |
| deposit_received | Đã cọc | info | |
| confirmed | Đã xác nhận | info | Mã có trong UI_SYSTEM |
| scheduled | Đã lên lịch | info | |
| shooting | Đang chụp | info | Mã có trong UI_SYSTEM |
| awaiting_edit | Đã chụp xong / Chờ chỉnh sửa | warning | |
| editing | Đang hậu kỳ | info | |
| awaiting_selection | Khách đang chọn ảnh | warning | **Bổ sung đề xuất** |
| awaiting_approval | Chờ duyệt | warning | |
| delivered | Đã bàn giao | success | |
| completed | Hoàn tất | success | |
| cancelled | Đã hủy | neutral | Hủy/hoàn tiền là trạng thái ngoại lệ có kiểm soát |

Thanh toán tách khỏi trạng thái sản xuất: Chưa thu / Thu một phần / Đã thu đủ / Hoàn tiền; cờ quá hạn/còn nợ là thuộc tính riêng. Transition matrix được enforce ở service server, ghi audit và timeline. Cần duyệt Q3.

### 5.6. PhotoShare và mã ảnh

- `photos.code` ổn định, duy nhất trong album; nếu filename trùng, sinh code duy nhất, không dùng số thứ tự dễ lệch.
- `photo_selections` unique `(album_id, photo_id)`; lưu `code_snapshot`, `note`, `favorite`, `selected`, `extra_fee`.
- Selection status: `draft` → `submitted` → `locked`; lưu `submitted_at`, `locked_at`; khóa thì khách không sửa được đến khi studio mở lại.
- Giới hạn chọn, phí ảnh thêm, quyền tải kiểm tra ở server.
- Token công khai khó đoán; lưu hash, có mật khẩu (hash), hạn dùng, thu hồi/gia hạn.
- Ảnh gốc/derivative và watermark kiểm tra ở server; production không dùng `/public/uploads` cho ảnh khách thật.

---

## 6. ROUTE MAP

### 6.1. Public và marketing (Phase 6)

| Route | Mục đích |
|---|---|
| `/` | Landing page chính |
| `/phan-mem-quan-ly-studio` | Trang giải pháp quản lý studio |
| `/crm-studio-chup-anh` | Trang giải pháp CRM studio |
| `/pricing` | Bảng giá, so sánh gói |
| `/guide` | Thư viện hướng dẫn |
| `/blog` | Danh sách bài viết |
| `/blog/[slug]` | Chi tiết bài viết |
| `/terms` | Điều khoản sử dụng |
| `/privacy` | Chính sách bảo mật |
| `/contact` | Form liên hệ/tư vấn, lưu `contact_requests` |
| `/demo` | Demo read-only, không cần đăng ký, chặn mutation ở server |
| `/share/[token]` | Gallery công khai cho khách (PhotoShare) |

### 6.2. Auth (Phase 1 cho đăng nhập; Phase 6 cho đăng ký/reset)

| Route | Mục đích |
|---|---|
| `/login` | Đăng nhập mã nhân viên + PIN hoặc email + mật khẩu |
| `/register` | Đăng ký dùng thử, tạo tenant/owner/chi nhánh đầu tiên |
| `/reset-password` | Quên/đặt lại mật khẩu, token thật |

### 6.3. Ứng dụng quản trị (`/manage`)

| Nhóm | Route |
|---|---|
| Tổng quan | `/manage/dashboard` |
| Kinh doanh | `/manage/customers`, `/manage/customers/[id]`, `/manage/orders`, `/manage/orders/new`, `/manage/orders/[id]`, `/manage/services`, `/manage/vouchers`, `/manage/products` |
| Sản xuất | `/manage/calendar`, `/manage/photos`, `/manage/photos/albums/new`, `/manage/photos/filter`, `/manage/albums/[id]`, `/manage/albums/[id]/filter`, `/manage/albums/[id]/notes`, `/manage/tasks` |
| Vận hành | `/manage/staff`, `/manage/staff/[id]`, `/manage/attendance`, `/manage/leave`, `/manage/wardrobe`, `/manage/wardrobe/rentals`, `/manage/equipment` |
| Tài chính | `/manage/finance/transactions`, `/manage/finance/debts`, `/manage/finance/invoices`, `/manage/finance/payroll`, `/manage/finance/commissions`, `/manage/reports` |
| Hệ thống | `/manage/documents`, `/manage/campaigns`, `/manage/inbox`, `/manage/inbox/[id]`, `/manage/ai`, `/manage/settings/studio`, `/manage/settings/branches`, `/manage/settings/rooms`, `/manage/settings/users`, `/manage/settings/roles`, `/manage/settings/sessions`, `/manage/settings/integrations`, `/manage/settings/payments`, `/manage/settings/payments/sandbox`, `/manage/settings/notifications`, `/manage/activity-log` |

Ghi chú:

- Route chưa triển khai không được hiển thị trên menu hoặc phải disabled kèm lý do; không render trang trống.
- `/manage/photos/filter` là trang lọc toàn cục theo SPEC I.5; `/manage/albums/[id]/filter` là luồng theo album.
- `/platform` (quản lý tenant nền tảng) là đề xuất cho platform admin, chờ duyệt Q10.

### 6.4. API routes

| Route | Mục đích | Ghi chú bảo mật |
|---|---|---|
| `/api/uploads` | Upload ảnh/tài liệu | Session + quyền + MIME/size/path traversal |
| `/api/webhooks/payment` | Webhook provider thật | Secret/signature + idempotency + replay |
| `/api/mock/webhook/payment` | Giả lập thanh toán | Chỉ `NODE_ENV !== production`; secret/signature/idempotency |
| `/api/exports/[type]` | CSV/PDF export | Session + quyền + tenant/branch scope |
| `/api/downloads/[...]` | Tải ảnh/ZIP/manifest | Token/quyền/hạn dùng; production signed URL |
| `/api/health` | Health check nội bộ | Không lộ secret/stack trace |

Mutation thông thường dùng Server Action, không mở API rộng.

---

## 7. LỘ TRÌNH PHASE 0–7

Thứ tự bám nguyên SPEC. Không chuyển phase khi còn lỗi build, placeholder hoặc nút không có handler. Mỗi phase kết thúc bằng cập nhật `TASKS.md`/`PROGRESS.md`/`HANDOFF.md` rồi dừng chờ duyệt.

### PHASE 0 — Khảo sát và kế hoạch

**Đầu ra:** khảo sát repo; `PLAN.md`; checklist thực thi; báo cáo kiến trúc; danh sách quyết định.

**Nội dung PLAN bắt buộc theo SPEC:** mục tiêu, giả định, rủi ro; feature matrix P0/P1/P2; route map; data model; permission matrix; adapter strategy; test plan; landing page blueprint. Tất cả có trong tài liệu này.

**Tiêu chí nghiệm thu:**

- Đã khảo sát repo/framework/dependency/database/route/component/style (repo trống, ghi nhận rõ).
- PLAN có đủ các mục trên.
- Có checklist thực thi dạng `[ ]`.
- Dừng báo cáo, chờ xác nhận.
- `PROGRESS.md` đã được tạo ngày 03/11/2026 trước khi viết code Phase 1.

**Kiểm chứng:** đọc chéo PLAN/TASKS/HANDOFF; user duyệt. **Trạng thái hiện tại: HOÀN TẤT ngày 03/11/2026** (xem §16).

### PHASE 1 — Nền tảng

**Đầu ra:**

- Khởi tạo Next.js App Router, TypeScript strict, Tailwind, design tokens, Be Vietnam Pro, shadcn/Base UI.
- App shell: sidebar nhóm Kinh doanh/Sản xuất/Vận hành/Tài chính/Hệ thống, topbar, breadcrumb, branch switcher, theme, mobile drawer, notification, skip link.
- Schema nền: tenant, branch, staff, staff_branches, role_permissions, sessions, password_reset_tokens, login_attempts, customers, services, wardrobe_items, settings, activity_logs; migration chạy được.
- Seed nền idempotent: tenant demo chính, tenant phụ tối thiểu, 2 chi nhánh, 8 nhân sự đủ vai, 10 khách, 5 gói chụp, 15 bộ trang phục, tài khoản demo.
- Auth mã nhân viên + PIN và email + mật khẩu; session cookie; rate limit/khóa tạm; audit.
- RBAC theo ma trận §4.3; branch scope; tenant isolation; trang quản lý người dùng/vai trò/phiên.
- Dashboard nền đọc dữ liệu thật (các chỉ số có nguồn ở Phase 1), empty/loading/error.
- Shared components: PageHeader, FilterBar, DataTable, StatusBadge, Money, DateTime, EmptyState, ErrorState, PermissionGate (UX), ConfirmDialog, PhotoGrid (khung).

**Tiêu chí nghiệm thu:**

- Đăng nhập được cả hai phương thức; sai nhiều lần bị chặn; session thu hồi được.
- Nhân viên không quyền bị chặn ở server (403/redirect an toàn), không chỉ ẩn menu.
- Tenant A không đọc/ghi được tenant B; manager chỉ thấy chi nhánh được giao.
- Seed chạy hai lần không nhân đôi dữ liệu.
- `lint`, `typecheck`, `build`, test pass; không còn placeholder trong luồng chính.

**Kiểm chứng:** unit/integration auth, RBAC, tenant isolation, rate limit; chạy app thật; kiểm tra 375/768/1024/1440; grep placeholder.

### PHASE 2 — CRM, dịch vụ, đơn hàng

**Đầu ra:**

- CRM: danh sách, hồ sơ 360, tạo/sửa, tương tác, phân khúc, tìm/lọc, CSV UTF-8 BOM, cảnh báo follow-up/sinh nhật, chuẩn hóa SĐT và chống trùng.
- Dịch vụ, add-on, voucher, sản phẩm; giá/thời lượng/trạng thái.
- Đơn hàng: tạo từ khách có sẵn/mới, đa dịch vụ, phụ phí, giảm giá/voucher, cọc/đã thu/còn lại, mã đơn, phân công, trạng thái + transition matrix server, timeline, audit.
- Thanh toán thủ công/cọc/thu một phần; tính tiền server; công nợ cơ bản.
- Hợp đồng/phiếu thu print/PDF, xác nhận điện tử nội bộ (không gọi là ký số hợp pháp).
- Seed CRM/order; test CRUD, validation, permission, chống trùng SĐT, tính tiền, trạng thái.

**Tiêu chí nghiệm thu:** luồng lead → khách → đơn → cọc → xếp lịch chạy; tổng tiền/đã thu/còn lại khớp; transition sai bị chặn; permission/tenant test pass.

**Kiểm chứng:** unit money/discount/deposit/status; integration permission/phone duplicate; E2E luồng 1 phần; print/PDF kiểm tra tiếng Việt.

### PHASE 3 — Lịch chụp và kho trang phục

**Đầu ra:**

- Calendar ngày/tuần/tháng/timeline; lọc chi nhánh/photographer/phòng; mobile agenda.
- Tạo/sửa/hủy lịch; kéo thả có fallback form; kiểm tra xung đột phòng, photographer, makeup, editor; buffer 30 phút; giờ làm việc/ngày nghỉ/leave; gợi ý slot.
- Transaction `BEGIN IMMEDIATE` + mutex + retry `SQLITE_BUSY` + idempotency; 409 kèm slot gợi ý.
- Check-in/check-out; cập nhật trạng thái; nhắc lịch qua notification local + terminal.
- Kho trang phục: SKU, QR, cho thuê/trả, cọc, phí giặt/đền bù; quét QR xuất/nhập kho.
- Thiết bị: CRUD, trạng thái, lịch sử sử dụng, cảnh báo tồn kho.
- Test hai request đồng thời; test phân quyền chi nhánh; test phí thuê/trả.

**Tiêu chí nghiệm thu:** hai booking cùng slot → một thành công, một 409, DB đúng 1 bản ghi; buffer/room/staff đúng; QR rental tính đúng phí; calendar dùng được mobile.

**Kiểm chứng:** integration concurrency (hai kết nối/process), E2E booking, manual calendar; unit buffer overlap.

### PHASE 4 — Ảnh, Drive, PhotoShare, AI

> Trạng thái: **HOÀN TẤT ngày 03/11/2026** — gate pass; Google live/NAS/S3 chưa cấu hình được ghi rõ trong HANDOFF.

**Đầu ra:**

- Storage adapter local `/public/uploads/<tenant>/<album>/`, `.gitignore`, upload API validate MIME/extension/size/path traversal; thumbnail, watermark server-side; synthetic demo assets.
- Album CRUD, trạng thái chưa upload/đang xử lý/sẵn sàng/đã giao/lưu trữ; raw/edit/delivery.
- Wizard tạo album 3 bước; nguồn Drive/NAS, nhiều link, upload folder/ZIP; quota chọn, phí ảnh thêm ghi vào order item/payment request.
- Quét folder/subfolder, tab “Tất cả” + từng folder, đếm ảnh, chống trùng, rescan giữ selection, ảnh missing.
- Google Drive OAuth connect/callback/refresh, mã hóa refresh token, scope tối thiểu, cache/backoff, trạng thái lỗi; local adapter khi chưa cấu hình.
- `/share/[token]`: mật khẩu, hạn, thu hồi/gia hạn; tab Tất cả/Đã chọn/Ghi chú; favorite/select/note; giới hạn; fullscreen; copy mã 4 định dạng; gửi selection; khóa/mở; audit.
- `/manage/albums/[id]/filter` và `/manage/photos/filter`: nguồn mã, chế độ chữ+số/chỉ số, parse Excel/Zalo, exact/ambiguous/duplicate/missing, File System Access API + fallback, output folder, RAW/JPG, progress/cancel, manifest/missing, lưu job.
- ZIP + manifest.csv + missing.txt; watermark/derivative; chặn tải ảnh gốc nếu gói không cho phép.
- AI Hub: cấu hình provider, job log, cost guard, consent; local heuristic (blur/exposure/near-duplicate/burst), matching; không giả vờ nhắm mắt nếu không có model.

**Tiêu chí nghiệm thu:** các kịch bản 5–18 trong danh sách acceptance; token/password/expiry đúng; quota/phí ghi nhận; lock không sửa được; rescan không trùng; parse đúng 4 định dạng; RAW/JPG đúng; ZIP/manifest/missing khớp; upload an toàn; demo label rõ.

**Kiểm chứng:** unit parser/matching/photo code; integration token/selection/quota/ZIP; E2E PhotoShare + filter; manual File System Access API và fallback.

### PHASE 5 — Tài chính, nhân sự, vận hành

> Trạng thái: **HOÀN TẤT ngày 03/11/2026** — gate pass; mock webhook dev-only; adapter live chưa cấu hình.

**Đầu ra:**

- Sổ quỹ thu chi, danh mục, ngân sách; giao dịch gắn đơn/khách/nhân viên/chi nhánh; phương thức; cọc/đợt 2/hoàn tiền.
- Công nợ, tuổi nợ, nhắc thu; hóa đơn, VAT/TNCN mức demo, trạng thái, in/PDF.
- Payment Adapter manual/VietQR; payload NAPAS hợp lệ; sandbox `/manage/settings/payments/sandbox`; mock webhook chỉ development, secret/signature/idempotency/replay; production tắt.
- Commission engine: cố định/%, vai trò, effective date, trạng thái chờ duyệt/đã duyệt/đã trả; không tính lại lịch sử khi đổi rule.
- HR: hồ sơ, ca, chấm công GPS/QR/thủ công, nghỉ phép, lương, KPI; phân quyền lương; audit.
- Tasks board/list, comments, mention, attachment; documents; campaigns/ROAS; inbox Fanpage/Zalo local; AI auto-reply có human handoff.
- Settings đầy đủ; notifications in-app/email/Zalo/SMS; audit log UI; backup/export demo.
- Dashboard/báo cáo đầy đủ; CSV/PDF; đối soát doanh thu/công nợ.
- Test tiền, công nợ, hoa hồng, lương, webhook idempotency, báo cáo, quyền.

**Tiêu chí nghiệm thu:** webhook lặp chỉ cộng một lần; báo cáo khớp giao dịch; lương/hoa hồng duyệt/khóa đúng; phân quyền lương đúng; sandbox không chạy production.

**Kiểm chứng:** unit/integration finance/commission/webhook; E2E luồng thanh toán; báo cáo đối soát; manual settings.

### PHASE 6 — Website công khai và landing page

> Trạng thái: **HOÀN TẤT ngày 03/11/2026** — gate pass; Lighthouse chưa đo; email live chưa cấu hình.

**Đầu ra:**

- Landing page đủ 14 section theo A.3, route map A.1; trang giải pháp, pricing, guide, blog, legal, auth UI, demo read-only, contact.
- Multi-tenant onboarding khi đăng ký; tạo tenant/owner/chi nhánh giao dịch thật.
- SEO metadata/canonical/OG/Twitter, JSON-LD Organization/SoftwareApplication/FAQPage, sitemap, robots, alt text, internal link.
- Ảnh/screenshot thật từ StudioCore; ảnh demo synthetic có nhãn; không asset không quyền.
- Responsive 375/390/768/1024/1440; accessibility; reduced motion; performance.
- Chạy toàn bộ acceptance A.7.

**Tiêu chí nghiệm thu:** A.7 pass; CTA hoạt động; FAQ accordion; tabs; pricing; form validate/phản hồi thật; demo read-only chặn mutation; SEO hợp lệ; không lorem/placeholder.

**Kiểm chứng:** Playwright/Chromium các viewport; Lighthouse; kiểm tra HTML metadata/JSON-LD; manual CTA/form; grep placeholder.

### PHASE 7 — QA và bàn giao

**Đầu ra:**

- Chạy toàn bộ unit/integration/E2E; chạy app thật kiểm tra route chính, phân quyền, tenant isolation.
- Kiểm tra landing desktop/tablet/mobile; acceptance A.7.
- README: chạy một lệnh, migration/seed, tài khoản demo/PIN, biến môi trường, giới hạn và credentials cần bổ sung.
- Cập nhật checklist/PROGRESS; báo cáo route, file chính, test results, known limitations.
- Grep TODO/Coming soon/Not implemented/onClick rỗng trong luồng chính.

**Tiêu chí nghiệm thu:** Definition of Done trong SPEC; không secret/PII; không placeholder; lint/typecheck/build/test pass.

---

## 8. FEATURE MATRIX P0/P1/P2 VÀ ÁNH XẠ PHASE

| Nhóm | Năng lực | Ưu tiên | Phase |
|---|---|---|---|
| Nền tảng | Auth, tenant, branch, RBAC, session, rate limit, audit nền | P0 | 1 |
| Nền tảng | App shell, theme, dashboard nền, user/role/session management | P0 | 1 |
| CRM | Hồ sơ 360, tương tác, phân khúc, tìm/lọc, CSV, chống trùng SĐT, cảnh báo | P0 | 2 |
| Danh mục | Dịch vụ, add-on, voucher, sản phẩm | P0 | 2 |
| Đơn hàng | Tạo đơn, items, giảm giá, cọc, trạng thái, timeline, phân công | P0 | 2 |
| Thanh toán | Ghi nhận thủ công, cọc/thu một phần, công nợ cơ bản | P0 | 2 |
| Hợp đồng | Hợp đồng/phiếu thu print/PDF, xác nhận nội bộ | P1 | 2 |
| Lịch chụp | Calendar, phòng, conflict, buffer, transaction lock, check-in/out, nhắc lịch | P0 | 3 |
| Trang phục | Kho QR, thuê/trả, cọc, phí giặt/đền bù | P1 | 3 |
| Thiết bị | Quản lý thiết bị, lịch sử, cảnh báo | P1 | 3 |
| Ảnh/Album | Upload, storage local, thumbnail, watermark, trạng thái album | P0 | 4 |
| PhotoShare | Link thả tim/chọn ảnh, ghi chú, copy mã 4 định dạng, quota, phí, khóa/mở | P0/P1 | 4 |
| Drive/NAS | OAuth, quét folder con, sync, missing, local adapter | P1 | 4 |
| Lọc ảnh | Lọc mã khách chọn từ folder máy tính, FS Access API/fallback, manifest/missing | P1 | 4 |
| AI Hub | Local heuristic, matching, job log, cost guard, consent, live adapter | P1 | 4 |
| Tài chính | Sổ quỹ, thu chi, công nợ, hóa đơn, VietQR, webhook mock, báo cáo | P0/P1 | 5 |
| Hoa hồng/lương | Commission engine, payroll, KPI, duyệt/khóa kỳ | P1 | 5 |
| HR | Chấm công, ca, nghỉ phép, hồ sơ nhân sự | P1 | 5 |
| Vận hành | Tasks, documents, notifications, audit log | P1 | 5 |
| Marketing ops | Campaigns, inbox Fanpage/Zalo, AI auto-reply | P2 | 5 |
| Báo cáo | Báo cáo nâng cao, CSV/PDF, dashboard đầy đủ | P1 | 5 |
| Website | Landing, giải pháp, pricing, guide, blog, legal, SEO, auth UI, onboarding | P2 | 6 |
| QA | Responsive, accessibility, performance, tài liệu bàn giao | P2 | 6–7 |

Các yêu cầu P1/P2 không bị cắt; chúng được đặt ở phase muộn hơn theo đúng thứ tự SPEC. Trong từng phase, phần P0 của phase đó hoàn thành trước phần P1/P2.

---

## 9. ADAPTER STRATEGY

| Adapter | Mặc định local/demo | Live khi có credentials | Hành vi khi thiếu cấu hình |
|---|---|---|---|
| Storage | `/public/uploads/<tenant>/<album>/`, thumbnail/watermark bằng sharp | S3/R2 private + signed URL/route kiểm tra quyền | Dùng local; UI ghi rõ môi trường demo |
| Google Drive | Local adapter đọc thư mục demo synthetic | OAuth connect/callback/refresh; scope tối thiểu; refresh token mã hóa | Nút kết nối disabled kèm lý do “chưa cấu hình”; app chạy bình thường |
| Payment | Manual + VietQR payload + mock webhook dev-only | SePay/PayOS khi có key | Ghi nhận thủ công; không giả lập thành công nếu thiếu cấu hình |
| Messaging | Ghi `notifications` + log terminal | SMTP/Zalo/Facebook | Không gửi thật; UI ghi “chưa cấu hình”, không báo đã gửi |
| AI | Heuristic sharp/rule-based; ghi rõ là heuristic | OpenAI/Gemini khi có key + consent | Chỉ chạy local; không giả vờ phân tích nhắm mắt |
| Notification | In-app DB mặc định | Email/Zalo/SMS khi cấu hình | In-app vẫn hoạt động; kênh ngoài disabled kèm lý do |

Quy tắc chung:

- Lazy-init adapter, timeout, retry có kiểm soát, lỗi hiển thị rõ; không gọi mạng ở module scope/build/startup.
- Không log secret/token/PII thanh toán.
- `NODE_ENV !== "production"` mới bật mock webhook; production trả 404/disabled.
- Adapter live không được tuyên bố “đã gửi/đã kết nối” nếu chưa thực sự thành công.

### 9.1. Biến môi trường dự kiến

```text
APP_URL / NEXT_PUBLIC_SITE_URL
DATABASE_URL (SQLite path hoặc Postgres URL)
AUTH_SECRET
SESSION_TTL_HOURS
TOKEN_ENCRYPTION_KEY
PAYMENT_PROVIDER=manual|vietqr|sepay|payos
PAYMENT_WEBHOOK_SECRET
BANK_BIN / BANK_ACCOUNT_NUMBER / BANK_ACCOUNT_NAME (demo có nhãn)
STORAGE_PROVIDER=local|s3|r2
S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI
MESSAGING_PROVIDER=local|smtp|zalo|facebook
SMTP_* / ZALO_* / FACEBOOK_*
AI_PROVIDER=local|openai|gemini
AI_API_KEY
CRON_SECRET
```

`.env.example` có đủ khóa, không có giá trị thật; `.env.local` không commit.

---

## 10. KẾ HOẠCH KIỂM THỬ

### 10.1. Unit

- Tính tiền: subtotal, surcharge, discount, voucher, deposit, paid, remaining; integer VND.
- Công nợ, tuổi nợ, hoa hồng cố định/%, lương, khấu trừ.
- Transition matrix trạng thái đơn; trạng thái thanh toán tách biệt.
- Chuẩn hóa SĐT Việt Nam; unique tenant+phone.
- Định dạng tiền/ngày/giờ/timezone; CSV UTF-8 BOM.
- Parse mã ảnh: xuống dòng, phẩy, khoảng trắng, Excel, có/không đuôi, số thứ tự; Unicode normalize.
- Matching ảnh: exact basename, numeric-only, ambiguous, duplicate, missing.
- Photo code ổn định/duy nhất trong album.
- Overlap lịch + buffer 30 phút.

### 10.2. Integration

- RBAC: từng vai trò × quyền; 403/404 đúng; branch scope.
- Tenant isolation: tenant A không đọc/ghi tenant B ở CRM/orders/albums/finance.
- Session: hết hạn/thu hồi; rate limit/khóa tạm; audit.
- Booking concurrency: hai request đồng thời cùng slot; một thành công, một 409; DB đúng 1; thêm test room/photographer.
- PhotoShare: token/password/expiry/revoke; selection/quota/lock; extra fee ghi nhận.
- Upload security: MIME giả, extension sai, path traversal, size limit.
- Drive scan: tab folder, dedupe, rescan missing, giữ selection (local adapter + live nếu có credentials).
- ZIP/manifest/missing khớp.
- Webhook idempotency/replay: gửi lặp chỉ một payment; sai signature/timestamp bị chặn.
- Báo cáo đối soát với giao dịch.

### 10.3. E2E / Playwright

- Đăng nhập cả hai phương thức; khóa tạm; phân quyền.
- Lead → khách → đơn → cọc → lịch → chụp → hậu kỳ → chọn ảnh → giao → thu còn lại → hoàn tất.
- Hai booking đồng thời (hoặc integration + E2E).
- PhotoShare: mở link, mật khẩu, thả tim/chọn/ghi chú, vượt quota, gửi, khóa/mở.
- Lọc ảnh: FS Access API (Chromium) và fallback upload folder/ZIP; RAW/JPG; manifest/missing.
- Landing: CTA, tabs, FAQ, pricing, form, responsive 375/390/768/1024/1440.

### 10.4. Manual browser

- Mỗi phase chạy app thật, kiểm tra route chính, form dài, bảng cuộn ngang, modal, focus, dark mode, reduced motion.
- Kiểm tra tiếng Việt có dấu, font, timezone, VND.
- Ghi rõ phần chưa kiểm chứng; không đánh dấu pass nếu chưa chạy.

### 10.5. Đối chiếu 25 kịch bản acceptance của SPEC

| # | Kịch bản | Phase | Loại test |
|---|---|---|---|
| 1 | Lead → order → deposit → schedule → shoot → edit → select → deliver → final payment | 2–5 | E2E |
| 2 | Hai request booking đồng thời cùng slot | 3 | Integration |
| 3 | Nhân viên không quyền bị chặn ở server | 1+ | Integration |
| 4 | Tenant A không truy cập dữ liệu tenant B | 1+ | Integration |
| 5 | PhotoShare đúng token/mật khẩu/hạn; sai bị từ chối | 4 | Integration/E2E |
| 6 | Thả tim/chọn/ghi chú/gửi; copy mã 4 định dạng | 4 | E2E |
| 7 | Vượt quota; phí ảnh thêm ghi vào đơn/payment | 4 | Integration |
| 8 | Khóa selection; khách không sửa khi chưa mở | 4 | Integration/E2E |
| 9 | Album Drive 3 folder con; tab Tất cả + 3 tab đúng số lượng | 4 | Integration/Manual (live) |
| 10 | Quét lại không trùng; ảnh xóa được đánh dấu missing | 4 | Integration |
| 11 | Parse mã từ Excel/Zalo với xuống dòng/phẩy/khoảng trắng/đuôi file | 4 | Unit |
| 12 | “Chỉ lấy số” đúng; ambiguous không tự copy | 4 | Unit/Integration |
| 13 | Folder RAW + JPG; lọc RAW/JPG/PNG/Tất cả đúng | 4 | Unit/E2E |
| 14 | Tạo folder “Ảnh khách chọn” trong folder gốc; không xóa/di chuyển file gốc | 4 | E2E/Manual |
| 15 | Browser không hỗ trợ FS Access API; fallback folder/ZIP hoạt động | 4 | E2E |
| 16 | ZIP + manifest + missing khớp chính xác | 4 | Integration |
| 17 | Watermark/derivative; không tải ảnh gốc nếu gói không cho phép | 4 | Integration/Manual |
| 18 | Ảnh demo `/public/uploads`; production private storage/signed URL | 4 | Integration/Config |
| 19 | Webhook gửi lặp không cộng tiền hai lần | 5 | Integration |
| 20 | Thuê/trả trang phục QR; phí giặt/đền bù đúng | 3 | Integration/E2E |
| 21 | Lương/hoa hồng → duyệt → khóa kỳ | 5 | Integration |
| 22 | Báo cáo doanh thu/công nợ khớp giao dịch | 5 | Integration |
| 23 | Responsive mobile/tablet; form dài/bảng cuộn ngang | 6–7 | E2E/Manual |
| 24 | Public page metadata/SEO cơ bản | 6 | Automated/Manual |
| 25 | Landing đủ section, CTA hoạt động, không lorem/asset sai quyền | 6 | E2E/Manual |

### 10.6. Lệnh kiểm tra phase gate

```text
npm run lint
npm run typecheck
npm run build
npm run test
npm run test:e2e        # khi đã có E2E của phase
npm run db:migrate      # trên DB mới
npm run db:seed         # chạy 2 lần, kiểm tra idempotent
```

Grep trước khi đóng phase:

```text
TODO
Coming soon
Not implemented
onClick={() => {}}
```

Nếu còn trong luồng chính: phase chưa hoàn thành.

---

## 11. LANDING PAGE BLUEPRINT (A.3 / PHASE 6)

| # | Section | Nội dung bắt buộc | Ghi chú triển khai |
|---|---|---|---|
| 1 | Header | Sticky, logo, menu Tính năng/Gói cước/Blog/Hướng dẫn/FAQ/Liên hệ, Đăng nhập, CTA Đăng ký dùng thử, mobile drawer | Anchor scroll, shadow khi scroll, không che nội dung |
| 2 | Hero | 2 cột; badge, H1, subheadline, CTA “Dùng thử miễn phí”/“Xem demo”, trust bullets; ảnh dashboard thật + card PhotoShare | Ảnh chụp từ StudioCore thật; mobile 1 cột |
| 3 | Pain point → giải pháp | 2 cột vấn đề chủ studio/nhân viên; 3–4 giá trị | Không bịa số liệu |
| 4 | Các bước vận hành | 3–4 bước có số/icon/mô tả; timeline ngang desktop, dọc mobile | |
| 5 | Tính năng nổi bật | 4 nhóm × 4–6 card; link “Xem tất cả tính năng” | Card icon/title/mô tả |
| 6 | Product showcase | Tabs Dashboard/Đơn hàng/Chi phí/Lịch chụp; ảnh thật; CTA demo read-only | Tab đổi ảnh đúng |
| 7 | Screenshot gallery | 5 card ảnh thật; mô tả; lightbox | Không ảnh giả |
| 8 | PhotoShare showcase | 2 cột; Drive/NAS, link thả tim, ghi chú, copy mã, lọc, ZIP+manifest; CTA | Ảnh cưới/gia đình/baby synthetic có quyền, nhãn demo nếu cần |
| 9 | Pricing | 4 gói; giá/tháng, tính năng, CTA; Pro nổi bật; bảng so sánh; toggle năm nếu có | Giá demo ghi rõ nếu chưa chốt |
| 10 | Testimonials | 3–6 card; avatar/tên/vai trò/nội dung/kết quả | Chỉ dùng thật hoặc nhãn demo; có thể bỏ section |
| 11 | FAQ | 8 câu, accordion, JSON-LD FAQPage | Đúng câu hỏi SPEC |
| 12 | Hướng dẫn | 3–6 card; CTA xem đầy đủ | |
| 13 | Final CTA | Nền primary/gradient nhẹ; CTA tạo tài khoản/xem gói | Không form dài |
| 14 | Footer | 4 cột; liên kết, hỗ trợ, liên hệ, copyright | Không thông tin liên hệ StudioBase |

Route công khai bổ sung: `/phan-mem-quan-ly-studio`, `/crm-studio-chup-anh`, `/pricing`, `/guide`, `/blog`, `/blog/[slug]`, `/terms`, `/privacy`, `/contact`, `/demo`, `/login`, `/register`, `/reset-password`.

SEO: metadata riêng, canonical, OG, Twitter card, JSON-LD Organization/SoftwareApplication/FAQPage, sitemap, robots, H1 duy nhất, alt text, internal link, tiếng Việt tự nhiên. Screenshot lấy từ app thật; không dùng asset/nội dung/logo/thông tin liên hệ StudioBase.

---

## 12. GHI CHÚ TRIỂN KHAI UI SYSTEM

- Token CSS custom properties là nguồn duy nhất; map vào Tailwind/component library; không trộn HSL channels và màu đầy đủ. Font Be Vietnam Pro.
- Light mặc định lần đầu; lưu light/dark/system; khởi tạo theme trước render để giảm nháy.
- Sidebar 240px desktop, thu 72px có tooltip/accessible name; dưới 1024px drawer đóng bằng Escape, trả focus.
- Page title 24/32, body 14/22, label/button 14/20, caption 12/18; số tiền tabular-nums, căn phải.
- Radius input/button 8px, card/dialog 12px, badge pill; shadow chỉ cho lớp nổi.
- Data table: toolbar search debounce 300ms, filter, pagination server-side 20/50/100, sticky header, row 48px, sort aria-sort, bulk action có selection, mobile ưu tiên cột chính/không cuộn ngang toàn trang.
- Form: label luôn hiện, lỗi dưới trường + aria-describedby/aria-invalid, giữ dữ liệu khi lỗi, form dài dùng Sheet, hành động nguy hiểm dùng Alert Dialog nêu hậu quả.
- Trạng thái: skeleton, empty kèm CTA theo quyền, error có thử lại, 403/404 an toàn, tích hợp thiếu cấu hình nêu bước cấu hình.
- Shared components: PageHeader, FilterBar, DataTable, StatusBadge, Money, DateTime, EmptyState, ErrorState, PermissionGate (UX), ConfirmDialog, PhotoGrid.
- Accessibility: WCAG 2.2 AA mục tiêu, skip link, landmark, heading, focus ring, touch 44px mobile, reduced motion, zoom 200%.
- Dark mode kiểm tra nếu module hỗ trợ; không dùng màu duy nhất để biểu thị trạng thái.

---

## 13. GIẢ ĐỊNH

1. App root là `studiocore/`, tài liệu quản lý nằm trong `studiocore/docs/` (chờ Q1).
2. Không có code cũ cần bảo toàn; Phase 1 khởi tạo mới.
3. Dùng npm; Node thực tế v26.13.0, npm 11.20.0; sẽ pin `engines` và xác minh driver SQLite tương thích.
4. Có Internet để cài dependency ở Phase 1; nếu không, Phase 1 dừng và báo blocker.
5. SQLite WAL là runtime demo/bàn giao chính; PostgreSQL là production path được thiết kế, chưa được chạy/test (Q9 đã chốt).
6. Chạy một tiến trình Node cho demo; đa tiến trình/đa instance cần PostgreSQL hoặc single-writer.
7. “Realtime” dashboard được hiểu là dữ liệu server mới khi tải/revalidate và polling thông báo; không mặc định WebSocket.
8. AI local là heuristic, có nhãn; không tuyên bố chính xác tuyệt đối; nhắm mắt chỉ khi có model phù hợp.
9. Hợp đồng chỉ xác nhận điện tử nội bộ, không gọi là ký số hợp pháp.
10. Dữ liệu seed/demo là hư cấu; không PII thật; ảnh demo synthetic/AI có nhãn; không dùng ảnh khách thật.
11. Giá, testimonial, thông tin liên hệ, domain là demo có nhãn cho đến khi user cung cấp (Q6).
12. Landing screenshot được chụp từ app thật sau Phase 1–5, không dùng mockup giả.
13. Mock webhook chỉ development; production tắt hoàn toàn.
14. `PROGRESS.md` đã được tạo trước khi viết code Phase 1 (Q2 đã chốt).

---

## 14. RỦI RO VÀ CÁCH GIẢM THIỂU

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Phạm vi rất lớn, dễ trượt phase | Chậm tiến độ, bỏ sót | Checklist TASKS theo phase; phase gate; không nhảy cóc |
| SQLite + Next dev/hot reload tạo nhiều kết nối | `SQLITE_BUSY`, khóa | Singleton connection, WAL, `busy_timeout`, transaction ngắn, mutex + retry, test đồng thời |
| Driver SQLite native không tương thích Node 26 | Phase 1 block | Kiểm tra prebuild; fallback pin Node LTS hoặc driver tương thích; ghi rõ |
| Next.js breaking changes | Code sai API | Đọc docs trong `node_modules` trước khi code; khóa version |
| File System Access API không đồng nhất | Lọc ảnh fail trên browser | Fallback upload folder/ZIP; test Chromium + browser không hỗ trợ |
| Drive OAuth thiếu credentials | Không test live | Local adapter + trạng thái “chưa cấu hình”; test live khi có key |
| Ảnh demo/landing không có quyền | Vi phạm bản quyền | Chỉ synthetic/AI/licensed; lưu nguồn; nhãn demo; không dùng ảnh người thật |
| PDF/print tiếng Việt lỗi font | Hợp đồng/hóa đơn sai | Nhúng font; test in thật; kiểm tra dấu |
| Watermark chỉ CSS | Lộ ảnh gốc | Render derivative server-side; chặn tải gốc |
| ZIP lớn gây OOM | Lỗi export | Streaming archiver; giới hạn/queue; test dữ liệu lớn |
| Webhook replay/trùng tiền | Sai tài chính | Secret + timestamp + event id unique + idempotency; test lặp |
| Tenant isolation thiếu ở query mới | Lộ dữ liệu | Repository bắt buộc tenant; test tự động; review query |
| Placeholder lọt vào cuối phase | Không đạt DoD | Grep bắt buộc; checklist; review |
| SEO/domain chưa chốt | Canonical/OG sai | Dùng env `NEXT_PUBLIC_SITE_URL`; chờ Q6 |
| Test concurrency không đại diện | Tuyên bố an toàn sai | Test nhiều kết nối/process, không chỉ mutex RAM |
| Scope “AI” bị hiểu là model thật | Sai kỳ vọng | Nhãn heuristic; feature chưa có model thì disabled kèm lý do |

---

## 15. TÍCH HỢP CẦN CREDENTIALS HOẶC QUYẾT ĐỊNH

| Hạng mục | Cần gì | Phase | Có thể chạy local không |
|---|---|---|---|
| Google Drive | Client ID/Secret/Redirect URI, OAuth consent | 4 | Có, local adapter |
| Storage S3/R2 | Endpoint/bucket/access key/secret | 4 | Có, local `/public/uploads` |
| Payment SePay/PayOS | Merchant credentials, webhook secret | 5 | Có, manual + mock webhook dev |
| VietQR | Bank BIN, số tài khoản, tên chủ tài khoản | 5 | Có, dùng demo có nhãn |
| SMTP | Host/port/user/password/from | 5 | Có, notification local + log |
| Zalo/Facebook | OA/Page token, app secret | 5 | Có, inbox local |
| AI provider | API key, model, budget | 4 | Có, heuristic local |
| Domain/SEO | URL công khai, canonical | 6 | Có, localhost + env |
| Branding | Logo, màu đã có token, thông tin liên hệ | 6 | Có, wordmark/tạm có nhãn |
| Nội dung marketing | Pricing, testimonial, blog/guide/legal | 6 | Có, nội dung demo có nhãn; legal cần review |
| Ảnh demo | Ảnh synthetic/AI/licensed | 4/6 | Có, tạo synthetic |
| Scheduler nhắc lịch | Cơ chế cron/CLI + `CRON_SECRET` | 3/5 | Có, script local + log |
| Secrets hệ thống | `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `PAYMENT_WEBHOOK_SECRET` | 1/4/5 | Tự sinh local, không commit |

---

## 16. TIÊU CHÍ HOÀN THÀNH PHASE 0 (ĐÃ HOÀN TẤT 03/11/2026)

Theo SPEC Phase 0:

- [x] Khảo sát repo, framework, dependency, database, route, component, style — repo trống, đã ghi nhận.
- [x] Quyết định Q5: bỏ qua nghiên cứu website đối thủ; feature matrix lập từ SPEC (user duyệt 03/11/2026).
- [x] PLAN có mục tiêu, giả định, rủi ro.
- [x] Feature matrix P0/P1/P2 (từ SPEC).
- [x] Route map.
- [x] Data model.
- [x] Permission matrix (đề xuất).
- [x] Adapter strategy.
- [x] Test plan.
- [x] Landing page section blueprint.
- [x] `PROGRESS.md` dạng checklist theo SPEC — đã tạo trước khi viết code Phase 1.
- [x] Dừng báo cáo và được xác nhận — user đã duyệt.

**Kết luận: Phase 0 hoàn tất ngày 03/11/2026.**
