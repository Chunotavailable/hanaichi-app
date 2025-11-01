// pages/api/products.js
import { google } from "googleapis";

const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;               // Bắt buộc
const RANGE            = process.env.SHEET_RANGE || "CÓ SẴN!A1:K999"; // Tên sheet!range
const CACHE_TTL_MS     = Number(process.env.CACHE_TTL_MS ?? 120000);  // TTL cache (ms)

let CACHE = { data: null, at: 0 };

export default async function handler(req, res) {
  if (!GOOGLE_SHEETS_ID) {
    return res.status(500).json({ error: "Missing GOOGLE_SHEETS_ID env" });
  }

  // Cho phép “bẻ cache” tức thời:
  //  - ?nocache=1 trên URL
  //  - NODE_ENV=development
  //  - hoặc đặt CACHE_TTL_MS=0
  const noCache =
    req.query.nocache === "1" ||
    process.env.NODE_ENV === "development" ||
    CACHE_TTL_MS <= 0;

  try {
    const now = Date.now();

    // Trả cache nếu còn hạn và không yêu cầu bỏ cache
    if (!noCache && CACHE.data && now - CACHE.at < CACHE_TTL_MS) {
      res.setHeader(
        "Cache-Control",
        `public, max-age=60, s-maxage=${Math.floor(CACHE_TTL_MS / 1000)}`
      );
      return res.status(200).json(CACHE.data);
    }

    // OAuth2
    const auth = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET
    );
    auth.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });

    const sheets = google.sheets({ version: "v4", auth });

    // Đọc Google Sheets
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: RANGE,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const values = resp.data.values || [];
    if (!values.length) {
      const payload = { rows: [], keys: [] };
      if (noCache) res.setHeader("Cache-Control", "no-store");
      else
        res.setHeader(
          "Cache-Control",
          `public, max-age=60, s-maxage=${Math.floor(CACHE_TTL_MS / 1000)}`
        );
      return res.status(200).json(payload);
    }

    // Chuẩn hoá header -> key object
    const [header, ...rows] = values;
    const keys = header.map((h, i) =>
      (h ?? `c${i}`)
        .toString()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "") // bỏ dấu tiếng Việt
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w]/g, "")
    );

    const data = rows.map((r) =>
      Object.fromEntries(keys.map((k, i) => [k, r?.[i] ?? ""]))
    );

    const payload = { rows: data, keys };

    // Lưu cache trong bộ nhớ (trừ khi noCache)
    CACHE = { data: payload, at: now };

    // Header cache
    if (noCache) {
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader(
        "Cache-Control",
        `public, max-age=60, s-maxage=${Math.floor(CACHE_TTL_MS / 1000)}`
      );
    }

    return res.status(200).json(payload);
  } catch (e) {
    console.error("Google Sheets API error:", e);
    return res.status(500).json({ error: e.message || "Sheets error" });
  }
}
