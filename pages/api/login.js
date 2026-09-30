// pages/api/login.js
// Kiểm tra mật khẩu gửi lên từ trang /login, đúng thì cấp cookie đăng nhập
// (còn hạn 180 ngày) để middleware.js cho qua các lần sau.
import { hashPassword, getAppPassword, AUTH_COOKIE_NAME } from "../../lib/authToken";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 180 ngày

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { password } = body;
  if (!password || password !== getAppPassword()) {
    return res.status(401).json({ error: "Sai mật khẩu, thử lại giúp em ạ" });
  }
  const token = hashPassword(getAppPassword());
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${AUTH_COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`
  );
  return res.status(200).json({ ok: true });
}
