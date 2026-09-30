// pages/sieuthi.js
// Trang "Giá siêu thị": tổng quan giá các sản phẩm siêu thị (giá niêm yết,
// giá bán Social, Shopee, Lazada...) để tra nhanh khi báo giá. Sản phẩm hết
// hàng được đánh dấu riêng và mặc định chỉ hiện hàng còn. Cùng cơ chế lưu
// phần sửa + hoàn tác xoá 10s như các trang khác.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { uid, norm } from "../lib/gomcanHelpers";
import { createSyncer, loadDoc } from "../lib/syncer";
import { usePerm } from "../lib/perm";
import { FilterChip, SearchInput, EmptyState, UndoToast } from "../lib/ui";
import { Plus, Pencil, Trash2, Copy, Check, SearchX, ArrowUpDown, Globe, ExternalLink, PackageX, PackageCheck } from "lucide-react";

const PAGE = 50;

function fmtK(n) {
  if (n == null) return "";
  const k = n / 1000;
  return (Number.isInteger(k) ? k : Math.round(k * 10) / 10).toString().replace(".", ",") + "k";
}
// "170k", "170.000", "170" (= 170k) -> số VNĐ; ô trống -> null.
function parseMoney(s) {
  const t = (s || "").toString().toLowerCase().trim();
  if (!t) return null;
  const hasK = t.includes("k");
  const d = t.replace(/[^0-9.,]/g, "");
  if (!d) return null;
  let n;
  if (hasK) n = Math.round(parseFloat(d.replace(",", ".")) * 1000);
  else {
    n = parseFloat(d.replace(/[.,]/g, ""));
    if (n < 10000) n *= 1000;
  }
  return isNaN(n) || n <= 0 ? null : n;
}
function copyText(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text || "").catch(() => {});
}
function mainPrice(p) {
  return p.price || p.list || null;
}

