// pages/api/codesites.js — danh sách web chính hãng do Quản lý thêm ở tab "Tìm mã từ ảnh".
// Mọi người (kể cả Khách) đọc được; chỉ Quản lý ghi (POST cả khối, middleware chặn Khách).
import { makeDocHandler } from "../../lib/docApi";

const clean = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string" && x.length < 100).slice(0, 50) : []);
export const config = { api: { bodyParser: { sizeLimit: "100kb" } } };
export default makeDocHandler({
  pathname: "codesites/data.json",
  normalize: (raw) => ({ data: { sites: clean(raw && raw.sites) }, upgraded: false }),
  defaults: () => ({ sites: [] }),
});
