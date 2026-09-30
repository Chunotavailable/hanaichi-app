// pages/sieuthi.js
// Trang "Giá siêu thị": tra nhanh giá các sản phẩm siêu thị để báo khách.
// Dữ liệu lấy từ file Google Sheet gốc (tự đồng bộ) — trang CHỈ ĐỌC, muốn sửa
// giá / thêm bớt sản phẩm / đổi tình trạng hàng thì sửa trong file gốc:
//   - dòng bôi đỏ = hết hàng
//   - cột D "Giá bán Social" = giá chính
//   - cột H (tiêu đề "SALE 26-30/9/2026") = giá sale trong thời gian đó
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { norm, showToast, goLogin } from "../lib/gomcanHelpers";
import { FilterChip, SearchInput, EmptyState } from "../lib/ui";
import { Copy, Check, SearchX, ArrowUpDown, Globe, ExternalLink, PackageX, Flame, RefreshCw, FileSpreadsheet } from "lucide-react";

const PAGE = 40;
const STALE_MS = 10 * 60 * 1000; // dữ liệu cũ hơn 10 phút thì tự hỏi lại file gốc

function fmtK(n) {
  if (n == null) return "";
  const k = n / 1000;
  return (Number.isInteger(k) ? k : Math.round(k * 10) / 10).toString().replace(".", ",") + "k";
}
function copyText(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text || "").catch(() => {});
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// "SALE 26 -30/9/2026" -> "26-30/9/2026"
function saleShort(label) {
  return String(label || "").replace(/^\s*sale\s*/i, "").replace(/\s*[-–]\s*/g, "-").trim();
}
function ago(iso) {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

export default function SieuThiPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("con"); // con | het | all | sale
  const [sort, setSort] = useState("none"); // none | asc | desc
  const [visible, setVisible] = useState(PAGE);
  const sentinelRef = useRef(null);

  // Lấy bản mới nhất từ file gốc (chạy ngầm, trang vẫn dùng được trong lúc chờ).
  const sync = useCallback(async (manual) => {
    setSyncing(true);
    try {
      const r = await fetch("/api/sieuthi-sync");
      if (r.status === 401) return goLogin();
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "sync failed");
      setSyncFailed(false);
      if (d.updated && d.doc) {
        setData(d.doc);
        if (manual) showToast("Đã cập nhật giá mới từ file gốc", 3000, "info");
      } else if (manual) showToast("Dữ liệu đang là bản mới nhất", 3000, "info");
    } catch (e) {
      setSyncFailed(true);
      if (manual) showToast("Chưa lấy được file gốc, đang dùng dữ liệu lần trước");
    } finally {
      setSyncing(false);
    }
  }, []);

  function loadData() {
    setLoading(true);
    setLoadFailed(false);
    fetch("/api/sieuthi", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) return goLogin();
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setData(d);
        // Dữ liệu chưa từng đồng bộ hoặc đã cũ -> hỏi lại file gốc.
        if (d.source !== "sheet" || !d.updatedAt || Date.now() - new Date(d.updatedAt).getTime() > STALE_MS) sync(false);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }
  useEffect(loadData, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setVisible(PAGE), [q, filter, sort]);

  const list = (data && data.products) || [];
  const sale = data && data.sale;
  const today = todayStr();
  const saleActive = !!sale && (!sale.start || today >= sale.start) && (!sale.end || today <= sale.end);
  const haystacks = useMemo(() => new Map(list.map((p) => [p.id, norm(p.name)])), [list]);
  const counts = useMemo(() => {
    let het = 0, sl = 0;
    for (const p of list) {
      if (p.oos) het++;
      else if (p.sale || p.saleText) sl++;
    }
    return { all: list.length, het, con: list.length - het, sale: sl };
  }, [list]);
  const filtered = useMemo(() => {
    const nq = norm(q);
    let out = list.filter((p) => {
      if (filter === "con" && p.oos) return false;
      if (filter === "het" && !p.oos) return false;
      if (filter === "sale" && (p.oos || !(p.sale || p.saleText))) return false;
      return !nq || (haystacks.get(p.id) || "").includes(nq);
    });
    if (sort !== "none") {
      const dir = sort === "asc" ? 1 : -1;
      const eff = (p) => (saleActive && p.sale ? p.sale : p.price);
      out = [...out].sort((a, b) => {
        const x = eff(a), y = eff(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x - y) * dir;
      });
    }
    return out;
  }, [list, haystacks, q, filter, sort, saleActive]);

  // Lăn xuống gần cuối danh sách thì tự tải thêm sản phẩm.
  const shownCount = Math.min(visible, filtered.length);
  const hasMore = filtered.length > shownCount;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => v + PAGE);
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shownCount]);

  if (loadFailed && !loading) return <LoadError onRetry={loadData} />;
  if (loading || !data) return <Loading />;

  const shown = filtered.slice(0, shownCount);
  const sortLabel = sort === "asc" ? "Giá thấp → cao" : sort === "desc" ? "Giá cao → thấp" : "Sắp xếp theo giá";

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Giá siêu thị" current="/sieuthi" maxWidth={960} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, color: syncFailed ? THEME.danger : THEME.subtext, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <FileSpreadsheet size={15} style={{ flexShrink: 0 }} />
            <span>
              {syncFailed ? "Chưa cập nhật được từ file gốc — đang hiện dữ liệu lần trước" : "Tự cập nhật từ file gốc"}
              {data.updatedAt ? ` · ${ago(data.updatedAt)}` : ""}
            </span>
          </div>
          <button style={{ ...btnSub, padding: "5px 11px", fontSize: 13 }} disabled={syncing} onClick={() => sync(true)}>
            <RefreshCw size={14} style={syncing ? { animation: "hnSpin 0.8s linear infinite" } : undefined} /> {syncing ? "Đang cập nhật..." : "Cập nhật ngay"}
          </button>
        </div>

        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên sản phẩm..." T={T} />
          <div className="hnHScroll" style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" }}>
            <FilterChip T={T} active={filter === "con"} onClick={() => setFilter("con")}>
              Còn hàng · {counts.con}
            </FilterChip>
            <FilterChip T={T} active={filter === "het"} tone="danger" onClick={() => setFilter("het")}>
              Hết hàng · {counts.het}
            </FilterChip>
            <FilterChip T={T} active={filter === "all"} onClick={() => setFilter("all")}>
              Tất cả · {counts.all}
            </FilterChip>
            {sale && counts.sale > 0 && (
              <FilterChip T={T} active={filter === "sale"} tone="danger" onClick={() => setFilter("sale")}>
                <Flame size={14} /> {saleActive ? "Đang sale" : "Sale"} {saleShort(sale.label)} · {counts.sale}
              </FilterChip>
            )}
            <FilterChip T={T} active={sort !== "none"} onClick={() => setSort((s) => (s === "none" ? "asc" : s === "asc" ? "desc" : "none"))}>
              <ArrowUpDown size={14} /> {sortLabel}
            </FilterChip>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={SearchX} title="Không tìm thấy sản phẩm nào" hint={filter === "con" ? "Thử tìm ở mục “Tất cả” hoặc “Hết hàng”." : "Thử từ khác."} T={T} />
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: THEME.muted, margin: "0 2px 8px" }}>{filtered.length} sản phẩm</div>
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              {shown.map((p, i) => (
                <ProductRow key={p.id} p={p} first={i === 0} sale={sale} saleActive={saleActive} T={T} />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} style={{ textAlign: "center", padding: "18px 0", color: THEME.muted, fontSize: 13 }}>
                Đang tải thêm sản phẩm...
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function LinkIcon({ href, title, children, THEME }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" title={title} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12.5, fontWeight: 600, color: THEME.brand, textDecoration: "none", padding: "2px 4px" }}>
      {children} <ExternalLink size={11} />
    </a>
  );
}

function ProductRow({ p, first, sale, saleActive, T }) {
  const { THEME, btnSub } = T;
  const [copied, setCopied] = useState(false);
  const border = first ? "none" : `1px solid ${THEME.line}`;
  const hasSale = !!(p.sale || p.saleText);
  const onSale = hasSale && saleActive && !p.oos;
  const shownPrice = onSale && p.sale ? p.sale : p.price;
  // Câu báo giá: Tên sản phẩm + giá + bên e có sẵn (đang sale thì ghi giá sale).
  const quote = shownPrice ? `${p.name} ${onSale && p.sale ? "đang sale giá" : "giá"} ${fmtK(shownPrice)} bên e có sẵn` : "";

  return (
    <div className="hnRowItem" style={{ borderTop: border, padding: "12px 14px", opacity: p.oos ? 0.62 : 1 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14.5, lineHeight: 1.4, color: THEME.text, overflowWrap: "anywhere" }}>
          {p.oos && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 700, color: THEME.danger, background: THEME.dangerBg, border: "1px solid #f3c9cb", borderRadius: 999, padding: "0 8px", marginRight: 6, verticalAlign: "1px" }}>
              <PackageX size={11} /> Hết hàng
            </span>
          )}
          {p.name}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {shownPrice ? (
            <>
              <div style={{ fontWeight: 700, fontSize: 18, color: onSale && p.sale ? THEME.danger : THEME.brand, lineHeight: 1.2 }}>{fmtK(shownPrice)}</div>
              {onSale && p.sale && p.price ? (
                <div style={{ fontSize: 12, color: THEME.muted }}>
                  Giá Social <s>{fmtK(p.price)}</s>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: THEME.muted }}>Giá Social</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: THEME.muted }}>Chưa có giá</div>
          )}
        </div>
      </div>

      {hasSale && sale && (
        <div style={{ marginTop: 7, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 999,
              padding: "2px 10px",
              color: onSale ? THEME.danger : THEME.subtext,
              background: onSale ? THEME.dangerBg : THEME.surfaceAlt,
              border: `1px solid ${onSale ? "#f3c9cb" : THEME.line}`,
            }}
          >
            <Flame size={13} /> Sale {saleShort(sale.label)}
            {!saleActive && " (đã kết thúc)"}
            {p.sale ? <> · <b>{fmtK(p.sale)}</b></> : null}
            {p.saleText ? <> · {p.saleText}</> : null}
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <span style={{ flex: 1 }} />
        <LinkIcon href={p.linkWeb} title="Mở trang web Hanaichi" THEME={THEME}><Globe size={13} /> Web</LinkIcon>
        <LinkIcon href={p.linkShopee} title="Mở Shopee" THEME={THEME}>Shopee</LinkIcon>
        <LinkIcon href={p.linkLazada} title="Mở Lazada" THEME={THEME}>Lazada</LinkIcon>
        {quote && !p.oos ? (
          <button
            title="Chép câu báo giá"
            style={{ ...btnSub, padding: "4px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text }}
            onClick={() => {
              copyText(quote);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép giá"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
