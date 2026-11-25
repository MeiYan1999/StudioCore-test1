# AUDIT — Rà soát 16 phân hệ StudioCore (25/11/2026)

Phạm vi: đọc code tại `main` (`d11c404`), theo dấu giao diện → action/route → service → DB/storage.
Không thao tác trên production. Mức độ rà soát ghi rõ ở từng phân hệ: **Sâu** (đọc toàn bộ luồng ghi) hoặc **Lướt** (đọc phân quyền, scope và các hàm chính; chưa chạy thử từng luồng).

Stack thực tế: Next.js 16 (App Router, `src/proxy.ts`), React 19, SQLite + Drizzle, storage local/R2, Vitest, Playwright.
Phân quyền: `getActorContext` (`src/lib/auth/session.ts`) → `assertPermission` / `getBranchScope` / `assertBranchAccess` (`src/lib/auth/permissions.ts`). `src/proxy.ts` chỉ rewrite trang chi tiết, **không** phải lớp phân quyền; mọi kiểm tra nằm ở service.

Trạng thái dùng trong tài liệu: `ĐÃ XÁC MINH` · `ĐÃ TRIỂN KHAI, CHƯA XÁC MINH ĐỦ` · `DANG DỞ / MOCK` · `LỖI LOGIC` · `CHƯA CÓ` · `BỊ CHẶN BỞI MÔI TRƯỜNG / TÍCH HỢP`.

## 1. Kết quả kiểm tra

| Lệnh | Trước khi sửa | Sau khi sửa |
| --- | --- | --- |
| `npm run lint` | exit 0 (0 lỗi, 87 cảnh báo có sẵn) | exit 0 (0 lỗi, 84 cảnh báo) |
| `npm run typecheck` | exit 0 | exit 0 |
| `npm run test` | exit 0 (48 file, 271 test) | exit 0 (50 file, 284 test) |
| `npm run build` | chưa chạy trước khi sửa | exit 0 |
| `npm run test:e2e` | chưa chạy | chưa chạy (xem mục 6) |

## 2. Phát hiện

### F-08 · P0 · LỖI LOGIC · ĐÃ SỬA — Webhook thanh toán gói kích hoạt được mà không cần khóa
- Bằng chứng: `processPlatformBillingWebhook` (`src/lib/services/subscription-service.ts`) chỉ so khóa khi `config.sepayApiKey && apiKeyHeader`; `POST /api/webhooks/platform-billing` (`src/app/api/webhooks/platform-billing/route.ts`) chuyển header rỗng xuống. Khóa mặc định `studiocore_platform_secret` nằm trong mã nguồn và là giá trị mặc định trên form `/platform`.
- Tái hiện: tạo đơn mua gói (lấy mã `SCxxxxx`), `POST` body `{"transferType":"in","transferAmount":999999999,"content":"SC12345"}` không kèm header → gói được kích hoạt.
- Nguyên nhân gốc: xác thực là tùy chọn; khóa mặc định công khai.
- Ảnh hưởng: bất kỳ ai cũng tự kích hoạt/gia hạn gói trả phí mà không trả tiền.
- Sửa: `isValidPlatformBillingKey` bắt buộc có khóa, so sánh hằng thời gian, production từ chối khóa mặc định.
- Tiêu chí: thiếu/sai khóa → 401, đơn vẫn `pending`; production chỉ nhận khóa riêng. Test: `tests/unit/subscription.test.ts`.
- **Việc cần làm khi triển khai:** đặt `PLATFORM_SEPAY_API_KEY` (hoặc lưu khóa mới ở `/platform`) và cập nhật cùng khóa trên SePay; nếu production đang dùng khóa mặc định, webhook mua gói sẽ trả 401 cho tới khi đổi.

