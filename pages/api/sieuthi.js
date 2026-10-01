// pages/api/sieuthi.js
// Trả bảng "Giá siêu thị" cho trang web. Dữ liệu được sao từ file Google Sheet
// gốc (xem lib/sieuthiSheet.js) và lưu tạm trên Vercel Blob để mở trang nhanh;
// việc lấy bản mới từ Google nằm ở /api/sieuthi-sync. Trang này CHỈ ĐỌC — sửa
// giá/sản phẩm/tình trạng hàng thì sửa trong file gốc.
import { readDoc } from "../../lib/blobDoc";
import SEED from "../../lib/sieuthiSeed.json";
import { CACHE_PATHNAME } from "../../lib/sieuthiConst";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const doc = await readDoc(CACHE_PATHNAME, { maxAgeMs: 60000 });
    if (doc.exists && doc.raw && Array.isArray(doc.raw.products)) return res.status(200).json(doc.raw);
  } catch (e) {
    // Đọc cache lỗi thì dùng bản kèm theo web, không làm hỏng trang.
  }
  // Chưa từng đồng bộ: dùng bản chụp từ file gốc lúc làm web (sẽ được thay
  // bằng bản mới ngay khi trang tự đồng bộ).
  return res.status(200).json(SEED);
}
