// pages/api/sheet-state.js
// Lưu trạng thái đối chiếu Google Sheet do trình duyệt Quản lý tính ra:
//   - pending : danh sách chờ duyệt + các mục đã bỏ qua (không nhắc lại)
//   - changes : lịch sử thay đổi (tối đa 40 lần)
//   - check   : thời điểm đối chiếu gần nhất
// GET  ?tab=closet            -> { items, dismissed, checkedAt }
// GET  ?tab=closet&log=1      -> { entries }
// POST { tab, pending?, checkedAt?, log? }   (chỉ Quản lý)
import { readDoc, writeDoc, isPrecondition } from "../../lib/blobDoc";

const TABS = new Set(["closet", "giadung", "thietbi"]);
const P = (tab) => ({ pending: `${tab}/pending.json`, changes: `${tab}/changes.json`, check: `${tab}/lastcheck.json` });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const tab = String(req.query.tab || "");
      if (!TABS.has(tab)) return res.status(400).json({ error: "Không rõ tab" });
      const p = P(tab);
      if (req.query.log === "1") {
        const d = await readDoc(p.changes);
        return res.status(200).json(d.exists ? d.raw : { entries: [] });
      }
      const [pd, cd] = await Promise.all([readDoc(p.pending), readDoc(p.check)]);
      return res.status(200).json({
        items: pd.exists && Array.isArray(pd.raw.items) ? pd.raw.items : [],
        dismissed: pd.exists && Array.isArray(pd.raw.dismissed) ? pd.raw.dismissed : [],
        checkedAt: cd.exists && cd.raw ? cd.raw.at || null : null,
      });
    }
    if (req.method === "POST") {
      if (req.headers["x-hn-role"] !== "admin") return res.status(403).json({ error: "Chỉ Quản lý mới lưu được" });
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const tab = String(body.tab || "");
      if (!TABS.has(tab)) return res.status(400).json({ error: "Không rõ tab" });
      const p = P(tab);
      if (body.pending && Array.isArray(body.pending.items)) {
        await writeDoc(p.pending, { items: body.pending.items.slice(0, 3000), dismissed: (body.pending.dismissed || []).slice(0, 20000), at: new Date().toISOString() });
      }
      if (body.log && body.log.items) {
        for (let i = 0; i < 4; i++) {
          const cur = await readDoc(p.changes);
          const entries = cur.exists && Array.isArray(cur.raw.entries) ? cur.raw.entries : [];
          entries.unshift({ at: new Date().toISOString(), approved: !!body.log.approved, summary: body.log.summary || {}, items: body.log.items.slice(0, 500), more: Math.max(0, body.log.items.length - 500) });
          try {
            await writeDoc(p.changes, { entries: entries.slice(0, 40) }, cur.exists ? { ifMatch: cur.etag } : {});
            break;
          } catch (e) {
            if (!isPrecondition(e)) throw e;
          }
        }
      }
      if (body.checkedAt) await writeDoc(p.check, { at: body.checkedAt });
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Lỗi lưu trạng thái" });
  }
}
