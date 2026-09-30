// pages/api/login.js
// Kiểm tra mật khẩu gửi lên từ trang /login: khớp mật khẩu của vai trò nào
// (Quản lý / Khách) thì cấp cookie đăng nhập của vai trò đó (còn
// hạn 180 ngày) để middleware.js cho qua các lần sau.
import { roleForPassword, tokenFor, getPasswords, AUTH_COOKIE_NAME, ROLE_COOKIE_NAME } from "../../lib/authToken";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 ngày

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const role = roleForPassword(body.password);
  if (!role) {
    return res.status(401).json({ error: "Sai mật khẩu, thử lại giúp em ạ" });
  }
  const token = tokenFor(role, getPasswords()[role]);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", [
    `${AUTH_COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
    `${ROLE_COOKIE_NAME}=${role}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`,
  ]);
  return res.status(200).json({ ok: true, role });
}
