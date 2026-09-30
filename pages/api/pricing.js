// pages/api/pricing.js
// Lưu/đọc lịch sử báo giá bằng Vercel Blob — hỗ trợ chỉ gửi phần sửa
// (PATCH), xem lib/docApi.js.
import { makeDocHandler } from "../../lib/docApi";

const DATA_PATHNAME = "pricing/data.json";
const DEFAULT_DATA = { priceHist: [], lastRate: 202 };

function normalize(raw) {
  return {
    data: { ...DEFAULT_DATA, ...raw, priceHist: Array.isArray(raw.priceHist) ? raw.priceHist : [] },
    upgraded: false,
  };
}
function defaults() {
  return { ...DEFAULT_DATA, priceHist: [] };
}

// Khách chỉ được THÊM mục mới vào lịch sử báo giá (tối đa vài mục mỗi lần,
// mỗi mục nhỏ, đúng dạng) — không sửa/xoá mục nào, không đổi gì khác.
function guestPatchOk(base, patch) {
  if (!patch || typeof patch !== "object") return false;
  if (Object.keys(patch.set || {}).length || (patch.unset || []).length) return false;
  const keys = Object.keys(patch.lists || {});
  if (keys.length !== 1 || keys[0] !== "priceHist") return false;
  const { upserts = [], removed = [] } = patch.lists.priceHist;
  if (removed.length || upserts.length > 5) return false;
  const existing = new Set(((base && base.priceHist) || []).map((h) => h && h.id));
  return upserts.every(
    (h) =>
      h &&
      typeof h.id === "string" &&
      !existing.has(h.id) &&
      (h.type === "Order" || h.type === "Hàng sẵn") &&
      JSON.stringify(h).length < 1500
  );
}

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default makeDocHandler({ pathname: DATA_PATHNAME, normalize, defaults, guestPatchOk });
