// pages/gomcan.js
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import {
  uid,
  norm,
  sortByFavorite,
  resizeImageFile,
  uploadGomcanImage,
  showToast,
  deleteGomcanImage,
  ViewModeToggle,
  gridColumnsFor,
  SmartImage,
} from "../lib/gomcanHelpers";
import { createSyncer, loadDoc } from "../lib/syncer";
import { usePerm } from "../lib/perm";
import { useSheetSync, SheetSyncBar, SheetSyncModal } from "../lib/SheetSyncUI";
import { FilterChip, SearchInput, EmptyState, GroupTitle, ImagePlaceholder, UndoToast } from "../lib/ui";
import {
  House,
  Footprints,
  Shirt,
  Package,
  SearchX,
  ExternalLink,
  ChevronRight,
  ArrowUp,
  Plus,
  Pencil,
  Trash2,
  Check,
  Heart,
  X,
  Copy,
  MessageSquareQuote,
  ImagePlus,
} from "lucide-react";

/* ================== Helpers ================== */
function buildGiadungQuote(it) {
  if (!it.name) return "";
  if (it.orderType === "ready") {
    if (!it.vnd) return "";
    return `Dạ ${it.name} giá ${it.vnd} bên em có sẵn ạ`;
  }
  if (!it.vnd) return `Dạ ${it.name} (phí cân hiện 19k/lạng) ạ`;
  if (!it.jpy) return `Dạ ${it.name} bên em nhận order giá ${it.vnd} (phí cân hiện 19k/lạng) ạ`;
  return `Dạ ${it.name} bên em nhận order về tay ${it.vnd} ạ`;
}
// Dòng giá hiển thị ra ngoài (thẻ sản phẩm, kết quả tìm kiếm...): luôn ưu
// tiên hiện GIÁ GỒM CÂN (vnd) — không hiện giá Yên ra ngoài nữa. Mã nào chưa
// có giá gồm cân (và cũng chưa có giá Yên để tham khảo) thì hiện "------"
// thay vì dòng chữ "Tính giá như bình thường" như trước.
function giadungOuterPrice(it) {
  if (it.vnd) return it.vnd;
  if (!it.jpy) return "------";
  return "------";
}

