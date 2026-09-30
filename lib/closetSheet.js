// lib/closetSheet.js — CHỈ dùng ở server.
// Đọc file Google Sheet "Hàng CLOSET có sẵn Hanaichi" (xuất CSV) rồi ĐỐI CHIẾU
// với danh sách Closet trong app THEO MÃ SP (cột B):
//   - Mã có ở cả hai: cập nhật Giá lẻ, SL, Đã bán, Còn lại theo sheet.
//   - Mã mới trong sheet: thêm vào sản phẩm cùng nhóm (hoặc tạo sản phẩm mới).
//   - Mã không còn trong sheet: đánh dấu "không còn trong sheet", số còn lại = 0
//     (KHÔNG xoá, để không mất ảnh/ghi chú).
// Không đụng tới: Giá CTV, ảnh, tên, mã (nhãn) và mọi chỉnh sửa tay khác.
import fs from "fs";
import * as XLSX from "xlsx";

const SHEET_ID = process.env.CLOSET_SHEET_ID || "1Tiu2VBfxwtACu5wpOTXrNSznoaxBdJj9u3J_WB0uLbc";
const SHEET_GID = process.env.CLOSET_SHEET_GID || "2074280258";

export async function fetchClosetCsv() {
  if (process.env.HANAICHI_CLOSET_FILE) return fs.readFileSync(process.env.HANAICHI_CLOSET_FILE, "utf8"); // chỉ để thử nghiệm
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 40000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    const text = await r.text();
    if (!r.ok || /^\s*<(!doctype|html)/i.test(text)) throw new Error("Không đọc được file Google Sheet (kiểm tra quyền chia sẻ: ai có link đều xem được)");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function isYellow(cell) {
  const st = cell && cell.s;
  const rgb = st && st.fgColor && st.fgColor.rgb ? String(st.fgColor.rgb).toUpperCase().slice(-6) : "";
  if (!/^[0-9A-F]{6}$/.test(rgb)) return false;
  const r = parseInt(rgb.slice(0, 2), 16), g = parseInt(rgb.slice(2, 4), 16), b = parseInt(rgb.slice(4), 16);
  return r >= 225 && g >= 190 && b <= 130 && Math.abs(r - g) <= 70; // vàng (không lấy cam/đỏ/xanh)
}

// Đọc file dạng Excel (xuất từ Google Sheet) -> { rows, yellow:Set("<dòng>") } với dòng 0-based theo rows.
export function readXlsxRows(buf) {
  const wb = XLSX.read(buf, { type: "buffer", cellStyles: true });
  let ws = null;
  for (const name of wb.SheetNames) {
    const w = wb.Sheets[name];
    const head = XLSX.utils.sheet_to_json(w, { header: 1, raw: false, defval: "", range: 0, blankrows: true }).slice(0, 6).flat().join("|").toLowerCase();
    if (head.includes("mã sp") && head.includes("ctv")) { ws = w; break; }
  }
  if (!ws) ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: true });
  const yellow = new Set();
  for (let i = 0; i < rows.length; i++) {
    if (isYellow(ws[XLSX.utils.encode_cell({ r: i, c: 2 })])) yellow.add(i); // cột C = Giá CTV
  }
  return { rows, yellow, colors: true };
}

