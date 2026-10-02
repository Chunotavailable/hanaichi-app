// lib/giadungSheet.js — CHỈ dùng ở server.
// Đối chiếu tab "Gia dụng + TPCN" (Giá gồm cân) với Google Sheet "BẢNG GIÁ GỒM CÂN".
// Chỉ lấy: Tên sản phẩm, Link sản phẩm, Giá Yên, Giá gồm cân. KHÔNG lấy ảnh và link bài đăng.
// Mọi thay đổi (giá đổi, sản phẩm mới, sản phẩm không còn) chỉ tạo "đề xuất" chờ chủ shop duyệt.
import fs from "fs";
import * as XLSX from "xlsx";
import { parseCsv, isNodeBuf } from "./closetSheet";

export const SHEET_ID = process.env.GIADUNG_SHEET_ID || "1veT2iJyBcVh8xeZDHCX671z4gVSzfdYI6NPGzeelbJs";

const plain = (s) =>
  String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const tidy = (s) => String(s == null ? "" : s).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();

// Đọc bảng từ file .xlsx (Buffer hoặc ArrayBuffer/Uint8Array) -> các dòng, hoặc null nếu không thấy bảng.
export function rowsFromXlsx(buf) {
  return pickRows(XLSX.read(buf, { type: isNodeBuf(buf) ? "buffer" : "array" }));
}
function pickRows(wb) {
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: true });
    const head = rows.slice(0, 6).flat().map(plain).join("|");
    if (head.includes("ten san pham") && head.includes("gia gom can") && head.includes("link san pham")) return rows;
  }
  return null;
}

