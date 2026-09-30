// lib/authToken.js
// 2 chế độ đăng nhập, mỗi chế độ 1 mật khẩu riêng — nhập mật khẩu nào thì
// vào đúng chế độ đó:
//   admin (Quản lý): đầy đủ tính năng.
//   guest (Khách)  : chỉ xem và copy, không sửa được gì.
// Quyền được chặn thật ở server (middleware.js + lib/docApi.js), không chỉ ẩn
// nút trên màn hình.
//
// Băm mật khẩu thành chuỗi ngắn để lưu vào cookie — không lưu mật khẩu gốc.
// Hàm băm đơn giản, đủ cho mục đích chặn người ngoài; chạy được cả ở
// middleware (Edge runtime) lẫn API route (Node).
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

// Mật khẩu mặc định khi chưa cấu hình biến môi trường trên Vercel. Đổi mật
// khẩu: sửa ở đây (nhờ deploy lại), hoặc tự thêm biến môi trường trên Vercel
// (Settings > Environment Variables): APP_PASSWORD,
// APP_PASSWORD_GUEST — không cần sửa code.
export const DEFAULT_PASSWORDS = {
  admin: "hanaichi2026",
  guest: "khach2026",
};

export function getPasswords() {
  return {
    admin: process.env.APP_PASSWORD || DEFAULT_PASSWORDS.admin,
    guest: process.env.APP_PASSWORD_GUEST || DEFAULT_PASSWORDS.guest,
  };
}
// Giữ tương thích với chỗ cũ gọi getAppPassword().
export function getAppPassword() {
  return getPasswords().admin;
}

// Token cookie cho từng vai trò. Token Quản lý giữ đúng công thức cũ để
// những máy đang đăng nhập sẵn không bị bắt đăng nhập lại.
export function tokenFor(role, pw) {
  if (role === "admin") return hashPassword(pw);
  return hashPassword(`${role}|${pw}`);
}

export const ROLES = ["admin", "guest"];

// Mật khẩu -> vai trò (ưu tiên Quản lý nếu lỡ đặt trùng mật khẩu).
export function roleForPassword(password) {
  const pws = getPasswords();
  for (const role of ROLES) if (password && password === pws[role]) return role;
  return null;
}
// Cookie -> vai trò.
export function roleForToken(token) {
  if (!token) return null;
  const pws = getPasswords();
  for (const role of ROLES) if (token === tokenFor(role, pws[role])) return role;
  return null;
}

export const AUTH_COOKIE_NAME = "hn_auth";
// Cookie phụ chỉ để giao diện biết đang ở chế độ nào (ẩn/hiện nút). Không
// dùng để phân quyền — quyền thật luôn tính lại ở server từ hn_auth.
export const ROLE_COOKIE_NAME = "hn_role";
