// pages/api/sieuthi-sync.js
// Lấy bản MỚI NHẤT của file Google Sheet gốc, đổi thành danh sách sản phẩm và
// lưu vào Vercel Blob (để /api/sieuthi trả nhanh). Trang "Giá siêu thị" tự gọi
// khi dữ liệu đã cũ hoặc khi bấm "Cập nhật ngay". Gọi dồn dập cũng không sao:
// có giới hạn tần suất và dùng chung 1 lần tải nếu đang chạy.
import { readDoc, writeDoc } from "../../lib/blobDoc";
import { fetchWorkbookBuffer, parseWorkbook } from "../../lib/sieuthiSheet";
import { CACHE_PATHNAME } from "../../lib/sieuthiConst";

// Tải + đọc file lớn có thể mất vài chục giây.
export const config = { maxDuration: 60 };

const MIN_GAP_MS = 30 * 1000; // không tải lại Google nếu vừa cập nhật chưa tới 30 giây
const running = globalThis.__sieuthiSync || (globalThis.__sieuthiSync = { p: null });

async function syncOnce() {
  const buf = await fetchWorkbookBuffer();
  const parsed = parseWorkbook(buf);
  if (!parsed.products.length) throw new Error("File gốc không có sản phẩm nào — giữ nguyên dữ liệu cũ");
  const doc = { ...parsed, updatedAt: new Date().toISOString(), source: "sheet" };
  await writeDoc(CACHE_PATHNAME, doc);
  return doc;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    let current = null;
    try {
      const d = await readDoc(CACHE_PATHNAME);
      if (d.exists) current = d.raw;
    } catch {}
    if (current && current.source === "sheet" && current.updatedAt && Date.now() - new Date(current.updatedAt).getTime() < MIN_GAP_MS) {
      return res.status(200).json({ updated: false, updatedAt: current.updatedAt });
    }
    if (!running.p) running.p = syncOnce().finally(() => (running.p = null));
    const doc = await running.p;
    return res.status(200).json({ updated: true, doc });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Không lấy được file gốc từ Google Sheet" });
  }
}
