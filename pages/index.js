// pages/index.js
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* ================== Theme ================== */
const THEME = {
  bg: "#f5f7fb",
  surface: "#ffffff",
  text: "#0f172a",
  subtext: "#5b6475",
  line: "#e8ebf3",
  primary: "#F9CFE1",
  primary600: "#ebabc2ff",
  primary700: "#ee9fbaff",
  successBg: "#eaf8f1",
  dangerBg: "#fdeff0",
  chipBg: "#f1f4fb",
  chipLine: "#dde3f1",
  glow: "0 8px 28px rgba(17, 34, 68, 0.08)",
};
const EASE = "cubic-bezier(.2,.7,.2,1)";

/* ================== Utils ================== */
function isCatalogueRow(text = "") {
  const s = String(text).trim();
  if (!s) return false;
  if (/x[ảa]\s*kho|không\s*hoà?n?\s*hủ?y/i.test(s)) return false;
  if (!isAllCapsVN(s)) return false;
  if (s.includes("-")) return false;
  if (/\d/.test(s)) return false;
  const words = s.split(/\s+/).length;
  if (words > 8) return false;
  return true;
}
function normalizeSku(raw = "") {
  let s = String(raw).trim();
  s = s.replace(/\s*\([^)]*\)\s*$/u, "");
  s = s.replace(/-([^-\s]+)\s*$/u, "");
  return s.trim();
}

// Hiển thị size từ SKU
function prettySizeLine(sku = "") {
  const s = String(sku).trim();
  if (!s) return "";
  const paren = s.match(/\(([^)]+)\)\s*$/);
  const parenText = paren ? paren[1].trim() : "";
  const withoutParen = s.replace(/\s*\([^)]*\)\s*$/u, "");
  const dash = withoutParen.match(/-([^-\s]+)\s*$/u);
  const dashText = dash ? dash[1].trim() : "";
  if (dashText && parenText) return `${dashText} (${parenText})`;
  if (dashText) return dashText;
  if (parenText) return `(${parenText})`;
  return "";
}

function parseSize(sku = "") {
  const s = String(sku);
  const withoutParen = s.replace(/\s*\([^)]*\)\s*$/u, "");
  const dash = withoutParen.match(/-([^-\s]+)\s*$/u);
  if (dash) return dash[1].trim();
  const paren = s.match(/\(([^)]+)\)\s*$/);
  return paren ? paren[1].trim() : "";
}
function canonicalSize(size = "") {
  let raw = String(size).trim();
  if (!raw) return "";
  if (/^EU/i.test(raw)) return raw.toUpperCase();
  raw = raw.replace(",", ".").replace(/\s+/g, "").toUpperCase();
  if (/^\d{3}$/.test(raw)) {
    const n = Number(raw);
    if (n >= 200 && n <= 330) {
      const cm = n / 10;
      return cm % 1 === 0 ? String(cm | 0) : String(cm);
    }
  }
  if (/^\d+(\.\d+)?$/.test(raw)) return raw;
  return raw;
}
function sizeRank(size) {
  const t = canonicalSize(size);
  const eu = t.match(/^EU(\d+(\.\d+)?)$/);
  if (eu) return 100 + Number(eu[1]);
  if (/^\d+(\.\d+)?$/.test(t)) return 100 + Number(t);
  const map = {
    XXS: 1,
    XS: 2,
    S: 3,
    M: 4,
    L: 5,
    XL: 6,
    "2XL": 7,
    XXL: 7,
    "3XL": 8,
  };
  if (map[t] != null) return 10 + map[t];
  return 1000 + t.charCodeAt(0);
}
function isAllCapsVN(text = "") {
  const s = String(text).trim();
  if (!s) return false;
  return !/[a-zàáâãăạảấầẫẩậắằẵẳặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/.test(
    s
  );
}
function vnd(x) {
  const n = +x;
  return Number.isFinite(n) ? n.toLocaleString("vi-VN") : x ?? "";
}

/* ======= SIZE SEARCH (chỉ match SIZE, không ăn theo mã/tên) ======= */
function _haystackForVariantRaw(_p, v) {
  const tokens = new Set();
  const canon = (v?.sizeCanon || "").toString().trim().toUpperCase();
  if (canon) {
    if (/^EU/.test(canon)) {
      const num = canon.replace(/^EU\s*/i, "").replace(/,/g, ".");
      tokens.add(`eu${num}`.toLowerCase());
      tokens.add(num.toLowerCase());
      tokens.add(num.replace(".", ""));
    } else if (/^\d+(\.\d+)?$/.test(canon)) {
      tokens.add(canon.toLowerCase());
      tokens.add(canon.replace(".", "").toLowerCase());
    } else if (/^(XXS|XS|S|M|L|XL|XXL|XXXL)$/.test(canon)) {
      tokens.add(canon.toLowerCase());
    }
  }
  const sku = String(v?.sku || "");
  const mParen = sku.match(/\(\s*eu\s*([0-9.,]+)\s*\)/i);
  if (mParen) {
    const num = mParen[1].replace(/,/g, ".");
    tokens.add(`eu${num}`.toLowerCase());
    tokens.add(num.toLowerCase());
    tokens.add(num.replace(".", ""));
  }
  const mEU = sku.match(/\beu\s*([0-9.,]+)\b/i);
  if (mEU) {
    const num = mEU[1].replace(/,/g, ".");
    tokens.add(`eu${num}`.toLowerCase());
    tokens.add(num.toLowerCase());
    tokens.add(num.replace(".", ""));
  }
  const pretty = prettySizeLine(sku).toLowerCase().replace(/,/g, ".");
  if (pretty) {
    const m = pretty.match(/\beu\s*([0-9.]+)\b/i);
    if (m) {
      const num = m[1];
      tokens.add(`eu${num}`.toLowerCase());
      tokens.add(num.toLowerCase());
      tokens.add(num.replace(".", ""));
    }
    const ml = pretty.match(/\b(xxS|xs|s|m|l|xl|xxl|xxxl)\b/i);
    if (ml) tokens.add(ml[0].toLowerCase());
    const mn = pretty.match(/\b\d{1,2}(?:\.\d)?\b/);
    if (mn) {
      tokens.add(mn[0]);
      tokens.add(mn[0].replace(".", ""));
    }
  }
  return tokens.size ? `|${[...tokens].join("|")}|` : "|";
}
function _matchSizeQuery(hayTokens, query) {
  if (!query) return true;
  const q = String(query).toLowerCase().trim();
  const qn = q
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9.]/g, "");
  if (/^(xs|s|m|l|xl|xxl|xxxl)$/i.test(qn))
    return hayTokens.includes(`|${qn}|`);
  const startsEU = qn.startsWith("eu");
  const numDot = qn.replace(/^eu/i, "");
  const numCompact = numDot.replace(".", "");
  const forms = new Set([numDot, numCompact, `eu${numDot}`]);
  if (startsEU) forms.add(qn);
  for (const f of forms) if (f && hayTokens.includes(`|${f}|`)) return true;
  return false;
}

