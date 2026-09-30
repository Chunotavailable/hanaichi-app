// pages/api/sieuthi.js
// Lưu/đọc bảng giá siêu thị (tổng quan giá) bằng Vercel Blob — cùng cơ chế
// lưu phần sửa như các trang khác, xem lib/docApi.js.
// Dữ liệu ban đầu lấy từ sheet "TỔNG QUAN GIÁ" (lib/sieuthiSeed.json); sản
// phẩm bôi đỏ trong sheet được đánh dấu sẵn là hết hàng.
import { makeDocHandler } from "../../lib/docApi";
import SEED from "../../lib/sieuthiSeed.json";

const DATA_PATHNAME = "sieuthi/data.json";

const DEFAULT_DATA = {
  products: [],
  // Sản phẩm đã xoá tay — ghi nhớ để KHÔNG tự thêm lại khi merge với seed.
  productsDeletedIds: [],
};

// Chỉ BỔ SUNG sản phẩm mẫu còn thiếu, không bao giờ ghi đè giá/tình trạng đã
// sửa trên web, và không thêm lại những sản phẩm đã bị xoá tay.
function withSeed(data) {
  const deleted = new Set(data.productsDeletedIds || []);
  const list = data.products || [];
  const have = new Set(list.map((p) => p.id));
  const missing = SEED.filter((p) => !have.has(p.id) && !deleted.has(p.id));
  if (!missing.length) return { data, upgraded: false };
  const byId = new Map(list.map((p) => [p.id, p]));
  const seedIds = new Set(SEED.map((p) => p.id));
  const merged = [
    ...SEED.filter((p) => !deleted.has(p.id)).map((p) => byId.get(p.id) || { ...p }),
    ...list.filter((p) => !seedIds.has(p.id)),
  ];
  return { data: { ...data, products: merged }, upgraded: true };
}

function normalize(raw) {
  return withSeed({ ...DEFAULT_DATA, ...raw });
}
function defaults() {
  return withSeed(DEFAULT_DATA).data;
}

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default makeDocHandler({ pathname: DATA_PATHNAME, normalize, defaults });
