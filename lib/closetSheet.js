// lib/closetSheet.js — CHỈ dùng ở server.
// Đọc file Google Sheet "Hàng CLOSET có sẵn Hanaichi" (xuất CSV) rồi ĐỐI CHIẾU
// với danh sách Closet trong app THEO MÃ SP (cột B):
//   - Mã có ở cả hai: cập nhật Giá lẻ, SL, Đã bán, Còn lại theo sheet.
//   - Mã mới trong sheet: thêm vào sản phẩm cùng nhóm (hoặc tạo sản phẩm mới).
//   - Mã không còn trong sheet: đánh dấu "không còn trong sheet", số còn lại = 0
//     (KHÔNG xoá, để không mất ảnh/ghi chú).
// Không đụng tới: Giá CTV, ảnh, tên, mã (nhãn) và mọi chỉnh sửa tay khác.
import fs from "fs";

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

export const keyOf = (label) => String(label || "").replace(/\s+/g, " ").trim().toLowerCase();

// -> [{ key, label, block, blockName, price, qty, sold, remaining }]
export function parseClosetRows(text) {
  const rows = parseCsv(text);
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
    out.push({
      key: keyOf(b),
      label: b,
      block,
      blockName,
      price: num(r[3]),
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

// closet: danh sách sản phẩm đang có trong app. seedIds: id các sản phẩm gốc (đã nhập từ sheet).
export function mergeClosetFromSheet(closet, recs, { seedIds = new Set(), deletedIds = [], deletedVariantIds = [] } = {}) {
  const delP = new Set(deletedIds);
  const delV = new Set(deletedVariantIds);
  const list = (closet || []).map((p) => ({ ...p, variants: (p.variants || []).map((v) => ({ ...v })) }));
  const index = new Map(); // key -> { p, v }
  for (const p of list) for (const v of p.variants) {
    const k = keyOf(v.label);
    if (k && !index.has(k)) index.set(k, { p, v });
  }
  const sheetKeys = new Set(recs.map((r) => r.key));
  const sum = { updated: 0, added: 0, newProducts: 0, gone: 0, back: 0 };

  // 1) Mã có ở cả hai -> cập nhật số liệu.
  for (const r of recs) {
    const hit = index.get(r.key);
    if (!hit) continue;
    const v = hit.v;
    const changed = v.qty !== r.qty || v.sold !== r.sold || v.remaining !== r.remaining || (r.price != null && v.price !== r.price) || v.src !== "sheet" || !!v.gone;
    if (!changed) continue;
    if (v.gone) sum.back++;
    v.qty = r.qty;
    v.sold = r.sold;
    v.remaining = r.remaining;
    if (r.price != null) v.price = r.price;
    v.src = "sheet";
    delete v.gone;
    sum.updated++;
  }

  // 2) Mã mới trong sheet.
  const newByBlock = new Map();
  let lastCategory = (list[0] && list[0].category) || "Khác";
  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    const hit = index.get(r.key);
    if (hit) { lastCategory = hit.p.category || lastCategory; continue; }
    // tìm sản phẩm trong app chứa các mã cùng khối với mã này
    const votes = new Map();
    for (const s of recs) {
      if (s.block !== r.block) continue;
      const h = index.get(s.key);
      if (h) votes.set(h.p, (votes.get(h.p) || 0) + 1);
    }
    let target = null;
    let best = 0;
    for (const [p, c] of votes) if (c > best) { best = c; target = p; }
    const mk = (pid) => ({ id: `${pid}-s${hash(r.key)}`, label: r.label, price: r.price == null ? 0 : r.price, qty: r.qty, sold: r.sold, remaining: r.remaining, src: "sheet" });
    if (target) {
      const nv = mk(target.id);
      if (delV.has(`${target.id}:${nv.id}`)) continue;
      target.variants.push(nv);
      index.set(r.key, { p: target, v: nv });
      sum.added++;
    } else {
      let np = newByBlock.get(r.block);
      if (!np) {
        const pid = `sheet-${hash(r.blockName + r.key)}`;
        if (delP.has(pid)) { newByBlock.set(r.block, { skip: true }); continue; }
        np = { id: pid, category: lastCategory, name: r.blockName.trim(), image: "", variants: [], src: "sheet" };
        newByBlock.set(r.block, np);
        list.push(np);
        sum.newProducts++;
      }
      if (np.skip) continue;
      const nv = mk(np.id);
      np.variants.push(nv);
      index.set(r.key, { p: np, v: nv });
      sum.added++;
    }
  }

  // 3) Mã gốc từ sheet nhưng nay không còn -> đánh dấu, không xoá.
  for (const p of list) {
    const origin = seedIds.has(p.id) || p.src === "sheet";
    if (!origin) continue;
    for (const v of p.variants) {
      const k = keyOf(v.label);
      if (!k || sheetKeys.has(k)) continue;
      if (seedIds.has(p.id) || v.src === "sheet") {
        if (!v.gone || v.remaining !== 0) { v.gone = true; v.remaining = 0; v.src = "sheet"; sum.gone++; }
      }
    }
  }
  return { closet: list, summary: sum };
}