export async function loadGiadungRows() {
  const f = process.env.HANAICHI_GIADUNG_FILE; // chỉ để thử nghiệm
  if (f) {
    if (/\.xlsx$/i.test(f)) return pickRows(XLSX.read(fs.readFileSync(f), { type: "buffer" })) || [];
    return parseCsv(fs.readFileSync(f, "utf8"));
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`, { signal: ctrl.signal, redirect: "follow" });
    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok || buf.slice(0, 2).toString() !== "PK") throw new Error("Không đọc được file Google Sheet (kiểm tra quyền chia sẻ: ai có link đều xem được)");
    const rows = pickRows(XLSX.read(buf, { type: "buffer" }));
    if (!rows) throw new Error("Không tìm thấy tab Gia dụng/TPCN (cột TÊN SẢN PHẨM, LINK SẢN PHẨM, GIÁ GỒM CÂN) trong file");
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

// -> [{ name, link, jpy, vnd }]
export function parseGiadungRows(rows) {
  let h = rows.findIndex((r) => r.some((c) => plain(c) === "ten san pham"));
  if (h < 0) return [];
  const head = rows[h].map(plain);
  const col = (re, fb) => {
    const i = head.findIndex((c) => re.test(c));
    return i >= 0 ? i : fb;
  };
  const cName = col(/^ten san pham/, 0);
  const cLink = col(/^link san pham/, 2);
  const cJpy = col(/^gia yen/, 3);
  const cVnd = col(/^gia gom can/, 4);
  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = tidy(r[cName]);
    if (!name) continue;
    const linkAll = tidy(r[cLink]);
    const first = (linkAll.match(/https?:\/\/[^\s]+/) || [linkAll])[0]; // app chỉ lưu 1 link (link đầu tiên)
    out.push({ name, link: first, linkAll, jpy: tidy(r[cJpy]), vnd: tidy(r[cVnd]) });
  }
  return out;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Khoá nhận diện theo LINK sản phẩm (ưu tiên mã Amazon ASIN), có thể nhiều link trong 1 ô.
export function linkKeys(link) {
  const keys = new Set();
  const s = String(link || "");
  for (const m of s.matchAll(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/gi)) keys.add("a:" + m[1].toLowerCase());
  if (!keys.size) for (const m of s.matchAll(/https?:\/\/[^\s]+/gi)) keys.add("u:" + m[0].split("?")[0].replace(/\/+$/, "").toLowerCase());
  return keys;
}
const tokens = (s) => new Set(plain(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length > 1));
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n / (a.size + b.size - n);
}

const nums = (s) => (String(s || "").replace(/(\d)[.,](?=\d{3}\b)/g, "$1").match(/\d+/g) || []);
// App có thể đang lưu bản TÓM TẮT của ô nhiều dòng (chi tiết nằm trong ghi chú) nên chỉ coi là "khác"
// khi thật sự khác: ô phức tạp thì so theo các con số có sẵn trong dữ liệu app.
function sameField(k, it, r) {
  const a = it[k] || "";
  const b = r[k] || "";
  if (plain(a) === plain(b)) return true;
  if (k === "name") {
    const pa = plain(a), pb = plain(b);
    return pa.includes(pb) || pb.includes(pa) || jaccard(tokens(a), tokens(b)) >= 0.6;
  }
  if (k === "link") {
    const ka = linkKeys(a), kb = linkKeys(b);
    if (!kb.size) return !ka.size;
    return [...ka].every((x) => kb.has(x)) && (ka.size > 0 || !kb.size);
  }
  // giá: ô phức tạp (nhiều dòng / dài) -> cùng các số là coi như không đổi
  const complex = /\n/.test(b) || b.length > 25;
  const nb = nums(b);
  if (complex && !nb.length && /xem ghi chu|nhieu muc gia|\(xem/.test(plain(a))) return true;
  if (complex && nb.length) {
    const hay = new Set(nums(`${it.jpy} ${it.vnd} ${it.productNote || ""}`));
    return nb.every((n) => hay.has(n));
  }
  return false;
}

const FIELDS = ["name", "link", "jpy", "vnd"];
export const FIELD_NAMES = { name: "Tên", link: "Link", jpy: "Giá Yên", vnd: "Giá gồm cân" };

export function mergeGiadungFromSheet(list, recs, { seedIds = new Set(), deletedIds = [], deletedItems = [], approved = {}, dismissed = [] } = {}) {
  const dis = new Set(dismissed);
  const okChg = new Set(approved.chg || []);
  const okNew = new Set(approved.new || []);
  const okGone = new Set(approved.gone || []);
  const items = list.map((it) => ({ ...it }));
  const delIds = new Set(deletedIds);
  const log = [];
  const proposals = [];
  const sum = { updated: 0, added: 0, gone: 0, back: 0 };

  // 1) ghép từng dòng sheet với 1 sản phẩm trong app
  const used = new Set();
  const itemKeys = items.map((it) => linkKeys(it.link));
  const match = new Map(); // rec index -> item index
  const tryMatch = (ri, pred) => {
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      if (pred(items[i], i)) { used.add(i); match.set(ri, i); return true; }
    }
    return false;
  };
  recs.forEach((r, ri) => {
    const rk = linkKeys(r.linkAll || r.link);
    if (rk.size) tryMatch(ri, (it, i) => [...rk].some((k) => itemKeys[i].has(k)));
  });
  recs.forEach((r, ri) => {
    if (match.has(ri)) return;
    const n = plain(r.name);
    tryMatch(ri, (it) => plain(it.name) === n);
  });
  recs.forEach((r, ri) => {
    if (match.has(ri)) return;
    const t = tokens(r.name);
    let best = -1, bs = 0.72;
    items.forEach((it, i) => {
      if (used.has(i)) return;
      const s = jaccard(t, tokens(it.name));
      if (s >= bs) { bs = s; best = i; }
    });
    if (best >= 0) { used.add(best); match.set(ri, best); }
  });

  recs.forEach((r, ri) => {
    const rk = [...linkKeys(r.linkAll || r.link)][0] || "n:" + plain(r.name);
    const idx = match.get(ri);
    if (idx == null) {
      // sản phẩm mới
      if (dis.has(`new:${rk}`)) return;
      // đã bị chính chủ shop xoá trước đó (sản phẩm gốc) thì không coi là mới
      const rkeys = linkKeys(r.linkAll || r.link);
      const rt = tokens(r.name);
      if (deletedItems.some((d) => [...linkKeys(d.link)].some((k) => rkeys.has(k)) || plain(d.name) === plain(r.name) || jaccard(rt, tokens(d.name)) >= 0.72)) return;
      const id = `gs-${hash(rk)}`;
      if (delIds.has(id)) return;
      if (!okNew.has(rk)) {
        proposals.push({ k: "new", key: rk, p: r.name.split("\n")[0].slice(0, 100), jpy: r.jpy, vnd: r.vnd });
        return;
      }
      items.push({ id, name: r.name, link: r.link, jpy: r.jpy, vnd: r.vnd, orderType: /theo gia san|ban san/.test(plain(r.vnd)) ? "ready" : "order", image: "", favorite: false, src: "sheet" });
      sum.added++;
      log.push({ k: "new", p: r.name.split("\n")[0].slice(0, 100), to: r.vnd });
      return;
    }
    // Sản phẩm đã có trong app: bỏ qua (chỉ báo khi có sản phẩm MỚI trong file).
  });
  return { list: items, summary: sum, items: log, proposals };
}
