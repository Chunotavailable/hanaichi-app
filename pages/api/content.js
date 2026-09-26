// pages/api/content.js
// Lưu/đọc dữ liệu dùng chung cho "Viết bài FB" + "Sửa bài theo khung": danh sách
// khung bài mẫu, khung đang chọn, và bộ icon cute — cùng cơ chế Vercel Blob như gomcan.js/todo.js.
import { put, head } from "@vercel/blob";

const DATA_PATHNAME = "content/data.json";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_ICONS = ["🌸", "✨", "👟", "🛍️", "🎀", "🛒", "💖", "🔥", "📌"];

function seedTemplates() {
  return [
    {
      id: uid(),
      name: "Chia sẻ đôi giày em ưng",
      body:
        "[Tiêu đề ngắn, nhẹ nhàng, kèm 1 emoji]\n\n[Mở đầu 1–2 câu: chuyện nhỏ hoặc cảm nhận của em khi gặp đôi giày này]\n\n[Thân bài: form dáng, chất liệu, độ êm, cách phối đồ – kể tự nhiên như trò chuyện]\n\n[Kết: 1 câu hỏi nhẹ để các bác chia sẻ, ví dụ các bác hay chọn giày kiểu nào]",
    },
    {
      id: uid(),
      name: "Câu chuyện đi giày mỗi ngày",
      body:
        "[Câu mở đầu: một khoảnh khắc đời thường có đôi giày]\n\n[Đoạn giữa: em thấy đôi giày hợp với hoàn cảnh nào (đi làm, đi dạo, đi học), điểm em thích nhất]\n\n[Một chi tiết nhỏ khiến em nhớ: màu sắc, đường may hoặc cảm giác khi mang]\n\n[Kết: lời chúc nhẹ nhàng gửi các bác 🌸]",
    },
  ];
}

function defaultData() {
  const templates = seedTemplates();
  return { templates, tplSel: templates[0].id, icons: DEFAULT_ICONS.slice() };
}

async function readData() {
  try {
    const meta = await head(DATA_PATHNAME);
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) return defaultData();
    const data = await r.json();
    const base = defaultData();
    return {
      ...base,
      ...data,
      templates: Array.isArray(data.templates) ? data.templates : base.templates,
      icons: Array.isArray(data.icons) && data.icons.length ? data.icons : base.icons,
    };
  } catch (e) {
    return defaultData();
  }
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json(await readData());
  }
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
      }
      await put(DATA_PATHNAME, JSON.stringify(body), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Không lưu được" });
    }
  }
  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).json({ error: "Method not allowed" });
}
