// lib/dysonSheet.js
// Đối chiếu tab "Dyson" (Giá gồm cân) với tab "SO SÁNH CÁC DÒNG HÚT BỤI DYSON" trong Google Sheet
// "BẢNG GIÁ GỒM CÂN" (cùng file với Gia dụng + TPCN). Mỗi dòng của tab đó là 1 bài: cột A = tiêu đề,
// cột B = nội dung. Đây là nội dung chữ do sếp viết, không ai sửa trong app nên file là nguồn chuẩn:
// bài mới / bài sửa chữ đều tự cập nhật, bài bị xoá khỏi file thì biến mất khỏi app.
import * as XLSX from "xlsx";
import { isNodeBuf } from "./closetSheet";

export { SHEET_ID } from "./giadungSheet";

const plain = (s) =>
  String(s == null ? "" : s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const tidy = (s) => String(s == null ? "" : s).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Đọc file .xlsx -> các dòng của tab Dyson, hoặc null nếu không thấy tab.
export function rowsFromXlsx(buf) {
  const wb = XLSX.read(buf, { type: isNodeBuf(buf) ? "buffer" : "array" });
  const name = wb.SheetNames.find((n) => plain(n).includes("dyson"));
  if (!name) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: "", blankrows: true });
}

// -> [{ id, title, body }]
export function parseDysonRows(rows) {
  const out = [];
  for (const r of rows) {
    const title = tidy(r[0]);
    const body = tidy(r[1]);
    if (!title || !body) continue;
    out.push({ id: `dy-${hash(plain(title))}`, title, body });
  }
  return out;
}

// Danh sách trong app luôn khớp đúng thứ tự + nội dung của file.
export function mergeDysonFromSheet(list, recs) {
  const old = new Map((list || []).map((x) => [x.id, x]));
  const log = [];
  const sum = { updated: 0, added: 0, gone: 0 };
  for (const r of recs) {
    const cur = old.get(r.id);
    if (!cur) {
      sum.added++;
      log.push({ k: "new", p: r.title.slice(0, 100) });
    } else if (cur.body !== r.body) {
      sum.updated++;
      log.push({ k: "chg", p: r.title.slice(0, 100) });
    }
  }
  const keep = new Set(recs.map((r) => r.id));
  for (const x of list || []) {
    if (!keep.has(x.id)) {
      sum.gone++;
      log.push({ k: "gone", p: String(x.title || "").slice(0, 100) });
    }
  }
  return { list: recs.map(({ id, title, body }) => ({ id, title, body })), summary: sum, items: log, proposals: [] };
}
