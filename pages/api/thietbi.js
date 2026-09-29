// pages/api/thietbi.js
// Lưu/đọc dữ liệu "Thiết bị bếp & vệ sinh" bằng Vercel Blob — cùng cơ chế các
// API khác trong app (xem pages/api/gomcan.js để hiểu chi tiết vì sao merge
// theo cách này).
import { put, head } from "@vercel/blob";
import { SEED_THIETBI, SEED_THIETBI_FAQ } from "../../lib/thietbiSeed";

const DATA_PATHNAME = "thietbi/data.json";

const DEFAULT_DATA = {
  thietbi: [],
  thietbiFaq: [],
  // Mã sản phẩm / câu hỏi mẫu đã bị xoá tay — phải ghi nhớ để KHÔNG tự thêm
  // lại khi merge với seed (bài học từ lỗi tương tự ở hàng Closet sẵn).
  thietbiDeletedIds: [],
  thietbiFaqDeletedIds: [],
};

async function readData() {
  try {
    const meta = await head(DATA_PATHNAME);
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) return withSeed(DEFAULT_DATA).data;
    const raw = await r.json();
    const merged = { ...DEFAULT_DATA, ...raw };
    const { data, upgraded } = withSeed(merged);
    if (upgraded) {
      try {
        await put(DATA_PATHNAME, JSON.stringify(data), {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
        });
      } catch (e) {
        // không ghi được thì thôi, lần đọc sau tự thử lại
      }
    }
    return data;
  } catch (e) {
    return withSeed(DEFAULT_DATA).data;
  }
}

// Chỉ BỔ SUNG sản phẩm/câu hỏi mẫu còn thiếu so với seed, không bao giờ ghi
// đè nội dung đã lưu (giá, ảnh, mô tả... nếu chủ shop đã tự sửa), và loại hẳn
// những mục đã bị xoá tay ra khỏi seed trước khi merge.
function withSeed(data) {
  const deletedIds = new Set(data.thietbiDeletedIds || []);
  const deletedFaqIds = new Set(data.thietbiFaqDeletedIds || []);
  const seedProducts = SEED_THIETBI.filter((p) => !deletedIds.has(p.id));
  const seedFaq = SEED_THIETBI_FAQ.filter((f) => !deletedFaqIds.has(f.id));

  const list = data.thietbi || [];
  const byId = new Map(list.map((p) => [p.id, p]));
  const seedIds = new Set(seedProducts.map((p) => p.id));
  const orderedProducts = seedProducts.map((sp) => byId.get(sp.id) || { ...sp });
  const customProducts = list.filter((p) => !seedIds.has(p.id) && !deletedIds.has(p.id));
  const mergedProducts = [...orderedProducts, ...customProducts];

  const faqList = data.thietbiFaq || [];
  const faqById = new Map(faqList.map((f) => [f.id, f]));
  const seedFaqIds = new Set(seedFaq.map((f) => f.id));
  const orderedFaq = seedFaq.map((sf) => faqById.get(sf.id) || { ...sf });
  const customFaq = faqList.filter((f) => !seedFaqIds.has(f.id) && !deletedFaqIds.has(f.id));
  const mergedFaq = [...orderedFaq, ...customFaq];

  const sameIds = (a, b) => a.length === b.length && a.every((x, i) => x.id === b[i].id);
  const unchanged = sameIds(mergedProducts, list) && sameIds(mergedFaq, faqList);
  if (unchanged) return { data, upgraded: false };
  return { data: { ...data, thietbi: mergedProducts, thietbiFaq: mergedFaq }, upgraded: true };
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
