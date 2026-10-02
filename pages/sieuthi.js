// pages/sieuthi.js
// Trang "Giá siêu thị": tra nhanh giá các sản phẩm siêu thị để báo khách.
// Dữ liệu lấy từ file Google Sheet gốc (tự đồng bộ) — trang CHỈ ĐỌC, muốn sửa
// giá / thêm bớt sản phẩm / đổi tình trạng hàng thì sửa trong file gốc:
//   - dòng bôi đỏ = hết hàng
//   - cột D "Giá bán Social" = giá chính
//   - cột H (tiêu đề "SALE 26-30/9/2026") = giá sale trong thời gian đó
import { readRoleCookie } from "../lib/perm";
import { Highlight } from "../lib/Highlight";
import { fetchRaw, takePrefetched } from "../lib/prefetch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { norm, showToast, goLogin } from "../lib/gomcanHelpers";
import { FilterChip, SearchInput, EmptyState } from "../lib/ui";
import { Copy, Check, SearchX, ArrowUpDown, Globe, ExternalLink, PackageX, Flame, RefreshCw, FileSpreadsheet, ChevronRight } from "lucide-react";

const PAGE = 40;
const STALE_MS = 24 * 60 * 60 * 1000; // mỗi ngày tự hỏi lại file gốc 1 lần (muốn cập nhật sớm thì bấm "Cập nhật ngay")

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

