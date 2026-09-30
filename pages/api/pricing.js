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

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default makeDocHandler({ pathname: DATA_PATHNAME, normalize, defaults });
