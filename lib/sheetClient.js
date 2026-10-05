// lib/sheetClient.js — CHỈ chạy ở trình duyệt (tài khoản Quản lý).
// Đối chiếu dữ liệu với file Google Sheet NGAY TRÊN MÁY CỦA QUẢN LÝ (máy chủ Cloudflare gói miễn phí chỉ cho
// ~10 mili giây tính toán mỗi lượt nên không tự đọc/so sánh Excel được):
//   1. Máy chủ chuyển nguyên file Google về (/api/sheet-raw).
//   2. Trình duyệt đọc file, so với dữ liệu đang có -> danh sách "chờ duyệt" + cập nhật tự động.
//   3. Kết quả được lưu lên máy chủ (/api/sheet-state) và dữ liệu được lưu bằng cơ chế sửa-dữ-liệu thường.
// Khách chỉ xem nên không chạy gì ở đây.

const DAY = 24 * 3600e3;
const recsCache = {}; // tab -> { at, recs }  (duyệt/bỏ qua liên tiếp dùng lại bản vừa đọc, tối đa 5 phút)

async function fetchRaw(tab) {
  const r = await fetch(`/api/sheet-raw?tab=${tab}`, { cache: "no-store" });
  if (r.status === 401) throw Object.assign(new Error("unauthorized"), { code: 401 });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || "Không đọc được file Google Sheet");
  }
  return { fmt: r.headers.get("x-sheet-format") || "xlsx", buf: await r.arrayBuffer() };
}

// ---- Từng tab: cách đọc file + cách so sánh ----
const ADAPTERS = {
  closet: {
    minRecs: 50,
    tooFew: "File Google Sheet đọc ra quá ít mã — giữ nguyên dữ liệu cũ để an toàn",
    async parse({ fmt, buf }) {
      const m = await import("./closetSheet");
      const src = fmt === "csv"
        ? { rows: m.parseCsv(new TextDecoder().decode(buf)), yellow: new Set(), colors: false }
        : m.readXlsxRows(new Uint8Array(buf));
      return m.parseClosetRows(src);
    },
    rejectKey: (x) => (x.k === "price" ? `price:${x.key}:${x.to}` : `${x.k === "gone" ? "gone" : "add"}:${x.key}`),
    bucket: (x) => (x.k === "gone" ? "gone" : x.k === "price" ? "price" : "add"),
    buckets: () => ({ add: [], gone: [], price: [] }),
    async merge(data, recs, approved, dismissed) {
      const m = await import("./closetSheet");
      const { SEED_CLOSET } = await import("./closetSeed");
      const r = m.mergeClosetFromSheet(data.closet || [], recs, {
        seedIds: new Set(SEED_CLOSET.map((p) => p.id)),
        deletedIds: data.closetDeletedIds || [],
        deletedVariantIds: data.closetDeletedVariantIds || [],
        approved,
        dismissed,
      });
      return { patch: { closet: r.closet }, summary: r.summary, items: r.items, proposals: r.proposals };
    },
  },
  giadung: {
    minRecs: 10,
    tooFew: "File Google Sheet đọc ra quá ít sản phẩm — giữ nguyên dữ liệu cũ để an toàn",
    async parse({ buf }) {
      const m = await import("./giadungSheet");
      const rows = m.rowsFromXlsx(new Uint8Array(buf));
      if (!rows) throw new Error("Không tìm thấy tab Gia dụng/TPCN (cột TÊN SẢN PHẨM, LINK SẢN PHẨM, GIÁ GỒM CÂN) trong file");
      return m.parseGiadungRows(rows);
    },
    rejectKey: (x) => (x.k === "chg" ? `chg:${x.key}:${x.sig}` : `${x.k}:${x.key}`),
    bucket: (x) => x.k,
    buckets: () => ({ chg: [], new: [], gone: [] }),
    async merge(data, recs, approved, dismissed) {
      const m = await import("./giadungSheet");
      const { SEED_GIADUNG } = await import("./giadungSeed");
      const delIds = data.giadungDeletedIds || [];
      const r = m.mergeGiadungFromSheet(data.giadung || [], recs, {
        seedIds: new Set(SEED_GIADUNG.map((p) => p.id)),
        deletedIds: delIds,
        deletedItems: SEED_GIADUNG.filter((x) => delIds.includes(x.id)),
        approved,
        dismissed,
      });
      return { patch: { giadung: r.list }, summary: r.summary, items: r.items, proposals: r.proposals };
    },
  },
  thietbi: {
    minRecs: 3,
    tooFew: "File Google Sheet đọc ra quá ít sản phẩm — giữ nguyên dữ liệu cũ để an toàn",
    async parse({ buf }) {
      const m = await import("./thietbiSheet");
      const rows = m.rowsFromXlsx(new Uint8Array(buf));
      if (!rows) throw new Error("Không tìm thấy bảng thiết bị (cột KHU VỰC, MÃ SẢN PHẨM...) trong file");
      return m.parseThietbiRows(rows);
    },
    rejectKey: (x) => `${x.k}:${x.key}`,
    bucket: (x) => x.k,
    buckets: () => ({ new: [] }),
    async merge(data, recs, approved, dismissed) {
      const m = await import("./thietbiSheet");
      const { SEED_THIETBI } = await import("./thietbiSeed");
      const delIds = data.thietbiDeletedIds || [];
      const r = m.mergeThietbiFromSheet(data.thietbi || [], recs, {
        deletedItems: SEED_THIETBI.filter((x) => delIds.includes(x.id)),
        deletedIds: delIds,
        approved,
        dismissed,
      });
      return { patch: { thietbi: r.list }, summary: r.summary, items: r.items, proposals: r.proposals };
    },
  },
};

