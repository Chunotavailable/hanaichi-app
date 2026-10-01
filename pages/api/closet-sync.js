// pages/api/closet-sync.js
// Đối chiếu tab Closet với file Google Sheet hàng Closet của công ty (xem
// lib/closetSheet.js) rồi ghi kết quả vào dữ liệu Closet. Trang Closet tự gọi
// khi mở và khi bấm "Cập nhật ngay". Gọi dồn dập không sao: có giới hạn tần
// suất và dùng chung 1 lần chạy nếu đang chạy.
import { readDoc, writeDoc, isPrecondition } from "../../lib/blobDoc";
import { loadClosetSource, parseClosetRows, mergeClosetFromSheet } from "../../lib/closetSheet";
import { normalize, DATA_PATHNAME } from "./gomcan";
import { SEED_CLOSET } from "../../lib/closetSeed";

export const config = { maxDuration: 60 };

const MIN_GAP_MS = 20 * 1000;
const state = globalThis.__closetSync || (globalThis.__closetSync = { p: null, at: 0, last: null });
const SEED_IDS = new Set(SEED_CLOSET.map((p) => p.id));

const LOG_PATH = "closet/changes.json";
// Nhật ký thay đổi: lưu tối đa 40 lần cập nhật gần nhất, mỗi lần tối đa 800 dòng chi tiết.
async function logChanges(summary, items, approved) {
  try {
    const cur = await readDoc(LOG_PATH);
    const entries = cur.exists && Array.isArray(cur.raw.entries) ? cur.raw.entries : [];
    entries.unshift({ at: new Date().toISOString(), approved: !!approved, summary, items: items.slice(0, 800), more: Math.max(0, items.length - 800) });
    await writeDoc(LOG_PATH, { entries: entries.slice(0, 40) }, cur.exists ? { ifMatch: cur.etag } : {});
  } catch {
    // ghi nhật ký hỏng thì bỏ qua, không ảnh hưởng dữ liệu chính
  }
}

const PENDING_PATH = "closet/pending.json";

async function readPending() {
  try {
    const d = await readDoc(PENDING_PATH);
    if (d.exists) return { doc: d.raw, etag: d.etag };
  } catch {}
  return { doc: { items: [], dismissed: [] }, etag: "" };
}

// action: { approve: [{k,key}], reject: [{k,key}] } — chỉ có khi chủ shop bấm duyệt/bỏ qua.
async function syncOnce(action = {}) {
  // Duyệt/bỏ qua liên tiếp: dùng lại bản sheet vừa đọc (tối đa 5 phút) cho nhanh, khỏi tải lại Google mỗi lần bấm.
  const isAction = (action.approve || []).length + (action.reject || []).length > 0;
  let recs;
  if (isAction && state.recs && Date.now() - state.recs.at < 5 * 60 * 1000) recs = state.recs.recs;
  else {
    recs = parseClosetRows(await loadClosetSource());
    state.recs = { at: Date.now(), recs };
  }
  if (recs.length < 50) throw new Error("File Google Sheet đọc ra quá ít mã — giữ nguyên dữ liệu cũ để an toàn");
  const pend = await readPending();
  const dismissed = new Set(pend.doc.dismissed || []);
  for (const x of action.reject || []) dismissed.add(x.k === "price" ? `price:${x.key}:${x.to}` : `${x.k === "gone" ? "gone" : "add"}:${x.key}`);
  const approved = { add: [], gone: [], price: [] };
  for (const x of action.approve || []) (x.k === "gone" ? approved.gone : x.k === "price" ? approved.price : approved.add).push(x.key);
  const isApproval = approved.add.length + approved.gone.length + approved.price.length > 0;

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
    const { closet, summary, items, proposals } = mergeClosetFromSheet(data.closet || [], recs, {
      seedIds: SEED_IDS,
      deletedIds: data.closetDeletedIds || [],
      deletedVariantIds: data.closetDeletedVariantIds || [],
      approved,
      dismissed: Array.from(dismissed),
    });
    const changed = items.length > 0;
    if (changed) {
      try {
        await writeDoc(DATA_PATHNAME, { ...data, closet }, etag ? { ifMatch: etag } : {});
      } catch (e) {
        if (isPrecondition(e)) continue;
        throw e;
      }
      await logChanges(summary, items, isApproval);
    }
    const next = { items: proposals, dismissed: Array.from(dismissed), at: new Date().toISOString() };
    if (JSON.stringify({ i: next.items, d: next.dismissed }) !== JSON.stringify({ i: pend.doc.items, d: pend.doc.dismissed })) {
      try { await writeDoc(PENDING_PATH, next, pend.etag ? { ifMatch: pend.etag } : {}); } catch {}
    }
    return { changed, summary, at: next.at, total: recs.length, pending: proposals };
  }
  throw new Error("Dữ liệu đang được lưu ở nơi khác, thử lại sau ít giây");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
      // Duyệt / bỏ qua đề xuất: chỉ Quản lý.
      if (req.headers["x-hn-role"] !== "admin") return res.status(403).json({ error: "Chỉ Quản lý mới duyệt được" });
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const clean = (a) => (Array.isArray(a) ? a.filter((x) => x && typeof x.key === "string").slice(0, 2000) : []);
      while (state.p) { try { await state.p; } catch {} }
      state.p = syncOnce({ approve: clean(body.approve), reject: clean(body.reject) }).then((r) => { state.last = r; state.at = Date.now(); return r; }).finally(() => (state.p = null));
      return res.status(200).json(await state.p);
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ error: "Method not allowed" });
    }
    const force = req.query.force === "1";
    if (!force && state.last && Date.now() - state.at < MIN_GAP_MS) return res.status(200).json({ ...state.last, changed: false, skipped: true });
    if (!state.p) state.p = syncOnce().then((r) => { state.last = r; state.at = Date.now(); return r; }).finally(() => (state.p = null));
    return res.status(200).json(await state.p);
  } catch (e) {
    return res.status(502).json({ error: e.message || "Không đọc được file Google Sheet" });
  }
}
