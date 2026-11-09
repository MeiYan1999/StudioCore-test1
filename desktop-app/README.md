# StudioCore Drive — Desktop Companion App (Windows & macOS)

Ứng dụng Desktop chạy nền cho **Windows 10/11** và **macOS (Apple Silicon & Intel)** kết nối trực tiếp với nền tảng **StudioCore SaaS**.

---

## 🌟 Tính Năng Nổi Bật

1. **Chuột phải thư mục trên PC/Mac → Có ngay link gửi khách**:
   - Tích hợp sâu vào menu chuột phải Windows Explorer và Finder Quick Actions trên macOS.
   - Quét file RAW (`.CR3`, `.ARW`, `.NEF`, `.RAF`, `.DNG`), JPG và Video (`.MP4`, `.MOV`).
   - Tự động copy link chia sẻ (`https://studiocore.vn/drive/...`) vào clipboard và hiển thị thông báo Desktop.

2. **Công nghệ Zero-Cloud Storage**:
   - Dữ liệu ở nguyên trên máy tính hoặc ổ NAS của studio.
   - Không tốn dung lượng Google Drive / Dropbox.
   - Khách xem trước ảnh và duyệt album siêu tốc.

3. **Tự động gom file RAW khi khách chốt (Auto RAW Filter)**:
   - Khi khách hàng bấm "Chốt danh sách gửi Studio", Desktop App nhận thông báo thời gian thực và phát chuông báo.
   - Tự động quét và copy toàn bộ các file RAW gốc tương ứng vào thư mục con `Retouch_Final/`.
   - Xuất file `lightroom_filter_codes.txt` chứa danh sách mã để dán vào bộ lọc Lightroom trong 1 click.
   - Xuất file `client_retouch_notes.txt` chứa toàn bộ yêu cầu chỉnh sửa chi tiết của khách.

4. **Trình phát Video & Góp ý theo giây**:
   - Video phóng sự cưới được phát trực tiếp từ máy studio, tua mượt mà không nén mờ.
   - Đồng bộ phản hồi theo từng giây (timestamp feedback) về máy tính studio.

---

## 🚀 Hướng Dẫn Cài Đặt

### 1. Trên macOS (Finder Quick Actions)
Mở Terminal và chạy:
```bash
cd desktop-app
bash macos/install-quick-actions.sh
```
Sau đó:
- Chuột phải vào bất kỳ thư mục ảnh hoặc file video nào trong Finder.
- Chọn **Thao tác nhanh (Quick Actions)** › **StudioCore Drive: Tạo link gửi khách**.
- Link khách sẽ được copy ngay lập tức vào clipboard của bạn!

### 2. Trên Windows (Explorer Context Menu)
1. Mở thư mục `desktop-app/windows`.
2. Nhấp chuột phải vào file `install.bat` và chọn **Run as administrator** (hoặc nhấp đúp vào `register-context-menu.reg`).
3. Chuột phải vào bất kỳ thư mục nào trong Windows Explorer để chọn **StudioCore Drive** › **Tạo link Album (chọn ảnh)**.

---

## 💻 Chạy Giao Diện Bảng Điều Khiển Desktop

Để mở bảng điều khiển quản lý trên máy tính:
```bash
cd desktop-app
npm start
# Hoặc: node cli.js gui
```
Ứng dụng sẽ tự động mở giao diện tại `http://localhost:3888` để bạn:
- Nhập **Studio Connect Key** (`sc_drive_live_...`).
- Kéo thả thư mục để tạo link.
- Quản lý các link đang share và máy tính kết nối.

---

## 🛠️ Lệnh CLI (Dòng lệnh)

- **Tạo link chia sẻ cho 1 thư mục:**
  ```bash
  node cli.js share --path "/Volumes/Data/Cuoi_Minh_Lan" --type album
  ```
- **Chạy Agent ở chế độ nền (Background Daemon):**
  ```bash
  node cli.js daemon
  ```
- **Kiểm tra trạng thái kết nối:**
  ```bash
  node cli.js status
  ```
