# sheets-proxy-web

Web tối giản đọc dữ liệu từ **Google Sheets riêng tư** (không public) qua API proxy (read-only).

## 0) Yêu cầu
- Node.js LTS (>=18)
- Một Google Sheet mà **tài khoản của bạn có quyền xem** (Viewer/Editor). Không cần chỉnh sửa sheet.

## 1) Tạo Google Cloud & OAuth
1. Vào https://console.cloud.google.com/ → tạo Project.
2. `APIs & Services` → `Library` → bật **Google Sheets API**.
3. `APIs & Services` → `OAuth consent screen` → chọn *External* (hoặc Internal nếu workspace), điền tối thiểu app name, email.
4. `Credentials` → `Create Credentials` → **OAuth client ID** → *Desktop app*.
   - Ghi lại **CLIENT_ID** và **CLIENT_SECRET**.

## 2) Tải mã nguồn & cài
```bash
npm i
```

## 3) Lấy REFRESH_TOKEN (một lần)
Tạo file `.env.local` tối thiểu:
```
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
```
Chạy:
```bash
npm run token
```
Trình duyệt mở ra để cấp quyền. Sau khi cấp, terminal sẽ in ra JSON tokens. Lấy `refresh_token` và thêm vào `.env.local`:
```
REFRESH_TOKEN=your_refresh_token
```

## 4) Khai báo Sheet
Thêm vào `.env.local`:
```
SHEET_ID=your_sheet_id   # ví dụ 1AbCdefGh... từ URL sheet
SHEET_RANGE='CÓ SẴN!A1:K999'   # thay theo tên worksheet và phạm vi
```
> Không cần public. Miễn là tài khoản đã cấp OAuth có quyền xem file.

Cấu hình đầy đủ `.env.local` ví dụ:
```
CLIENT_ID=xxx.apps.googleusercontent.com
CLIENT_SECRET=xxx
REFRESH_TOKEN=1//0g...
SHEET_ID=1AbCdefGhIJkLmNoPQ
SHEET_RANGE=CÓ SẴN!A1:K999
```

## 5) Chạy thử local
```bash
npm run dev
```
Mở http://localhost:5173

## 6) Deploy
- **Vercel**: import repo, set các Environment Variables trong Project Settings giống `.env.local`, chọn Framework = Next.js.
- **Cloud Run / Docker**: `npm run build` rồi `npm start`. Đặt env tương tự.

## 7) Mapping cột
Frontend đang đọc các khóa phổ biến:
- tên sản phẩm: `ten` hoặc `ten_san_pham` hoặc `tensanpham` hoặc `name`
- mã SP: `ma_sp` hoặc `masanpham` hoặc `sku`
- giá: `gia_le` hoặc `giale` hoặc `gia`
- tồn: `ton` hoặc `con_lai` hoặc `sl`
- ảnh: `anh` hoặc `hinh_anh_san_pham`

Nếu tiêu đề cột trên sheet khác, bạn chỉ cần đổi logic map trong `pages/index.js`.

## Bảo mật/Hiệu năng
- API chỉ đọc; token lưu ở server (env). Frontend không thấy SECRET.
- Cache 120 giây giảm quota và tăng tốc. Có thể tăng bằng KV/Redis nếu cần.
