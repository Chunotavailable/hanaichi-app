// pages/api/sieuthi-sync.js
// Nhận bảng "Giá siêu thị" đã được TRÌNH DUYỆT QUẢN LÝ đọc từ file Google Sheet và lưu lại để mọi người xem.
// (Máy chủ Cloudflare gói miễn phí không đủ sức tự đọc file Excel lớn.) Chỉ Quản lý gọi được (middleware chặn Khách).
import { writeDoc } from "../../lib/blobDoc";
import { CACHE_PATHNAME } from "../../lib/sieuthiConst";

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.headers["x-hn-role"] !== "admin") return res.status(403).json({ error: "Chỉ Quản lý mới cập nhật được" });
  try {
    const p = req.body && req.body.doc;
    if (!p || !Array.isArray(p.products) || !p.products.length) throw new Error("File gốc không có sản phẩm nào — giữ nguyên dữ liệu cũ");
    const doc = { ...p, updatedAt: new Date().toISOString(), source: "sheet" };
    await writeDoc(CACHE_PATHNAME, doc);
    return res.status(200).json({ updated: true, doc });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Không lưu được dữ liệu" });
  }
}
