// pages/api/pricing.js
// Lưu/đọc lịch sử báo giá bằng Vercel Blob — cùng cơ chế các API khác trong app.
import { put, head } from "@vercel/blob";

const DATA_PATHNAME = "pricing/data.json";
const DEFAULT_DATA = { priceHist: [], lastRate: 202 };

async function readData() {
  try {
    const meta = await head(DATA_PATHNAME);
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) return DEFAULT_DATA;
    const data = await r.json();
    return { ...DEFAULT_DATA, ...data, priceHist: Array.isArray(data.priceHist) ? data.priceHist : [] };
  } catch (e) {
    return DEFAULT_DATA;
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
