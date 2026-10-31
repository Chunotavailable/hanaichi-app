// lib/nhanvien.js — CHỈ dùng ở server.
// "Nhân viên AI" trả lời khách qua Discord: chủ shop dán tin khách vào Discord, bot soạn câu trả lời để chép đi gửi.
// - Bài học chủ shop dạy: lưu trong D1, bảng docs, path "nhanvien/brain.json".
// - Giá, size lấy từ dữ liệu Gồm cân (do CHƯƠNG TRÌNH điền, AI không tự nghĩ ra giá).
// - Kiến thức có sẵn ở trang Tra cứu nhanh (bảng size, thông tin cửa hàng, đổi trả...) cũng được đưa cho AI.
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "./blobDoc";
import { SHOP_KB } from "./nhanvienKb";

const BRAIN_PATH = "nhanvien/brain.json";
const MAX_LESSONS = 500;
const MAX_LESSON_CHARS = 700;
export const MODEL_MAIN = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
export const MODEL_VISION = "@cf/google/gemma-4-26b-a4b-it";
export const MODEL_VISION_ALT = "@cf/meta/llama-4-scout-17b-16e-instruct";
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
  if (it.src === "sheet") return it.vnd ? `${it.name} → ${String(it.vnd).replace(/\s*\n\s*/g, " / ").slice(0, 200)}` : "";
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

// Bài học bắt đầu bằng "Luôn..." thì lần nào cũng đưa cho AI (tối đa 12). Các bài còn lại chỉ lấy 10 bài liên quan nhất tới tin khách.
export function pickLessons(lessons, message) {
  const mt = tokens(message).filter((w) => !STOP.has(w));
  const always = [];
  const rest = [];
  lessons.forEach((l, i) => {
    if (/^\s*luôn\b/i.test(l.text)) always.push({ l, i });
    else rest.push({ l, i, s: scoreText(mt, l.text) });
  });
  const rel = rest.filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, 10);
  return [...always.slice(0, 12), ...rel].sort((a, b) => a.i - b.i);
}

