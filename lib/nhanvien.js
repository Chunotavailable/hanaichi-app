// lib/nhanvien.js — CHỈ dùng ở server.
// "Nhân viên AI" trả lời khách qua Discord: chủ shop dán tin khách vào Discord, bot soạn câu trả lời để chép đi gửi.
// - Bài học chủ shop dạy: lưu trong D1, bảng docs, path "nhanvien/brain.json".
// - Giá, size lấy từ dữ liệu Gồm cân (do CHƯƠNG TRÌNH điền, AI không tự nghĩ ra giá).
// - Kiến thức có sẵn ở trang Tra cứu nhanh (bảng size, thông tin cửa hàng, đổi trả...) cũng được đưa cho AI.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "./blobDoc";
import { SHOP_KB } from "./nhanvienKb";

const BRAIN_PATH = "nhanvien/brain.json";
const MAX_LESSONS = 80;
const MAX_LESSON_CHARS = 700;
export const MODEL_MAIN = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const MODEL_LIGHT = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

export function cfEnv() {
  try { return getCloudflareContext().env || {}; } catch { return {}; }
}
export function envVar(name) {
  const e = cfEnv();
  return (e && e[name]) || process.env[name] || "";
}

// ---------- bộ nhớ (bài học) ----------
async function readRow(path) {
  const db = await getDb();
  return db.prepare("SELECT body, etag FROM docs WHERE path = ?1").bind(path).first();
}
export async function loadBrain() {
  const row = await readRow(BRAIN_PATH);
  if (!row) return { lessons: [] };
  try {
    const b = JSON.parse(row.body);
    return { lessons: Array.isArray(b.lessons) ? b.lessons : [] };
  } catch {
    return { lessons: [] };
  }
}
async function saveBrain(brain) {
  const db = await getDb();
  const body = JSON.stringify(brain);
  const etag = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare("INSERT INTO docs (path, body, etag) VALUES (?1, ?2, ?3) ON CONFLICT(path) DO UPDATE SET body = excluded.body, etag = excluded.etag").bind(BRAIN_PATH, body, etag).run();
}
export async function addLesson(text) {
  const t = String(text || "").trim().slice(0, MAX_LESSON_CHARS);
  if (!t) return { ok: false, msg: "Nội dung trống." };
  const brain = await loadBrain();
  if (brain.lessons.length >= MAX_LESSONS) return { ok: false, msg: `Đã đủ ${MAX_LESSONS} bài học. Xoá bớt bài cũ bằng /xoa trước nhé.` };
  brain.lessons.push({ id: Date.now().toString(36), text: t, at: new Date().toISOString() });
  await saveBrain(brain);
  return { ok: true, n: brain.lessons.length };
}
export async function deleteLesson(n) {
  const brain = await loadBrain();
  const i = Number(n) - 1;
  if (!Number.isInteger(i) || i < 0 || i >= brain.lessons.length) return { ok: false, msg: `Không có bài số ${n}. Gõ /baihoc để xem danh sách.` };
  const [gone] = brain.lessons.splice(i, 1);
  await saveBrain(brain);
  return { ok: true, text: gone.text };
}

// ---------- tìm sản phẩm / mẫu câu liên quan ----------
const plain = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
const tokens = (s) => plain(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1);
const STOP = new Set(["gia", "bao", "nhieu", "cho", "hoi", "chi", "em", "shop", "co", "khong", "the", "nao", "la", "va", "cai", "nay", "kia", "con", "duoc", "ko", "ak", "a", "nhe", "nha", "voi", "gui", "link", "xin"]);

function scoreText(msgTokens, text) {
  const t = tokens(text).filter((w) => !STOP.has(w));
  if (!t.length) return 0;
  const set = new Set(msgTokens);
  let hit = 0;
  for (const w of t) if (set.has(w)) hit++;
  return hit / Math.sqrt(t.length);
}

async function loadDocField(path, jsonPath) {
  const db = await getDb();
  const row = await db.prepare("SELECT json_extract(body, ?2) AS v FROM docs WHERE path = ?1").bind(path, jsonPath).first();
  if (!row || !row.v) return [];
  try { return JSON.parse(row.v) || []; } catch { return []; }
}

const firstLine = (v) => String(v || "").split("\n").map((x) => x.trim()).find(Boolean) || "";

