// pages/api/logout.js — Xoá cookie đăng nhập.
import { AUTH_COOKIE_NAME } from "../../lib/authToken";

export default async function handler(req, res) {
  res.setHeader("Set-Cookie", `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return res.status(200).json({ ok: true });
}