### F-01 · P0 · LỖI LOGIC · ĐÃ SỬA (phần ảnh gốc) — `/api/files` trả ảnh gốc không cần đăng nhập
- Bằng chứng: `GET` trong `src/app/api/files/[...key]/route.ts` chỉ chặn `db/`, `documents/`, path traversal rồi `getStorageAdapter().read(key)`. Trang share nhúng `publicUploadUrl(thumbnailKey|previewKey)` (`getShareGalleryPage`, `src/lib/services/share-service.ts`); bỏ hậu tố `-thumb`/`-preview` ra key ảnh gốc (`processImageBuffer` trong `src/lib/storage/local-storage.ts`, `processImage` trong `src/lib/storage/r2-storage.ts`).
- Ảnh hưởng: khách (hoặc người có link) tải ảnh gốc, bỏ qua `authorizeShareDownload` (mật khẩu, hết hạn, thu hồi, quyền tải); không cần phiên đăng nhập, không phân biệt tenant.
- Sửa: `resolveFileAccess` (`src/lib/storage/file-access.ts`): chỉ thumbnail/preview và album demo là công khai; key khác cần phiên nhân sự cùng tenant (`<tenantId>/…`) hoặc `tenants.manage`, trả `Cache-Control: private, no-store`.
- Tiêu chí: ảnh gốc 404 khi chưa đăng nhập hoặc khác tenant. Test: `tests/unit/file-access.test.ts`.
- B-01 ĐÃ SỬA: thumbnail/preview của link share dùng URL ký (`signedFileUrl`, HMAC theo `AUTH_SECRET`), hết hạn trong tối đa 2 giờ; `/api/files` còn kiểm tra link của album chưa bị thu hồi, chưa hết hạn, album chưa lưu trữ, nên thu hồi có hiệu lực ngay (trừ bản trình duyệt đã cache). URL không ký chỉ dành cho nhân sự cùng studio. Chỉ áp dụng cho album tạo bằng "Tải thư mục/ZIP"; album từ link Drive lưu thẳng URL Google Drive (`prepareGoogleImport`, `album-service.ts`), ảnh do Google phát theo quyền chia sẻ trên Drive nên thu hồi link trong StudioCore không chặn được URL ảnh Google đã phát.

### F-07 · P1 · LỖI LOGIC · ĐÃ SỬA — Bấm đúp "Thu tiền" ghi hai khoản thu
- Bằng chứng: `recordOrderPayment` (`src/lib/services/order-service.ts`) tự sinh `idempotencyKey: crypto.randomUUID()`; chặn duy nhất là `amount <= remaining`, nên hai lần gửi một khoản thu một phần đều hợp lệ.
- Sửa: form gửi `requestId` (`src/components/orders/payment-sheet.tsx`), service lưu `form:<requestId>` và trả lại khoản thu cũ khi gửi lại; khóa của đơn khác bị từ chối.
- Test: `tests/integration/payment-idempotency.test.ts`.

### F-05 · P1 · LỖI LOGIC · ĐÃ SỬA — Bấm đúp "Hoàn tiền" hoàn hai lần
- Bằng chứng: `recordRefund` (`src/lib/services/finance-service.ts`) không có khóa chống trùng từ client.
- Sửa: cùng cơ chế `requestId` (`RefundSheet` trong `src/components/finance/finance-sheets.tsx`); transaction hoàn tiền nay có `idempotencyKey`.

### F-04 · P1 · LỖI LOGIC · ĐÃ SỬA — Webhook SePay của studio
- (a) `sendTestSepayWebhookAction` (`src/lib/actions/sepay-actions.ts`) ghi **thật** 10.000đ thu nhập vào sổ quỹ mỗi lần bấm "gửi thử". Sửa: chế độ `test` chỉ kiểm tra kết nối, không ghi sổ.
- (b) Khớp đơn bằng "mã đơn là chuỗi con của nội dung", lấy đơn đầu tiên → `DH1` khớp `DH10`, ghi tiền vào sai đơn. Sửa: `matchOrderByTransferContent` chọn mã dài nhất, không khớp tiền tố số, bỏ qua khi mơ hồ (ghi thành thu khác để đối soát tay).
- (c) Thiếu `id`/`referenceCode` thì event id ngẫu nhiên → SePay gửi lại là ghi trùng. Sửa: event id suy ra từ hash nội dung.
- Test: `tests/unit/sepay.test.ts`.