/* ======= Gom nhóm theo catalogue → tên → size ======= */
function groupProducts(rows) {
  const groups = new Map();
  let currentCatalogue = "";
  let currentTitle = "";

  for (const r of rows) {
    const colA = (r["Tên sản phẩm"] ?? r.ten_san_pham ?? r.ten ?? "")
      .toString()
      .trim();
    const sku = (r.ma_san_pham || r.masanpham || r.sku || "").toString().trim();

    const giaCtv = r.gia_ctv ?? r.giactv ?? r.ctv ?? "";
    const giaLe = r.gia_le ?? r.giale ?? r.gia ?? "";
    const sl = r.sl ?? r.so_luong ?? "";
    const daBan = Number(r.da_ban ?? r.a_ban ?? 0);
    const conLai = r.con_lai ?? r.ton ?? "";
    const img = r.anh || r.hinh_anh_san_pham || "";
    const zl = r.zl ?? r.giazalo ?? "";

    const hasSku = !!sku;
    const hasOther = giaCtv || giaLe || sl || daBan || conLai || img || zl;

    if (colA && !hasSku && !hasOther) {
      if (isCatalogueRow(colA)) currentCatalogue = colA;
      else currentTitle = colA;
      continue;
    }

    if (hasSku) {
      if (colA) currentTitle = colA;

      const base = normalizeSku(sku);
      const size = parseSize(sku);

      if (!groups.has(base)) {
        groups.set(base, {
          baseCode: base,
          name: currentTitle || base,
          catalogue: currentCatalogue,
          image: img || "",
          zaloBase: "",
          variants: [],
        });
      }
      const g = groups.get(base);
      if (!g.image && img) g.image = img;
      g.name = currentTitle || g.name;
      g.catalogue = currentCatalogue || g.catalogue;
      if (!g.zaloBase && zl) g.zaloBase = zl;

      g.variants.push({
        sku,
        size,
        sizeCanon: canonicalSize(size),
        giaCtv,
        giaLe,
        sl,
        daBan,
        conLai,
        zl,
      });
    }
  }

  return Array.from(groups.values()).map((g) => {
    g.variants.sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
    g.totals = {
      sl: g.variants.reduce((s, v) => s + (+v.sl || 0), 0),
      daBan: g.variants.reduce((s, v) => s + (+v.daBan || 0), 0),
      conLai: g.variants.reduce((s, v) => s + (+v.conLai || 0), 0),
    };
    g.sizeSet = Array.from(
      new Set(g.variants.map((v) => v.sizeCanon).filter(Boolean))
    );
    return g;
  });
}

