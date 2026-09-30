// pages/api/closet-sync.js
// Đối chiếu tab Closet với file Google Sheet hàng Closet của công ty (xem
// lib/closetSheet.js) rồi ghi kết quả vào dữ liệu Closet. Trang Closet tự gọi
// khi mở và khi bấm "Cập nhật ngay". Gọi dồn dập không sao: có giới hạn tần
// suất và dùng chung 1 lần chạy nếu đang chạy.
import { readDoc, writeDoc, isPrecondition } from "../../lib/blobDoc";
import { fetchClosetCsv, parseClosetRows, mergeClosetFromSheet } from "../../lib/closetSheet";
import { normalize, DATA_PATHNAME } from "./gomcan";
import { SEED_CLOSET } from "../../lib/closetSeed";

export const config = { maxDuration: 60 };

const MIN_GAP_MS = 20 * 1000;
const state = globalThis.__closetSync || (globalThis.__closetSync = { p: null, at: 0, last: null });
const SEED_IDS = new Set(SEED_CLOSET.map((p) => p.id));

async function syncOnce() {
  const recs = parseClosetRows(await fetchClosetCsv());
  if (recs.length < 50) throw new Error("File Google Sheet đọc ra quá ít mã — giữ nguyên dữ liệu cũ để an toàn");
  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await readDoc(DATA_PATHNAME);
    let data;
    let etag = "";
    if (doc.exists) {
      if (!doc.fresh) { await new Promise((r) => setTimeout(r, 1200)); continue; }
      data = normalize(doc.raw).data;
      etag = doc.etag;
    } else {
      data = normalize({}).data;
    }
    const { closet, summary } = mergeClosetFromSheet(data.closet || [], recs, {
      seedIds: SEED_IDS,
      deletedIds: data.closetDeletedIds || [],
      deletedVariantIds: data.closetDeletedVariantIds || [],
    });
    const changed = summary.updated + summary.added + summary.newProducts + summary.gone > 0;
    if (changed) {
      try {
        await writeDoc(DATA_PATHNAME, { ...data, closet }, etag ? { ifMatch: etag } : {});
      } catch (e) {
        if (isPrecondition(e)) continue;
        throw e;
      }
    }
    return { changed, summary, at: new Date().toISOString(), total: recs.length };
  }
  throw new Error("Dữ liệu đang được lưu ở nơi khác, thử lại sau ít giây");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const force = req.query.force === "1";
    if (!force && state.last && Date.now() - state.at < MIN_GAP_MS) return res.status(200).json({ ...state.last, changed: false, skipped: true });
    if (!state.p) state.p = syncOnce().then((r) => { state.last = r; state.at = Date.now(); return r; }).finally(() => (state.p = null));
    return res.status(200).json(await state.p);
  } catch (e) {
    return res.status(502).json({ error: e.message || "Không đọc được file Google Sheet" });
  }
}
