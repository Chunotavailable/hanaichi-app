// pages/api/gomcan.js
// Lưu/đọc dữ liệu "Giá gồm cân" bằng Vercel Blob (kho lưu trữ file thật của Vercel),
// thay vì ghi ra ổ đĩa server — vì trên môi trường serverless (Vercel/Cloudflare...),
// ổ đĩa không lưu được lâu dài giữa các lần gọi.
//
// Cần biến môi trường BLOB_READ_WRITE_TOKEN. Khi bạn tạo 1 Blob Store trên Vercel và gắn
// vào project, biến này được Vercel tự thêm vào — không cần tự tạo token thủ công.
import { put, head } from "@vercel/blob";
import { SEED_GIADUNG } from "../../lib/giadungSeed";
import { SEED_CLOSET } from "../../lib/closetSeed";

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
  closet: [],
};

async function readData() {
  try {
    const meta = await head(DATA_PATHNAME);
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) return withGiadungSeed(DEFAULT_DATA).data;
    const data = await r.json();
    const merged = { ...DEFAULT_DATA, ...data, oniRates: { ...DEFAULT_DATA.oniRates, ...(data.oniRates || {}) } };
    const { data: seeded1, upgraded: upgraded1 } = withGiadungSeed(merged);
    const { data: seeded, upgraded: upgraded2 } = withClosetSeed(seeded1);
    const upgraded = upgraded1 || upgraded2;
    if (upgraded) {
      // Tự ghi lại ngay bản đã bổ sung để lần đọc sau không phải tính lại nữa.
      try {
        await put(DATA_PATHNAME, JSON.stringify(seeded), {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
        });
      } catch (e) {
        // không ghi được thì thôi, lần đọc sau sẽ tự thử lại
      }
    }
    return seeded;
  } catch (e) {
    // Chưa có file nào được lưu (lần đầu) -> trả về mặc định
    return withClosetSeed(withGiadungSeed(DEFAULT_DATA).data).data;
  }
}

// Tự động điền sẵn danh sách "Gia dụng + TPCN" lấy từ file Google Sheet của
// chủ shop khi tab này đang trống. Khi có thêm sản phẩm mới trong seed (sau
// này bổ sung thêm sản phẩm) hoặc khi thứ tự trong seed được sửa lại đúng
// theo file gốc, thì TỰ ĐỒNG BỘ lại danh sách đang lưu:
//   - THÊM những sản phẩm còn thiếu (theo id "gNN" chưa từng có).
//   - SẮP LẠI THỨ TỰ các sản phẩm gốc từ seed theo đúng thứ tự trong
//     SEED_GIADUNG (để khớp với file gốc của chủ shop).
//   - Sản phẩm nào người dùng đã tự thêm tay (id ngẫu nhiên, không phải mẫu
//     "gNN") luôn được giữ nguyên và xếp sau các sản phẩm seed.
// Quan trọng: KHÔNG BAO GIỜ ghi đè NỘI DUNG của sản phẩm đã có sẵn trong danh
// sách đang lưu — chỉ đổi VỊ TRÍ của nó trong mảng. Ảnh, giá, ghi chú người
// dùng tự sửa (dù có phải sản phẩm seed hay không) luôn được giữ nguyên.
//
// Trước đây từng dùng cách "so ID xem có phải toàn bộ vẫn là seed cũ chưa ai
// đụng vào hay không" rồi GHI ĐÈ TOÀN BỘ nếu đúng — cách đó có lỗi: chỉ cần
// người dùng sửa NỘI DUNG (ví dụ thêm ảnh) của 1 sản phẩm seed cũ mà KHÔNG
// đổi id, thì lần đọc sau vẫn bị nhận nhầm là "chưa ai đụng vào" và bị ghi đè
// mất ảnh/sửa đổi đó. Cách merge + sắp lại thứ tự theo id dưới đây không có
// lỗi này vì luôn lấy NỘI DUNG hiện tại của sản phẩm (nếu đã có), chỉ đổi vị
// trí hoặc bổ sung thêm khi thiếu.
function withGiadungSeed(data) {
  const list = data.giadung || [];
  if (list.length === 0) {
    return { data: { ...data, giadung: SEED_GIADUNG.map((it) => ({ ...it })) }, upgraded: false };
  }
  const byId = new Map(list.map((it) => [it.id, it]));
  const seedIds = new Set(SEED_GIADUNG.map((it) => it.id));
  const orderedFromSeed = SEED_GIADUNG.map((seedIt) => byId.get(seedIt.id) || { ...seedIt });
  const customExtras = list.filter((it) => !seedIds.has(it.id));
  const merged = [...orderedFromSeed, ...customExtras];

  const unchanged =
    merged.length === list.length && merged.every((it, i) => it.id === list[i].id);
  if (unchanged) {
    return { data, upgraded: false };
  }
  return { data: { ...data, giadung: merged }, upgraded: true };
}

// Tương tự withGiadungSeed ở trên nhưng cho tab "Hàng Closet sẵn" — mỗi sản
// phẩm còn có danh sách biến thể (size/màu) riêng bên trong, nên merge thêm
// một lớp nữa ở cấp biến thể: giữ nguyên biến thể đã có (số lượng còn lại đã
// được người bán tự sửa tay sau khi bán), chỉ bổ sung biến thể/sản phẩm còn
// thiếu so với seed, không bao giờ ghi đè nội dung đã lưu.
function withClosetSeed(data) {
  const list = data.closet || [];
  if (list.length === 0) {
    return {
      data: { ...data, closet: SEED_CLOSET.map((p) => ({ ...p, variants: p.variants.map((v) => ({ ...v })) })) },
      upgraded: false,
    };
  }
  const byId = new Map(list.map((p) => [p.id, p]));
  const seedIds = new Set(SEED_CLOSET.map((p) => p.id));

  const orderedFromSeed = SEED_CLOSET.map((seedP) => {
    const existing = byId.get(seedP.id);
    if (!existing) return { ...seedP, variants: seedP.variants.map((v) => ({ ...v })) };
    const vById = new Map((existing.variants || []).map((v) => [v.id, v]));
    const seedVIds = new Set(seedP.variants.map((v) => v.id));
    const mergedVariants = [
      ...seedP.variants.map((sv) => vById.get(sv.id) || { ...sv }),
      ...(existing.variants || []).filter((v) => !seedVIds.has(v.id)),
    ];
    return { ...existing, variants: mergedVariants };
  });
  const customExtras = list.filter((p) => !seedIds.has(p.id));
  const merged = [...orderedFromSeed, ...customExtras];

  const sameShape = (a, b) =>
    a.length === b.length &&
    a.every((p, i) => p.id === b[i].id && (p.variants || []).length === (b[i].variants || []).length && (p.variants || []).every((v, j) => v.id === (b[i].variants || [])[j].id));
  const unchanged = sameShape(merged, list);
  if (unchanged) {
    return { data, upgraded: false };
  }
  return { data: { ...data, closet: merged }, upgraded: true };
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
