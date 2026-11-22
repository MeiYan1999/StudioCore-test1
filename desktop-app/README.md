# StudioCore Drive (ứng dụng máy tính)

Ứng dụng Electron cho Windows và macOS: biến một thư mục ảnh/video trên máy studio thành link để khách xem,
chọn ảnh và tải file. Ảnh gốc nằm trên máy studio; máy chủ StudioCore chỉ chuyển tiếp khi khách đang xem.

## Cách hoạt động

1. **Kết nối**: trên web vào *Quản lý → StudioCore Drive → Tạo mã kết nối* (dùng một lần, hết hạn sau 15 phút),
   dán vào ứng dụng. Ứng dụng nhận token thiết bị riêng, lưu bằng kho khoá của hệ điều hành (`safeStorage`).
2. **Chia sẻ**: chọn thư mục (nút trong ứng dụng, kéo thả, chuột phải thư mục trên Windows, hoặc trên macOS chuột
   phải thư mục → “Chia sẻ bằng StudioCore Drive” (có thể nằm trong mục Dịch vụ), hoặc kéo thư mục vào biểu tượng
   ứng dụng). Ứng dụng quét ảnh/video, gửi **danh mục tên tệp** lên máy chủ và nhận link.
3. **Khách xem**: máy chủ xếp yêu cầu vào hàng đợi; ứng dụng (long-poll) tạo ảnh xem trước bằng `sharp` và đẩy
   ngược lên, máy chủ chuyển tiếp cho khách. Tải gốc và video được truyền theo luồng, hỗ trợ `Range`.
4. **Khách chọn xong**: ứng dụng hiện thông báo và (tuỳ cài đặt) chép ảnh đã chọn kèm RAW cùng tên vào
   thư mục `Khach-chon` bên trong thư mục gốc, cùng `danh-sach-chon.txt` chứa mã ảnh cho Lightroom.

Trên macOS, Quick Action được cài tại `~/Library/Services` và không bị gỡ khi kéo ứng dụng vào Thùng rác. Hãy tắt
mục này trong Cài đặt trước khi xóa ứng dụng hoặc tự xóa `~/Library/Services/Chia sẻ bằng StudioCore Drive.workflow`.

## Bảo mật

- Không mở cổng mạng nào trên máy: giao diện là cửa sổ Electron tải tệp đóng gói sẵn, giao tiếp qua IPC.
- `contextIsolation`, `sandbox`, tắt `nodeIntegration`, CSP `default-src 'none'`, chặn điều hướng và cửa sổ mới;
  IPC chỉ nhận từ khung chính của cửa sổ ứng dụng.
- Giao diện chỉ dựng DOM bằng `textContent`, nên tên thư mục/tệp/khách chứa HTML không thể chạy mã.
- Đường dẫn trên máy không bao giờ gửi lên máy chủ; mỗi tệp có khoá ngẫu nhiên theo từng link, và mọi lần đọc tệp
  đều kiểm tra đường dẫn thật nằm trong thư mục đã chia sẻ (chặn `..` và symlink).
- Chỉ kết nối máy chủ qua `https` (hoặc `http://localhost` khi phát triển).

## Phát triển

```bash
cd desktop-app
npm install
npm start          # chạy ứng dụng
npm test           # kiểm thử phần lõi (không cần Electron)
npm run dist:win   # bộ cài Windows (NSIS) — chạy trên Windows
npm run dist:mac   # DMG macOS (x64 + arm64) — chạy trên macOS
```

Bộ cài được dựng bằng workflow `.github/workflows/drive-desktop.yml` khi đẩy tag `drive-v*` và đính kèm vào
GitHub Release. Bản dựng Windows chưa ký số. Bản dựng macOS không có chứng chỉ Developer ID được ký ad-hoc,
nhưng chưa notarize. Lần đầu mở trên macOS:

1. Mở file .dmg, kéo StudioCore Drive vào thư mục Applications.
2. Mở app. Khi macOS báo không mở được StudioCore Drive, bấm “Xong”.
3. Vào **Cài đặt hệ thống › Quyền riêng tư & Bảo mật**, kéo xuống và bấm “Vẫn mở” cạnh dòng StudioCore Drive bị
   chặn.
4. Ở hộp thoại hỏi lại, bấm “Vẫn mở” lần nữa rồi nhập mật khẩu máy.
5. Nếu macOS hỏi cho “StudioCore Drive Safe Storage” dùng Chuỗi khóa (Keychain), nhập mật khẩu máy và bấm “Luôn cho
   phép”. Ứng dụng dùng mục này để mã hóa khóa kết nối studio. Từ lần sau app mở bình thường.

Khi có chứng chỉ Developer ID, cấu hình `CSC_LINK` và `CSC_KEY_PASSWORD` trong secrets để ký chính thức.
Notarization cần thông tin xác thực Apple và tài khoản Apple Developer của MeiYing.
