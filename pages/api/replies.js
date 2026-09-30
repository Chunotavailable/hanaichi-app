// pages/api/replies.js
// Lưu/đọc dữ liệu trang "Tra cứu nhanh" (mẫu câu trả lời khách, thông tin cửa
// hàng, link, size...) — cùng cơ chế lưu phần sửa như các trang khác, xem
// lib/docApi.js. Mục đánh dấu "chỉ Quản lý xem" bị lọc bỏ khỏi dữ liệu gửi
// cho chế độ Khách ngay từ server.
import { makeDocHandler } from "../../lib/docApi";
import { SEED_REPLIES } from "../../lib/repliesSeed";

const DATA_PATHNAME = "replies/data.json";

const DEFAULT_DATA = {
  replies: [],
  // Mục mẫu đã bị xoá tay — ghi nhớ để KHÔNG tự thêm lại khi merge với seed.
  repliesDeletedIds: [],
};

// Chỉ BỔ SUNG mục mẫu còn thiếu, không ghi đè nội dung đã sửa trên web.
function withSeed(data) {
  const deletedIds = new Set(data.repliesDeletedIds || []);
  const seed = SEED_REPLIES.filter((r) => !deletedIds.has(r.id));
  const list = data.replies || [];
  const have = new Set(list.map((r) => r.id));
  const missing = seed.filter((r) => !have.has(r.id));
  if (!missing.length) return { data, upgraded: false };
  // Mục mẫu còn thiếu chèn theo đúng thứ tự trong seed, mục tự thêm giữ ở cuối.
  const byId = new Map(list.map((r) => [r.id, r]));
  const seedIds = new Set(seed.map((r) => r.id));
  const merged = [...seed.map((r) => byId.get(r.id) || { ...r }), ...list.filter((r) => !seedIds.has(r.id))];
  return { data: { ...data, replies: merged }, upgraded: true };
}

function normalize(raw) {
  return withSeed({ ...DEFAULT_DATA, ...raw });
}
function defaults() {
  return withSeed(DEFAULT_DATA).data;
}
function viewFor(data) {
  return { ...data, replies: (data.replies || []).filter((r) => !r.private) };
}

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default makeDocHandler({ pathname: DATA_PATHNAME, normalize, defaults, viewFor });