export function productQuote(it) {
  const parts = [];
  const main = firstLine(it.vnd).replace(/\s*gồm cân\s*$/i, "");
  if (main) parts.push(main);
  (it.sizes || []).forEach((z) => {
    const v = firstLine(z.vnd).replace(/\s*gồm cân\s*$/i, "");
    if (v) parts.push(z.label ? `${String(z.label).trim()} ${v}` : v);
  });
  if (!parts.length) return "";
  return it.orderType === "ready" ? `Dạ ${it.name} giá ${parts.join(", ")} bên em có sẵn ạ` : `Dạ ${it.name} giá order ${parts.join(", ")} ạ`;
}

// ---------- tính giá Yên theo đúng công thức ở trang Báo giá (pages/pricing.js) ----------
// giá = làm tròn lên 5k( Yên × tỷ giá × (1 − giảm%) ), báo dạng "Xk + KG".
const roundUp5k = (n) => Math.ceil(n / 5000) * 5000;
const fmtK = (n) => {
  const k = n / 1000;
  return (Number.isInteger(k) ? k : Math.round(k * 10) / 10).toString().replace(".", ",") + "k";
};
const cleanNum = (raw) => {
  const r = String(raw || "").replace(/\s/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(r)) return Number(r.replace(/[.,]/g, ""));
  return Number(r.replace(",", "."));
};
export function parseYenFromMessage(message) {
  const m = String(message || "");
  const pats = [
    /[¥￥]\s*([\d][\d.,]*)/,
    /([\d][\d.,]*)\s*(?:円|yên|yen|jpy)/i,
    /(?:giá\s*)?(?:yên|yen)\s*[:=]?\s*([\d][\d.,]*)/i,
  ];
  let yen = NaN;
  for (const re of pats) {
    const x = m.match(re);
    if (x) { yen = cleanNum(x[1]); if (yen > 0) break; }
  }
  if (!(yen > 0)) return null;
  const rm = m.match(/t[ỷỉ]\s*gi[áa]\s*[:=]?\s*(\d{2,3}(?:[.,]\d+)?)/i);
  const dm = m.match(/(?:giảm|sale|off)\s*[:=]?\s*(\d{1,2})\s*%|-\s*(\d{1,2})\s*%/i);
  return {
    yen,
    rate: rm ? cleanNum(rm[1]) : null,
    disc: dm ? Number(dm[1] || dm[2]) : 0,
    sale: /sale|giảm|khuyến mãi|khuyen mai/i.test(m),
  };
}
export async function yenQuote(message) {
  const p = parseYenFromMessage(message);
  if (!p) return null;
  let rate = p.rate;
  if (!rate) {
    try { rate = Number(await loadDocField("pricing/data.json", "$.lastRate")) || 0; } catch { rate = 0; }
  }
  if (!rate || rate < 100 || rate > 400) rate = 202;
  const total = roundUp5k(p.yen * rate * (1 - p.disc / 100));
  const line = p.sale ? `Mã này đang sale còn ${fmtK(total)} + KG ạ` : `Mã này giá ${fmtK(total)} + KG ạ`;
  return { line, total, yen: p.yen, rate, disc: p.disc };
}

export async function findContext(message) {
  const mt = tokens(message).filter((w) => !STOP.has(w));
  const [giadung, replies] = await Promise.all([loadDocField("gomcan/data.json", "$.giadung"), loadDocField("replies/data.json", "$.replies")]);
  const products = (giadung || [])
    .filter((it) => !it.gone && it.name)
    .map((it) => ({ it, s: scoreText(mt, it.name) }))
    .filter((x) => x.s >= 1.2)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.it);
  const knowledge = (replies || [])
    .filter((r) => !r.private && r.content)
    .map((r) => ({ r, s: scoreText(mt, `${r.title} ${r.group}`) + scoreText(mt, r.content) * 0.5 }))
    .filter((x) => x.s >= 0.9)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.r);
  // Mẫu câu có sẵn của shop (từ file viết tắt Unikey)
  const kb = SHOP_KB.map((m) => ({ m, s: scoreText(mt, `${m.title} ${m.kw}`) * 1.2 + scoreText(mt, m.text) * 0.4 }))
    .filter((x) => x.s >= 0.8)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.m);
  const yq = await yenQuote(message);
  return { products, knowledge, kb, yq };
}

