// pages/api/ai.js
// Gọi Claude (Anthropic API) để hỗ trợ viết / viết lại bài đăng Facebook.
//
// Cần biến môi trường ANTHROPIC_API_KEY (lấy 1 API key tại
// https://console.anthropic.com/settings/keys — LƯU Ý: đây là key trả phí theo
// lượng dùng, khác với tài khoản claude.ai thường dùng để chat).
// Tuỳ chọn thêm biến ANTHROPIC_MODEL nếu muốn đổi model (mặc định "claude-sonnet-5").
//
// Nếu CHƯA cấu hình ANTHROPIC_API_KEY, API trả về { text: null, code: "no_key" }
// (không phải lỗi) để trang tự động chuyển sang chế độ ghép bài thủ công, không AI —
// giống hệt cách bản HTML cũ tự chuyển chế độ khi chưa mở trong claude.ai.
const DEFAULT_MODEL = "claude-sonnet-5";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ text: null, code: "no_key" });
  }

  let prompt = "";
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    prompt = ((body && body.prompt) || "").toString();
  } catch (e) {
    return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  }
  if (!prompt.trim()) {
    return res.status(400).json({ error: "Thiếu nội dung yêu cầu" });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: `Anthropic API lỗi (${r.status})`, detail: detail.slice(0, 400) });
    }

    const data = await r.json();
    const text = (data.content || [])
      .map((c) => c.text || "")
      .join("")
      .trim();
    return res.status(200).json({ text, code: "ok" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Lỗi không xác định khi gọi AI" });
  }
}