### F-02 · P1 · LỖI LOGIC + MOCK · ĐÃ SỬA — Trung tâm AI
- Bằng chứng: `checkAuth` (`src/lib/actions/ai-hub-actions.ts`) chấp nhận `settings.view` cho thao tác thêm/xóa/bật tắt API key và đổi ngân sách; `testAiHubApiKeyAction` chờ 600ms rồi luôn trả "Kết nối thành công… latency 182ms".
- Sửa: chỉ `settings.manage`/`integrations.manage` được ghi; `testAiHubApiKey` (`src/lib/services/ai-hub-service.ts`) gọi thật endpoint liệt kê model của nhà cung cấp, báo đúng lỗi và độ trễ đo được.
- Chưa xác minh: endpoint thật của từng nhà cung cấp chưa được gọi thử bằng key thật (không có key); test dùng `fetch` giả.

### F-03 · P2 · LỖI LOGIC · ĐÃ SỬA — Tra trạng thái đơn mua gói không cần đăng nhập
- Bằng chứng: `checkSubscriptionStatusAction` (`src/lib/actions/subscription-actions.ts`) gọi `getSubscriptionById` không có actor, không lọc tenant.
- Sửa: yêu cầu đăng nhập và đúng tenant (hoặc `tenants.manage`).

### F-17 · P0 · LỖI PHÂN QUYỀN · ĐÃ SỬA — Chủ studio tự cấp quyền quản trị nền tảng
- Bằng chứng: `updateRolePermissions` (`src/lib/services/staff-service.ts`) lưu mọi quyền hợp lệ kể cả `tenants.manage`; trang phân quyền chỉ ẩn quyền này ở giao diện. `getActorFromToken` nạp quyền theo `role_permissions` của studio, nên một vai trò studio có dòng `tenants.manage` vào được `/platform`, các action trong `platform-actions.ts` và `api/exports/platform-backup`.
- Sửa: `updateRolePermissions` bỏ `tenants.manage`; `getActorFromToken` chỉ giữ `tenants.manage` cho vai trò `platform_admin` (`mayManagePlatform`), nên dòng đã lưu sẵn trong DB mất hiệu lực mà không cần migration. Tài khoản quản trị nền tảng demo (mật khẩu công khai) mất quyền nền tảng khi `NODE_ENV=production`. `savePlatformBillingConfigAction` và `simulateSubscriptionPaymentAction` kiểm tra quyền thay vì tên vai trò.
- Test: `tests/integration/platform-boundary.test.ts`.