// ---------- gọi AI ----------
export function buildMessages({ message, brain, ctx }) {
  const lessons = brain.lessons.map((l, i) => `${i + 1}. ${l.text}`).join("\n");
  const prods = ctx.products
    .map((it) => {
      const q = productQuote(it);
      const lines = [`- Tên: ${it.name}`, q ? `  Giá (đã tính sẵn, dùng đúng số này): ${q}` : "  Chưa có giá gồm cân trong dữ liệu."];
      if (it.productNote) lines.push(`  Ghi chú sản phẩm: ${String(it.productNote).slice(0, 500)}`);
      if (it.consultNote) lines.push(`  Ghi chú tư vấn: ${String(it.consultNote).slice(0, 600)}`);
      return lines.join("\n");
    })
    .join("\n");
  const know = ctx.knowledge.map((r) => `- [${r.group}] ${r.title}:\n${String(r.content).slice(0, 900)}`).join("\n");
  const kbText = (ctx.kb || []).map((m) => `- ${m.title}:\n${String(m.text).slice(0, 700)}`).join("\n");
  const yqText = ctx.yq ? `- Giá quần áo/hàng order tính từ giá Yên ${ctx.yq.yen} (tỷ giá ${ctx.yq.rate}${ctx.yq.disc ? `, giảm ${ctx.yq.disc}%` : ""}), câu báo giá dùng đúng nguyên văn: ${ctx.yq.line}` : "";
  const system = [
    "Bạn là nhân viên bán hàng đồ Nhật order của shop Hanaichi, đang soạn câu trả lời khách để CHỦ SHOP đọc lại rồi mới gửi.",
    "Mặc định xưng \"em\", gọi khách là \"chị\" (trừ khi bài học dưới đây dặn khác). Viết tiếng Việt tự nhiên, thân thiện, ngắn gọn như đang nhắn tin, không dùng markdown.",
    "QUY TẮC BẮT BUỘC:",
    "1. Chỉ dùng thông tin có trong phần \"Bài học\", \"Sản phẩm khớp\" và \"Kiến thức shop\" bên dưới. KHÔNG tự bịa giá, size, chất liệu, thời gian giao hàng, chính sách.",
    "2. Giá chỉ được lấy đúng từ dòng \"Giá\" của sản phẩm khớp, hoặc từ phần \"GIÁ ĐÃ TÍNH SẴN\", hoặc giá chủ shop ghi thẳng trong tin. Không tự tính hay làm tròn.",
    "3. Nếu thiếu thông tin để trả lời chắc chắn, vẫn soạn phần trả lời được, và cuối câu thêm đúng 1 dòng: [CẦN CHỦ SHOP KIỂM TRA: điều còn thiếu].",
    "4. Chỉ trả về nội dung tin nhắn gửi khách, không giải thích thêm.",
    lessons ? `\nBÀI HỌC CHỦ SHOP ĐÃ DẠY:\n${lessons}` : "",
    yqText ? `\nGIÁ ĐÃ TÍNH SẴN TỪ GIÁ YÊN (dùng đúng câu này, không tự tính lại):\n${yqText}` : "",
    prods ? `\nSẢN PHẨM KHỚP VỚI TIN KHÁCH:\n${prods}` : "\nKhông tìm thấy sản phẩm nào khớp trong dữ liệu.",
    know ? `\nKIẾN THỨC SHOP:\n${know}` : "",
    kbText ? `\nMẪU CÂU CỦA SHOP (chủ shop hay dùng; giữ đúng ý và giọng văn, viết đầy đủ chữ thay cho viết tắt e/a/c, sửa cho khớp tình huống):\n${kbText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Tin nhắn của khách:\n${message}` },
  ];
}

export async function runAI(messages) {
  const env = cfEnv();
  if (!env.AI) throw new Error("Chưa gắn AI (binding tên AI) cho web — cần deploy lại sau khi có wrangler.jsonc mới.");
  let lastErr;
  for (const model of [MODEL_MAIN, MODEL_LIGHT]) {
    try {
      const out = await env.AI.run(model, { messages, max_tokens: 500, temperature: 0.4 });
      const text = typeof out === "string" ? out : out && (out.response || out.result?.response);
      if (text && String(text).trim()) return { text: String(text).trim(), model };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("AI không trả lời");
}

// ---------- xác thực yêu cầu từ Discord (Ed25519) ----------
const hex = (s) => {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
};
export async function verifyDiscord(rawBody, signature, timestamp, publicKeyHex) {
  if (!signature || !timestamp || !publicKeyHex) return false;
  try {
    const data = new TextEncoder().encode(timestamp + rawBody);
    let key;
    try {
      key = await crypto.subtle.importKey("raw", hex(publicKeyHex), { name: "Ed25519" }, false, ["verify"]);
      return await crypto.subtle.verify({ name: "Ed25519" }, key, hex(signature), data);
    } catch {
      key = await crypto.subtle.importKey("raw", hex(publicKeyHex), { name: "NODE-ED25519", namedCurve: "NODE-ED25519" }, false, ["verify"]);
      return await crypto.subtle.verify("NODE-ED25519", key, hex(signature), data);
    }
  } catch {
    return false;
  }
}