export default function SieuThiPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip };
  const perm = usePerm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [q, setQ] = useState("");
  const [stock, setStock] = useState("con"); // con | het | all
  const [sort, setSort] = useState("none"); // none | asc | desc
  const [visible, setVisible] = useState(PAGE);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const undoRef = useRef(null);
  const [undoInfo, setUndoInfo] = useState(null);
  const dataRef = useRef(null);
  dataRef.current = data;
  const syncerRef = useRef(null);
  if (!syncerRef.current) syncerRef.current = createSyncer("/api/sieuthi", { onServerData: setData });

  function loadData() {
    setLoading(true);
    setLoadFailed(false);
    loadDoc("/api/sieuthi")
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
      if (undoRef.current) clearTimeout(undoRef.current.timer);
      detach();
    };
  }, []);
  useEffect(() => setVisible(PAGE), [q, stock, sort]);

  const list = (data && data.products) || [];
  // Chuỗi tìm kiếm của từng sản phẩm tính 1 lần (gần 2000 mục).
  const haystacks = useMemo(() => new Map(list.map((p) => [p.id, norm(`${p.name} ${p.code || ""}`)])), [list]);
  const counts = useMemo(() => {
    let het = 0;
    for (const p of list) if (p.oos) het++;
    return { all: list.length, het, con: list.length - het };
  }, [list]);
  const filtered = useMemo(() => {
    const nq = norm(q);
    let out = list.filter((p) => {
      if (stock === "con" && p.oos) return false;
      if (stock === "het" && !p.oos) return false;
      return !nq || (haystacks.get(p.id) || "").includes(nq);
    });
    if (sort !== "none") {
      const dir = sort === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = mainPrice(a), y = mainPrice(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x - y) * dir;
      });
    }
    return out;
  }, [list, haystacks, q, stock, sort]);

  if (loadFailed && !loading) return <LoadError onRetry={loadData} />;
  if (loading || !data) return <Loading />;

  function persist(next) {
    setData(next);
    syncerRef.current.schedule(next);
  }
  function addProduct(item) {
    persist({ ...data, products: [{ id: uid(), ...item }, ...list] });
  }
  function saveProduct(id, patch) {
    persist({ ...data, products: list.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }
  function delProduct(id) {
    const index = list.findIndex((p) => p.id === id);
    const item = list[index];
    if (!item) return;
    if (undoRef.current) clearTimeout(undoRef.current.timer);
    persist({ ...data, products: list.filter((p) => p.id !== id), productsDeletedIds: Array.from(new Set([...(data.productsDeletedIds || []), id])) });
    const restore = (cur) => {
      const out = (cur.products || []).filter((p) => p.id !== id);
      out.splice(Math.min(index, out.length), 0, item);
      return { ...cur, products: out, productsDeletedIds: (cur.productsDeletedIds || []).filter((x) => x !== id) };
    };
    const timer = setTimeout(() => {
      undoRef.current = null;
      setUndoInfo(null);
    }, 10000);
    undoRef.current = { restore, timer };
    setUndoInfo({ message: `Đã xoá "${item.name.slice(0, 40)}"` });
  }
  function undoDelete() {
    if (!undoRef.current) return;
    clearTimeout(undoRef.current.timer);
    const { restore } = undoRef.current;
    undoRef.current = null;
    setUndoInfo(null);
    persist(restore(dataRef.current));
  }

  const shown = filtered.slice(0, visible);
  const confirmDel = confirmDelId ? list.find((p) => p.id === confirmDelId) : null;
  const sortLabel = sort === "asc" ? "Giá thấp → cao" : sort === "desc" ? "Giá cao → thấp" : "Sắp xếp theo giá";

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Giá siêu thị" current="/sieuthi" maxWidth={960} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: THEME.subtext }}>
            <b style={{ color: THEME.text }}>{counts.con}</b> còn hàng · <b style={{ color: THEME.danger }}>{counts.het}</b> hết hàng
          </div>
          {perm.canEdit && (
            <button style={showAdd ? btnSub : btn} onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? "Đóng" : (<><Plus size={16} /> Thêm sản phẩm</>)}
            </button>
          )}
        </div>

        {showAdd && perm.canEdit && (
          <ProductForm
            T={T}
            initial={{}}
            submitLabel="Thêm sản phẩm"
            onSubmit={(item) => {
              addProduct(item);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên sản phẩm hoặc mã vạch..." T={T} />
          <div className="hnHScroll" style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" }}>
            <FilterChip T={T} active={stock === "con"} onClick={() => setStock("con")}>
              Còn hàng · {counts.con}
            </FilterChip>
            <FilterChip T={T} active={stock === "het"} tone="danger" onClick={() => setStock("het")}>
              Hết hàng · {counts.het}
            </FilterChip>
            <FilterChip T={T} active={stock === "all"} onClick={() => setStock("all")}>
              Tất cả · {counts.all}
            </FilterChip>
            <FilterChip T={T} active={sort !== "none"} onClick={() => setSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none"))}>
              <ArrowUpDown size={14} /> {sortLabel}
            </FilterChip>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={SearchX} title="Không tìm thấy sản phẩm nào" hint={stock === "con" ? "Thử tìm ở mục “Tất cả” hoặc “Hết hàng”." : "Thử từ khác."} T={T} />
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: THEME.muted, margin: "0 2px 8px" }}>
              {q || stock !== "con" ? `${filtered.length} kết quả` : `${filtered.length} sản phẩm`}
            </div>
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              {shown.map((p, i) => (
                <ProductRow key={p.id} p={p} first={i === 0} saveProduct={saveProduct} onDelete={() => setConfirmDelId(p.id)} T={T} />
              ))}
            </div>
            {filtered.length > shown.length && (
              <div style={{ textAlign: "center", marginTop: 14 }}>
                <button style={btnSub} onClick={() => setVisible((v) => v + PAGE)}>
                  Hiện thêm {Math.min(PAGE, filtered.length - shown.length)} sản phẩm · còn {filtered.length - shown.length}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        message={`Xoá sản phẩm "${confirmDel ? confirmDel.name.slice(0, 60) : ""}"? (có 10s để hoàn tác sau khi xoá)`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delProduct(confirmDelId);
          setConfirmDelId(null);
        }}
      />
      {undoInfo && <UndoToast message={undoInfo.message} onUndo={undoDelete} />}
    </main>
  );
}

function PriceChip({ label, value, THEME, strike, tone }) {
  if (!value) return null;
  const danger = tone === "danger";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 5,
        fontSize: 12.5,
        background: danger ? THEME.dangerBg : THEME.surfaceAlt,
        border: `1px solid ${danger ? "#f3c9cb" : THEME.line}`,
        color: danger ? THEME.danger : THEME.subtext,
        borderRadius: 999,
        padding: "2px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {label} <b style={{ color: danger ? THEME.danger : THEME.text, fontWeight: 650, textDecoration: strike ? "line-through" : "none" }}>{fmtK(value)}</b>
    </span>
  );
}

function LinkIcon({ href, title, children, THEME }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={title}
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 600, color: THEME.brand, textDecoration: "none", padding: "2px 4px" }}
    >
      {children} <ExternalLink size={11} />
    </a>
  );
}

