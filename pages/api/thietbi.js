// pages/api/thietbi.js
// Lưu/đọc dữ liệu "Thiết bị bếp & vệ sinh" bằng Vercel Blob — hỗ trợ chỉ gửi
// phần sửa (PATCH), xem lib/docApi.js.
import { makeDocHandler } from "../../lib/docApi";
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

function normalize(raw) {
  return withSeed({ ...DEFAULT_DATA, ...raw });
}
function defaults() {
  return withSeed(DEFAULT_DATA).data;
}

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default makeDocHandler({ pathname: DATA_PATHNAME, normalize, defaults });