// Số ngày còn lại tới hết sale (0 = hết hôm nay); null nếu không rõ ngày.
function daysLeft(end, today) {
  if (!end) return null;
  const a = new Date(today + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.round((b - a) / 86400000);
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
    if (readRoleCookie() !== "admin") return; // Khách chỉ xem, không đọc file gốc
    setSyncing(true);
    try {
      const rr = await fetch("/api/sheet-raw?tab=sieuthi", { cache: "no-store" });
      if (rr.status === 401) return goLogin();
      if (!rr.ok) throw new Error("raw failed");
      const buf = new Uint8Array(await rr.arrayBuffer());
      const { parseWorkbook } = await import("../lib/sieuthiSheet");
      const parsed = parseWorkbook(buf);
      if (!parsed.products.length) throw new Error("empty");
      const r = await fetch("/api/sieuthi-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ doc: parsed }) });
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
    (takePrefetched("/api/sieuthi") || Promise.resolve(null))
      .then((pre) => (pre && pre.ok ? pre : fetchRaw("/api/sieuthi")))
      .then((r) => {
        if (r.status === 401) return goLogin();
        if (!r.ok) throw new Error("load failed");
        return r.data;
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
  const tokens = useMemo(() => norm(q).split(" ").filter(Boolean), [q]);
  const searching = tokens.length > 0;
  const filtered = useMemo(() => {
    // Đang tìm kiếm thì tìm trong TẤT CẢ sản phẩm (kể cả hết hàng), bỏ qua bộ
    // lọc; hàng còn xếp trước, hàng hết xếp sau.
    let out = list.filter((p) => {
      if (searching) {
        const h = haystacks.get(p.id) || "";
        return tokens.every((t) => h.includes(t));
      }
      if (filter === "con") return !p.oos;
      if (filter === "het") return !!p.oos;
      if (filter === "sale") return !p.oos && !!(p.sale || p.saleText);
      return true;
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
    if (searching) out = [...out.filter((p) => !p.oos), ...out.filter((p) => p.oos)];
    return out;
  }, [list, haystacks, tokens, searching, filter, sort, saleActive]);

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
  const left = sale ? daysLeft(sale.end, today) : null;
  const matchedOos = searching ? filtered.filter((p) => p.oos).length : 0;

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Giá siêu thị" current="/sieuthi" maxWidth={960} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "14px 18px" }}>
        {/* Dòng trạng thái đồng bộ */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: syncFailed ? THEME.danger : THEME.subtext, display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <FileSpreadsheet size={15} style={{ flexShrink: 0 }} />
            <span>
              {syncFailed ? "Chưa cập nhật được từ file gốc — đang hiện dữ liệu lần trước" : "Tự cập nhật mỗi ngày 1 lần từ file gốc"}
              {data.updatedAt ? ` · ${ago(data.updatedAt)}` : ""}
            </span>
          </div>
          <button style={{ ...btnSub, padding: "5px 11px", fontSize: 13 }} disabled={syncing} onClick={() => sync(true)}>
            <RefreshCw size={14} style={syncing ? { animation: "hnSpin 0.8s linear infinite" } : undefined} /> {syncing ? "Đang cập nhật..." : "Cập nhật ngay"}
          </button>
        </div>

        {/* Đang sale: thanh nổi bật, bấm để xem riêng hàng sale */}
        {saleActive && counts.sale > 0 && (
          <button
            onClick={() => {
              setQ("");
              setFilter("sale");
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              cursor: "pointer",
              marginBottom: 12,
              padding: "11px 14px",
              borderRadius: 14,
              border: "1px solid #f3c9cb",
              background: "linear-gradient(90deg, #fdeeee, #fff4ec)",
              color: THEME.text,
            }}
          >
            <span style={{ width: 36, height: 36, borderRadius: 11, background: THEME.danger, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Flame size={19} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700, fontSize: 14.5, color: THEME.danger }}>Đang sale {saleShort(sale.label)}</span>
              <span style={{ display: "block", fontSize: 13, color: THEME.subtext }}>
                {counts.sale} sản phẩm có giá sale{left != null ? (left === 0 ? " · hết sale hôm nay" : ` · còn ${left} ngày`) : ""}
              </span>
            </span>
            <ChevronRight size={18} color={THEME.danger} />
          </button>
        )}

        {/* Tìm kiếm + bộ lọc: dính ở đầu màn hình khi cuộn để luôn tìm được */}
        <div className="stSticky" style={{ position: "sticky", top: 0, zIndex: 20, margin: "0 -18px 12px", padding: "8px 18px 10px", background: THEME.bg }}>
          <div style={{ ...card, padding: 12 }}>
            <SearchInput value={q} onChange={setQ} placeholder="Tìm sản phẩm (cả hàng hết)..." T={T} />
            <div className="hnHScroll" style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", opacity: searching ? 0.5 : 1 }}>
              <FilterChip T={T} small active={!searching && filter === "con"} onClick={() => { setQ(""); setFilter("con"); }}>
                Còn hàng · {counts.con}
              </FilterChip>
              {sale && counts.sale > 0 && (
                <FilterChip T={T} small active={!searching && filter === "sale"} tone="danger" onClick={() => { setQ(""); setFilter("sale"); }}>
                  <Flame size={13} /> {saleActive ? "Đang sale" : "Sale"} · {counts.sale}
                </FilterChip>
              )}
              <FilterChip T={T} small active={!searching && filter === "all"} onClick={() => { setQ(""); setFilter("all"); }}>
                Tất cả · {counts.all}
              </FilterChip>
              <FilterChip T={T} small active={sort !== "none"} onClick={() => setSort((x) => (x === "none" ? "asc" : x === "asc" ? "desc" : "none"))}>
                <ArrowUpDown size={13} /> {sortLabel}
              </FilterChip>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={SearchX} title="Không tìm thấy sản phẩm nào" hint={searching ? "Thử gõ ít từ hơn, hoặc gõ không dấu." : "Chưa có sản phẩm nào ở mục này."} T={T} />
        ) : (
          <>
            <div style={{ fontSize: 13, color: THEME.subtext, margin: "0 2px 8px" }}>
              {searching ? (
                <>
                  <b style={{ color: THEME.text }}>{filtered.length}</b> kết quả cho “{q.trim()}”
                  {matchedOos > 0 ? <span style={{ color: THEME.danger }}> · trong đó {matchedOos} hết hàng</span> : null}
                </>
              ) : (
                <>
                  <b style={{ color: THEME.text }}>{filtered.length}</b> sản phẩm
                </>
              )}
            </div>
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              {shown.map((p, i) => (
                <ProductRow key={p.id} p={p} first={i === 0} sale={sale} saleActive={saleActive} tokens={tokens} T={T} />
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
      <style jsx global>{`
        .stRow {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 132px 84px;
          column-gap: 12px;
          align-items: center;
        }
        .stName { grid-column: 1; }
        .stPrice { grid-column: 2; text-align: right; }
        .stAct { grid-column: 3; display: flex; justify-content: flex-end; }
        @media (max-width: 640px) {
          .stRow {
            grid-template-columns: minmax(0, 1fr) auto;
            column-gap: 12px;
            row-gap: 8px;
          }
          .stName { grid-column: 1 / -1; }
          .stPrice { grid-column: 1; text-align: left; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
          .stAct { grid-column: 2; }
        }
      `}</style>
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

function ProductRow({ p, first, sale, saleActive, tokens, T }) {
  const { THEME, btnSub } = T;
  const [copied, setCopied] = useState(false);
  const border = first ? "none" : `1px solid ${THEME.line}`;
  const hasSale = !!(p.sale || p.saleText);
  const onSale = hasSale && saleActive && !p.oos;
  const saleNow = onSale && !!p.sale;
  const shownPrice = saleNow ? p.sale : p.price;
  // Câu báo giá: Tên sản phẩm + giá + bên e có sẵn (đang sale thì ghi giá sale).
  const quote = shownPrice ? `${p.name} ${saleNow ? "đang sale giá" : "giá"} ${fmtK(shownPrice)} bên e có sẵn` : "";
  const hasLinks = p.linkWeb || p.linkShopee || p.linkLazada;

  return (
    <div className="hnRowItem" style={{ borderTop: border, padding: "10px 14px", background: p.oos ? THEME.surfaceAlt : "transparent" }}>
      <div className="stRow">
        <div className="stName" style={{ minWidth: 0, opacity: p.oos ? 0.7 : 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.38, color: THEME.text, overflowWrap: "anywhere" }}>
            <Highlight text={p.name} tokens={tokens} color="#fbe3a6" />
          </div>
          {hasLinks ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 10px", marginTop: 3, fontSize: 12.5, color: THEME.muted }}>
              {[["Web", p.linkWeb], ["Shopee", p.linkShopee], ["Lazada", p.linkLazada]]
                .filter(([, h]) => h)
                .map(([label, h]) => (
                  <a key={label} href={h} target="_blank" rel="noreferrer" style={{ color: THEME.muted, textDecoration: "none", fontWeight: 600 }}>
                    {label} ↗
                  </a>
                ))}
            </div>
          ) : null}
        </div>

        <div className="stPrice" style={{ opacity: p.oos ? 0.7 : 1 }}>
          {p.price ? (
            <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.15, color: p.oos ? THEME.subtext : THEME.brand }}>{fmtK(p.price)}</div>
          ) : !hasSale ? (
            <div style={{ fontSize: 13, color: THEME.muted }}>Chưa có giá</div>
          ) : null}
          {hasSale && !p.oos && (
            <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginTop: 2, whiteSpace: "nowrap", color: saleActive ? THEME.danger : THEME.subtext }}>
              <Flame size={11} style={{ verticalAlign: -1 }} /> {p.sale ? fmtK(p.sale) : p.saleText}
              {sale ? <span style={{ fontWeight: 600, color: THEME.muted }}> · {saleShort(sale.label).replace(/\/\d{4}$/, "")}</span> : null}
            </div>
          )}
        </div>

        <div className="stAct">
          {p.oos ? (
            <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.danger, whiteSpace: "nowrap" }}>Hết hàng</span>
          ) : quote ? (
            <button
              title="Chép câu báo giá"
              style={{ ...btnSub, padding: "6px 10px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", color: copied ? THEME.success : THEME.text, borderColor: copied ? THEME.successLine : THEME.line, background: copied ? THEME.successBg : THEME.surface }}
              onClick={() => {
                copyText(quote);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