// Lấy dữ liệu sheet: ưu tiên bản Excel (có màu ô -> nhận ra giá xả), lỗi thì dùng CSV (không có màu).
export async function loadClosetSource() {
  const f = process.env.HANAICHI_CLOSET_FILE;
  if (f) {
    if (/\.xlsx$/i.test(f)) return readXlsxRows(fs.readFileSync(f));
    return { rows: parseCsv(fs.readFileSync(f, "utf8")), yellow: new Set(), colors: false };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`, { signal: ctrl.signal, redirect: "follow" });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok || buf.slice(0, 2).toString() !== "PK") throw new Error("not xlsx");
      return readXlsxRows(buf);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { rows: parseCsv(await fetchClosetCsv()), yellow: new Set(), colors: false };
  }
}

// CSV có ô nhiều dòng (tên sản phẩm xuống dòng) nên phải tự đọc theo chuẩn có dấu "".
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function num(s) {
  const t = String(s == null ? "" : s).trim().replace(/[.,\s]/g, "");
  return /^-?\d+$/.test(t) ? parseInt(t, 10) : null;
}

// Mã gốc của 1 mã biến thể, bỏ phần size (size số 38 / 235 / 25.5, size chữ S M L XL, "38 2/3"...)
// VD "WRS339620U-225 (EU 36 2/3)" -> "WRS339620U"; "FB7920-100-M" -> "FB7920-100".
export function baseCodeOf(label) {
  const raw = String(label || "").trim();
  const m = raw.match(/^(.*?)\s*\(/);
  let code = (m ? m[1] : raw).trim();
  const sz = "(?:XS|S|M|L|XL|XXL|\\d?XL)";
  code = code.replace(new RegExp(`-(?:\\d+(?:[.,]\\d+)?|${sz}|\\d+\\s*/\\s*\\d+|${sz}\\s*/\\s*${sz})$`, "i"), "").trim();
  return code.length >= 5 ? code.toLowerCase() : "";
}

export const keyOf = (label) => String(label || "").replace(/\s+/g, " ").trim().toLowerCase();

// -> [{ key, label, block, blockName, price, qty, sold, remaining }]
export function parseClosetRows(src) {
  const rows = Array.isArray(src) ? src : src.rows;
  const yellow = (!Array.isArray(src) && src.yellow) || new Set();
  const colors = !Array.isArray(src) && !!src.colors;
  const out = [];
  let block = 0;
  let blockName = "";
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const a = (r[0] || "").trim();
    const b = (r[1] || "").trim();
    if (a) { block++; blockName = a; }
    if (!b) continue;
    const qty = num(r[4]);
    const sold = num(r[5]);
    const rem = num(r[6]);
    const q = qty == null ? 0 : qty;
    const s = sold == null ? 0 : sold;
    const ctv = num(r[2]);
    const price = num(r[3]);
    // Ô CTV tô vàng = giá xả: giá bán hiện hành của mã đó là giá xả, không phải Giá lẻ.
    const xa = colors && yellow.has(i) && ctv != null ? ctv : null;
    out.push({
      xa,
      priceKnown: colors,
      key: keyOf(b),
      label: b,
      block,
      blockName,
      price: xa != null ? xa : price,
      lePrice: price,
      qty: q,
      sold: s,
      remaining: rem == null ? Math.max(0, q - s) : rem,
    });
  }
  return out;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Cách xử lý:
//   - Mã có ở cả hai: TỰ cập nhật SL / Đã bán / Còn lại (không đổi giá, ảnh, tên, mã).
//   - Mã mới, sản phẩm mới, mã không còn trong sheet: KHÔNG tự đổi — trả về
//     "candidates" (chờ chủ shop duyệt trong Lịch sử thay đổi).
// closet: danh sách sản phẩm đang có trong app. seedIds: id các sản phẩm gốc (đã nhập từ sheet).
// Cập nhật SỐ LƯỢNG (SL / Đã bán / Còn lại) của mã đang có: áp dụng ngay.
// Mã MỚI và mã KHÔNG CÒN trong sheet: chỉ tạo "đề xuất" (proposals) chờ chủ shop duyệt,
// trừ khi đã được duyệt (approved.add / approved.gone là các key mã).
// dismissed: các đề xuất đã bị bỏ qua ("add:<key>" / "gone:<key>") -> không đề xuất lại.
export function mergeClosetFromSheet(closet, recs, { seedIds = new Set(), deletedIds = [], deletedVariantIds = [], approved = {}, dismissed = [] } = {}) {
  const delP = new Set(deletedIds);
  const delV = new Set(deletedVariantIds);
  const okAdd = new Set(approved.add || []);
  const okGone = new Set(approved.gone || []);
  const okPrice = new Set(approved.price || []);
  const dis = new Set(dismissed);
  const list = (closet || []).map((p) => ({ ...p, variants: (p.variants || []).map((v) => ({ ...v })) }));
  const index = new Map(); // key -> { p, v }
  for (const p of list) for (const v of p.variants) {
    const k = keyOf(v.label);
    if (k && !index.has(k)) index.set(k, { p, v });
  }
  // mã gốc -> sản phẩm đang có (ưu tiên sản phẩm có nhiều mã nhất)
  const baseMap = new Map();
  for (const p of list) for (const v of p.variants) {
    const b = baseCodeOf(v.label);
    if (!b) continue;
    const cur = baseMap.get(b);
    if (!cur || p.variants.length > cur.variants.length) baseMap.set(b, p);
  }
  const sheetKeys = new Set(recs.map((r) => r.key));
  const sum = { updated: 0, added: 0, newProducts: 0, gone: 0, back: 0 };
  const items = []; // nhật ký các thay đổi đã áp dụng
  const proposals = []; // đề xuất chờ duyệt
  const pname = (p) => String(p.name || "").split("\n")[0].trim().slice(0, 90);

  // 1) Mã có ở cả hai -> cập nhật số lượng ngay.
  for (const r of recs) {
    const hit = index.get(r.key);
    if (!hit) continue;
    const v = hit.v;
    const f = {};
    if (v.remaining !== r.remaining) f.remaining = [v.remaining, r.remaining];
    if (v.qty !== r.qty) f.qty = [v.qty, r.qty];
    if (v.sold !== r.sold) f.sold = [v.sold, r.sold];
    // Giá lẻ đổi: không tự đổi, chờ duyệt (đã duyệt thì áp dụng).
    if (r.priceKnown && r.price != null && v.price !== r.price && !dis.has(`price:${r.key}:${r.price}`)) {
      if (okPrice.has(r.key)) f.price = [v.price, r.price];
      else proposals.push({ k: "price", key: r.key, p: pname(hit.p), l: v.label, from: v.price, to: r.price, xa: r.xa != null });
    }
    const real = Object.keys(f).length > 0 || !!v.gone;
    if (!real && v.src === "sheet") continue;
    if (v.gone) { sum.back++; items.push({ k: "back", p: pname(hit.p), l: v.label, to: r.remaining }); }
    else if (real) items.push({ k: "upd", p: pname(hit.p), l: v.label, f });
    v.qty = r.qty;
    v.sold = r.sold;
    v.remaining = r.remaining;
    if (f.price) v.price = r.price;
    v.src = "sheet";
    delete v.gone;
    if (real) sum.updated++;
  }

  // 2) Mã mới trong sheet -> chờ duyệt.
  const newByBlock = new Map();
  let lastCategory = (list[0] && list[0].category) || "Khác";
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    const hit = index.get(r.key);
    if (hit) { lastCategory = hit.p.category || lastCategory; continue; }
    const votes = new Map();
    for (const s of recs) {
      if (s.block !== r.block) continue;
      const h = index.get(s.key);
      if (h) votes.set(h.p, (votes.get(h.p) || 0) + 1);
    }
    let target = null;
    let best = 0;
    for (const [p, c] of votes) if (c > best) { best = c; target = p; }
    // Cùng mã gốc (không tính size) với sản phẩm đã có -> gộp chung sản phẩm đó.
    const rb = baseCodeOf(r.label);
    if (rb && baseMap.get(rb)) target = baseMap.get(rb);
    const kind = target ? "add" : "new";
    if (dis.has(`add:${r.key}`)) continue;
    if (!okAdd.has(r.key)) {
      proposals.push({ k: kind, key: r.key, p: target ? pname(target) : r.blockName.split("\n")[0].trim().slice(0, 90), l: r.label, to: r.remaining, price: r.price });
      continue;
    }
    const mk = (pid) => ({ id: `${pid}-s${hash(r.key)}`, label: r.label, price: r.price == null ? 0 : r.price, qty: r.qty, sold: r.sold, remaining: r.remaining, src: "sheet" });
    if (target) {
      const nv = mk(target.id);
      if (delV.has(`${target.id}:${nv.id}`)) continue;
      target.variants.push(nv);
      index.set(r.key, { p: target, v: nv });
      sum.added++;
      items.push({ k: "add", p: pname(target), l: r.label, to: r.remaining });
    } else {
      const nbKey = rb || `b${r.block}`;
      let np = newByBlock.get(nbKey);
      if (!np) {
        const pid = `sheet-${hash(r.blockName + r.key)}`;
        if (delP.has(pid)) { newByBlock.set(nbKey, { skip: true }); continue; }
        np = { id: pid, category: lastCategory, name: r.blockName.trim(), image: "", variants: [], src: "sheet" };
        newByBlock.set(nbKey, np);
        if (rb) baseMap.set(rb, np);
        list.push(np);
        sum.newProducts++;
      }
      if (np.skip) continue;
      const nv = mk(np.id);
      np.variants.push(nv);
      index.set(r.key, { p: np, v: nv });
      sum.added++;
      items.push({ k: "new", p: pname(np), l: r.label, to: r.remaining });
    }
  }

  // 3) Mã gốc từ sheet nhưng nay không còn -> chờ duyệt (duyệt xong mới đánh dấu, không xoá).
  for (const p of list) {
    if (!(seedIds.has(p.id) || p.src === "sheet")) continue;
    for (const v of p.variants) {
      const k = keyOf(v.label);
      if (!k || sheetKeys.has(k) || v.gone) continue;
      if (!(seedIds.has(p.id) || v.src === "sheet")) continue;
      if (dis.has(`gone:${k}`)) continue;
      if (!okGone.has(k)) {
        proposals.push({ k: "gone", key: k, p: pname(p), l: v.label, was: v.remaining });
        continue;
      }
      items.push({ k: "gone", p: pname(p), l: v.label, was: v.remaining });
      v.gone = true;
      v.remaining = 0;
      v.src = "sheet";
      sum.gone++;
    }
  }
  return { closet: list, summary: sum, items, proposals };
}
