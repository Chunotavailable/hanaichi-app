// pages/api/img/[name].js — phục vụ ảnh đã lưu trong D1 (xem lib/blobDoc.js).
import { getImage } from "../../../lib/blobDoc";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).end();
  }
  try {
    const name = String(req.query.name || "").replace(/[^\w.-]/g, "_");
    const img = await getImage(name);
    if (!img) return res.status(404).end("Không có ảnh");
    res.setHeader("Content-Type", img.type || "image/jpeg");
    // URL có ?v=<thời điểm> nên có thể giữ lâu trong trình duyệt.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(Buffer.from(img.b64, "base64"));
  } catch (e) {
    return res.status(500).end(e.message || "Lỗi đọc ảnh");
  }
}