### Chưa sửa (đưa vào backlog)
| ID | Mức | Trạng thái | Phát hiện | Bằng chứng |
| --- | --- | --- | --- | --- |
| F-06 | P2 | ĐÃ SỬA | Hóa đơn chuyển `issued → paid` bằng tay dù đơn còn nợ. Nay trạng thái suy ra từ khoản thu: mỗi đơn chỉ có một hóa đơn hiệu lực nên số đã thu của đơn (`orders.paid`) là số phân bổ vào hóa đơn; thu đủ thì tự thành `paid`, hoàn tiền làm thiếu thì về `issued`. Không cần bảng phân bổ riêng | `syncInvoiceStatusForOrder`, `updateInvoiceStatus` (`finance-service.ts`) |
| F-09 | P2 | CHƯA CÓ · ĐÃ SỬA (chi nhánh, nhân sự, hết hạn; `plan-limits.ts`) | Hạn mức gói (nhân sự, chi nhánh, dung lượng, số album) và ngày hết hạn gói không được kiểm tra ở backend; gói chỉ là nhãn | `SUBSCRIPTION_PLANS`, `tenants.planExpiresAt` chỉ được ghi trong `subscription-service.ts`/`platform-actions.ts`, không nơi nào đọc để chặn |
| F-10 | P2 | CHƯA CÓ · ĐÃ SỬA | Thiết bị không có luồng mượn/trả: `equipment_usages` chỉ được đọc (`getEquipmentDetail`), không có hàm ghi ngoài seed. Nay có `checkOutEquipment`/`checkInEquipment` gắn lịch chụp, thao tác trên trang chi tiết lịch | `src/lib/services/equipment-service.ts` |
| F-11 | P2 | ĐÃ SỬA (cảnh báo) | Hủy lịch không nhắc gì về trang phục của đơn đang mượn. Phiếu thuê là phiếu đã xuất đồ (không có đặt trước), nên hủy lịch không tự đánh dấu trả; nay người hủy nhận thông báo và trang lịch đã hủy hiện cảnh báo | `cancelAppointment` (`appointment-service.ts`), `updateBooking` (`omnichannel/booking.ts`), `notifyUnreturnedRentals` (`wardrobe-service.ts`) |
| F-12 | P2 | LỖI LOGIC | Chỉ với album tạo bằng "Tải thư mục/ZIP" lưu trên R2: bản "gốc" là WebP nén lại và preview không có watermark (local có). Album từ link Drive không qua R2, ảnh gốc là file thật trên Google Drive | `processImage` (`r2-storage.ts`) |
| F-13 | P3 | ĐÃ SỬA | Mọi nhân sự đã đăng nhập đều tạo được đơn mua gói cho studio | `createSubscriptionInvoiceAction` |
| F-14 | P3 | LỖI LOGIC · ĐÃ SỬA | Nhật ký hoạt động không lọc theo chi nhánh; quản lý chi nhánh có `audit.view` thấy toàn tenant. Nay `activity_logs.branch_id` (migration 0013, có điền lại dữ liệu cũ) và `listActivityLogs`/`listAuditActions` lọc theo chi nhánh đang chọn; dòng không thuộc chi nhánh nào chỉ chủ studio và chính người thực hiện thấy | `listActivityLogs` (`audit-service.ts`) |
| F-15 | P3 | ĐÃ SỬA | `getPlatformBillingConfig` đọc setting `platform.*` không lọc tenant | `subscription-service.ts` |
| F-16 | P3 | ĐÃ SỬA (phần mở khóa) | Kích hoạt gói đặt lại `tenants.status = active` kể cả studio đang bị khóa (đã sửa). Đơn quá `expiresAt` vẫn kích hoạt khi tiền tới: giữ nguyên có chủ ý, vì khách đã chuyển tiền | `activateSubscription` |

## 3. Hiện trạng từng phân hệ

