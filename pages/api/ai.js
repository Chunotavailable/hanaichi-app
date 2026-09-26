// pages/api/ai.js
// Hỗ trợ viết / viết lại bài đăng Facebook bằng AI. Ưu tiên dùng GEMINI_API_KEY
// (Google Gemini — MIỄN PHÍ, lấy tại https://aistudio.google.com/apikey, chỉ cần
// tài khoản Google, không cần thẻ tín dụng). Nếu không có, thử ANTHROPIC_API_KEY
// (Claude — trả phí theo lượng dùng, lấy tại https://console.anthropic.com/settings/keys).
//
// Chỉ cần cấu hình ĐÚNG MỘT trong hai biến môi trường trên là dùng được, không cần cả hai.
// Nếu CHƯA cấu hình biến nào, API trả về { text: null, code: "no_key" } (không phải lỗi)
// để trang tự động chuyển sang chế độ ghép bài thủ công, không AI.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

async function callGemini(prompt, apiKey) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw Object.assign(new Error(`Gemini API lỗi (${r.status})`), { detail: detail.slice(0, 400) });
  }
  const data = await r.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map((p) => p.text || "").join("").trim();
}

async function callAnthropic(prompt, apiKey) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw Object.assign(new Error(`Anthropic API lỗi (${r.status})`), { detail: detail.slice(0, 400) });
  }
  const data = await r.json();
  return (data.content || []).map((c) => c.text || "").join("").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!geminiKey && !anthropicKey) {
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
    const text = geminiKey ? await callGemini(prompt, geminiKey) : await callAnthropic(prompt, anthropicKey);
    return res.status(200).json({ text, code: "ok" });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Lỗi không xác định khi gọi AI", detail: e.detail || "" });
  }
}