export async function getSheetState(tab) {
  const r = await fetch(`/api/sheet-state?tab=${tab}`, { cache: "no-store" });
  if (r.status === 401) throw Object.assign(new Error("unauthorized"), { code: 401 });
  if (!r.ok) throw new Error("Không đọc được trạng thái đối chiếu");
  return r.json();
}

async function saveState(tab, body) {
  const r = await fetch("/api/sheet-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tab, ...body }), cache: "no-store" });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || "Không lưu được kết quả đối chiếu");
  }
}

// ctx: { getData(): dữ liệu hiện tại của trang, applyPatch(patch): lưu phần dữ liệu thay đổi }
// opts: { force, action: { approve:[{k,key,...}], reject:[...] } }
// -> { changed, summary, at, pending, skipped }
export async function runSheetSync(tab, ctx, { force = false, action = null } = {}) {
  const A = ADAPTERS[tab];
  const approve = (action && action.approve) || [];
  const reject = (action && action.reject) || [];
  const isAction = approve.length + reject.length > 0;
  const state = await getSheetState(tab);
  if (!force && !isAction && state.checkedAt && Date.now() - new Date(state.checkedAt).getTime() < DAY) {
    return { changed: false, skipped: true, at: state.checkedAt, pending: state.items || [] };
  }
  let recs;
  const c = recsCache[tab];
  if (isAction && c && Date.now() - c.at < 5 * 60 * 1000) recs = c.recs;
  else {
    recs = await A.parse(await fetchRaw(tab));
    recsCache[tab] = { at: Date.now(), recs };
  }
  if (recs.length < A.minRecs) throw new Error(A.tooFew);
  const dismissed = new Set(state.dismissed || []);
  for (const x of reject) dismissed.add(A.rejectKey(x));
  const approved = A.buckets();
  for (const x of approve) approved[A.bucket(x)] && approved[A.bucket(x)].push(x.key);
  const isApproval = Object.values(approved).some((a) => a.length > 0);
  const res = await A.merge(ctx.getData(), recs, approved, Array.from(dismissed));
  const changed = res.items.length > 0;
  const at = new Date().toISOString();
  if (changed) await ctx.applyPatch(res.patch);
  await saveState(tab, {
    pending: { items: res.proposals, dismissed: Array.from(dismissed) },
    checkedAt: at,
    ...(changed ? { log: { summary: res.summary, items: res.items, approved: isApproval } } : {}),
  });
  return { changed, summary: res.summary, at, pending: res.proposals, total: recs.length };
}