| # | Phân hệ | Giao diện / route | Service · bảng nguồn | Phân quyền & scope | Mức rà soát · trạng thái |
| --- | --- | --- | --- | --- | --- |
| 1 | StudioCore Drive | `/manage/drive`, `/drive/[slug]`, `api/drive/agent/*`, `api/drive/s/[slug]/*` | `drive-service.ts`, `lib/drive/relay.ts`; file nằm trên máy studio, server chỉ relay | Agent xác thực bằng token thiết bị (`authenticateDriveDevice`); link công khai qua `resolveDrivePublicAccess` (thu hồi, PIN, `allowOriginal`) | Lướt · ĐÃ TRIỂN KHAI, CHƯA XÁC MINH ĐỦ (cần máy agent thật) |
| 2 | Lọc ảnh / Proofing | `/manage/albums/[id]`, `/manage/photos`, `/share/[token]`, `api/uploads/*`, `api/share/[token]/download` | `album-service.ts`, `share-service.ts`, `photo-filter-service.ts`; bảng albums/photos/selections; storage local/R2 | Upload cần actor + same-origin; share kiểm tra thu hồi/hết hạn/mật khẩu; giới hạn chọn và khóa chọn kiểm tra trong transaction (`updateSharePhotoSelection`, `submitShareSelection`) | Sâu · ĐÃ XÁC MINH phần chọn ảnh; F-01 đã sửa; B-01, F-12 còn mở |
| 3 | Kho trang phục | `/manage/wardrobe`, `/manage/wardrobe/rentals` | `wardrobe-service.ts`; `wardrobe_items`, `wardrobe_rentals` | `schedule.manage`, lọc tenant + chi nhánh; tạo/trả phiếu trong transaction `immediate` | Lướt · ĐÃ TRIỂN KHAI, CHƯA XÁC MINH ĐỦ; F-11 |
| 4 | Thiết bị | `/manage/equipment` | `equipment-service.ts`; `equipment`, `equipment_usages` | `schedule.view/manage`, lọc tenant + chi nhánh | Sâu · ĐÃ XÁC MINH: danh mục và mượn/trả theo lịch chụp (F-10 đã sửa) |
| 5 | Công việc / Lịch / Booking | `/manage/calendar`, `/manage/tasks`, `/book/[serviceId]`, `api/booking` | `appointment-service.ts` (`findConflict`, `createAppointment` có `idempotency_key` duy nhất), `task-service.ts`, `omnichannel/booking.ts` | `schedule.*`, `tasks.*`, scope chi nhánh | Lướt · ĐÃ TRIỂN KHAI, CHƯA XÁC MINH ĐỦ; F-11 |
| 6 | Tài liệu / Hợp đồng | `/manage/documents`, in hợp đồng `/manage/orders/[id]/contract`, `api/documents/*` | `document-service.ts`, `contract-service.ts`; `documents`, storage `documents/<key>` | Tải file qua `getDocumentFile` (tenant + chi nhánh); `/api/files` chặn `documents/` | Lướt · ĐÃ XÁC MINH phần tải file |
| 7 | Nhân sự | `/manage/staff`, `/manage/staff/attendance`, `/manage/staff/leave`, `/manage/settings/users` | `staff-service.ts`, `hr-service.ts`; `staff`, `attendance`, `leave_requests` | `staff.view/manage`, scope chi nhánh | Lướt · ĐÃ TRIỂN KHAI, CHƯA XÁC MINH ĐỦ |
| 8 | Sổ quỹ | `/manage/finance` | `finance-service.ts` (`listTransactions`, `createManualTransaction`, `createExpense`); `transactions` là sổ quỹ, `payments` là khoản thu theo đơn | `finance.view/manage`, scope chi nhánh | Sâu · ĐÃ XÁC MINH; F-04, F-05, F-07 đã sửa |
| 9 | Hóa đơn | `/manage/finance/invoices`, bản in | `createInvoiceForOrder`, `updateInvoiceStatus`; `invoices` | `finance.manage`; tạo hóa đơn không sinh khoản thu (đúng) | Sâu |
| 10 | Công nợ | `/manage/finance/debts` | `listDebtors`, `remindDebt`; nguồn là `orders.remaining` | `finance.view`, scope chi nhánh | Lướt · ĐÃ TRIỂN KHAI, CHƯA XÁC MINH ĐỦ |
| 11 | Hoa hồng | `/manage/finance/commissions` | `commission-payroll-service.ts`; `commission_rules`, `commissions` lưu snapshot `ruleType/ruleValue/baseAmount` | `payroll.manage`; `accrueCommissionsForOrderSystem` không tạo trùng theo đơn + nhân sự + vai trò; trạng thái pending → approved → paid | Sâu · ĐÃ XÁC MINH bằng đọc code |
| 12 | Bảng lương | `/manage/payroll` | `generatePayrolls`, `updatePayroll`, `setPayrollStatus`; `payrolls` | `payroll.manage`; kỳ đã duyệt/đã trả không tạo lại, chỉ sửa khi `draft` | Sâu · ĐÃ XÁC MINH bằng đọc code |
| 13 | Báo cáo | `/manage/reports`, `api/exports/reports` | `report-service.ts`; tách doanh thu/đã thu/hoàn/chi/lợi nhuận | `reports.view`, `branchConditions` | Lướt · ĐÃ TRIỂN KHAI, CHƯA XÁC MINH ĐỦ |
| 14 | Nhật ký hoạt động | `/manage/activity-log` | `audit-service.ts`, `writeAudit` (`src/lib/audit.ts`); `activity_logs` | `audit.view`, lọc tenant | Sâu · ĐÃ XÁC MINH; F-14 |
| 15 | Cài đặt | `/manage/settings/*` | `settings-service.ts`, `settings-write-service.ts`, `sepay-service.ts`, `ai-hub-service.ts` | `settings.manage` ở hầu hết action | Sâu ở SePay/AI/billing, lướt phần còn lại · F-02, F-04 đã sửa |
| 16 | Gói và hạn mức | `/manage/settings/billing`, `/pricing`, `/platform`, `api/webhooks/platform-billing` | `subscription-service.ts`; `platform_subscriptions`, `tenants.plan/planExpiresAt` | Cấu hình nền tảng cần `tenants.manage` | Sâu · F-08, F-03 đã sửa; F-09 CHƯA CÓ hạn mức |

