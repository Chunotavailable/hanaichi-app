// pages/api/logout.js — Xoá cookie đăng nhập (và cookie vai trò).
import { AUTH_COOKIE_NAME, ROLE_COOKIE_NAME } from "../../lib/authToken";

export default async function handler(req, res) {
  res.setHeader("Set-Cookie", [
    `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    `${ROLE_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`,
  ]);
  return res.status(200).json({ ok: true });
}
