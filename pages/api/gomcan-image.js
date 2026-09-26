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
      const { id, dataUrl, imageUrl } = req.body || {};
      if (!id) return res.status(400).json({ error: "Thiếu id" });

      let ext, contentType, buffer;

      if (imageUrl && typeof imageUrl === "string") {
        // Dán link ảnh từ ngoài (Google Images, web bán hàng...) — tải giúp
        // ở server (trình duyệt người dùng có thể bị chặn CORS khi tải trực
        // tiếp từ site khác) rồi lưu lại như ảnh upload bình thường.
        let url;
        try {
          url = new URL(imageUrl);
        } catch {
          return res.status(400).json({ error: "Link ảnh không hợp lệ" });
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return res.status(400).json({ error: "Link ảnh không hợp lệ" });
        }
        // Nhiều CDN của các hãng lớn (Nike, Adidas, Asics...) chặn thẳng các
        // request tự xưng là "bot" — phải giả lập đúng trình duyệt thật (User-Agent,
        // Accept, Referer cùng domain ảnh) thì mới tải được, không thì bị chặn âm thầm.
        const r = await fetch(url.toString(), {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            Referer: `${url.protocol}//${url.hostname}/`,
          },
        });
        if (!r.ok) return res.status(400).json({ error: `Không tải được ảnh từ link này (mã lỗi ${r.status})` });
        const ct = r.headers.get("content-type") || "";
        const m = ct.match(/^image\/(\w+)/);
        if (!m) return res.status(400).json({ error: "Link này không phải ảnh" });
        contentType = `image/${m[1]}`;
        ext = m[1] === "jpeg" ? "jpg" : m[1];
        const arrBuf = await r.arrayBuffer();
        buffer = Buffer.from(arrBuf);
        if (buffer.length > 8 * 1024 * 1024) return res.status(400).json({ error: "Ảnh quá lớn (trên 8MB)" });
      } else if (dataUrl && typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
        const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: "Định dạng ảnh không đúng" });
        ext = match[1] === "jpeg" ? "jpg" : match[1];
        contentType = `image/${match[1]}`;
        buffer = Buffer.from(match[2], "base64");
      } else {
        return res.status(400).json({ error: "Thiếu ảnh hoặc link ảnh" });
      }

      const blob = await put(`gomcan/images/${id}.${ext}`, buffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
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
