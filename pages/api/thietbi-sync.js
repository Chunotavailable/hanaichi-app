// pages/api/thietbi-sync.js
// Đối chiếu tab "Thiết bị bếp & vệ sinh" với Google Sheet Google Sheet thiết bị (xem lib/thietbiSheet.js).
// GET  : kiểm tra sheet, tạo danh sách đề xuất chờ duyệt.
// POST : { approve: [...], reject: [...] } — Quản lý duyệt / bỏ qua đề xuất.
import { readDoc, writeDoc, isPrecondition } from "../../lib/blobDoc";
import { loadThietbiRows, parseThietbiRows, mergeThietbiFromSheet } from "../../lib/thietbiSheet";
import { normalize, DATA_PATHNAME } from "./thietbi";
import { SEED_THIETBI } from "../../lib/thietbiSeed";

export const config = { maxDuration: 60 };

const MIN_GAP_MS = 20 * 1000;
const state = globalThis.__thietbiSync || (globalThis.__thietbiSync = { p: null, at: 0, last: null });
const LOG_PATH = "thietbi/changes.json";
const PENDING_PATH = "thietbi/pending.json";
const CHECK_PATH = "thietbi/lastcheck.json";
const DAY_MS = 24 * 60 * 60 * 1000; // tự động đối chiếu file gốc tối đa 1 lần / ngày (bấm "Cập nhật ngay" thì làm luôn)

async function logChanges(summary, items, approved) {
  try {
    const cur = await readDoc(LOG_PATH);
    const entries = cur.exists && Array.isArray(cur.raw.entries) ? cur.raw.entries : [];
    entries.unshift({ at: new Date().toISOString(), approved: !!approved, summary, items: items.slice(0, 500), more: Math.max(0, items.length - 500) });
    await writeDoc(LOG_PATH, { entries: entries.slice(0, 40) }, cur.exists ? { ifMatch: cur.etag } : {});
  } catch {}
}
async function readPending() {
  try {
    const d = await readDoc(PENDING_PATH);
    if (d.exists) return { doc: d.raw, etag: d.etag };
  } catch {}
  return { doc: { items: [], dismissed: [] }, etag: "" };
}

async function syncOnce(action = {}) {
  // Duyệt/bỏ qua liên tiếp: dùng lại bản sheet vừa đọc (tối đa 5 phút) cho nhanh, khỏi tải lại Google mỗi lần bấm.
  const isAction = (action.approve || []).length + (action.reject || []).length > 0;
  let recs;
  if (isAction && state.recs && Date.now() - state.recs.at < 5 * 60 * 1000) recs = state.recs.recs;
  else {
    recs = parseThietbiRows(await loadThietbiRows());
    state.recs = { at: Date.now(), recs };
  }
  if (recs.length < 3) throw new Error("File Google Sheet đọc ra quá ít sản phẩm — giữ nguyên dữ liệu cũ để an toàn");
  const pend = await readPending();
  const dismissed = new Set(pend.doc.dismissed || []);
  for (const x of action.reject || []) dismissed.add(x.k === "chg" ? `chg:${x.key}:${x.sig}` : `${x.k}:${x.key}`);
  const approved = { chg: [], new: [], gone: [] };
  for (const x of action.approve || []) if (approved[x.k]) approved[x.k].push(x.key);
  const isApproval = approved.chg.length + approved.new.length + approved.gone.length > 0;

  for (let attempt = 0; attempt < 4; attempt++) {
    const doc = await readDoc(DATA_PATHNAME);
    let data, etag = "";
    if (doc.exists) {
      if (!doc.fresh) { await new Promise((r) => setTimeout(r, 1200)); continue; }
      data = normalize(doc.raw).data;
      etag = doc.etag;
    } else data = normalize({}).data;
    const { list, summary, items, proposals } = mergeThietbiFromSheet(data.thietbi || [], recs, {
      deletedIds: data.thietbiDeletedIds || [],
      deletedItems: SEED_THIETBI.filter((x) => (data.thietbiDeletedIds || []).includes(x.id)),
      approved,
      dismissed: Array.from(dismissed),
    });
    const changed = items.length > 0;
    if (changed) {
      try {
        await writeDoc(DATA_PATHNAME, { ...data, thietbi: list }, etag ? { ifMatch: etag } : {});
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
    try { const c = await readDoc(CHECK_PATH); await writeDoc(CHECK_PATH, { at: next.at }, c.exists ? { ifMatch: c.etag } : {}); } catch {}
    return { changed, summary, at: next.at, total: recs.length, pending: proposals };
  }
  throw new Error("Dữ liệu đang được lưu ở nơi khác, thử lại sau ít giây");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "POST") {
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
    if (req.query.log === "1") {
      const d = await readDoc(LOG_PATH);
      return res.status(200).json(d.exists ? d.raw : { entries: [] });
    }
    const force = req.query.force === "1";
    if (!force && state.last && Date.now() - state.at < MIN_GAP_MS) return res.status(200).json({ ...state.last, changed: false, skipped: true });
    if (!force) {
      // Đã đối chiếu trong vòng 24 giờ -> không tải lại Google, chỉ trả danh sách chờ duyệt đang lưu.
      try {
        const c = await readDoc(CHECK_PATH);
        if (c.exists && c.raw && c.raw.at && Date.now() - new Date(c.raw.at).getTime() < DAY_MS) {
          const pend = await readPending();
          return res.status(200).json({ changed: false, skipped: true, at: c.raw.at, pending: pend.doc.items || [] });
        }
      } catch {}
    }
    if (!state.p) state.p = syncOnce().then((r) => { state.last = r; state.at = Date.now(); return r; }).finally(() => (state.p = null));
    return res.status(200).json(await state.p);
  } catch (e) {
    return res.status(502).json({ error: e.message || "Không đọc được file Google Sheet" });
  }
}
