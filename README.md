# 🎧 Nhạc của tôi

Ứng dụng nghe nhạc cá nhân đa nền tảng (Web, PWA iOS/Android và Android APK qua Capacitor), sử dụng **Supabase** (Database, Auth, Storage).

## ✨ Tính năng chính
- **Nghe nhạc không cần đăng nhập:** Tìm kiếm nhanh, lọc theo thể loại & thời lượng, hẹn giờ tắt nhạc, chỉnh tốc độ phát (`0.75x–2.0x`), lưu vị trí đang nghe dở.
- **Trải nghiệm nâng cao:** Yêu thích (`❤️`), tạo Playlist cá nhân (`📁`), hàng đợi phát tiếp (`📜`), lưu nhạc nghe **Offline** (`📥`), lời bài hát đồng bộ (`🎤 Lyrics`), chia sẻ link bài hát (`?song=<id>`), giao diện Sáng/Tối & Đa ngôn ngữ (`VI/EN`).
- **Tài khoản Thành viên & Admin:**
  - **Thành viên:** Đăng ký/đăng nhập để đồng bộ Yêu thích & Playlist lên đám mây.
  - **Admin:** Kéo thả upload nhiều bài (kiểm tra định dạng, giới hạn 50MB, hủy giữa chừng), sửa thông tin/ảnh bìa/lời bài hát, chọn xóa hàng loạt và xem Dashboard thống kê 7 ngày + Top bài nghe nhiều.
- **Đa thiết bị:** Cài trực tiếp lên màn hình chính iPhone (PWA) hoặc tải file `NhacCuaToi.apk` trên Android (tự động cập nhật giao diện mới từ GitHub Pages).

## 🚀 Cài đặt & Chạy thử (Local)
```bash
npm install
npm run dev
# Mở http://localhost:5000
```

## 🗄️ Cấu hình Supabase
Mở **Supabase Dashboard → SQL Editor**, dán toàn bộ nội dung file [`supabase_setup.sql`](./supabase_setup.sql) và bấm **Run** để khởi tạo bảng, hàm RPC đếm lượt nghe và phân quyền RLS.

## 📱 Build Android APK
```bash
npm run apk:debug     # Build bản Debug (xuất ra downloads/NhacCuaToi.apk)
npm run apk:release   # Build bản Release
npm run aab:release   # Build gói .aab cho Google Play
```
