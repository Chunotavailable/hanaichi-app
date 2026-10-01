// pages/api/closet-changes.js — nhật ký các lần Closet tự cập nhật từ Google Sheet.
import { readDoc } from "../../lib/blobDoc";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const d = await readDoc("closet/changes.json", { maxAgeMs: 60000 });
    return res.status(200).json(d.exists ? d.raw : { entries: [] });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Lỗi máy chủ" });
  }
}
