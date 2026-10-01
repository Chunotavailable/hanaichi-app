// lib/thietbiSheet.js — CHỈ dùng ở server.
// Đối chiếu tab "Thiết bị bếp & vệ sinh" với Google Sheet "Thông tin thiết bị bếp và vệ sinh".
// Chỉ phát hiện SẢN PHẨM MỚI (theo Mã sản phẩm, không có mã thì theo tên) và đưa vào danh sách chờ chủ shop duyệt.
// Mọi thứ khác (giá, mô tả, sản phẩm không còn...) bỏ qua.
import fs from "fs";
import * as XLSX from "xlsx";
import { parseCsv } from "./closetSheet";

const SHEET_ID = process.env.THIETBI_SHEET_ID || "1uiRqJREl5qmeR_18eGAeVWc29B8Yt5b4tMPLZxLgR2k";

const plain = (s) =>
  String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/\s+/g, " ").trim();
const tidy = (s) => String(s == null ? "" : s).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();

function hasHeader(rows) {
  const head = rows.slice(0, 40).flat().map(plain);
  return head.includes("khu vuc") && head.includes("ma san pham");
}
function pickRows(wb) {
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: true });
    if (hasHeader(rows)) return rows;
  }
  return null;
}

export async function loadThietbiRows() {
  const f = process.env.HANAICHI_THIETBI_FILE; // chỉ để thử nghiệm
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
    if (!rows) throw new Error("Không tìm thấy bảng thiết bị (cột KHU VỰC, MÃ SẢN PHẨM...) trong file");
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

// -> [{ area, name, code, brand, size, material, price, link, highlights, installNotes }]
export function parseThietbiRows(rows) {
  const h = rows.findIndex((r) => r.some((c) => plain(c) === "khu vuc") && r.some((c) => plain(c) === "ma san pham"));
  if (h < 0) return [];
  const head = rows[h].map(plain);
  const col = (re, fb) => {
    const i = head.findIndex((c) => re.test(c));
    return i >= 0 ? i : fb;
  };
  const c = {
    area: col(/^khu vuc/, 0), name: col(/^ten san pham/, 1), code: col(/^ma san pham/, 2), brand: col(/^thuong hieu/, 3),
    size: col(/^kich thuoc/, 4), material: col(/^chat lieu/, 5), price: col(/^gia ban/, 6), link: col(/^link/, 7),
    highlights: col(/^uu diem/, 8), installNotes: col(/^luu y/, 9),
  };
  const out = [];
  let area = "";
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    const a = tidy(r[c.area]);
    if (a) area = a; // ô "Khu vực" chỉ ghi ở dòng đầu của cả nhóm
    const name = tidy(r[c.name]);
    if (!name) continue;
    out.push({
      area, name, code: tidy(r[c.code]), brand: tidy(r[c.brand]), size: tidy(r[c.size]), material: tidy(r[c.material]),
      price: tidy(r[c.price]), link: tidy(r[c.link]), highlights: tidy(r[c.highlights]), installNotes: tidy(r[c.installNotes]),
    });
  }
  return out;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const codeKey = (s) => plain(s).replace(/[^a-z0-9]/g, "");
const recKey = (r) => (codeKey(r.code) ? "c:" + codeKey(r.code) : "n:" + plain(r.name.split("\n")[0]));

// Chỉ đề xuất sản phẩm MỚI. Đã có (theo mã hoặc tên), đã xoá tay, hoặc đã bỏ qua -> không nhắc.
export function mergeThietbiFromSheet(list, recs, { deletedItems = [], deletedIds = [], approved = {}, dismissed = [] } = {}) {
  const dis = new Set(dismissed);
  const okNew = new Set(approved.new || []);
  const items = list.map((it) => ({ ...it }));
  const delIds = new Set(deletedIds);
  const known = (it) => [codeKey(it.code), plain(it.name)];
  const have = new Set();
  [...items, ...deletedItems].forEach((it) => known(it).forEach((k) => k && have.add(k)));
  const log = [];
  const proposals = [];
  const sum = { updated: 0, added: 0, gone: 0, back: 0 };
  const seen = new Set();
  for (const r of recs) {
    const key = recKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    if ((codeKey(r.code) && have.has(codeKey(r.code))) || have.has(plain(r.name))) continue;
    if (dis.has(`new:${key}`)) continue;
    const id = `ts-${hash(key)}`;
    if (delIds.has(id)) continue;
    if (!okNew.has(key)) {
      proposals.push({ k: "new", key, p: r.name.split("\n")[0].slice(0, 100), code: r.code, area: r.area, price: r.price.split("\n")[0].slice(0, 60) });
      continue;
    }
    items.push({ id, area: r.area, name: r.name, code: r.code, brand: r.brand, size: r.size, material: r.material, price: r.price, link: r.link, highlights: r.highlights, installNotes: r.installNotes, src: "sheet" });
    sum.added++;
    log.push({ k: "new", p: r.name.split("\n")[0].slice(0, 100), to: r.code || "" });
  }
  return { list: items, summary: sum, items: log, proposals };
}
