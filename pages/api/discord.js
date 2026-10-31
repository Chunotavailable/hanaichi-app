// pages/api/discord.js
// Điểm nhận lệnh từ Discord (Interactions Endpoint URL): /hoi /day /nho /baihoc /xoa + menu "Soạn trả lời".
// Discord không gửi cookie đăng nhập nên đường này được mở ở middleware, và tự kiểm tra CHỮ KÝ của Discord
// (không đúng chữ ký thì từ chối). Có thể giới hạn người dùng bằng biến DISCORD_ALLOWED_USER_IDS.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { addLesson, buildMessages, deleteLesson, envVar, findContext, loadBrain, productQuote, runAI, verifyDiscord } from "../../lib/nhanvien";

export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString("utf8");
}
const clip = (s, n = 1900) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));
const opt = (data, name) => ((data.options || []).find((o) => o.name === name) || {}).value;

async function followUp(appId, token, content) {
  const r = await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: clip(content) }),
  });
  if (!r.ok) console.error("discord followUp", r.status, await r.text().catch(() => ""));
}

async function answerCustomer(message) {
  const brain = await loadBrain();
  const ctx = await findContext(message);
  const { text, model } = await runAI(buildMessages({ message, brain, ctx }));
  const quotes = ctx.products.map(productQuote).filter(Boolean);
  const names = ctx.products.map((p) => p.name);
  let out = `**Gợi ý trả lời** (chép phần này):\n${text}`;
  if (quotes.length) out += `\n\n💰 **Giá trong dữ liệu:**\n${quotes.map((q) => `• ${q}`).join("\n")}`;
  else out += "\n\n⚠️ Không thấy sản phẩm nào khớp trong dữ liệu Gồm cân — chủ shop tự kiểm tra giá.";
  if (names.length) out += `\n🔎 Sản phẩm khớp: ${names.join(" | ")}`;
  out += `\n_(${model.includes("70b") ? "mô hình khá" : "mô hình nhẹ"} · ${brain.lessons.length} bài học)_`;
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const raw = await readRaw(req);
  const ok = await verifyDiscord(raw, req.headers["x-signature-ed25519"], req.headers["x-signature-timestamp"], envVar("DISCORD_PUBLIC_KEY"));
  if (!ok) return res.status(401).send("invalid request signature");
  let it;
  try { it = JSON.parse(raw); } catch { return res.status(400).send("bad json"); }

  if (it.type === 1) return res.status(200).json({ type: 1 }); // PING

  const allowed = String(envVar("DISCORD_ALLOWED_USER_IDS") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const uid = (it.member && it.member.user && it.member.user.id) || (it.user && it.user.id) || "";
  const say = (content) => res.status(200).json({ type: 4, data: { content: clip(content) } });
  if (allowed.length && !allowed.includes(uid)) return say("Bạn chưa được phép dùng bot này.");

  if (it.type !== 2) return say("Lệnh này chưa hỗ trợ.");
  const d = it.data || {};

  try {
    // ----- cần AI: trả lời "đang soạn…" trước (Discord chỉ chờ 3 giây), soạn xong sửa lại tin -----
    let customerMsg = null;
    if (d.type === 3) {
      const m = d.resolved && d.resolved.messages && d.resolved.messages[d.target_id];
      customerMsg = m && m.content ? m.content : "";
      if (!customerMsg) return say("Tin nhắn này không có chữ để soạn trả lời.");
    } else if (d.name === "hoi") {
      customerMsg = String(opt(d, "tin") || "");
      if (!customerMsg.trim()) return say("Bạn dán tin của khách vào ô `tin` nhé.");
    }
    if (customerMsg !== null) {
      const ctxCf = getCloudflareContext();
      ctxCf.ctx.waitUntil(
        (async () => {
          try {
            await followUp(it.application_id, it.token, await answerCustomer(customerMsg));
          } catch (e) {
            await followUp(it.application_id, it.token, `⚠️ Bot gặp lỗi: ${String((e && e.message) || e).slice(0, 300)}\n(Có thể đã hết hạn mức AI miễn phí hôm nay, thử lại sau 7h sáng giờ Việt Nam.)`);
          }
        })()
      );
      return res.status(200).json({ type: 5 });
    }

    // ----- dạy / quản lý bài học -----
    if (d.name === "day") {
      const r = await addLesson(opt(d, "noi_dung"));
      return say(r.ok ? `✅ Đã nhớ (bài số ${r.n}). Gõ /baihoc để xem tất cả.` : `⚠️ ${r.msg}`);
    }
    if (d.name === "nho") {
      const r = await addLesson(`Khi khách ${String(opt(d, "khi_khach") || "").trim()} thì trả lời kiểu: ${String(opt(d, "tra_loi") || "").trim()}`);
      return say(r.ok ? `✅ Đã nhớ cách trả lời này (bài số ${r.n}).` : `⚠️ ${r.msg}`);
    }
    if (d.name === "baihoc") {
      const b = await loadBrain();
      if (!b.lessons.length) return say("Chưa có bài học nào. Dạy bot bằng /day hoặc /nho nhé.");
      return say("📚 **Bài học bot đang nhớ:**\n" + b.lessons.map((l, i) => `${i + 1}. ${l.text}`).join("\n"));
    }
    if (d.name === "xoa") {
      const r = await deleteLesson(opt(d, "so"));
      return say(r.ok ? `🗑️ Đã xoá: ${clip(r.text, 300)}` : `⚠️ ${r.msg}`);
    }
    return say("Lệnh chưa được hỗ trợ.");
  } catch (e) {
    console.error("discord handler", e);
    return say(`⚠️ Lỗi: ${String((e && e.message) || e).slice(0, 300)}`);
  }
}