function ProductRow({ p, first, saveProduct, onDelete, T }) {
  const { THEME, btnSub, iconBtn } = T;
  const perm = usePerm();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const border = first ? "none" : `1px solid ${THEME.line}`;
  const price = mainPrice(p);
  const hasSocial = !!p.price;
  const shopee = p.shopeeNew || p.shopeeOld;
  const discount = p.list && p.price && p.list > p.price ? Math.round((1 - p.price / p.list) * 100) : 0;
  const smallIcon = { ...iconBtn, width: 30, height: 30 };

  if (editing && perm.canEdit) {
    return (
      <div style={{ borderTop: border, padding: 10 }}>
        <ProductForm
          T={T}
          flat
          initial={p}
          submitLabel="Lưu"
          onSubmit={(patch) => {
            saveProduct(p.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="hnRowItem" style={{ borderTop: border, padding: "12px 14px", opacity: p.oos ? 0.62 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.4, color: THEME.text, overflowWrap: "anywhere" }}>
            {p.oos && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 700, color: THEME.danger, background: THEME.dangerBg, border: "1px solid #f3c9cb", borderRadius: 999, padding: "0 8px", marginRight: 6, verticalAlign: "1px" }}>
                <PackageX size={11} /> Hết hàng
              </span>
            )}
            {p.name}
          </div>
          {p.code ? <div style={{ fontSize: 12, color: THEME.muted, marginTop: 1 }}>Mã {p.code}</div> : null}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {price ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 18, color: THEME.brand, lineHeight: 1.2 }}>{fmtK(price)}</div>
              <div style={{ fontSize: 11.5, color: THEME.muted }}>{hasSocial ? "Giá Social" : "Niêm yết"}</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: THEME.muted }}>Chưa có giá</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {hasSocial && p.list ? <PriceChip label="Niêm yết" value={p.list} THEME={THEME} strike /> : null}
        {discount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: THEME.success, background: THEME.successBg, border: `1px solid ${THEME.successLine}`, borderRadius: 999, padding: "2px 8px" }}>-{discount}%</span>
        )}
        <PriceChip label="Shopee" value={shopee} THEME={THEME} />
        <PriceChip label="Lazada" value={p.lazada} THEME={THEME} />
        <PriceChip label="Xả kho" value={p.clearance} THEME={THEME} tone="danger" />
        <span style={{ flex: 1 }} />
        <LinkIcon href={p.linkWeb} title="Mở trang web Hanaichi" THEME={THEME}><Globe size={13} /> Web</LinkIcon>
        <LinkIcon href={p.linkShopee} title="Mở Shopee" THEME={THEME}>Shopee</LinkIcon>
        <LinkIcon href={p.linkLazada} title="Mở Lazada" THEME={THEME}>Lazada</LinkIcon>
        {price ? (
          <button
            title="Chép tên và giá"
            style={{ ...btnSub, padding: "4px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text }}
            onClick={() => {
              copyText(`${p.name}: ${fmtK(price)}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép giá"}
          </button>
        ) : null}
        {perm.canEdit && (
          <button
            title={p.oos ? "Báo có hàng lại" : "Báo hết hàng"}
            style={{ ...btnSub, padding: "4px 10px", fontSize: 13, color: p.oos ? THEME.success : THEME.danger }}
            onClick={() => saveProduct(p.id, { oos: !p.oos })}
          >
            {p.oos ? <PackageCheck size={14} /> : <PackageX size={14} />} {p.oos ? "Có hàng lại" : "Hết hàng"}
          </button>
        )}
        {perm.canEdit && (
          <button title="Sửa" aria-label="Sửa" style={smallIcon} onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </button>
        )}
        {perm.canDelete && (
          <button title="Xoá" aria-label="Xoá" style={{ ...smallIcon, color: THEME.danger }} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

const FIELDS = [
  ["list", "Giá niêm yết", "money"],
  ["price", "Giá bán Social (web, fb, offline)", "money"],
  ["shopeeNew", "Giá Shopee mới", "money"],
  ["shopeeOld", "Giá Shopee cũ", "money"],
  ["lazada", "Giá Lazada", "money"],
  ["clearance", "Giá xả kho / xả cận date", "money"],
  ["linkWeb", "Link web", "text"],
  ["linkShopee", "Link Shopee", "text"],
  ["linkLazada", "Link Lazada", "text"],
];

function ProductForm({ initial, onSubmit, onCancel, submitLabel, flat, T }) {
  const { THEME, card, inp, btn, btnSub } = T;
  const [name, setName] = useState(initial.name || "");
  const [code, setCode] = useState(initial.code || "");
  const [vals, setVals] = useState(() => {
    const o = {};
    for (const [k, , kind] of FIELDS) o[k] = kind === "money" ? (initial[k] ? fmtK(initial[k]) : "") : initial[k] || "";
    return o;
  });
  const label = { fontSize: 12, fontWeight: 600, color: THEME.subtext, marginBottom: 3, display: "block" };
  function submit() {
    const out = { name: name.trim(), code: code.trim() };
    for (const [k, , kind] of FIELDS) out[k] = kind === "money" ? parseMoney(vals[k]) : vals[k].trim();
    // Ô để trống thì bỏ hẳn trường đó (giữ dữ liệu gọn).
    for (const k of Object.keys(out)) if (out[k] == null || out[k] === "") out[k] = undefined;
    onSubmit(out);
  }
  return (
    <div style={flat ? { padding: 4 } : { ...card, padding: 14, marginBottom: 14, borderColor: THEME.chipLine }}>
      <label style={label}>Tên sản phẩm</label>
      <input style={{ ...inp, marginBottom: 8, fontWeight: 600 }} value={name} onChange={(e) => setName(e.target.value)} />
      <label style={label}>Mã vạch</label>
      <input style={{ ...inp, marginBottom: 8 }} value={code} onChange={(e) => setCode(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {FIELDS.map(([k, text, kind]) => (
          <div key={k} style={kind === "text" ? { gridColumn: "1 / -1" } : undefined}>
            <label style={label}>{text}</label>
            <input
              style={inp}
              inputMode={kind === "money" ? "decimal" : "url"}
              placeholder={kind === "money" ? "VD: 170k hoặc 170.000" : "https://..."}
              value={vals[k]}
              onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={btn} disabled={!name.trim()} onClick={submit}>
          <Check size={16} /> {submitLabel}
        </button>
        <button style={btnSub} onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </div>
  );
}
