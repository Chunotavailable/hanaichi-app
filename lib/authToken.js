// lib/authToken.js
// Băm mật khẩu thành 1 chuỗi ngắn để lưu vào cookie đăng nhập — không lưu
// thẳng mật khẩu gốc vào cookie của trình duyệt. Đây chỉ là hàm băm đơn giản
// (không phải mã hoá bảo mật cấp ngân hàng) nhưng đủ dùng cho mục đích chặn
// người ngoài vô tình truy cập/sửa dữ liệu khi lỡ lộ link — không phải chống
// tấn công có chủ đích chuyên nghiệp.
// Dùng được ở cả middleware (Edge runtime) lẫn API route (Node) vì chỉ dùng
// phép toán số học thuần JS, không phụ thuộc thư viện Node như "crypto".
export function hashPassword(pw) {
  const s = `hanaichi::${pw || ""}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const n2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return n1 + n2;
}

// Mật khẩu mặc định dùng khi chưa cấu hình biến môi trường APP_PASSWORD trên
// Vercel. Đổi trực tiếp dòng dưới (rồi nhờ deploy lại) hoặc — cách khuyên
// dùng — vào Vercel > Settings > Environment Variables thêm biến
// APP_PASSWORD để tự đổi mật khẩu bất cứ lúc nào mà không cần sửa code.
export const DEFAULT_APP_PASSWORD = "hanaichi2026";

export function getAppPassword() {
  return process.env.APP_PASSWORD || DEFAULT_APP_PASSWORD;
}

export const AUTH_COOKIE_NAME = "hn_auth";