## 4. Thứ tự xử lý và lý do
1. F-08 (tiền, không cần đăng nhập) và F-01 (lộ ảnh gốc) trước vì khai thác được từ bên ngoài.
2. F-07, F-05, F-04: ghi trùng/ghi sai tiền trong luồng dùng hằng ngày.
3. F-02, F-03: phân quyền và nút "thành công giả".
Các mục cần thay đổi mô hình dữ liệu (F-06, F-09, F-10) không gộp vào PR này vì cần quyết định nghiệp vụ và migration riêng.

## 5. Backlog đề xuất
| ID | Mức | Việc | Phụ thuộc |
| --- | --- | --- | --- |
| B-01 | P2 | ĐÃ SỬA: URL ký/hết hạn cho thumbnail và preview của link share | F-01 |
| B-02 | P2 | ĐÃ SỬA: trạng thái hóa đơn suy ra từ khoản thu của đơn, trang hóa đơn hiện số đã thu (F-06). Không dùng migration; bảng phân bổ chỉ cần nếu sau này cho nhiều hóa đơn hiệu lực trên một đơn | — |
| B-03 | P2 | ĐÃ SỬA: Cơ bản 1 chi nhánh/10 nhân sự, Pro và Dùng thử 3/30, Doanh nghiệp không giới hạn; chỉ chặn tạo mới; hết hạn quá 7 ngày thì chỉ xem (F-09). Còn lại: studio dùng thử đăng ký mới chưa được gán ngày hết hạn | quyết định có đặt hạn 30 ngày cho dùng thử |
| B-04 | P2 | ĐÃ SỬA: mượn/trả thiết bị theo lịch chụp, chống xuất trùng (F-10). Chưa có đặt trước thiết bị theo khung giờ | — |
| B-05 | P2 | Khi hủy lịch/đơn: giải phóng phiếu thuê chưa lấy, cảnh báo phiếu đang mượn (F-11) | — |
| B-06 | P2 | ĐÃ BỎ theo mặc định (chỉ ảnh hưởng album tải thư mục/ZIP; mở lại nếu studio giao ảnh qua luồng này): giữ file gốc và watermark preview trên R2 (F-12) | dung lượng R2 |
| B-07 | P3 | F-13, F-14, F-15, F-16 | — |
| B-08 | P3 | Test tích hợp cô lập tenant qua route handler (gọi API trực tiếp bằng phiên tenant khác) cho các phân hệ đánh dấu "Lướt". ĐÃ LÀM cho tải tài liệu, xuất ghi chú/ZIP album, xuất khách hàng, xuất báo cáo (`tests/integration/route-tenant-isolation.test.ts`); và route upload ảnh/ZIP/tài liệu; CÒN LẠI: `api/drive/agent/*` và các server action của kho trang phục, nhân sự, công việc | — |

## 6. Chưa kiểm chứng
- Chưa chạy E2E Playwright và chưa thử trên trình duyệt các form Thu tiền/Hoàn tiền sau khi thêm `requestId`.
- Chưa thử với R2 thật, SePay thật, key AI thật, máy Drive agent thật.
- Các phân hệ ghi "Lướt" chưa được chạy thử từng luồng; kết luận dựa trên đọc code phân quyền và scope.
