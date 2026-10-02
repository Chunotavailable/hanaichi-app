// pages/api/sheet-raw.js
// Chuyển NGUYÊN file Google Sheet (dạng .xlsx) về trình duyệt Quản lý để trình duyệt tự đọc và so sánh
// (máy chủ Cloudflare gói miễn phí chỉ cho ~10 mili giây tính toán mỗi lượt nên không tự đọc Excel được).
import fs from "fs";
import { SHEET_ID as CLOSET_ID, SHEET_GID as CLOSET_GID } from "../../lib/closetSheet";
import { SHEET_ID as GIADUNG_ID } from "../../lib/giadungSheet";
import { SHEET_ID as THIETBI_ID } from "../../lib/thietbiSheet";
import { SHEET_ID as SIEUTHI_ID } from "../../lib/sieuthiSheet";

export const config = { api: { responseLimit: false } };

const IDS = { closet: CLOSET_ID, giadung: GIADUNG_ID, thietbi: THIETBI_ID, sieuthi: SIEUTHI_ID };
const TEST_FILES = {
  closet: process.env.HANAICHI_CLOSET_FILE,
  giadung: process.env.HANAICHI_GIADUNG_FILE,
  thietbi: process.env.HANAICHI_THIETBI_FILE,
  sieuthi: process.env.HANAICHI_SHEET_FILE,
};

async function get(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  const tab = String(req.query.tab || "");
  const id = IDS[tab];
  if (!id) return res.status(400).json({ error: "Không rõ tab" });
  try {
    const tf = TEST_FILES[tab]; // chỉ để thử trên máy
    if (tf) {
      res.setHeader("x-sheet-format", /\.csv$/i.test(tf) ? "csv" : "xlsx");
      res.setHeader("Content-Type", "application/octet-stream");
      return res.status(200).send(fs.readFileSync(tf));
    }
    const r = await get(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, 50000);
    if (r.ok && r.body) {
      // Chuyển dần từng đoạn về trình duyệt, KHÔNG giữ cả file trong bộ nhớ (Cloudflare gói miễn phí chỉ có 128MB).
      const reader = r.body.getReader();
      const first = await reader.read();
      const head = first.value || new Uint8Array(0);
      if (head.length >= 2 && head[0] === 0x50 && head[1] === 0x4b) {
        res.setHeader("x-sheet-format", "xlsx");
        res.setHeader("Content-Type", "application/octet-stream");
        res.status(200);
        res.write(head);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        return res.end();
      }
      try { await reader.cancel(); } catch {}
    }
    if (tab === "closet") {
      // Không tải được bản Excel (mất màu ô) -> dùng bản CSV, vẫn đối chiếu được số lượng/mã nhưng không nhận ra giá xả.
      const rc = await get(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${CLOSET_GID}`, 40000);
      const text = await rc.text();
      if (rc.ok && !/^\s*<(!doctype|html)/i.test(text)) {
        res.setHeader("x-sheet-format", "csv");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.status(200).send(text);
      }
    }
    return res.status(502).json({ error: "Không đọc được file Google Sheet (kiểm tra quyền chia sẻ: ai có link đều xem được)" });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Không đọc được file Google Sheet" });
  }
}
