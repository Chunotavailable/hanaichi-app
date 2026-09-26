// pages/api/gomcan.js
// Lưu/đọc dữ liệu "Giá gồm cân" bằng Vercel Blob (kho lưu trữ file thật của Vercel),
// thay vì ghi ra ổ đĩa server — vì trên môi trường serverless (Vercel/Cloudflare...),
// ổ đĩa không lưu được lâu dài giữa các lần gọi.
//
// Cần biến môi trường BLOB_READ_WRITE_TOKEN. Khi bạn tạo 1 Blob Store trên Vercel và gắn
// vào project, biến này được Vercel tự thêm vào — không cần tự tạo token thủ công.
import { put, head } from "@vercel/blob";
import { SEED_GIADUNG } from "../../lib/giadungSeed";

const DATA_PATHNAME = "gomcan/data.json";

const DEFAULT_DATA = {
  oniRates: {
    adult: [
      { id: "r1", jpy: "13200", vnd: "2550k", note: "" },
      { id: "r2", jpy: "14300", vnd: "2650k", note: "" },
      { id: "r3", jpy: "15400", vnd: "2800k", note: "" },
      { id: "r4", jpy: "16500", vnd: "2900k", note: "Riêng mã SABOT" },
      { id: "r5", jpy: "16500", vnd: "2950k", note: "Các mã khác" },
      { id: "r6", jpy: "17600", vnd: "3150k", note: "" },
      { id: "r7", jpy: "18700", vnd: "3300k", note: "" },
      { id: "r8", jpy: "19800", vnd: "3500k", note: "" },
      { id: "r9", jpy: "20900", vnd: "3650k", note: "" },
      { id: "r10", jpy: "22000", vnd: "3850k", note: "" },
      { id: "r11", jpy: "33000", vnd: "5500k", note: "" },
    ],
    kid: [
      { id: "k1", jpy: "7150", vnd: "1450k", note: "" },
      { id: "k2", jpy: "8250", vnd: "1600k", note: "" },
      { id: "k3", jpy: "8800", vnd: "1700k", note: "" },
      { id: "k4", jpy: "9350", vnd: "1800k", note: "" },
      { id: "k5", jpy: "9900", vnd: "1900k", note: "" },
      { id: "k6", jpy: "11000", vnd: "2050k", note: "" },
    ],
    unigu: [
      { id: "u1", jpy: "1900", vnd: "460k", note: "Polo nam" },
      { id: "u2", jpy: "1990", vnd: "450k", note: "Polo nữ" },
      { id: "u3", jpy: "1990", vnd: "460k", note: "Chống nắng nam" },
      { id: "u4", jpy: "1990", vnd: "450k", note: "Chống nắng nữ" },
      { id: "u5", jpy: "990", vnd: "250k", note: "Bộ ngủ nữ ngắn tay quần đùi" },
      { id: "u6", jpy: "990", vnd: "250k", note: "Polo nữ" },
      { id: "u7", jpy: "1990", vnd: "425k", note: "Kính" },
      { id: "u8", jpy: "1290", vnd: "285k", note: "Kính" },
      { id: "u9", jpy: "790", vnd: "195k", note: "Loạt áo phông/sơ mi/áo kiểu ngắn tay, mông... của nam và nữ" },
      { id: "u10", jpy: "990", vnd: "235k", note: "Loạt áo phông/sơ mi/áo kiểu ngắn tay, mông... của nam và nữ" },
      { id: "u11", jpy: "1290", vnd: "295k", note: "Loạt áo phông/sơ mi/áo kiểu ngắn tay, mông... của nam và nữ" },
      { id: "u12", jpy: "1490", vnd: "335k", note: "Loạt áo phông/sơ mi/áo kiểu ngắn tay, mông... của nam và nữ" },
      { id: "u13", jpy: "1290", vnd: "290k", note: "Áo thun ngắn tay Mini T của nữ" },
      { id: "u14", jpy: "990", vnd: "220k", note: "Tanktop không có đệm ngực của nữ" },
      { id: "u15", jpy: "1290", vnd: "345k", note: "Quần soóc nam tới đầu gối" },
    ],
  },
  oniAdult: [],
  oniKid: [],
  unigu: [],
  giadung: [],
};

async function readData() {
  try {
    const meta = await head(DATA_PATHNAME);
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) return withGiadungSeed(DEFAULT_DATA);
    const data = await r.json();
    return withGiadungSeed({ ...DEFAULT_DATA, ...data, oniRates: { ...DEFAULT_DATA.oniRates, ...(data.oniRates || {}) } });
  } catch (e) {
    // Chưa có file nào được lưu (lần đầu) -> trả về mặc định
    return withGiadungSeed(DEFAULT_DATA);
  }
}

// Tự động điền sẵn danh sách "Gia dụng + TPCN" lấy từ file Google Sheet của
// chủ shop, nhưng chỉ khi tab này đang trống (chưa có sản phẩm nào được
// thêm/sửa tay) — một khi đã có ít nhất 1 sản phẩm thật, seed này không còn
// tự điền vào nữa để không đè lên dữ liệu người dùng.
function withGiadungSeed(data) {
  if (!data.giadung || data.giadung.length === 0) {
    return { ...data, giadung: SEED_GIADUNG.map((it) => ({ ...it })) };
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const data = await readData();
    return res.status(200).json(data);
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