// ---------- tự đọc giá Yên từ link (tối đa 5 link mỗi lần hỏi) ----------
// Chỉ mở link khi chủ shop gõ /hoi. Đọc không được thì báo, không đoán giá.
const OK_HOSTS = /(\.jp$|(^|\.)uniqlo\.com$|(^|\.)gu-global\.com$|(^|\.)muji\.com$|(^|\.)onitsukatiger\.com$|(^|\.)amazon\.co\.jp$)/i;
export function extractUrls(message) {
  const found = String(message || "").match(/https?:\/\/[^\s<>"')]+/gi) || [];
  const seen = new Set();
  const out = [];
  for (const raw of found) {
    const u = raw.replace(/[.,;!?]+$/, "");
    let h;
    try { h = new URL(u); } catch { continue; }
    if (h.protocol !== "https:" || /^\d+\.\d+\.\d+\.\d+$/.test(h.hostname) || h.hostname === "localhost" || !OK_HOSTS.test(h.hostname)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= 5) break;
  }
  return out;
}
const num = (v) => {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : NaN;
};
export function parsePriceFromHtml(html) {
  const h = String(html || "").slice(0, 400000);
  const title = ((h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || h.match(/<title[^>]*>([^<]+)/i) || [])[1] || "").trim().slice(0, 120);
  const prices = [];
  const ld = h.match(/<script[^>]+application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.offers) {
      const arr = Array.isArray(o.offers) ? o.offers : [o.offers];
      for (const f of arr) {
        const cur = String(f.priceCurrency || "JPY").toUpperCase();
        if (cur !== "JPY") continue;
        for (const k of ["price", "lowPrice", "highPrice"]) if (f[k] != null && !isNaN(num(f[k]))) prices.push(num(f[k]));
      }
    }
    for (const k of Object.keys(o)) if (k !== "offers" && typeof o[k] === "object") walk(o[k]);
  };
  for (const blk of ld.slice(0, 6)) {
    try { walk(JSON.parse(blk.replace(/^<script[^>]*>|<\/script>$/gi, ""))); } catch {}
  }
  if (!prices.length) {
    const m = h.match(/<meta[^>]+(?:product:price:amount|og:price:amount)["'][^>]+content=["']([\d.,]+)/i);
    if (m && !isNaN(num(m[1]))) prices.push(num(m[1]));
  }
  if (!prices.length) return { title, yen: null };
  const uniq = [...new Set(prices)].sort((a, b) => a - b);
  return { title, yen: uniq[0], max: uniq[uniq.length - 1] };
}
// Uniqlo Nhật nạp giá bằng JavaScript nên trang HTML không có giá. Thử hỏi thẳng máy chủ giá của chính trang đó (đoán theo cách trang web chạy, chưa kiểm chứng được).
async function readUniqlo(url, ac) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const id = (u.pathname.match(/\/products\/(E\d{5,7}-\d{3})/i) || [])[1];
  if (!/(^|\.)uniqlo\.com$/i.test(u.hostname) || !/^\/jp\//i.test(u.pathname) || !id) return null;
  const r = await fetch(`https://www.uniqlo.com/jp/api/commerce/v5/ja/products?productIds=${id}&withPrices=true&withStocks=false&httpFailure=true`, {
    signal: ac.signal,
    headers: { "x-fr-clientid": "uq.jp.web-spa", Accept: "application/json" },
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const it = j && j.result && j.result.items && j.result.items[0];
  if (!it) return null;
  const pr = it.prices || {};
  const val = (x) => (x && x.value != null ? num(x.value) : NaN);
  const color = (u.searchParams.get("colorDisplayCode") || "").trim();
  const sale = val(pr.promo);
  const base = val(pr.base);
  const yen = !isNaN(sale) ? sale : base;
  if (isNaN(yen)) return null;
  return { title: String(it.name || "").slice(0, 120), yen, color };
}
async function readLink(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    try {
      const uq = await readUniqlo(url, ac);
      if (uq) return { url, ...uq };
    } catch {}
    const r = await fetch(url, { signal: ac.signal, redirect: "follow", headers: { "Accept-Language": "ja,vi;q=0.8", Accept: "text/html" } });
    if (!r.ok) return { url, error: `trang trả lỗi ${r.status}` };
    const info = parsePriceFromHtml(await r.text());
    if (!info.yen) return { url, title: info.title, error: "không thấy giá trong trang" };
    return { url, ...info };
  } catch (e) {
    return { url, error: e && e.name === "AbortError" ? "trang trả lời quá chậm" : "không mở được trang" };
  } finally {
    clearTimeout(t);
  }
}
export async function readLinks(message, skip = new Set()) {
  const urls = extractUrls(message).filter((u) => !skip.has(u));
  if (!urls.length) return [];
  const mt = parseYenFromMessage(message);
  let rate = (mt && mt.rate) || 0;
  if (!rate) { try { rate = Number(await loadDocField("pricing/data.json", "$.lastRate")) || 0; } catch { rate = 0; } }
  if (!rate || rate < 100 || rate > 400) rate = 202;
  const sale = /sale|giảm|khuyến mãi|khuyen mai/i.test(String(message));
  const disc = mt ? mt.disc : 0;
  const res = await Promise.all(urls.map(readLink));
  return res.map((x) => {
    if (x.error) return x;
    const total = roundUp5k(x.yen * rate * (1 - disc / 100));
    return { ...x, rate, total, line: sale ? `Mã này đang sale còn ${fmtK(total)} + KG ạ` : `Mã này giá ${fmtK(total)} + KG ạ`, varies: x.max && x.max !== x.yen };
  });
}

// Phần "link + câu báo giá" do CHƯƠNG TRÌNH ghép sẵn đúng câu mẫu ở trang Báo giá; AI chỉ viết phần tư vấn và câu kết.
const COLOR_RE = /(?:vàng|xanh|đen|trắng|đỏ|hồng|nâu|xám|be|kem|tím|cam|ghi|rêu|navy|đậm|nhạt|dương|lá|màu|mầu)\s+(\d{2})\b/gi;
function linkWithColors(url, message) {
  let u;
  try { u = new URL(url); } catch { return [url]; }
  if (!/(^|\.)uniqlo\.com$/i.test(u.hostname) || u.searchParams.get("colorDisplayCode")) return [url];
  const codes = [...new Set([...String(message).matchAll(COLOR_RE)].map((m) => m[1]))].slice(0, 3);
  if (!codes.length) return [url];
  return codes.map((c) => { const v = new URL(u.toString()); v.searchParams.set("colorDisplayCode", c); return v.toString(); });
}
export function buildQuoteBlocks(message, ctx) {
  const blocks = [];
  const priced = (ctx.links || []).filter((x) => !x.error && x.line);
  if (ctx.yq) {
    const first = (String(message).match(/https?:\/\/[^\s<>"')]+/i) || [""])[0].replace(/[.,;!?]+$/, "");
    blocks.push([...(first ? linkWithColors(first, message) : []), ...(first ? [""] : []), ctx.yq.line].join("\n"));
  } else {
    for (const x of priced) blocks.push([...linkWithColors(x.url, message), "", x.line].join("\n"));
  }
  return blocks.join("\n\n");
}

// ---------- hàng có sẵn: tab "Hàng closet sẵn" (gomcan/data.json $.closet) và "Giá siêu thị" (sieuthi/cache.json) ----------
// Dữ liệu lớn nên chỉ lấy bản rút gọn (tên, mã) để tìm, rồi mới đọc đầy đủ vài sản phẩm khớp nhất — việc lọc làm ngay trong D1.
const saigonToday = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const dotK = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "k";
const GENERIC = new Set(["giay", "ao", "quan", "tui", "balo", "nam", "nu", "mau", "size", "eu", "cm", "kg", "hang", "san", "uniqlo", "nike", "adidas", "asics", "onitsuka", "tiger", "puma", "wilson", "gu", "den", "trang", "https", "http", "www", "com", "jp", "ja", "products", "mua", "lay", "muon", "cai", "chiec", "doi", "ban", "bao", "nhieu", "gia"]);
// Bỏ phần "https://..." khỏi tin, chỉ giữ các đoạn đường dẫn có chứa số (mã sản phẩm như E479791-000).
const searchText = (msg) => String(msg || "").replace(/https?:\/\/[^\s<>"')]+/gi, (u) => { try { return " " + new URL(u).pathname.split("/").filter((x) => /\d/.test(x)).join(" ") + " "; } catch { return " "; } });
const prefixHit = (set, w) => set.has(w) || (w.length >= 4 && [...set].some((h) => h.length > w.length && h.startsWith(w)));
function rankByTokens(msgTokens, items, getText) {
  const out = [];
  for (const it of items) {
    const set = new Set(tokens(getText(it)));
    let hits = 0, strong = 0;
    for (const w of msgTokens) {
      if (!prefixHit(set, w)) continue;
      hits++;
      if (!GENERIC.has(w)) strong++;
    }
    const codeHit = msgTokens.some((w) => w.length >= 5 && /\d/.test(w) && set.has(w));
    if (codeHit || (hits >= 2 && strong >= 1)) out.push({ it, s: (codeHit ? 5 : 0) + strong * 2 + hits });
  }
  return out.sort((a, b) => b.s - a.s).map((x) => x.it);
}
let _cache = { closet: null, sieuthi: null };
async function cachedList(key, loader) {
  const c = _cache[key];
  if (c && Date.now() - c.at < 60000) return c.v;
  const v = await loader();
  _cache[key] = { at: Date.now(), v };
  return v;
}
async function closetIndex() {
  return cachedList("closet", async () => {
    const db = await getDb();
    const r = await db.prepare(`SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.name') AS name, json_extract(value,'$.category') AS cat,
      (SELECT group_concat(json_extract(v.value,'$.label'),' ') FROM json_each(json_extract(value,'$.variants')) v) AS labels
      FROM json_each((SELECT json_extract(body,'$.closet') FROM docs WHERE path='gomcan/data.json'))`).all();
    return (r.results || []).map((x) => ({ id: x.id, text: `${x.name || ""} ${x.cat || ""} ${x.labels || ""}` }));
  });
}
const closetActive = (d) => {
  if (!d || !d.enabled) return false;
  const t = saigonToday();
  return !((d.from && t < d.from) || (d.to && t > d.to));
};
const closetApply = (price, d, xa) => {
  if (xa || !closetActive(d)) return price;
  const th = Number(d.threshold) || 0, pc = Number(d.percent) || 0;
  return th > 0 && pc > 0 && price >= th ? Math.ceil((price * (1 - pc / 100)) / 5) * 5 : price;
};
function closetBlock(p, d) {
  const xa = !!p.xaKho || plain(p.name).includes("xa kho");
  const name = String(p.name || "").replace(/\n/g, " ").trim();
  const vs = (p.variants || []).filter((v) => Number(v.price) > 0);
  if (!vs.length) return `- ${name} (${p.category || ""}): chưa có giá trong dữ liệu`;
  const orig = vs.map((v) => Number(v.price));
  const disc = orig.map((x) => closetApply(x, d, xa));
  const rng = (a) => (Math.min(...a) === Math.max(...a) ? dotK(a[0]) : `${dotK(Math.min(...a))} - ${dotK(Math.max(...a))}`);
  const hasDisc = disc.some((x, i) => x !== orig[i]);
  const quote = hasDisc ? `Dạ ${name} bên em có sẵn đang được giảm giá còn ${rng(disc)} ạ` : `Dạ ${name} bên em có sẵn giá ${rng(disc)} ạ`;
  const zalo = orig.map((x) => { const sale = closetApply(x, d, xa); return sale !== x ? sale : Math.max(x - 30, 0); });
  const lines = (p.variants || [])
    .slice()
    .sort((a, b) => (Number(b.remaining) > 0) - (Number(a.remaining) > 0))
    .slice(0, 16)
    .map((v) => `    · ${String(v.label || "").trim()}${v.color ? ` ${v.color}` : ""}: ${Number(v.remaining) > 0 ? `còn ${v.remaining}` : "HẾT"}${Number(v.price) !== orig[0] || hasDisc ? `, giá ${dotK(closetApply(Number(v.price), d, xa))}` : ""}`)
    .join("\n");
  return `- ${name} (${p.category || ""})${xa ? " [XẢ KHO]" : ""}\n  Câu báo giá mẫu (dùng đúng câu này): ${quote}\n  Giá Zalo (chỉ dùng khi khách nhắn qua Zalo): ${rng(zalo)}\n  Mã/size và số lượng còn:\n${lines}`;
}
export async function findClosetStock(message) {
  const mt = tokens(searchText(message)).filter((w) => !STOP.has(w));
  if (!mt.length) return [];
  const ids = rankByTokens(mt, await closetIndex(), (x) => x.text).slice(0, 3).map((x) => x.id);
  if (!ids.length) return [];
  const db = await getDb();
  const ph = ids.map((_, i) => `?${i + 2}`).join(",");
  const r = await db.prepare(`SELECT value AS p FROM json_each((SELECT json_extract(body,'$.closet') FROM docs WHERE path=?1)) WHERE json_extract(value,'$.id') IN (${ph})`).bind("gomcan/data.json", ...ids).all();
  const disc = await loadDocField("gomcan/data.json", "$.closetDiscount").catch(() => null);
  const byId = new Map();
  for (const row of r.results || []) { try { const p = JSON.parse(row.p); byId.set(p.id, p); } catch {} }
  return ids.map((id) => byId.get(id)).filter(Boolean).map((p) => ({ name: String(p.name || "").replace(/\n/g, " "), text: closetBlock(p, Array.isArray(disc) ? null : disc) }));
}
async function sieuthiIndex() {
  return cachedList("sieuthi", async () => {
    const db = await getDb();
    const r = await db.prepare(`SELECT json_extract(value,'$.id') AS id, json_extract(value,'$.name') AS name FROM json_each((SELECT json_extract(body,'$.products') FROM docs WHERE path='sieuthi/cache.json'))`).all();
    return (r.results || []).map((x) => ({ id: x.id, text: x.name || "" }));
  });
}
export async function findSupermarket(message) {
  const mt = tokens(searchText(message)).filter((w) => !STOP.has(w));
  if (!mt.length) return [];
  const ids = rankByTokens(mt, await sieuthiIndex(), (x) => x.text).slice(0, 3).map((x) => x.id);
  if (!ids.length) return [];
  const db = await getDb();
  const ph = ids.map((_, i) => `?${i + 2}`).join(",");
  const r = await db.prepare(`SELECT value AS p FROM json_each((SELECT json_extract(body,'$.products') FROM docs WHERE path=?1)) WHERE json_extract(value,'$.id') IN (${ph})`).bind("sieuthi/cache.json", ...ids).all();
  const saleCfg = await loadDocField("sieuthi/cache.json", "$.sale").catch(() => null);
  const t = saigonToday();
  const saleActive = !!saleCfg && !Array.isArray(saleCfg) && (!saleCfg.start || t >= saleCfg.start) && (!saleCfg.end || t <= saleCfg.end);
  const k = (n) => { const x = n / 1000; return (Number.isInteger(x) ? x : Math.round(x * 10) / 10).toString().replace(".", ",") + "k"; };
  const byId = new Map();
  for (const row of r.results || []) { try { const p = JSON.parse(row.p); byId.set(p.id, p); } catch {} }
  return ids.map((id) => byId.get(id)).filter(Boolean).map((p) => {
    const saleNow = saleActive && p.sale && !p.oos;
    const price = saleNow ? p.sale : p.price;
    const quote = price ? `${p.name} ${saleNow ? "đang sale giá" : "giá"} ${k(price)} bên e có sẵn` : "";
    return { name: p.name, oos: !!p.oos, text: `- ${p.name}${p.oos ? " — ĐANG HẾT HÀNG (nói hết hàng, không báo có sẵn)" : ""}${quote && !p.oos ? `\n  Câu báo giá mẫu (dùng đúng ý này): ${quote}${saleNow && p.price ? ` (giá gốc ${k(p.price)})` : ""}` : ""}${p.saleText ? `\n  Ghi chú sale: ${p.saleText}` : ""}${p.linkWeb ? `\n  Link: ${p.linkWeb}` : ""}` };
  });
}

// ---------- bảng "GIÁ GỒM CÂN" (Gia dụng, TPCN) đọc THẲNG từ Google Sheet ----------
// Chỉ lấy: Tên sản phẩm, Link sản phẩm, Giá Yên, Giá gồm cân. Bỏ qua Ảnh và Link bài đăng.
const GD_SHEET_ID = () => envVar("GIADUNG_SHEET_ID") || "1veT2iJyBcVh8xeZDHCX671z4gVSzfdYI6NPGzeelbJs";
const GD_SHEET_GID = () => envVar("GIADUNG_SHEET_GID") || "1088393678";
function csvRows(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const t = String(text || "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export function parseGiaGomCanCsv(text) {
  const rows = csvRows(text);
  const h = rows.findIndex((r) => r.some((c) => plain(c).trim() === "ten san pham") && r.some((c) => /gia gom can/.test(plain(c))));
  if (h < 0) return null;
  const head = rows[h].map((c) => plain(c).trim());
  const col = (re, fb) => { const i = head.findIndex((c) => re.test(c)); return i >= 0 ? i : fb; };
  const cName = col(/^ten san pham/, 1), cLink = col(/^link san pham/, 3), cJpy = col(/^gia yen/, 4), cVnd = col(/^gia gom can/, 5);
  const tidy = (x) => String(x == null ? "" : x).replace(/[ \t]+\n/g, "\n").trim();
  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = tidy(r[cName]);
    if (!name) continue;
    const linkAll = tidy(r[cLink]);
    out.push({ src: "sheet", name, link: (linkAll.match(/https?:\/\/[^\s]+/) || [""])[0], linkAll, jpy: tidy(r[cJpy]), vnd: tidy(r[cVnd]) });
  }
  return out;
}
async function sheetProducts() {
  return cachedList("sheet", async () => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${GD_SHEET_ID()}/export?format=csv&gid=${GD_SHEET_GID()}`, { signal: ac.signal, redirect: "follow" });
      if (!r.ok) return null;
      return parseGiaGomCanCsv(await r.text());
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  });
}
const linkKeysOf = (text) => {
  const keys = new Set();
  const s = String(text || "");
  for (const m of s.matchAll(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/gi)) keys.add("a:" + m[1].toLowerCase());
  if (!keys.size) for (const m of s.matchAll(/https?:\/\/[^\s]+/gi)) keys.add("u:" + m[0].split("?")[0].replace(/\/+$/, "").toLowerCase());
  return keys;
};
// -> { items: sản phẩm khớp (ưu tiên khớp theo link), urls: link khách gửi đã khớp trong bảng } hoặc null nếu không đọc được bảng
export async function findSheetProducts(message, mt) {
  const list = await sheetProducts();
  if (!list) return null;
  const mk = linkKeysOf(message);
  const byLink = [];
  const urls = [];
  if (mk.size) {
    for (const it of list) {
      const ik = linkKeysOf(it.linkAll);
      if ([...ik].some((k) => mk.has(k))) byLink.push(it);
    }
    if (byLink.length) for (const u of extractUrls(message)) if ([...linkKeysOf(u)].some((k) => byLink.some((it) => linkKeysOf(it.linkAll).has(k)))) urls.push(u);
  }
  const byName = list
    .map((it) => ({ it, s: scoreText(mt, it.name) }))
    .filter((x) => x.s >= 1.2 && !byLink.includes(x.it))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it);
  return { items: [...byLink, ...byName].slice(0, 3), urls, linkMatched: byLink.length };
}

// ---------- đọc ảnh khách gửi (Discord) ----------
const VISION_PROMPT = [
  "Đây là ảnh khách gửi cho shop bán đồ Nhật order. Hãy đọc kỹ ảnh và trả lời đúng định dạng dưới đây, mỗi mục một dòng, không nói gì thêm:",
  "Loại ảnh: (ảnh sản phẩm / ảnh chụp bài đăng / ảnh chụp trang web / ảnh chụp tin nhắn / khác)",
  "Tên sản phẩm: (viết bằng tiếng Việt theo cách người bán đồ Nhật hay gọi)",
  "Hãng: ...",
  "Mã sản phẩm nhìn thấy: ...",
  "Chữ nhìn thấy trên ảnh: (chép nguyên chữ tiếng Nhật/Anh quan trọng)",
  "Giá ghi trên ảnh: ...",
  "Màu/size/số lượng/nội dung tin nhắn trong ảnh: ...",
  "Điều nào không thấy rõ thì ghi \"không rõ\". Tuyệt đối không đoán.",
].join("\n");
export function okImageUrl(u) {
  try {
    const h = new URL(u);
    return h.protocol === "https:" && /(^|\.)(discordapp\.com|discordapp\.net|discord\.com)$/i.test(h.hostname);
  } catch { return false; }
}
function visionText(out) {
  if (typeof out === "string") return out;
  if (!out) return "";
  const c = out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content;
  const parts = Array.isArray(c) ? c.map((x) => (typeof x === "string" ? x : x.text || "")).join("\n") : c;
  return String(out.response || parts || (out.result && out.result.response) || "").trim();
}
export async function describeImages(urls) {
  const env = cfEnv();
  if (!env.AI) return { texts: [], error: "Chưa gắn AI" };
  const texts = [];
  let error = "";
  for (const url of urls.filter(okImageUrl).slice(0, 2)) {
    let got = "";
    for (const model of [MODEL_VISION, MODEL_VISION_ALT]) {
      try {
        const out = await env.AI.run(model, {
          messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url } }] }],
          max_tokens: 450,
          temperature: 0.1,
        });
        got = visionText(out);
        if (got) break;
      } catch (e) {
        error = String((e && e.message) || e).slice(0, 160);
      }
    }
    if (got) texts.push(got);
  }
  return { texts, error };
}
// Bỏ dòng "Giá ghi trên ảnh" khỏi phần dùng để tìm sản phẩm / tự tính giá (chữ trong ảnh có thể đọc sai).
export const forSearch = (t) => String(t || "").split("\n").filter((l) => !/^\s*gi[áa] ghi tr[êe]n ảnh/i.test(l)).join("\n");

export async function findContext(message) {
  const mt = tokens(message).filter((w) => !STOP.has(w));
  const [giadung, replies, sheet] = await Promise.all([loadDocField("gomcan/data.json", "$.giadung"), loadDocField("replies/data.json", "$.replies"), findSheetProducts(message, mt).catch(() => null)]);
  // Ưu tiên bảng Google Sheet (mới nhất); không đọc được bảng thì dùng dữ liệu đã lưu trong web.
  const products = sheet
    ? sheet.items
    : (giadung || [])
        .filter((it) => !it.gone && it.name)
        .map((it) => ({ it, s: scoreText(mt, it.name) }))
        .filter((x) => x.s >= 1.2)
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .map((x) => x.it);
  const sheetFailed = !sheet;
  const knowledge = (replies || [])
    .filter((r) => !r.private && r.content)
    .map((r) => ({ r, s: scoreText(mt, `${r.title} ${r.group}`) + scoreText(mt, r.content) * 0.5 }))
    .filter((x) => x.s >= 0.9)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.r);
  // Khách hỏi size / nói chiều cao cân nặng: luôn đưa bảng size ở trang Tra cứu nhanh (nhóm "Size") cho AI,
  // kèm bảng riêng của hãng nếu khách nhắc tên hãng (Nike, Adidas, Puma).
  if (/size|\bcm\b|\d\s?kg|kí|nặng|chiều cao|cao\s?\d|mặc|vừa|rộng|chật/i.test(String(message))) {
    const all = (replies || []).filter((r) => !r.private && r.content && r.group === "Size");
    const brand = (r) => /nike|adidas|puma/i.exec(r.title);
    const picks = all.filter((r) => !brand(r) || new RegExp(brand(r)[0], "i").test(String(message)));
    for (const r of picks) if (!knowledge.includes(r)) knowledge.unshift(r);
  }
  // Mẫu câu có sẵn của shop (từ file viết tắt Unikey)
  const kb = SHOP_KB.map((m) => ({ m, s: scoreText(mt, `${m.title} ${m.kw}`) * 1.2 + scoreText(mt, m.text) * 0.4 }))
    .filter((x) => x.s >= 0.8)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.m);
  const yq = await yenQuote(message);
  const [links, closet, market] = await Promise.all([readLinks(message, new Set((sheet && sheet.urls) || [])), findClosetStock(message).catch(() => []), findSupermarket(message).catch(() => [])]);
  return { products, knowledge, kb, yq, links, closet, market, sheetFailed };
}

// ---------- gọi AI ----------
export function buildMessages({ message, brain, ctx, imageText = "", imageFailed = false }) {
  const lessons = pickLessons(brain.lessons, message).map((x) => `${x.i + 1}. ${x.l.text}`).join("\n");
  const prods = ctx.products
    .map((it) => {
      if (it.src === "sheet") {
        return [`- Tên: ${it.name}`, it.link ? `  Link sản phẩm: ${it.link}` : "", it.jpy ? `  Giá Yên (ô trong bảng): ${String(it.jpy).slice(0, 300)}` : "", it.vnd ? `  Giá gồm cân (ô trong bảng giá, dùng đúng số này; ô nhiều dòng là giá theo size/loại): ${String(it.vnd).slice(0, 700)}` : "  Ô giá gồm cân đang trống."].filter(Boolean).join("\n");
      }
      const q = productQuote(it);
      const lines = [`- Tên: ${it.name}`, q ? `  Giá (đã tính sẵn, dùng đúng số này): ${q}` : "  Chưa có giá gồm cân trong dữ liệu."];
      if (it.productNote) lines.push(`  Ghi chú sản phẩm: ${String(it.productNote).slice(0, 500)}`);
      if (it.consultNote) lines.push(`  Ghi chú tư vấn: ${String(it.consultNote).slice(0, 600)}`);
      return lines.join("\n");
    })
    .join("\n");
  const know = ctx.knowledge.map((r) => `- [${r.group}] ${r.title}:\n${String(r.content).slice(0, 1200)}`).join("\n");
  const kbText = (ctx.kb || []).map((m) => `- ${m.title}:\n${String(m.text).slice(0, 700)}`).join("\n");
  const yqText = ctx.yq ? `- Giá quần áo/hàng order tính từ giá Yên ${ctx.yq.yen} (tỷ giá ${ctx.yq.rate}${ctx.yq.disc ? `, giảm ${ctx.yq.disc}%` : ""}), câu báo giá dùng đúng nguyên văn: ${ctx.yq.line}` : "";
  const lkText = (ctx.links || [])
    .map((x) => (x.error ? `- ${x.url} → KHÔNG đọc được giá (${x.error}). Phải thêm [CẦN CHỦ SHOP KIỂM TRA: giá Yên của link này].` : `- ${x.url}${x.title ? ` (${x.title})` : ""} → giá đọc từ trang ¥${x.yen}${x.varies ? ` đến ¥${x.max} (giá khác nhau theo size/màu)` : ""}, tỷ giá ${x.rate}, câu báo giá nguyên văn: ${x.line}${x.varies ? " — nhớ nhắc chủ shop kiểm tra giá theo size/màu" : ""}`))
    .join("\n");
  const stockText = [
    (ctx.closet || []).length ? "HÀNG CÓ SẴN THỜI TRANG (tab Hàng closet sẵn):\n" + ctx.closet.map((x) => x.text).join("\n") : "",
    (ctx.market || []).length ? "HÀNG SẴN SIÊU THỊ (tab Giá siêu thị):\n" + ctx.market.map((x) => x.text).join("\n") : "",
  ].filter(Boolean).join("\n");
  const hasQuote = !!(ctx.yq || (ctx.links || []).some((x) => !x.error && x.line));
  const system = [
    "Bạn là nhân viên bán hàng đồ Nhật order của shop Hanaichi, đang soạn câu trả lời khách để CHỦ SHOP đọc lại rồi mới gửi.",
    "Mặc định xưng \"em\", gọi khách là \"chị\" (trừ khi bài học dưới đây dặn khác). Viết tiếng Việt tự nhiên, thân thiện, ngắn gọn như đang nhắn tin, không dùng markdown.",
    "QUY TẮC BẮT BUỘC:",
    "1. Chỉ dùng thông tin có trong phần \"Bài học\", \"Sản phẩm khớp\" và \"Kiến thức shop\" bên dưới. KHÔNG tự bịa giá, size, chất liệu, thời gian giao hàng, chính sách.",
    "2. Giá chỉ được lấy đúng từ dòng \"Giá\" của sản phẩm khớp, hoặc từ phần \"HÀNG CÓ SẴN KHỚP\" / \"GIÁ ĐÃ TÍNH SẴN\" / \"GIÁ TỰ ĐỌC TỪ LINK\", hoặc giá chủ shop ghi thẳng trong tin. Không tự tính hay làm tròn.",
    "3. Nếu thiếu thông tin để trả lời chắc chắn, vẫn soạn phần trả lời được, và cuối câu thêm đúng 1 dòng: [CẦN CHỦ SHOP KIỂM TRA: điều còn thiếu].",
    "4. Chỉ trả về nội dung tin nhắn gửi khách, không giải thích thêm.",
    imageText || imageFailed ? "8. Khách có gửi ảnh. Nội dung đọc từ ảnh do máy đoán nên có thể sai. Chỉ dùng nó để xác định sản phẩm; giá chỉ lấy từ bảng/dữ liệu shop. Nếu sản phẩm khớp trong dữ liệu không chắc chắn đúng với ảnh, hoặc không đọc được ảnh, thì hỏi khách xin tên hoặc link sản phẩm và thêm [CẦN CHỦ SHOP KIỂM TRA: xác nhận đúng sản phẩm trong ảnh]." : "",
    ctx.products.some((x) => x.src === "sheet") ? "7. Ô trong bảng giá có thể kèm ghi chú nội bộ cho nhân viên (ví dụ \"nhập về bán sẵn rồi nên lưu đơn thì lưu sẵn siêu thị\", \"theo giá sẵn\"). Đó là ghi chú cho chủ shop, KHÔNG chép nguyên văn cho khách; chỉ lấy phần giá và điều khách cần biết, và nếu ghi chú nói là hàng bán sẵn thì thêm [CẦN CHỦ SHOP KIỂM TRA: hàng có sẵn, xem giá ở tab siêu thị/closet]. Báo giá theo mẫu: Dạ + tên sản phẩm + giá order + (từng size/loại kèm giá gồm cân) + ạ." : "",
    "6. Tư vấn size: dùng đúng bảng size trong phần KIẾN THỨC SHOP (theo cân nặng và theo hãng). Nêu size theo bảng, nếu khách muốn mặc thoải mái thì gợi ý thêm size lớn hơn 1 cỡ. Nếu chưa biết khách nam hay nữ thì thêm [CẦN CHỦ SHOP KIỂM TRA: khách nam hay nữ].",
    hasQuote ? "5. QUAN TRỌNG: phần link sản phẩm và câu báo giá \"Mã này ... + KG ạ\" đã được chương trình ghép sẵn ở ĐẦU tin gửi khách. Bạn KHÔNG được viết lại link, giá hay câu báo giá. Chỉ viết phần tiếp theo: tư vấn size/màu theo chiều cao cân nặng khách nói (nếu có), rồi một câu kết mời khách cân nhắc và chốt để cuộc trò chuyện tiếp tục. Không chào hỏi mở đầu." : "",
    lessons ? `\nBÀI HỌC CHỦ SHOP ĐÃ DẠY:\n${lessons}` : "",
    yqText ? `\nGIÁ ĐÃ TÍNH SẴN TỪ GIÁ YÊN (dùng đúng câu này, không tự tính lại):\n${yqText}` : "",
    stockText ? `\nHÀNG CÓ SẴN KHỚP VỚI TIN KHÁCH (lấy từ dữ liệu web, dùng đúng giá, câu báo giá mẫu và số lượng còn; size khách hỏi mà HẾT thì nói hết và gợi ý size còn):\n${stockText}` : "",
    lkText ? `\nGIÁ TỰ ĐỌC TỪ LINK KHÁCH GỬI (dùng đúng câu giá này cho từng link, mỗi link một mục; nếu tin cũng có giá chủ shop tự ghi thì ưu tiên giá chủ shop):\n${lkText}` : "",
    prods ? `\nSẢN PHẨM KHỚP VỚI TIN KHÁCH:\n${prods}` : "\nKhông tìm thấy sản phẩm nào khớp trong dữ liệu.",
    know ? `\nKIẾN THỨC SHOP:\n${know}` : "",
    kbText ? `\nMẪU CÂU CỦA SHOP (chủ shop hay dùng; giữ đúng ý và giọng văn, viết đầy đủ chữ thay cho viết tắt e/a/c, sửa cho khớp tình huống):\n${kbText}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `Tin nhắn của khách:\n${message || "(khách chỉ gửi ảnh, không có chữ)"}${imageText ? `\n\nNỘI DUNG MÁY ĐỌC TỪ ẢNH KHÁCH GỬI (có thể sai):\n${imageText}` : ""}${imageFailed ? "\n\n(Khách có gửi ảnh nhưng máy không đọc được ảnh.)" : ""}` },
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
