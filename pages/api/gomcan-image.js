// pages/api/gomcan-image.js
// Nhận ảnh dạng base64 (data URL) từ trình duyệt, lưu lên Vercel Blob thay vì ghi
// file trực tiếp lên đĩa — để hoạt động đúng khi deploy serverless (Vercel/Cloudflare).
import { put, del } from "@vercel/blob";

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
};

export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const { id, dataUrl } = req.body || {};
      if (!id || !dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
        return res.status(400).json({ error: "Thiếu id hoặc ảnh không hợp lệ" });
      }
      const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "Định dạng ảnh không đúng" });
      const ext = match[1] === "jpeg" ? "jpg" : match[1];
      const buffer = Buffer.from(match[2], "base64");
      const blob = await put(`gomcan/images/${id}.${ext}`, buffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: `image/${match[1]}`,
      });
      // Thêm tham số ?v= để "phá cache" của trình duyệt/CDN — nếu không, khi thay ảnh
      // mới cho cùng 1 sản phẩm (URL không đổi), trình duyệt vẫn hiển thị ảnh cũ đã lưu cache.
      return res.status(200).json({ url: `${blob.url}?v=${Date.now()}` });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Không lưu được ảnh" });
    }
  }
  if (req.method === "DELETE") {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Thiếu id" });
      // Không biết chắc đuôi file gốc nên thử xoá vài đuôi phổ biến, bỏ qua lỗi không tồn tại
      await Promise.allSettled(
        ["jpg", "jpeg", "png", "webp"].map((ext) => del(`gomcan/images/${id}.${ext}`))
      );
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Không xoá được ảnh" });
    }
  }
  res.setHeader("Allow", ["POST", "DELETE"]);
  return res.status(405).json({ error: "Method not allowed" });
}
