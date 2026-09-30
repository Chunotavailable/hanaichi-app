// lib/sieuthiSheet.js — CHỈ dùng ở server.
// Đọc file Google Sheet gốc "Giá sản phẩm siêu thị Hanaichi" (sheet "TỔNG QUAN
// GIÁ") và đổi thành danh sách sản phẩm cho trang "Giá siêu thị".
// File gốc là nguồn dữ liệu duy nhất: chủ shop sửa trong Google Sheet, web tự
// lấy về — trên web không sửa được. Quy ước trong file:
//   - Dòng bôi ĐỎ (ở cột tên / mã) = hết hàng.
//   - Cột D "Giá bán Social" = giá chính.
//   - Cột H có tiêu đề dạng "SALE 26 -30/9/2026": ô nào trong cột này có giá
//     thì sản phẩm đó được sale trong thời gian ghi ở tiêu đề.
import * as XLSX from "xlsx";
import fs from "fs";

export const SHEET_ID = process.env.SIEUTHI_SHEET_ID || "1lvYNvdZ0wfoxGPXM8vn2UMLLKg_9CtLDCT5pJ8HiikA";
export const SHEET_NAME = "TỔNG QUAN GIÁ";
// Đỏ thuần và đỏ đậm (Google Sheet xuất ra dạng FF0000 / 980000).
const OOS_COLORS = new Set(["FF0000", "980000"]);

// Tải cả file dạng .xlsx (giữ được màu nền ô). File chia sẻ "bất kỳ ai có link
// đều xem được" nên không cần đăng nhập.
export async function fetchWorkbookBuffer() {
  // Chỉ để test trên máy: đọc file .xlsx có sẵn thay vì tải từ Google.
  if (process.env.HANAICHI_SHEET_FILE) return fs.readFileSync(process.env.HANAICHI_SHEET_FILE);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  try {
    const r = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`, { signal: ctrl.signal, redirect: "follow" });
    if (!r.ok) throw new Error(`Google trả lỗi ${r.status}`);
    const type = r.headers.get("content-type") || "";
    if (type.includes("text/html")) throw new Error("Google yêu cầu đăng nhập — kiểm tra file còn chia sẻ 'bất kỳ ai có link'");
    return Buffer.from(await r.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

function clean(s) {
  return String(s).normalize("NFKC").normalize("NFC").replace(/\s+/g, " ").trim();
}
function toNum(v) {
  if (typeof v === "number") return v > 0 ? Math.round(v) : null;
  if (typeof v === "string") {
    const d = v.replace(/[^\d]/g, "");
    return d ? parseInt(d, 10) : null;
  }
  return null;
}
function isOos(cell) {
  const s = cell && cell.s;
  const rgb = s && s.fgColor && s.fgColor.rgb ? String(s.fgColor.rgb).toUpperCase().slice(-6) : "";
  return s && s.patternType === "solid" && OOS_COLORS.has(rgb);
}

const pad = (n) => String(n).padStart(2, "0");
// "SALE 26 -30/9/2026" -> { start: "2026-09-26", end: "2026-09-30" }. Hiểu được
// vài kiểu viết: "26-30/9/2026", "26/9-30/9/2026", "30/9/2026". Không hiểu thì
// trả null (coi như đang sale, hiện đúng chữ ở tiêu đề).
export function parseSaleRange(label) {
  const t = String(label || "");
  let m = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  if (m) return { start: `${m[5]}-${pad(m[2])}-${pad(m[1])}`, end: `${m[5]}-${pad(m[4])}-${pad(m[3])}` };
  m = t.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  if (m) return { start: `${m[4]}-${pad(m[3])}-${pad(m[1])}`, end: `${m[4]}-${pad(m[3])}-${pad(m[2])}` };
  m = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/);
  if (m) return { start: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, end: `${m[3]}-${pad(m[2])}-${pad(m[1])}` };
  return null;
}

export function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: "buffer", cellStyles: true });
  const name = wb.SheetNames.includes(SHEET_NAME) ? SHEET_NAME : wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws || !ws["!ref"]) throw new Error("Không đọc được sheet giá");
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const at = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];

  // Tìm cột theo tiêu đề (dòng 1) để không hỏng khi chèn/đổi chỗ cột.
  const headers = [];
  for (let c = range.s.c; c <= range.e.c; c++) headers[c] = at(0, c) && at(0, c).v != null ? clean(at(0, c).v).toLowerCase() : "";
  const find = (re, fallback) => {
    const i = headers.findIndex((h) => re.test(h));
    return i >= 0 ? i : fallback;
  };
  const C = {
    code: find(/^(f|mã|ma)\b/, 0),
    name: find(/tên sản phẩm/, 1),
    price: find(/social/, 3),
    sale: find(/^sale/, 7),
    linkWeb: find(/link web/, 8),
    linkShopee: find(/link shopee/, 9),
    linkLazada: find(/link lazada/, 10),
  };
  const saleLabel = headers[C.sale] ? clean(at(0, C.sale).v) : "";

  const products = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const nameCell = at(r, C.name);
    if (!nameCell || nameCell.v == null || !String(nameCell.v).trim()) continue;
    const price = at(r, C.price) ? toNum(at(r, C.price).v) : null;
    const saleCell = at(r, C.sale);
    let sale = null;
    let saleText = "";
    if (saleCell && saleCell.v != null && String(saleCell.v).trim() !== "") {
      if (typeof saleCell.v === "number") sale = toNum(saleCell.v);
      else {
        const t = clean(saleCell.v);
        // "299.000", "299k" -> giá sale; chữ khác (VD "mua 2 tặng 1") -> giữ làm thông tin.
        if (/^[\d.,\s]+k?\s*(đ|₫)?$/i.test(t)) sale = /k\s*(đ|₫)?$/i.test(t) ? Math.round(parseFloat(t.replace(/[^\d.,]/g, "").replace(",", ".")) * 1000) : toNum(t);
        else saleText = t;
      }
    }
    const link = (col) => {
      const c = at(r, col);
      const v = c && typeof c.v === "string" ? c.v.trim() : "";
      return /^https?:\/\//i.test(v) ? v : "";
    };
    const p = {
      id: `st-${r + 1}`,
      name: clean(nameCell.v),
      price: price || null,
      sale: sale || null,
      saleText: saleText || "",
      linkWeb: link(C.linkWeb),
      linkShopee: link(C.linkShopee),
      linkLazada: link(C.linkLazada),
      oos: !!(isOos(nameCell) || isOos(at(r, C.code))),
    };
    // Dòng tiêu đề nhóm (VD "QUÀ TẾT") — ngoài tên không có ô nào khác -> bỏ.
    let hasOther = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const x = at(r, c);
      if (c !== C.name && x && x.v != null && String(x.v).trim() !== "") {
        hasOther = true;
        break;
      }
    }
    if (!hasOther) continue;
    for (const k of ["price", "sale", "saleText", "linkWeb", "linkShopee", "linkLazada"]) if (!p[k]) delete p[k];
    if (!p.oos) delete p.oos;
    products.push(p);
  }
  return { products, sale: saleLabel ? { label: saleLabel, ...(parseSaleRange(saleLabel) || {}) } : null };
}