export default function GomCan() {
  const { theme: THEME, mode, toggleTheme } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip, thumb } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip, thumb };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("giadung");
  const [gcQuery, setGcQuery] = useState("");
  const [editKey, setEditKey] = useState(null); // { area, id } đang sửa
  const [viewGiadungId, setViewGiadungId] = useState(null); // id sản phẩm đang xem chi tiết
  const [loadFailed, setLoadFailed] = useState(false);
  const perm = usePerm();
  // Hoàn tác xoá trong 10s — cùng cơ chế với Hàng Closet sẵn: xoá thì lưu
  // ngay, hoàn tác thì chèn lại đúng món đó vào dữ liệu HIỆN TẠI; riêng xoá
  // ảnh trên server (không lấy lại được) chờ hết 10s mới làm.
  const undoRef = useRef(null); // { restore, timer, onCommit }
  const [undoInfo, setUndoInfo] = useState(null);
  const dataRef = useRef(null);
  dataRef.current = data;
  // Chỉ gửi phần thay đổi lên server khi lưu — xem lib/syncer.js.
  const syncerRef = useRef(null);
  if (!syncerRef.current) syncerRef.current = createSyncer("/api/gomcan", { onServerData: setData });

  function loadData() {
    setLoading(true);
    setLoadFailed(false);
    loadDoc("/api/gomcan")
      .then(({ data: d, etag }) => {
        syncerRef.current.init(d, etag);
        setData(d);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    loadData();
    const detach = syncerRef.current.attachLifecycle();
    return () => {
      if (undoRef.current) {
        clearTimeout(undoRef.current.timer);
        undoRef.current.onCommit();
        undoRef.current = null;
      }
      detach();
    };
  }, []);

  // Đối chiếu tab Gia dụng + TPCN với Google Sheet BẢNG GIÁ GỒM CÂN.
  async function reloadAfterSync() {
    if (syncerRef.current.hasPending()) return;
    const fr = await fetch("/api/gomcan", { cache: "no-store" }); // không dùng bản tải trước (cũ)
    if (!fr.ok) return;
    const d = await fr.json();
    syncerRef.current.init(d, fr.headers.get("x-hn-etag") || "");
    setData(d);
  }
  const [gdSync, runGdSync, actGdSync] = useSheetSync("/api/giadung-sync", reloadAfterSync);
  const [gdModal, setGdModal] = useState(null); // null | "pending" | "log"
  useEffect(() => {
    runGdSync(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(next) {
    setData(next);
    syncerRef.current.schedule(next);
  }

  function scheduleUndoableDelete({ message, nextData, restore, onCommit = () => {} }) {
    if (undoRef.current) {
      clearTimeout(undoRef.current.timer);
      undoRef.current.onCommit();
      undoRef.current = null;
    }
    persist(nextData);
    const timer = setTimeout(() => {
      onCommit();
      undoRef.current = null;
      setUndoInfo(null);
    }, 10000);
    undoRef.current = { restore, timer, onCommit };
    setUndoInfo({ message });
  }
  function undoDelete() {
    if (!undoRef.current) return;
    clearTimeout(undoRef.current.timer);
    const { restore } = undoRef.current;
    undoRef.current = null;
    setUndoInfo(null);
    persist(restore(dataRef.current));
  }
  function reinsert(list, item, index) {
    const out = (list || []).filter((x) => x.id !== item.id);
    out.splice(Math.min(index, out.length), 0, item);
    return out;
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function quickAddGiadung() {
    setSubTab("giadung");
    setTimeout(() => {
      const el = document.getElementById("giadung-add-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      const inputEl = document.getElementById("giadung-add-name-input");
      if (inputEl) inputEl.focus();
    }, 60);
  }

  if (loadFailed && !loading) {
    return <LoadError onRetry={loadData} />;
  }
  if (loading || !data) {
    return <Loading />;
  }

  /* ---------- Bảng giá theo Yên (Oni / Uni+GU) ---------- */
  function addRate(cat, jpy, vnd, note) {
    if (!jpy || !vnd) return;
    const next = { ...data, oniRates: { ...data.oniRates, [cat]: [...data.oniRates[cat], { id: uid(), jpy, vnd, note: note || "" }] } };
    persist(next);
  }
  function saveRate(cat, id, patch) {
    const next = { ...data, oniRates: { ...data.oniRates, [cat]: data.oniRates[cat].map((r) => (r.id === id ? { ...r, ...patch } : r)) } };
    persist(next);
  }
  function delRate(cat, id) {
    const index = data.oniRates[cat].findIndex((r) => r.id === id);
    const row = data.oniRates[cat][index];
    if (!row) return;
    const next = { ...data, oniRates: { ...data.oniRates, [cat]: data.oniRates[cat].filter((r) => r.id !== id) } };
    scheduleUndoableDelete({
      message: `Đã xoá dòng giá ¥${row.jpy}`,
      nextData: next,
      restore: (cur) => ({ ...cur, oniRates: { ...cur.oniRates, [cat]: reinsert(cur.oniRates[cat], row, index) } }),
    });
  }

  /* ---------- Sản phẩm đã note (Oni / Uni+GU) ---------- */
  function addOniItem(areaKey, item) {
    const next = { ...data, [areaKey]: [{ id: uid(), favorite: false, ...item }, ...data[areaKey]] };
    persist(next);
  }
  function saveOniItem(areaKey, id, patch) {
    const next = { ...data, [areaKey]: data[areaKey].map((it) => (it.id === id ? { ...it, ...patch } : it)) };
    persist(next);
  }
  function delOniItem(areaKey, id) {
    const index = data[areaKey].findIndex((it) => it.id === id);
    const item = data[areaKey][index];
    if (!item) return;
    const next = { ...data, [areaKey]: data[areaKey].filter((it) => it.id !== id) };
    scheduleUndoableDelete({
      message: `Đã xoá "${item.name}"`,
      nextData: next,
      restore: (cur) => ({ ...cur, [areaKey]: reinsert(cur[areaKey], item, index) }),
    });
  }
  function toggleOniFavorite(areaKey, id) {
    const it = data[areaKey].find((x) => x.id === id);
    saveOniItem(areaKey, id, { favorite: !it.favorite });
  }

  /* ---------- Gia dụng ---------- */
  function addGiadungItem(item) {
    const next = { ...data, giadung: [...data.giadung, { id: uid(), favorite: false, ...item }] };
    persist(next);
  }
  function saveGiadungItem(id, patch) {
    const next = { ...data, giadung: data.giadung.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
    persist(next);
  }
  function delGiadungItem(id) {
    const index = data.giadung.findIndex((it) => it.id === id);
    const item = data.giadung[index];
    if (!item) return;
    // Ghi nhớ id đã xoá để server không tự thêm lại sản phẩm mẫu (seed) này
    // mỗi lần tải trang — cùng lỗi từng gặp ở Hàng Closet sẵn.
    const deletedIds = Array.from(new Set([...(data.giadungDeletedIds || []), id]));
    const next = { ...data, giadung: data.giadung.filter((it) => it.id !== id), giadungDeletedIds: deletedIds };
    scheduleUndoableDelete({
      message: `Đã xoá "${item.name}"`,
      nextData: next,
      restore: (cur) => ({
        ...cur,
        giadung: reinsert(cur.giadung, item, index),
        giadungDeletedIds: (cur.giadungDeletedIds || []).filter((x) => x !== id),
      }),
      onCommit: () => deleteGomcanImage(id),
    });
  }
  function toggleGiadungFavorite(id) {
    const it = data.giadung.find((x) => x.id === id);
    saveGiadungItem(id, { favorite: !it.favorite });
  }

  /* ---------- Tìm kiếm theo tên (đầu trang) ---------- */
  function searchAll(q) {
    const tokens = norm(q).split(" ").filter(Boolean);
    if (!tokens.length) return [];
    const all = [];
    [["oniAdult", "Oni · Người lớn"], ["oniKid", "Oni · Trẻ em"], ["unigu", "Uni + GU"]].forEach(([key, label]) => {
      (data[key] || []).forEach((it) => all.push({ ...it, sourceLabel: label, kind: "oni", areaKey: key }));
    });
    (data.giadung || []).forEach((it) => all.push({ ...it, sourceLabel: "Gia dụng + TPCN", kind: "giadung" }));
    const joined = tokens.join("");
    // Ưu tiên tên chính của sản phẩm: tên khớp đủ -> (tên bắt đầu bằng từ khoá lên trước) -> chỉ khớp mã/ghi chú.
    const scored = [];
    all.forEach((p, i) => {
      const nm = norm(p.name || "");
      const h = norm(p.name + " " + (p.code || "") + " " + (p.productNote || ""));
      const inName = tokens.every((t) => nm.includes(t)) || nm.replace(/ /g, "").includes(joined);
      const inAll = inName || tokens.every((t) => h.includes(t)) || h.replace(/ /g, "").includes(joined);
      if (!inAll) return;
      const pos = inName ? Math.max(0, nm.indexOf(tokens[0])) : 9999;
      scored.push({ p, i, rank: inName ? (nm.startsWith(tokens[0]) ? 0 : 1) : 2, pos });
    });
    scored.sort((a, b) => a.rank - b.rank || a.pos - b.pos || a.i - b.i);
    return scored.map((x) => x.p);
  }
  const searchResults = gcQuery.trim() ? searchAll(gcQuery) : [];

  // Bấm vào 1 kết quả tìm kiếm ở đầu trang -> chuyển sang đúng tab và mở
  // luôn chi tiết/sửa của sản phẩm đó, khỏi phải tự đi tìm lại trong danh sách.
  function openSearchResult(p) {
    setGcQuery("");
    if (p.kind === "giadung") {
      setSubTab("giadung");
      setViewGiadungId(p.id);
      return;
    }
    // kind "oni": chuyển đúng tab (oniAdult/oniKid -> "oni", unigu -> "unigu"),
    // mở sẵn chế độ sửa, rồi cuộn tới đúng dòng đó.
    setSubTab(p.areaKey === "unigu" ? "unigu" : "oni");
    setEditKey({ area: p.areaKey, id: p.id });
    setTimeout(() => {
      const el = document.getElementById(`oni-item-${p.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
  }

  const SUB_TABS = [
    ["giadung", "Gia dụng + TPCN", House],
    ["oni", "Giày Onitsuka gồm cân", Footprints],
    ["unigu", "Uniqlo + GU", Shirt],
  ];
  const oniProps = { data, editKey, setEditKey, addRate, saveRate, delRate, addOniItem, saveOniItem, delOniItem, toggleOniFavorite, T };

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 90 }}>
      <PageHeader title="Giá gồm cân" current="/gomcan" maxWidth={900} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        <SearchInput value={gcQuery} onChange={setGcQuery} placeholder="Khách hỏi sản phẩm nào, tìm nhanh ở đây..." T={T} />
        {gcQuery.trim() && (
          <div style={{ marginTop: 10, marginBottom: 16 }}>
            {searchResults.length === 0 ? (
              <div style={{ ...card }}>
                <EmptyState icon={SearchX} title="Không tìm thấy sản phẩm nào khớp" hint="Thử từ khóa khác giúp em ạ." T={T} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: THEME.subtext, margin: "4px 0 8px" }}>{searchResults.length} kết quả</div>
            )}
            {searchResults.map((p) => {
              let priceLine;
              if (p.kind === "oni")
                priceLine = (
                  <>
                    <span style={{ color: THEME.subtext }}>¥{p.jpy || "-"} →</span> <b style={{ color: THEME.brand, fontWeight: 700 }}>{p.vnd || "-"}</b>
                    {p.ready ? <span style={{ color: THEME.subtext }}> · Hàng sẵn: {p.ready}</span> : null}
                  </>
                );
              else priceLine = <b style={{ color: THEME.brand, fontWeight: 700 }}>{giadungOuterPrice(p)}</b>;
              return (
                <div
                  key={p.id}
                  className="hnCard hnClickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => openSearchResult(p)}
                  onKeyDown={(e) => e.key === "Enter" && openSearchResult(p)}
                  style={{ ...card, padding: 10, marginBottom: 8, display: "flex", gap: 12, cursor: "pointer", alignItems: "center" }}
                >
                  <div style={{ width: 64, height: 64, minWidth: 64, borderRadius: 10, overflow: "hidden", border: `1px solid ${THEME.line}` }}>
                    <SmartImage src={p.image} style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} fallback={<ImagePlaceholder icon={Package} size={24} T={T} />} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: THEME.text, overflowWrap: "anywhere" }}>{p.name}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      <span style={{ ...chip, fontSize: 11.5 }}>{p.sourceLabel}</span>
                      {p.code ? <span style={{ ...chip, fontSize: 11.5, background: THEME.surfaceAlt, borderColor: THEME.line, color: THEME.subtext }}>Mã {p.code}</span> : null}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 15 }}>{priceLine}</div>
                    {p.productNote && <div style={{ marginTop: 4, fontSize: 13.5, color: THEME.subtext, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{p.productNote}</div>}
                    {p.link && /^https?:\/\//i.test(p.link) && (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 13, color: THEME.brand, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4, fontWeight: 500 }}>
                        Link gốc <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <ChevronRight size={18} color={THEME.muted} />
                </div>
              );
            })}
          </div>
        )}

        <div className="hnHScroll" style={{ display: "flex", gap: 6, margin: "14px 0 16px", overflowX: "auto" }}>
          {SUB_TABS.map(([k, label, Icon]) => (
            <FilterChip key={k} T={T} active={subTab === k} onClick={() => setSubTab(k)}>
              <Icon size={15} /> {label}
            </FilterChip>
          ))}
        </div>

        {subTab === "oni" && (
          <>
            <OniCategory label="Giày người lớn" areaKey="oniAdult" cat="adult" {...oniProps} />
            <OniCategory label="Giày trẻ em" areaKey="oniKid" cat="kid" {...oniProps} />
          </>
        )}
        {subTab === "unigu" && <OniCategory label="Uniqlo + GU" areaKey="unigu" cat="unigu" {...oniProps} />}
        {subTab === "giadung" && (
          <SheetSyncBar note="tự cập nhật mỗi ngày 1 lần" st={gdSync} run={runGdSync} canEdit={perm.canEdit} onOpen={setGdModal} T={T} summaryText={(m) => `đã cập nhật ${m.updated} sản phẩm`} />
        )}
        {subTab === "giadung" && (
          <GiadungSection
            data={data} editKey={editKey} setEditKey={setEditKey}
            addGiadungItem={addGiadungItem} saveGiadungItem={saveGiadungItem} delGiadungItem={delGiadungItem} toggleGiadungFavorite={toggleGiadungFavorite}
            viewGiadungId={viewGiadungId} setViewGiadungId={setViewGiadungId}
            T={T}
          />
        )}
      </div>

      {gdModal && (
        <SheetSyncModal
          onClose={() => setGdModal(null)}
          changesUrl="/api/giadung-sync?log=1"
          st={gdSync}
          onAct={actGdSync}
          canEdit={perm.canEdit}
          initialTab={gdModal}
          refOf={(x) => ({ k: x.k, key: x.key, sig: x.sig })}
          pendingView={(x, TH) =>
            x.k === "new"
              ? { kind: "Sản phẩm mới", color: TH.success, text: `· Yên: ${x.jpy || "—"} · Giá gồm cân: ${x.vnd || "—"}` }
              : x.k === "gone"
              ? { kind: "Không còn trong file", color: TH.danger, text: "" }
              : { kind: "Thay đổi", color: "#b26a00", text: "\n" + Object.entries(x.f).map(([k, [a, b]]) => `${{ name: "Tên", link: "Link", jpy: "Giá Yên", vnd: "Giá gồm cân" }[k] || k}: ${a || "—"} → ${b || "—"}`).join("\n") }
          }
          logView={(it, TH) =>
            it.k === "new"
              ? { text: `Sản phẩm mới · ${it.to || ""}`, color: TH.success }
              : it.k === "gone"
              ? { text: "Không còn trong file", color: TH.danger }
              : it.k === "back"
              ? { text: "Có lại trong file", color: TH.success }
              : { text: Object.entries(it.f || {}).map(([k, [a, b]]) => `${{ name: "Tên", link: "Link", jpy: "Giá Yên", vnd: "Giá gồm cân" }[k] || k}: ${a || "—"} → ${b || "—"}`).join("\n"), color: TH.text }
          }
          T={T}
        />
      )}

      <div style={{ position: "fixed", right: 16, bottom: "calc(74px + env(safe-area-inset-bottom, 0px))", zIndex: 45, display: "flex", flexDirection: "column", gap: 10 }}>
        {perm.canEdit && (
          <button
            onClick={quickAddGiadung}
            title="Thêm nhanh sản phẩm"
            aria-label="Thêm nhanh sản phẩm"
            style={{ width: 44, height: 44, borderRadius: 14, background: THEME.brand, color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 8px 20px rgba(158,42,59,0.35)", display: "grid", placeItems: "center" }}
          >
            <Plus size={22} />
          </button>
        )}
      </div>

      {undoInfo && <UndoToast message={undoInfo.message} onUndo={undoDelete} />}
    </main>
  );
}

/* ================== Oni / Uni+GU Category ================== */
function OniCategory({ label, areaKey, cat, data, editKey, setEditKey, addRate, saveRate, delRate, addOniItem, saveOniItem, delOniItem, toggleOniFavorite, T }) {
  const { THEME, card, btn, btnSub, iconBtn, inp, chip } = T;
  const perm = usePerm();
  const rates = data.oniRates[cat] || [];
  const log = sortByFavorite(data[areaKey] || []);
  const [rf, setRf] = useState({ jpy: "", vnd: "", note: "" });
  const [nf, setNf] = useState({ name: "", code: "", link: "", jpy: "", vnd: "", ready: "" });
  const smallIcon = { ...iconBtn, width: 30, height: 30 };
  const sectionLabel = { fontSize: 12, fontWeight: 600, color: THEME.subtext, textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 8px" };

  return (
    <section style={{ ...card, padding: 18, marginBottom: 16 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 14px", color: THEME.text }}>{label}</h2>

      <div style={sectionLabel}>Bảng giá theo giá Yên</div>
      <div style={{ border: `1px solid ${THEME.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
        {rates.length === 0 && <div style={{ color: THEME.subtext, fontSize: 14, padding: 12 }}>Chưa có dòng giá nào</div>}
        {rates.map((r, idx) => {
          const isEdit = perm.canEdit && editKey && editKey.area === `rate-${cat}` && editKey.id === r.id;
          const rowStyle = { padding: "10px 12px", borderTop: idx === 0 ? "none" : `1px solid ${THEME.line}` };
          if (isEdit) {
            return (
              <div key={r.id} style={{ ...rowStyle, display: "flex", gap: 8, flexWrap: "wrap", background: THEME.surfaceAlt }}>
                <input style={{ ...inp, width: 110 }} defaultValue={r.jpy} placeholder="Giá Yên" onBlur={(e) => saveRate(cat, r.id, { jpy: e.target.value })} />
                <input style={{ ...inp, width: 120 }} defaultValue={r.vnd} placeholder="Giá gồm cân" onBlur={(e) => saveRate(cat, r.id, { vnd: e.target.value })} />
                <input style={{ ...inp, flex: 1, minWidth: 120 }} defaultValue={r.note} placeholder="Ghi chú" onBlur={(e) => saveRate(cat, r.id, { note: e.target.value })} />
                <button style={{ ...btn, padding: "7px 14px" }} onClick={() => setEditKey(null)}>
                  <Check size={15} /> Xong
                </button>
              </div>
            );
          }
          return (
            <div key={r.id} style={{ ...rowStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 15 }}>
                  <span style={{ color: THEME.subtext }}>¥{r.jpy} →</span> <b style={{ color: THEME.brand, fontWeight: 700 }}>{r.vnd}</b>
                </span>
                {r.note ? <span style={{ fontSize: 13, color: THEME.subtext, marginTop: 1 }}>{r.note}</span> : null}
              </div>
              {perm.canEdit && (
                <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button style={smallIcon} title="Sửa dòng giá" aria-label="Sửa dòng giá" onClick={() => setEditKey({ area: `rate-${cat}`, id: r.id })}>
                    <Pencil size={14} />
                  </button>
                  {perm.canDelete && (
                    <button style={{ ...smallIcon, color: THEME.danger }} title="Xoá dòng giá" aria-label="Xoá dòng giá" onClick={() => delRate(cat, r.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {perm.canEdit && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
          <input style={{ ...inp, flex: "1 1 110px" }} inputMode="numeric" placeholder="Giá Yên" value={rf.jpy} onChange={(e) => setRf({ ...rf, jpy: e.target.value })} />
          <input style={{ ...inp, flex: "1 1 120px" }} placeholder="Giá gồm cân" value={rf.vnd} onChange={(e) => setRf({ ...rf, vnd: e.target.value })} />
          <input style={{ ...inp, flex: "2 1 160px" }} placeholder="Ghi chú (không bắt buộc)" value={rf.note} onChange={(e) => setRf({ ...rf, note: e.target.value })} />
          <button
            style={btnSub}
            disabled={!rf.jpy || !rf.vnd}
            onClick={() => {
              addRate(cat, rf.jpy, rf.vnd, rf.note);
              setRf({ jpy: "", vnd: "", note: "" });
            }}
          >
            <Plus size={15} /> Thêm dòng giá
          </button>
        </div>
      )}

      <div style={{ ...sectionLabel, marginTop: perm.canEdit ? 0 : 18 }}>Sản phẩm đã note ({log.length})</div>
      {log.length === 0 && <div style={{ color: THEME.subtext, fontSize: 14, marginBottom: 8 }}>Chưa note sản phẩm nào</div>}
      {log.map((it, i) => {
        const isEdit = perm.canEdit && editKey && editKey.area === areaKey && editKey.id === it.id;
        if (isEdit) {
          return (
            <div key={it.id} id={`oni-item-${it.id}`} style={{ padding: 12, marginBottom: 8, borderRadius: 12, background: THEME.surfaceAlt, border: `1px solid ${THEME.chipLine}` }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input style={{ ...inp, minWidth: 140, flex: 2 }} defaultValue={it.name} placeholder="Tên" onBlur={(e) => saveOniItem(areaKey, it.id, { name: e.target.value })} />
                <input style={{ ...inp, flex: "1 1 100px" }} defaultValue={it.code} placeholder="Mã" onBlur={(e) => saveOniItem(areaKey, it.id, { code: e.target.value })} />
                <input style={{ ...inp, flex: "2 1 160px" }} defaultValue={it.link} placeholder="Link" onBlur={(e) => saveOniItem(areaKey, it.id, { link: e.target.value })} />
                <input style={{ ...inp, flex: "1 1 90px" }} defaultValue={it.jpy} placeholder="Giá Yên" onBlur={(e) => saveOniItem(areaKey, it.id, { jpy: e.target.value })} />
                <input style={{ ...inp, flex: "1 1 110px" }} defaultValue={it.vnd} placeholder="Giá gồm cân" onBlur={(e) => saveOniItem(areaKey, it.id, { vnd: e.target.value })} />
                <input style={{ ...inp, flex: "1 1 110px" }} defaultValue={it.ready} placeholder="Giá hàng sẵn" onBlur={(e) => saveOniItem(areaKey, it.id, { ready: e.target.value })} />
              </div>
              <button style={{ ...btn, marginTop: 10, padding: "7px 14px" }} onClick={() => setEditKey(null)}>
                <Check size={15} /> Xong
              </button>
            </div>
          );
        }
        const linkOk = it.link && /^https?:\/\//i.test(it.link);
        return (
          <div key={it.id} id={`oni-item-${it.id}`} style={{ padding: "10px 12px", marginBottom: 8, borderRadius: 12, border: `1px solid ${THEME.line}`, background: THEME.surface }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: THEME.text, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: THEME.muted, fontWeight: 500, fontSize: 13 }}>{i + 1}.</span> {it.name}
                  {it.favorite && !perm.canEdit ? <Heart size={14} fill={THEME.brand} color={THEME.brand} /> : null}
                  {it.code ? <span style={{ ...chip, fontSize: 11.5, background: THEME.surfaceAlt, borderColor: THEME.line, color: THEME.subtext }}>Mã {it.code}</span> : null}
                  {linkOk ? (
                    <a href={it.link} target="_blank" rel="noopener noreferrer" title="Mở link gốc" style={{ color: THEME.brand, display: "inline-flex" }}>
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>
                <div style={{ marginTop: 4, fontSize: 15 }}>
                  <span style={{ color: THEME.subtext }}>¥{it.jpy || "-"} →</span> <b style={{ color: THEME.brand, fontSize: 16, fontWeight: 700 }}>{it.vnd || "-"}</b>
                  {it.ready ? <span style={{ color: THEME.subtext, fontSize: 13.5 }}> · Hàng sẵn: {it.ready}</span> : null}
                </div>
              </div>
              {perm.canEdit && (
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button style={{ ...smallIcon, color: it.favorite ? THEME.brand : THEME.subtext }} title="Yêu thích (đưa lên đầu)" aria-pressed={!!it.favorite} onClick={() => toggleOniFavorite(areaKey, it.id)}>
                    <Heart size={15} fill={it.favorite ? THEME.brand : "none"} />
                  </button>
                  <button style={smallIcon} title="Sửa" aria-label="Sửa" onClick={() => setEditKey({ area: areaKey, id: it.id })}>
                    <Pencil size={14} />
                  </button>
                  {perm.canDelete && (
                    <button style={{ ...smallIcon, color: THEME.danger }} title="Xoá" aria-label="Xoá" onClick={() => delOniItem(areaKey, it.id)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {perm.canEdit && (
        <div style={{ marginTop: 14, padding: 12, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 12 }}>
          <div style={{ ...sectionLabel }}>Note sản phẩm mới</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginBottom: 10 }}>
            <input style={inp} placeholder="Tên sản phẩm" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
            <input style={inp} placeholder="Mã sản phẩm" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} />
            <input style={inp} placeholder="Link sản phẩm" value={nf.link} onChange={(e) => setNf({ ...nf, link: e.target.value })} />
            <input style={inp} inputMode="numeric" placeholder="Giá Yên" value={nf.jpy} onChange={(e) => setNf({ ...nf, jpy: e.target.value })} />
            <input style={inp} placeholder="Giá Việt gồm cân" value={nf.vnd} onChange={(e) => setNf({ ...nf, vnd: e.target.value })} />
            <input style={inp} placeholder="Giá hàng sẵn (để so sánh)" value={nf.ready} onChange={(e) => setNf({ ...nf, ready: e.target.value })} />
          </div>
          <button
            style={btn}
            disabled={!nf.name.trim()}
            onClick={() => {
              if (!nf.name.trim()) return;
              addOniItem(areaKey, nf);
              setNf({ name: "", code: "", link: "", jpy: "", vnd: "", ready: "" });
            }}
          >
            <Plus size={16} /> Note sản phẩm này
          </button>
        </div>
      )}
    </section>
  );
}

/* ================== Gia dụng ================== */
function GiadungSection({ data, editKey, setEditKey, addGiadungItem, saveGiadungItem, delGiadungItem, toggleGiadungFavorite, viewGiadungId, setViewGiadungId, T }) {
  const { THEME, card, btn, btnSub, inp } = T;
  const perm = usePerm();
  const list = sortByFavorite(data.giadung || []);
  const [form, setForm] = useState({ name: "", link: "", jpy: "", vnd: "", orderType: "order" });
  const [pendingImg, setPendingImg] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [viewMode, setViewMode] = useState("small");

  async function onPickImage(e, onDone) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 1280, 0.85);
      onDone(dataUrl);
    } catch {
      alert("Không đọc được ảnh này (thường do ảnh chụp thẳng trên iPhone ở định dạng HEIC). Bạn thử lưu ảnh dạng JPG/PNG rồi chọn lại, hoặc chụp màn hình ảnh đó rồi dùng ảnh chụp màn hình nhé.");
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    const newId = uid();
    let imageUrl = "";
    if (pendingImg) {
      try { imageUrl = await uploadGomcanImage(newId, pendingImg); } catch { showToast("⚠️ Sản phẩm đã thêm nhưng ẢNH CHƯA LƯU được (lỗi mạng?). Hãy mở sản phẩm và thêm lại ảnh.", 9000); }
    }
    addGiadungItem({ id: newId, name: form.name, link: form.orderType === "ready" ? "" : form.link, jpy: form.orderType === "ready" ? "" : form.jpy, vnd: form.vnd, orderType: form.orderType, image: imageUrl });
    setForm({ name: "", link: "", jpy: "", vnd: "", orderType: "order" });
    setPendingImg(null);
  }

  const viewingItem = viewGiadungId ? list.find((x) => x.id === viewGiadungId) : null;
  const editingItem = perm.canEdit && editKey && editKey.area === "giadung" ? list.find((x) => x.id === editKey.id) : null;
  const confirmDelItem = confirmDelId ? list.find((x) => x.id === confirmDelId) : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <GroupTitle T={T} count={list.length}>
          Gia dụng + Thực phẩm chức năng
        </GroupTitle>
        <ViewModeToggle mode={viewMode} setMode={setViewMode} T={T} />
      </div>
      {list.length === 0 && <EmptyState icon={Package} title="Chưa có sản phẩm nào" T={T} />}

      <div style={{ display: "grid", gridTemplateColumns: gridColumnsFor(viewMode), gap: 12, marginBottom: 20 }}>
        {list.map((it, i) => (
          <GiadungCard key={it.id} it={it} idx={i + 1} listMode={viewMode === "list"} onOpen={() => setViewGiadungId(it.id)} onFavorite={() => toggleGiadungFavorite(it.id)} T={T} />
        ))}
      </div>

      {viewingItem && (
        <GiadungDetailModal
          it={viewingItem}
          onClose={() => setViewGiadungId(null)}
          onEdit={() => { setViewGiadungId(null); setEditKey({ area: "giadung", id: viewingItem.id }); }}
          onDelete={() => setConfirmDelId(viewingItem.id)}
          onFavorite={() => toggleGiadungFavorite(viewingItem.id)}
          T={T}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelItem}
        message={`Xoá sản phẩm "${confirmDelItem ? confirmDelItem.name : ""}"? (có 10s để hoàn tác sau khi xoá)`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delGiadungItem(confirmDelId);
          setConfirmDelId(null);
          setViewGiadungId(null);
        }}
      />

      {editingItem && (
        <GiadungEditModal it={editingItem} onDone={() => setEditKey(null)} onSave={(patch) => saveGiadungItem(editingItem.id, patch)} onPickImage={onPickImage} T={T} />
      )}

      {perm.canEdit && (
        <div id="giadung-add-form" style={{ ...card, padding: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={18} color={THEME.brand} /> Thêm sản phẩm
          </h3>
          <input id="giadung-add-name-input" style={{ ...inp, marginBottom: 10 }} placeholder="Tên sản phẩm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ ...btnSub, cursor: "pointer" }}>
              <ImagePlus size={16} /> {pendingImg ? "Đổi ảnh" : "Chọn ảnh"}
              <input type="file" accept="image/*" onChange={(e) => onPickImage(e, setPendingImg)} style={{ display: "none" }} />
            </label>
            {pendingImg && <img src={pendingImg} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", border: `1px solid ${THEME.line}` }} />}
            <OrderTypeToggle value={form.orderType} onChange={(v) => setForm({ ...form, orderType: v })} T={T} />
          </div>
          {form.orderType !== "ready" && (
            <input style={{ ...inp, marginBottom: 10 }} placeholder="Link gốc sản phẩm" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          )}
          <div style={{ display: "grid", gridTemplateColumns: form.orderType !== "ready" ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 12 }}>
            {form.orderType !== "ready" && <input style={inp} inputMode="numeric" placeholder="Giá Yên (JPY)" value={form.jpy} onChange={(e) => setForm({ ...form, jpy: e.target.value })} />}
            <input style={inp} placeholder="Giá Việt gồm cân (VNĐ)" value={form.vnd} onChange={(e) => setForm({ ...form, vnd: e.target.value })} />
          </div>
          <button style={btn} onClick={handleAdd} disabled={!form.name.trim()}>
            <Plus size={16} /> Thêm sản phẩm
          </button>
        </div>
      )}
    </div>
  );
}

// Chọn "Hàng order" / "Hàng sẵn" dạng 2 nút liền nhau.
function OrderTypeToggle({ value, onChange, T }) {
  const { THEME } = T;
  const opts = [
    ["order", "Hàng order"],
    ["ready", "Hàng sẵn"],
  ];
  return (
    <div role="radiogroup" style={{ display: "inline-flex", background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 10, padding: 3, gap: 2 }}>
      {opts.map(([k, label]) => {
        const active = value === k;
        return (
          <button
            key={k}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(k)}
            style={{ border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", background: active ? THEME.surface : "transparent", color: active ? THEME.brand : THEME.subtext, boxShadow: active ? "0 1px 3px rgba(44,26,30,0.12)" : "none" }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ---- Ô vuông trong lưới sản phẩm (hoặc dòng ngang khi ở chế độ danh sách) ---- */
function GiadungCard({ it, idx, listMode, onOpen, onFavorite, T }) {
  const { THEME, card, chip, iconBtn } = T;
  const perm = usePerm();
  const isReady = it.orderType === "ready";
  const priceLine = giadungOuterPrice(it);
  const clickProps = {
    onClick: onOpen,
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
  };
  const typeChip = (
    <span style={{ ...chip, fontSize: 11, padding: "1px 8px", ...(isReady ? { background: THEME.successBg, borderColor: THEME.successLine, color: THEME.success } : {}) }}>
      {isReady ? "Hàng sẵn" : "Hàng order"}
    </span>
  );
  const favButton = (extraStyle) =>
    perm.canEdit ? (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFavorite();
        }}
        title="Yêu thích (đưa lên đầu)"
        aria-pressed={!!it.favorite}
        style={{ ...extraStyle, color: it.favorite ? THEME.brand : THEME.subtext }}
      >
        <Heart size={15} fill={it.favorite ? THEME.brand : "none"} />
      </button>
    ) : it.favorite ? (
      <span style={{ ...extraStyle, color: THEME.brand, cursor: "default" }}>
        <Heart size={15} fill={THEME.brand} />
      </span>
    ) : null;

  if (listMode) {
    return (
      <div className="hnCard hnRowItem hnClickable" {...clickProps} style={{ ...card, minWidth: 0, maxWidth: "100%", cursor: "pointer", display: "flex", gap: 12, padding: 10, alignItems: "center" }}>
        <div style={{ position: "relative", width: 60, height: 60, minWidth: 60, borderRadius: 10, overflow: "hidden", background: THEME.surfaceAlt }}>
          <SmartImage src={it.image} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }} fallback={<ImagePlaceholder icon={Package} size={22} T={T} />} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}{it.gone && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: T.THEME.danger, border: `1px solid ${T.THEME.danger}`, borderRadius: 999, padding: "0 6px", whiteSpace: "nowrap" }}>Không còn trong file</span>}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
            {typeChip}
            <span style={{ fontWeight: 700, color: THEME.brand, fontSize: 14.5 }}>{priceLine}</span>
          </div>
        </div>
        {favButton({ ...iconBtn })}
      </div>
    );
  }

  return (
    <div className="hnCard hnListItem hnClickable" {...clickProps} style={{ ...card, minWidth: 0, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", width: "100%", paddingTop: "100%", background: THEME.surfaceAlt, borderBottom: `1px solid ${THEME.line}` }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <SmartImage src={it.image} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }} fallback={<ImagePlaceholder icon={Package} size={34} T={T} />} />
          {favButton({ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 999, border: "none", background: "rgba(255,250,245,0.92)", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" })}
          <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(255,255,255,0.9)", color: THEME.subtext, fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "1px 7px" }}>{idx}</span>
        </div>
      </div>
      <div style={{ padding: "10px 11px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 36 }}>{it.name}{it.gone && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: T.THEME.danger, border: `1px solid ${T.THEME.danger}`, borderRadius: 999, padding: "0 6px", whiteSpace: "nowrap" }}>Không còn trong file</span>}</div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: THEME.brand, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{priceLine}</span>
        </div>
        <div style={{ marginTop: 6 }}>{typeChip}</div>
      </div>
    </div>
  );
}

/* ---- Popup xem nhanh, gọn, bao quát 1 sản phẩm ---- */
function GiadungDetailModal({ it, onClose, onEdit, onDelete, onFavorite, T }) {
  const { THEME, card, chip, iconBtn, btnSub } = T;
  const perm = usePerm();
  const isReady = it.orderType === "ready";
  const quote = buildGiadungQuote(it);
  const linkOk = it.link && /^https?:\/\//i.test(it.link);
  const priceLine = giadungOuterPrice(it);
  const [copied, setCopied] = useState(false);
  function copyQuote() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(quote).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div onClick={onClose} className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(44,26,30,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="hnPop" style={{ ...card, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", padding: 0, boxShadow: "0 24px 60px rgba(44,26,30,0.25)" }}>
        <div style={{ position: "relative", width: "100%", paddingTop: "80%", background: THEME.surfaceAlt, borderBottom: `1px solid ${THEME.line}` }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <SmartImage src={it.image} lazy={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }} fallback={<ImagePlaceholder icon={Package} size={56} T={T} />} />
            <button
              onClick={onClose}
              aria-label="Đóng"
              style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(255,250,245,0.92)", color: THEME.text, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.35, flex: 1, minWidth: 0, overflowWrap: "break-word" }}>{it.name}{it.gone && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: T.THEME.danger, border: `1px solid ${T.THEME.danger}`, borderRadius: 999, padding: "0 6px", whiteSpace: "nowrap" }}>Không còn trong file</span>}</h3>
            {perm.canEdit && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button style={{ ...iconBtn, color: it.favorite ? THEME.brand : THEME.subtext }} title="Yêu thích" aria-pressed={!!it.favorite} onClick={onFavorite}>
                  <Heart size={15} fill={it.favorite ? THEME.brand : "none"} />
                </button>
                <button style={iconBtn} title="Sửa" aria-label="Sửa" onClick={onEdit}>
                  <Pencil size={15} />
                </button>
                {perm.canDelete && (
                  <button style={{ ...iconBtn, color: THEME.danger }} title="Xoá" aria-label="Xoá" onClick={onDelete}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ ...chip, ...(isReady ? { background: THEME.successBg, borderColor: THEME.successLine, color: THEME.success } : {}) }}>{isReady ? "Hàng sẵn" : "Hàng order"}</span>
            {linkOk && (
              <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ color: THEME.brand, fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
                Link gốc <ExternalLink size={13} />
              </a>
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700, color: THEME.brand }}>{priceLine}</div>
          {!isReady && it.jpy && <div style={{ marginTop: 2, fontSize: 13, color: THEME.subtext }}>¥{it.jpy} (giá Yên)</div>}
          {quote && (
            <div style={{ marginTop: 14, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 14, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <MessageSquareQuote size={17} color={THEME.brand} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, lineHeight: 1.45 }}>{quote}</span>
              <button style={{ ...btnSub, padding: "6px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text }} onClick={copyQuote}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép"}
              </button>
            </div>
          )}
          {it.productNote && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: THEME.subtext, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Tính năng sản phẩm</div>
              <div style={{ fontSize: 14.5, color: THEME.text, whiteSpace: "pre-line", overflowWrap: "anywhere", lineHeight: 1.55 }}>{it.productNote}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Popup sửa sản phẩm ---- */
function GiadungEditModal({ it, onDone, onSave, onPickImage, T }) {
  const { THEME, card, inp, btnSub, btn, iconBtn } = T;
  const [editImg, setEditImg] = useState(null);
  const label = { fontSize: 12.5, fontWeight: 600, color: THEME.subtext, marginBottom: 5, display: "block" };

  return (
    <div onClick={onDone} className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(44,26,30,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="hnPop" style={{ ...card, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", padding: 20, boxShadow: "0 24px 60px rgba(44,26,30,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <Pencil size={17} color={THEME.brand} /> Sửa sản phẩm
          </h3>
          <button onClick={onDone} aria-label="Đóng" style={iconBtn}>
            <X size={17} />
          </button>
        </div>
        <span style={label}>Tên sản phẩm</span>
        <input style={{ ...inp, marginBottom: 12 }} defaultValue={it.name} placeholder="Tên sản phẩm" onBlur={(e) => onSave({ name: e.target.value })} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          {(editImg || it.image) && <img src={editImg || it.image} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", border: `1px solid ${THEME.line}` }} />}
          <label style={{ ...btnSub, cursor: "pointer" }}>
            <ImagePlus size={16} /> {it.image || editImg ? "Đổi ảnh" : "Thêm ảnh"}
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) =>
                onPickImage(e, async (dataUrl) => {
                  setEditImg(dataUrl);
                  try {
                    const url = await uploadGomcanImage(it.id, dataUrl);
                    onSave({ image: url });
                  } catch {
                    setEditImg(null);
                    showToast("⚠️ ẢNH CHƯA LƯU được (lỗi mạng?). Hãy chọn lại ảnh.", 9000);
                  }
                })
              }
            />
          </label>
          <OrderTypeToggle value={it.orderType === "ready" ? "ready" : "order"} onChange={(v) => onSave({ orderType: v })} T={T} />
        </div>
        {it.orderType !== "ready" && (
          <>
            <span style={label}>Link gốc</span>
            <input style={{ ...inp, marginBottom: 12 }} defaultValue={it.link} placeholder="Link gốc" onBlur={(e) => onSave({ link: e.target.value })} />
          </>
        )}
        <div style={{ display: "grid", gridTemplateColumns: it.orderType !== "ready" ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 12 }}>
          {it.orderType !== "ready" && (
            <div>
              <span style={label}>Giá Yên</span>
              <input style={inp} inputMode="numeric" defaultValue={it.jpy} placeholder="Giá Yên" onBlur={(e) => onSave({ jpy: e.target.value })} />
            </div>
          )}
          <div>
            <span style={label}>Giá gồm cân</span>
            <input style={inp} defaultValue={it.vnd} placeholder="Giá gồm cân" onBlur={(e) => onSave({ vnd: e.target.value })} />
          </div>
        </div>
        <span style={label}>Ghi chú / tính năng sản phẩm</span>
        <textarea
          style={{ ...inp, minHeight: 90, marginBottom: 14, resize: "vertical", lineHeight: 1.5 }}
          defaultValue={it.productNote || ""}
          placeholder="Ghi chú riêng cho sản phẩm này: đặc điểm, size, màu, lưu ý khi bán..."
          onBlur={(e) => onSave({ productNote: e.target.value })}
          lang="vi"
          spellCheck={false}
        />
        <button style={{ ...btn, width: "100%" }} onClick={onDone}>
          <Check size={16} /> Xong
        </button>
      </div>
    </div>
  );
}