/* ============== ẢNH: LẤY QUA API /api/list-images?code= ============== */
const MAX_GALLERY = 20;

async function fetchImagesForCode(code) {
  if (!code) return [];
  try {
    const res = await fetch(
      `/api/list-images?code=${encodeURIComponent(code)}`
    );
    const data = await res.json();
    let imgs = Array.isArray(data?.images) ? data.images : [];
    // Ưu tiên file tên bắt đầu bằng "cover"
    const covers = imgs.filter((u) => /\/cover(\.|-|_|$)/i.test(u));
    const others = imgs.filter((u) => !/\/cover(\.|-|_|$)/i.test(u));
    imgs = covers.length ? [...covers, ...others] : imgs;
    return imgs.slice(0, MAX_GALLERY);
  } catch {
    return [];
  }
}

/* =================== Component =================== */
export default function Home() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // tìm kiếm tách 3 input
  const [searchName, setSearchName] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchSize, setSearchSize] = useState("");

  const [onlyInStock, setOnlyInStock] = useState(false);
  const [tab, setTab] = useState("catalogue");
  const [selectedCatalogue, setSelectedCatalogue] = useState("");
  const [clothingSet, setClothingSet] = useState(new Set());
  const [footwearSet, setFootwearSet] = useState(new Set());
  const [sizeFilters, setSizeFilters] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalType, setModalType] = useState("clothing");
  const [modalQuery, setModalQuery] = useState("");
  const [modalSelected, setModalSelected] = useState(new Set());

  // Cột hiển thị & % giảm
  const [visibleCols, setVisibleCols] = useState({
    giamGia: false,
    zalo: true,
    giaLe: true,
    conLai: true,
  });
  const [discountPct, setDiscountPct] = useState(0);

  // Ảnh
  // imageListMap: { [baseCode]: string[] | undefined } — undefined = đang nạp, [] = không có ảnh
  const [imageListMap, setImageListMap] = useState({});
  const [zoomCode, setZoomCode] = useState("");
  const [zoomIndex, setZoomIndex] = useState(0);

  // Đồng bộ & toolbar
  const [lastSync, setLastSync] = useState(null);
  const [toolbarOpen, setToolbarOpen] = useState(true);

  // Load data từ API products
  useEffect(() => {
    let timer;
    (async () => {
      try {
        const r = await fetch(`/api/products?ts=${Date.now()}`);
        const d = await r.json();
        setRows(d.rows || []);
        setLastSync(new Date());
      } finally {
        setLoading(false);
      }
    })();

    timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/products?ts=${Date.now()}`);
        const d = await r.json();
        setRows(d.rows || []);
        setLastSync(new Date());
      } catch {}
    }, 60000);

    try {
      setClothingSet(
        new Set(JSON.parse(localStorage.getItem("hc_clothing_set") || "[]"))
      );
      setFootwearSet(
        new Set(JSON.parse(localStorage.getItem("hc_footwear_set") || "[]"))
      );
    } catch {}

    return () => clearInterval(timer);
  }, []);

  const allProducts = useMemo(() => groupProducts(rows), [rows]);

  // Tìm size chính xác (chỉ nhìn size/EU/letter)
  const products = useMemo(() => {
    let out = allProducts;

    const nameKey = searchName.trim().toLowerCase();
    const codeKey = searchCode.trim().toLowerCase();
    const sizeQuery = searchSize.trim();

    if (nameKey || codeKey || sizeQuery) {
      out = out
        .map((p) => {
          const nameMatch = nameKey
            ? p.name.toLowerCase().includes(nameKey)
            : true;
          const codeMatch = codeKey
            ? (p.baseCode || "").toLowerCase().includes(codeKey) ||
              p.variants.some((v) => v.sku.toLowerCase().includes(codeKey))
            : true;

          const filteredVariants = p.variants.filter((v) => {
            if (!sizeQuery) return true;
            try {
              const tokens = _haystackForVariantRaw(p, v);
              return _matchSizeQuery(tokens, sizeQuery);
            } catch {
              return false;
            }
          });

          const pass =
            nameMatch &&
            codeMatch &&
            (filteredVariants.length > 0 || !sizeQuery);
          return pass
            ? { ...p, variants: sizeQuery ? filteredVariants : p.variants }
            : null;
        })
        .filter(Boolean);
    }

    if (onlyInStock) {
      out = out
        .map((p) => ({
          ...p,
          variants: p.variants.filter((v) => (+v.conLai || 0) > 0),
        }))
        .filter((p) => p.variants.length);
    }

    return out;
  }, [allProducts, searchName, searchCode, searchSize, onlyInStock]);

  const catalogues = useMemo(
    () => [...new Set(allProducts.map((p) => p.catalogue).filter(Boolean))],
    [allProducts]
  );

  const filtered = useMemo(() => {
    const clothing = clothingSet,
      footwear = footwearSet;
    let base = products;
    if (tab === "catalogue" && selectedCatalogue)
      base = base.filter((p) => p.catalogue === selectedCatalogue);
    else if (tab === "clothing")
      base = base.filter((p) => clothing.has(p.baseCode));
    else if (tab === "footwear")
      base = base.filter((p) => footwear.has(p.baseCode));
    else if (tab === "other")
      base = base.filter(
        (p) => !clothing.has(p.baseCode) && !footwear.has(p.baseCode)
      );
    if (sizeFilters.length) {
      base = base
        .map((p) => ({
          ...p,
          variants: p.variants.filter((v) => sizeFilters.includes(v.sizeCanon)),
        }))
        .filter((p) => p.variants.length);
    }
    return base;
  }, [products, tab, selectedCatalogue, sizeFilters, clothingSet, footwearSet]);

  // 👉 NẠP ẢNH AN TOÀN (KHÔNG setState trong render)
  useEffect(() => {
    // lấy các mã đang hiển thị (theo filtered) mà chưa có entry trong imageListMap
    const need = [];
    for (const section of Object.values(
      filtered.reduce((acc, p) => {
        const cat = (p.catalogue || "Khác").trim();
        (acc[cat] ||= []).push(p);
        return acc;
      }, {})
    )) {
      for (const p of section) {
        if (!Object.prototype.hasOwnProperty.call(imageListMap, p.baseCode)) {
          need.push(p.baseCode);
        }
      }
    }
    if (!need.length) return;

    // đánh dấu "đang nạp"
    setImageListMap((m) => {
      const next = { ...m };
      need.forEach((code) => {
        if (!Object.prototype.hasOwnProperty.call(next, code))
          next[code] = undefined;
      });
      return next;
    });

    // nạp tuần tự (tránh bão request)
    (async () => {
      for (const code of need) {
        const arr = await fetchImagesForCode(code);
        setImageListMap((m) => ({ ...m, [code]: arr }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]); // cố ý không đưa imageListMap vào deps để tránh vòng lặp

  const toggleSize = (v) => {
    const c = canonicalSize(v);
    setSizeFilters((p) =>
      p.includes(c) ? p.filter((x) => x !== c) : [...p, c]
    );
  };
  const openEdit = (t) => {
    setModalType(t);
    setModalSelected(new Set(t === "clothing" ? clothingSet : footwearSet));
    setModalQuery("");
    setShowEditModal(true);
  };
  const applyModal = () => {
    if (modalType === "clothing") {
      setClothingSet(new Set(modalSelected));
      localStorage.setItem(
        "hc_clothing_set",
        JSON.stringify([...modalSelected])
      );
    } else {
      setFootwearSet(new Set(modalSelected));
      localStorage.setItem(
        "hc_footwear_set",
        JSON.stringify([...modalSelected])
      );
    }
    setShowEditModal(false);
  };

  const commonSizes = useMemo(() => {
    const s = new Set();
    allProducts.forEach((p) => p.sizeSet.forEach((x) => s.add(x)));
    return [...s].sort((a, b) => sizeRank(a) - sizeRank(b));
  }, [allProducts]);

  const groupedByCatalogue = useMemo(() => {
    return filtered.reduce((acc, p) => {
      const cat = (p.catalogue || "Khác").trim();
      (acc[cat] ||= []).push(p);
      return acc;
    }, {});
  }, [filtered]);

  if (loading) return <main style={{ padding: 16 }}>Đang tải dữ liệu…</main>;

  const refreshData = async () => {
    const r = await fetch(`/api/products?nocache=1&ts=${Date.now()}`);
    const d = await r.json();
    setRows(d.rows || []);
    setLastSync(new Date());
  };
  const clearFiltersAndRefresh = async () => {
    setSearchName("");
    setSearchCode("");
    setSearchSize("");
    setOnlyInStock(false);
    setSelectedCatalogue("");
    setSizeFilters([]);
    setTab("catalogue");
    await refreshData();
  };

  const openGallery = (code) => {
    setZoomCode(code);
    setZoomIndex(0);
  };
  const zoomList = zoomCode ? imageListMap[zoomCode] || [] : [];
  const zoomSrc = zoomList[zoomIndex] || "";

  return (
    <main style={appWrap}>
      {/* ===== Header ===== */}
      <header style={hero}>
        <div style={heroInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={logoDot} />
            <h1 style={heroTitle}>Hàng CÓ SẴN</h1>
            <Link href="/gomcan" style={{ ...tabPill(false), textDecoration: "none" }}>🧮 Giá gồm cân</Link>
            <Link href="/todo" style={{ ...tabPill(false), textDecoration: "none" }}>✅ Việc cần làm</Link>
            <Link href="/fbcontent" style={{ ...tabPill(false), textDecoration: "none" }}>✍️ Viết bài FB</Link>
            <Link href="/rewrite" style={{ ...tabPill(false), textDecoration: "none" }}>📝 Sửa bài theo khung</Link>
            {lastSync && (
              <span style={syncBadge}>
                Đồng bộ lúc{" "}
                {lastSync.toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          <div style={tabsWrap}>
            {["catalogue", "clothing", "footwear", "other"].map((k) => (
              <div key={k} style={tabPill(tab === k)} onClick={() => setTab(k)}>
                {k === "catalogue"
                  ? "Catalogue"
                  : k === "clothing"
                  ? "Quần áo"
                  : k === "footwear"
                  ? "Giày dép"
                  : "Khác"}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div style={container}>
        {/* ===== Toolbar sticky + toggle ===== */}
        <div style={toolbarSticky}>
          <div
            className={`toolbar-collapsible ${toolbarOpen ? "open" : "closed"}`}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr .9fr 1.1fr auto auto",
                gap: 10,
                alignItems: "center",
              }}
              className="toolbar-grid"
            >
              <input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="Tìm theo TÊN (vd: nike)"
                style={inp}
              />
              <input
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Tìm theo MÃ (vd: dh3158, a8461)"
                style={inp}
              />
              <input
                value={searchSize}
                onChange={(e) => setSearchSize(e.target.value)}
                placeholder="Tìm theo SIZE (vd: 24.5 / 24,5 / 245 / EU39)"
                style={inp}
              />
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: THEME.subtext,
                }}
              >
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                />
                Chỉ còn hàng
              </label>
              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
                className="toolbar-actions"
              >
                <button onClick={refreshData} style={btnPrimary}>
                  ⟳ Cập nhật
                </button>
                <button onClick={clearFiltersAndRefresh} style={btnGhost}>
                  🧹 Xóa lọc & cập nhật
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 420px) 1fr",
                gap: 12,
                marginTop: 10,
              }}
              className="toolbar-row2"
            >
              <div style={panelLight}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    color: THEME.subtext,
                  }}
                >
                  Chọn catalogue
                </div>
                <select
                  value={selectedCatalogue}
                  onChange={(e) => setSelectedCatalogue(e.target.value)}
                  style={select2}
                >
                  <option value="">— Tất cả —</option>
                  {catalogues.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div style={panelLight}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    color: THEME.subtext,
                  }}
                >
                  Cột hiển thị
                </div>
                {[
                  ["giamGia", "Giảm giá"],
                  ["giaLe", "Giá lẻ"],
                  ["zalo", "Giá Zalo"],
                  ["conLai", "Còn"],
                ].map(([k, label]) => (
                  <label key={k} style={chip2}>
                    <input
                      type="checkbox"
                      checked={!!visibleCols[k]}
                      onChange={(e) =>
                        setVisibleCols((v) => ({ ...v, [k]: e.target.checked }))
                      }
                    />
                    {label}
                  </label>
                ))}
                {visibleCols.giamGia && (
                  <span
                    style={{
                      marginLeft: 12,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ color: THEME.subtext, fontWeight: 600 }}>
                      Giảm (%):
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discountPct}
                      onChange={(e) =>
                        setDiscountPct(
                          Math.max(
                            0,
                            Math.min(100, Number(e.target.value) || 0)
                          )
                        )
                      }
                      style={inpSm}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className={`toolbar-toggle ${toolbarOpen ? "open" : "closed"}`}
            onClick={() => setToolbarOpen((v) => !v)}
            title={toolbarOpen ? "Ẩn thanh công cụ" : "Hiện thanh công cụ"}
          >
            <span>{toolbarOpen ? "▴" : "▾"}</span>
          </button>
        </div>

        {/* ===== Empty state ===== */}
        {Object.keys(groupedByCatalogue).length === 0 && (
          <div
            style={{
              margin: "12px 0",
              padding: 12,
              border: `1px solid ${THEME.line}`,
              borderRadius: 12,
              background: THEME.surface,
            }}
          >
            Không có sản phẩm khớp bộ lọc.
            <button
              onClick={clearFiltersAndRefresh}
              style={{ ...btnGhost, marginLeft: 8 }}
            >
              Xoá bộ lọc & tải lại
            </button>
          </div>
        )}

        {/* ===== Render theo catalogue ===== */}
        {Object.entries(groupedByCatalogue).map(([cat, items]) => (
          <section key={cat} style={{ marginBottom: 28 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: "#3d3f8b",
                margin: "12px 0 10px",
                textTransform: "uppercase",
              }}
            >
              {cat}
            </div>

            {items.map((p) => {
              const imgs = imageListMap[p.baseCode]; // undefined: đang nạp; []: không ảnh; array: đã có
              const cover = Array.isArray(imgs) && imgs.length ? imgs[0] : "";

              return (
                <div key={p.baseCode} style={card}>
                  <div
                    style={{ display: "flex", gap: 16 }}
                    className="card-flex"
                  >
                    {/* ẢNH: khung cố định + click mở gallery */}
                    <div
                      style={imgBox}
                      className={`img-zoom ${cover ? "img-has" : "img-empty"}`}
                      onClick={() => imgs && openGallery(p.baseCode)}
                      title={
                        cover
                          ? "Bấm để xem bộ ảnh"
                          : imgs === undefined
                          ? "Đang lấy ảnh…"
                          : "Không ảnh"
                      }
                    >
                      <div className="zoom-inner">
                        {cover ? (
                          <img
                            src={cover}
                            alt={p.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              display: "block",
                            }}
                            onError={() => {
                              const list = Array.isArray(imgs) ? imgs : [];
                              if (list.length > 1) {
                                setImageListMap((m) => {
                                  const now = Array.isArray(m[p.baseCode])
                                    ? m[p.baseCode]
                                    : [];
                                  const next = now.slice(1); // bỏ ảnh lỗi
                                  return { ...m, [p.baseCode]: next };
                                });
                              } else {
                                setImageListMap((m) => ({
                                  ...m,
                                  [p.baseCode]: [],
                                }));
                              }
                            }}
                          />
                        ) : imgs === undefined ? (
                          <span style={{ color: "#999" }}>Đang lấy…</span>
                        ) : (
                          <span style={{ color: "#999" }}>Không ảnh</span>
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>
                        {p.name}{" "}
                        <span style={{ color: THEME.subtext, fontWeight: 400 }}>
                          ({p.baseCode})
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: THEME.subtext,
                          marginBottom: 10,
                        }}
                      >
                        Tổng: <b>{vnd(p.totals.sl)}</b> | Đã bán:{" "}
                        <b>{vnd(p.totals.daBan)}</b> | Còn:{" "}
                        <b style={{ color: "#0a7" }}>{vnd(p.totals.conLai)}</b>
                      </div>

                      <div style={tableWrap}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            tableLayout: "fixed",
                            minWidth: 560,
                          }}
                          className="price-table"
                        >
                          <thead>
                            <tr>
                              <th style={th}>Mã + Size</th>
                              {visibleCols.giamGia && (
                                <th style={thNum}>Giảm giá</th>
                              )}
                              {visibleCols.giaLe && (
                                <th style={thNum}>Giá lẻ</th>
                              )}
                              {visibleCols.zalo && (
                                <th style={thNum}>Giá Zalo</th>
                              )}
                              {visibleCols.conLai && <th style={thNum}>Còn</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {p.variants.map((v) => {
                              const giaLe = +v.giaLe || 0;
                              const giaZalo =
                                +(v.zl || p.zaloBase || giaLe) || 0;
                              const giaGiam = Math.round(
                                giaLe * (1 - (discountPct || 0) / 100)
                              );
                              const stock = +v.conLai || 0;

                              return (
                                <tr
                                  key={v.sku}
                                  style={{
                                    background:
                                      stock > 0 ? ROW_BG_IN_STOCK : ROW_BG_OUT,
                                    transition: "background 120ms ease",
                                  }}
                                >
                                  <td style={td}>
                                    <div style={{ fontWeight: 500 }}>
                                      {v.sku}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: THEME.subtext,
                                        marginTop: 2,
                                      }}
                                    >
                                      {prettySizeLine(v.sku) || v.size}
                                    </div>
                                  </td>

                                  {visibleCols.giamGia && (
                                    <td style={{ ...numCol, fontWeight: 600 }}>
                                      {vnd(giaGiam)}
                                    </td>
                                  )}
                                  {visibleCols.giaLe && (
                                    <td style={numCol}>{vnd(giaLe)}</td>
                                  )}
                                  {visibleCols.zalo && (
                                    <td style={numCol}>{vnd(giaZalo)}</td>
                                  )}
                                  {visibleCols.conLai && (
                                    <td
                                      style={{
                                        ...numCol,
                                        fontWeight: 700,
                                        color:
                                          stock > 0 ? TEXT_IN_STOCK : TEXT_OUT,
                                      }}
                                      title={
                                        stock > 0 ? "Còn hàng" : "Hết hàng"
                                      }
                                    >
                                      {vnd(v.conLai)}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}

                            <tr style={{ background: THEME.chipBg }}>
                              <td style={{ ...td, fontWeight: 700 }}>Tổng</td>
                              {visibleCols.giamGia && (
                                <td style={{ ...numCol, fontWeight: 700 }} />
                              )}
                              {visibleCols.giaLe && (
                                <td style={{ ...numCol, fontWeight: 700 }} />
                              )}
                              {visibleCols.zalo && (
                                <td style={{ ...numCol, fontWeight: 700 }} />
                              )}
                              {visibleCols.conLai && (
                                <td style={{ ...numCol, fontWeight: 700 }}>
                                  {vnd(p.totals.conLai)}
                                </td>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {/* ===== Modal ảnh phóng to + gallery ===== */}
      {zoomCode && (
        <div
          style={imgModalWrap}
          onClick={() => {
            setZoomCode("");
            setZoomIndex(0);
          }}
        >
          <div style={imgModal} onClick={(e) => e.stopPropagation()}>
            {zoomSrc ? (
              <img
                src={zoomSrc}
                alt="Xem ảnh"
                style={{
                  display: "block",
                  maxWidth: "92vw",
                  maxHeight: "78vh",
                  objectFit: "contain",
                  margin: "8px auto",
                }}
                onError={() => {
                  const list = imageListMap[zoomCode] || [];
                  const next = list.filter((_, i) => i !== zoomIndex);
                  setImageListMap((m) => ({ ...m, [zoomCode]: next }));
                  setZoomIndex((i) =>
                    Math.max(0, Math.min(i, next.length - 1))
                  );
                }}
              />
            ) : (
              <div
                style={{
                  color: "#ddd",
                  textAlign: "center",
                  padding: "80px 0 60px",
                }}
              >
                Không có ảnh hợp lệ
              </div>
            )}

            {zoomList.length > 0 && (
              <div style={thumbRailWrap}>
                <div style={thumbRailInner}>
                  {zoomList.map((src, i) => (
                    <button
                      key={`${src}-${i}`}
                      style={{
                        ...thumbBtn,
                        borderColor: i === zoomIndex ? "#66a6ff" : "#e6e8ef",
                        outline:
                          i === zoomIndex
                            ? "2px solid rgba(102,166,255,.45)"
                            : "none",
                      }}
                      onClick={() => setZoomIndex(i)}
                      title="Xem ảnh"
                    >
                      <img
                        src={src}
                        alt="thumb"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          borderRadius: 8,
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Global styles / Responsive ===== */}
      <style jsx global>{`
        body {
          background: ${THEME.bg};
          color: ${THEME.text};
        }
        * {
          box-sizing: border-box;
        }
        ::selection {
          background: ${THEME.primary};
          color: #fff;
        }

        .card-hover:hover {
          transform: none !important;
          box-shadow: ${THEME.glow} !important;
        }

        .img-zoom {
          position: relative;
          overflow: visible;
        }
        .img-zoom .zoom-inner {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          background: #fff;
          border: 1px solid ${THEME.line};
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.22s ${EASE}, box-shadow 0.22s ${EASE};
          will-change: transform;
        }
        .img-empty .zoom-inner {
          background: #f6f7fb;
        }
        .img-zoom:hover .zoom-inner {
          transform: scale(1.08);
          box-shadow: 0 12px 28px rgba(17, 34, 68, 0.18);
          z-index: 5;
        }

        .toolbar-collapsible {
          overflow: hidden;
          transition: max-height 0.28s ${EASE}, padding 0.28s ${EASE};
          max-height: 1000px;
          padding-top: 2px;
        }
        .toolbar-collapsible.closed {
          max-height: 0;
          padding-top: 0;
          padding-bottom: 0;
        }

        .toolbar-toggle {
          position: absolute;
          left: 50%;
          bottom: -22px;
          transform: translate(-50%, 0);
          width: 44px;
          height: 44px;
          border-radius: 999px;
          border: 1px solid ${THEME.line};
          background: ${THEME.surface};
          box-shadow: ${THEME.glow};
          color: ${THEME.subtext};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s ${EASE}, transform 0.2s ${EASE};
          z-index: 60;
          font-size: 20px;
          line-height: 1;
        }
        .toolbar-toggle:hover {
          background: #f7f8fd;
        }

        @media (max-width: 900px) {
          .toolbar-grid {
            grid-template-columns: 1fr !important;
          }
          .toolbar-actions {
            justify-content: flex-start !important;
          }
          .toolbar-row2 {
            grid-template-columns: 1fr !important;
          }
          .card-flex {
            flex-direction: column !important;
          }
          .price-table {
            min-width: 520px;
          }
        }
        @media (max-width: 640px) {
          .img-zoom {
            width: 100% !important;
            height: 48vw !important;
            flex: 0 0 auto !important;
          }
          .price-table th,
          .price-table td {
            padding: 8px 6px !important;
          }
        }
      `}</style>
    </main>
  );
}

/* ========== Styles ========== */
const appWrap = {
  minHeight: "100vh",
  background: THEME.bg,
  color: THEME.text,
  fontFamily: "system-ui",
};
const container = { width: "min(1240px, 92vw)", margin: "-36px auto 24px" };

const hero = {
  background: `linear-gradient(180deg, ${THEME.primary} 0%, ${THEME.primary700} 100%)`,
  padding: "34px 0 86px",
  color: "#fff",
  boxShadow: "inset 0 -1px 0 rgba(255,255,255,.1)",
};
const heroInner = { width: "min(1240px, 92vw)", margin: "0 auto" };
const heroTitle = { fontSize: 28, fontWeight: 800, letterSpacing: 0.2 };
const logoDot = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#fff",
  boxShadow: "0 0 0 3px rgba(255,255,255,.25)",
};
const syncBadge = {
  marginLeft: 10,
  padding: "4px 8px",
  background: "rgba(255,255,255,.15)",
  borderRadius: 999,
  fontSize: 12,
};

const tabsWrap = {
  display: "inline-flex",
  gap: 8,
  marginTop: 14,
  background: "rgba(255,255,255,.12)",
  padding: 6,
  borderRadius: 999,
  backdropFilter: "blur(6px)",
};
const tabPill = (active) => ({
  padding: "8px 14px",
  borderRadius: 999,
  cursor: "pointer",
  color: "#fff",
  fontWeight: 700,
  letterSpacing: 0.2,
  background: active ? "rgba(255,255,255,.28)" : "transparent",
  transition: `all .2s ${EASE}`,
  boxShadow: active ? "0 6px 16px rgba(0,0,0,.12) inset" : "none",
});

const toolbarSticky = {
  position: "sticky",
  top: 12,
  zIndex: 50,
  background: THEME.surface,
  border: `1px solid ${THEME.line}`,
  borderRadius: 14,
  padding: 12,
  paddingBottom: 30,
  boxShadow: THEME.glow,
};
const panelLight = {
  border: `1px dashed ${THEME.line}`,
  borderRadius: 12,
  padding: 10,
  background: THEME.surface,
};
const chip2 = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  border: `1px solid ${THEME.chipLine}`,
  borderRadius: 999,
  background: THEME.chipBg,
  marginRight: 8,
};

const inp = {
  padding: "10px 12px",
  border: `1px solid ${THEME.line}`,
  borderRadius: 10,
  background: "#fff",
  outline: "none",
};
const inpSm = { ...inp, padding: "8px 10px", width: 90 };
const select2 = { ...inp, minWidth: 240 };

const btnPrimary = {
  padding: "10px 12px",
  border: "none",
  borderRadius: 10,
  color: "#fff",
  background: THEME.primary600,
  cursor: "pointer",
  transition: `transform .15s ${EASE}, box-shadow .2s ${EASE}`,
  boxShadow: "0 6px 16px rgba(86,118,244,.25)",
};
const btnGhost = {
  padding: "10px 12px",
  border: `1px solid ${THEME.line}`,
  borderRadius: 10,
  background: "#fff",
  cursor: "pointer",
};

const card = {
  border: `1px solid ${THEME.line}`,
  borderRadius: 14,
  padding: 14,
  background: THEME.surface,
  boxShadow: THEME.glow,
  transition: `transform .15s ${EASE}, box-shadow .2s ${EASE}`,
  marginBottom: 8,
};

const imgBox = {
  width: 320,
  height: 220,
  flex: "0 0 320px",
  position: "relative",
  overflow: "visible",
  borderRadius: 12,
};

const th = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: `1px solid ${THEME.line}`,
  whiteSpace: "nowrap",
  color: THEME.subtext,
  fontWeight: 700,
  fontSize: 13.5,
};
const td = {
  padding: "10px 8px",
  borderBottom: `1px dashed ${THEME.line}`,
  lineHeight: 1.25,
  fontSize: 14,
};
const thNum = {
  ...th,
  textAlign: "right",
  width: 120,
  fontVariantNumeric: "tabular-nums",
};
const numCol = {
  ...td,
  textAlign: "right",
  width: 120,
  fontVariantNumeric: "tabular-nums",
};

const ROW_BG_IN_STOCK = THEME.successBg;
const ROW_BG_OUT = THEME.dangerBg;
const TEXT_IN_STOCK = "#0a7";
const TEXT_OUT = "#c33";

const tableWrap = {
  width: "100%",
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
  borderRadius: 8,
};

/* Modal zoom + gallery */
const imgModalWrap = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1100,
};
const imgModal = {
  maxWidth: "92vw",
  maxHeight: "92vh",
  borderRadius: 12,
  overflow: "hidden",
  background: "#000",
  paddingBottom: 10,
};
const thumbRailWrap = {
  width: "100%",
  padding: "8px 10px 12px",
  background: "#0b0b0b",
  borderTop: "1px solid rgba(255,255,255,.08)",
};
const thumbRailInner = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};
const thumbBtn = {
  width: 84,
  height: 64,
  borderRadius: 10,
  border: "2px solid #e6e8ef",
  background: "#fff",
  padding: 0,
  cursor: "pointer",
  flex: "0 0 auto",
};

// ok Z66
