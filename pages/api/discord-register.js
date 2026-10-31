// pages/api/discord-register.js
// Chủ shop (đã đăng nhập Quản lý) mở đường này MỘT LẦN để đăng ký các lệnh của bot lên Discord.
// Cần biến bí mật DISCORD_APP_ID và DISCORD_BOT_TOKEN trong Cloudflare.
import { envVar } from "../../lib/nhanvien";

const COMMANDS = [
  { name: "hoi", type: 1, description: "Dán tin khách vào để bot soạn câu trả lời", options: [{ type: 3, name: "tin", description: "Tin nhắn của khách (có thể bỏ trống nếu chỉ có ảnh)", required: false }, { type: 11, name: "anh", description: "Ảnh khách gửi (sản phẩm, bài đăng, tin nhắn...)", required: false }, { type: 11, name: "anh2", description: "Ảnh thứ hai (nếu có)", required: false }] },
  { name: "day", type: 1, description: "Dạy bot một điều cần nhớ (cách xưng hô, thời gian hàng về, cọc...)", options: [{ type: 3, name: "noi_dung", description: "Điều cần nhớ", required: true }] },
  {
    name: "nho",
    type: 1,
    description: "Dạy bot cách trả lời một tình huống",
    options: [
      { type: 3, name: "khi_khach", description: "Khi khách hỏi/nói gì", required: true },
      { type: 3, name: "tra_loi", description: "Cách trả lời đúng ý chủ shop", required: true },
    ],
  },
  { name: "baihoc", type: 1, description: "Xem các bài học bot đang nhớ" },
  { name: "xoa", type: 1, description: "Xoá một bài học theo số", options: [{ type: 4, name: "so", description: "Số bài học (xem bằng /baihoc)", required: true, min_value: 1 }] },
  { name: "Soạn trả lời", type: 3 },
];

export default async function handler(req, res) {
  if (req.headers["x-hn-role"] !== "admin") return res.status(403).json({ error: "Chỉ Quản lý" });
  const appId = envVar("DISCORD_APP_ID");
  const token = envVar("DISCORD_BOT_TOKEN");
  if (!appId || !token) return res.status(400).json({ error: "Chưa có DISCORD_APP_ID hoặc DISCORD_BOT_TOKEN trong Cloudflare." });
  const r = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${token}` },
    body: JSON.stringify(COMMANDS),
  });
  const body = await r.text();
  return res.status(r.ok ? 200 : 502).send(r.ok ? `Đã đăng ký ${COMMANDS.length} lệnh cho bot Discord.` : `Discord báo lỗi ${r.status}: ${body.slice(0, 400)}`);
}
