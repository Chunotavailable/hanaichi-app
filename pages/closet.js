// pages/closet.js
// Trang riêng "Hàng Closet sẵn" — tra cứu nhanh hàng có sẵn (giày Wilson/
// Onitsuka/Nike/Asics, quần áo, túi/balo/phụ kiện...) theo mã, size, tên...
// Dùng chung nguồn dữ liệu với "Giá gồm cân" (api/gomcan, field "closet").
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { uid, norm, resizeImageFile, uploadGomcanImage, deleteGomcanImage, importGomcanImageFromUrl, ViewModeToggle, gridColumnsFor } from "../lib/gomcanHelpers";

// Lấy phần trong ngoặc của mã biến thể để hiện gọn khi cần (VD "WRS...-235
// (EU 38)" -> "EU 38").
function variantShortLabel(v) {
  const m = (v.label || "").match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  const label = (v.label || "").trim();
  return label.length > 22 ? label.slice(0, 20) + "…" : label || "?";
}
// Tìm phần mã DÙNG CHUNG cho mọi biến thể của 1 sản phẩm (VD các mã
// "WRS00964001-235", "WRS00964001-24"... đều chung tiền tố "WRS00964001") —
// để hiện mã đó ra 1 lần duy nhất, còn từng biến thể chỉ hiện phần size
// riêng, khỏi lặp lại mã dài dòng dài trên từng thẻ size.
function commonCodePrefix(variants) {
  const labels = (variants || []).map((v) => (v.label || "").trim()).filter(Boolean);
  if (labels.length < 2) return "";
  let prefix = labels[0];
  for (let i = 1; i < labels.length && prefix; i++) {
    const b = labels[i];
    let j = 0;
    while (j < prefix.length && j < b.length && prefix[j] === b[j]) j++;
    prefix = prefix.slice(0, j);
  }
  // Cắt về đúng ranh giới sạch (trước dấu "-", "/" hoặc khoảng trắng gần nhất)
  // để không cắt đứt giữa chừng 1 từ/số.
  const m = prefix.match(/^(.*)[-/\s]/);
  const cleaned = m ? m[1] : "";
  return cleaned.length >= 3 ? cleaned : "";
}
// Đoán ra mã sản phẩm để ghép vào từ khóa tìm ảnh: ưu tiên mã dùng chung
// giữa các biến thể, không có thì lấy phần trước dấu "(" của biến thể đầu.
function productCodeGuess(p) {
  const variants = p.variants || [];
  const shared = commonCodePrefix(variants);
  if (shared) return shared;
  const first = (variants[0] && variants[0].label) || "";
  const m = first.match(/^(.*?)\s*\(/);
  return (m ? m[1] : first).trim();
}
// Phần "size" riêng của 1 biến thể sau khi đã bỏ mã dùng chung — ưu tiên lấy
// phần chữ trong ngoặc (dễ đọc hơn, VD "EU 38") nếu có.
function sizePartFor(label, code) {
  const raw = (label || "").trim();
  let rest = code ? raw.slice(code.length) : raw;
  rest = rest.replace(/^[-/\s]+/, "").trim();
  const m = rest.match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  return rest || raw || "?";
}
function fmtClosetPrice(price) {
  const n = Number(price) || 0;
  return n.toLocaleString("vi-VN") + "k";
}
// ===== Nhập ảnh hàng loạt: khớp 1 dòng "mã: link ảnh" người dùng dán vào với
// đúng sản phẩm trong danh sách, dựa trên mã sản phẩm xuất hiện trong tên
// hoặc trong mã các biến thể (không cần khớp chính xác dấu cách/gạch ngang).
function normCode(s) {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function matchClosetProductsByCode(list, code) {
  // Cho phép dán thẳng đúng id nội bộ của sản phẩm (chính xác tuyệt đối,
  // dùng khi đã biết chắc sản phẩm nào — ví dụ do tự tra cứu sẵn) — ưu tiên
  // kiểm tra trước, không thì mới khớp mờ theo mã xuất hiện trong tên/biến thể.
  const byId = list.find((p) => p.id === (code || "").trim());
  if (byId) return [byId];
  const nc = normCode(code);
  if (nc.length < 4) return [];
  return list.filter((p) => {
    const hay = normCode(p.name + " " + (p.variants || []).map((v) => v.label).join(" "));
    return hay.includes(nc);
  });
}
// Tách 1 khối text nhiều dòng thành từng dòng {code, url} — link ảnh là phần
// bắt đầu bằng http(s), phần còn lại trước đó là mã sản phẩm.
function parseBulkImageLines(text) {
  return (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/(https?:\/\/\S+)/i);
      if (!m) return { raw: line, code: line, url: "" };
      const url = m[1];
      const code = line.slice(0, m.index).replace(/[:\-|,\s]+$/, "").trim();
      return { raw: line, code, url };
    });
}
// Sản phẩm xả kho: tên có chữ "xả kho" HOẶC được tự tay tích chọn (p.xaKho)
// — hiện nhãn XẢ KHO + giá tô đỏ ở ngoài, và không được áp chương trình
// giảm giá chung. Nhận vào cả product object hoặc chuỗi tên (giữ tương thích
// với các chỗ gọi cũ isXaKho(p)).
function isXaKho(p) {
  if (p && typeof p === "object") {
    return !!p.xaKho || norm(p.name || "").includes("xa kho");
  }
  return norm(p || "").includes("xa kho");
}
const XA_KHO_COLOR = "#dc2626";

// Giới tính suy ra từ tên/danh mục: mã nào không có chữ "nam"/"nữ" thì coi
// như dùng được cho cả 2 giới (luôn hiện ra dù đang lọc Nam hay Nữ).
function genderOf(p) {
  const tokens = norm((p.name || "") + " " + (p.category || "")).split(" ").filter(Boolean);
  const hasNam = tokens.includes("nam");
  const hasNu = tokens.includes("nu");
  if (hasNam && !hasNu) return "nam";
  if (hasNu && !hasNam) return "nu";
  return "both";
}
// Lấy các số size EU có trong mã/size của 1 sản phẩm — không cần khớp chính
// xác dấu cách (VD "EU 38", "EU38", "EU 38 2/3" đều nhận ra số "38").
function euSizesOf(p) {
  const sizes = new Set();
  (p.variants || []).forEach((v) => {
    const m = (v.label || "").match(/EU\s*([0-9]+)/i);
    if (m) sizes.add(m[1]);
  });
  return sizes;
}
function minPriceOf(p) {
  const prices = (p.variants || []).map((v) => Number(v.price) || 0).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : Infinity;
}
// Tách 1 mã hiển thị (VD "WRS00964001-235 (EU 38)") thành 2 phần riêng để
// sửa cho dễ: "Mã" (WRS00964001-235) và "Size" (EU 38) — dùng khi mở form
// sửa 1 mã cụ thể. Mã nào không có ngoặc thì size để trống, mã là cả chuỗi.
function splitLabelForEdit(label) {
  const raw = (label || "").trim();
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { code: m[1].trim(), size: m[2].trim() };
  return { code: raw, size: "" };
}
// Ghép lại "Mã" + "Size" thành 1 chuỗi label để lưu và hiển thị/tìm kiếm
// như trước (VD "WRS00964001-235 (EU 38)").
function composeLabel(code, size) {
  const c = (code || "").trim();
  const s = (size || "").trim();
  if (!c) return s;
  return s ? `${c} (${s})` : c;
}
// Chương trình giảm giá áp dụng cho cả tab Closet: bật lên thì mọi sản phẩm
// có giá từ "threshold" trở lên được giảm "percent"% khi hiển thị ra ngoài.
const DEFAULT_DISCOUNT = { enabled: false, threshold: 500, percent: 5 };
function applyDiscount(price, discount) {
  const d = discount || DEFAULT_DISCOUNT;
  if (!d.enabled) return price;
  const threshold = Number(d.threshold) || 0;
  const percent = Number(d.percent) || 0;
  if (threshold > 0 && percent > 0 && price >= threshold) {
    const raw = price * (1 - percent / 100);
    // Giá đơn vị "k" = nghìn đồng, nên bội số 5.000đ chính là bội số của 5 ở đây.
    return Math.ceil(raw / 5) * 5;
  }
  return price;
}
// Dòng giá hiện ra ngoài thẻ sản phẩm: nếu các mã/size có cùng 1 giá thì
// hiện 1 số, khác giá thì hiện khoảng giá "thấp nhất - cao nhất". Khi có
// chương trình giảm giá đang bật và áp dụng được, trả thêm dòng giá gốc để
// hiện gạch ngang bên cạnh giá đã giảm.
function priceRangeLine(variants, discount) {
  const prices = (variants || []).map((v) => Number(v.price) || 0).filter((n) => n > 0);
  if (!prices.length) return { text: "------", originalText: null };
  const discounted = prices.map((p) => applyDiscount(p, discount));
  const min = Math.min(...discounted);
  const max = Math.max(...discounted);
  const text = min === max ? fmtClosetPrice(min) : `${fmtClosetPrice(min)} - ${fmtClosetPrice(max)}`;
  const hasDiscount = discounted.some((d, i) => d !== prices[i]);
  if (!hasDiscount) return { text, originalText: null };
  const omin = Math.min(...prices);
  const omax = Math.max(...prices);
  const originalText = omin === omax ? fmtClosetPrice(omin) : `${fmtClosetPrice(omin)} - ${fmtClosetPrice(omax)}`;
  return { text, originalText };
}
// Câu báo giá nhanh cho từng sản phẩm, theo đúng mẫu chủ shop dùng để trả lời khách.
function buildClosetQuote(p, discount) {
  const priceLine = priceRangeLine(p.variants || [], discount);
  if (priceLine.text === "------") return "";
  const name = (p.name || "").replace(/\n/g, " ").trim();
  // Sản phẩm đang được giảm giá thì câu báo giá nói rõ luôn cho khách biết.
  if (priceLine.originalText) {
    return `Dạ ${name} bên em có sẵn đang được giảm giá còn ${priceLine.text} ạ`;
  }
  return `Dạ ${name} bên em có sẵn giá ${priceLine.text} ạ`;
}

export default function ClosetPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip, thumb } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip, thumb };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/gomcan");
        const d = await r.json();
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function persist(next) {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/gomcan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 250);
  }

  if (loading || !data) {
    return <Loading />;
  }

  function addClosetProduct(product) {
    const next = { ...data, closet: [...(data.closet || []), { id: uid(), image: "", variants: [], ...product }] };
    persist(next);
  }
  function saveClosetProduct(id, patch) {
    const next = { ...data, closet: data.closet.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    persist(next);
  }
  function delClosetProduct(id) {
    deleteGomcanImage(id);
    const next = { ...data, closet: data.closet.filter((p) => p.id !== id) };
    persist(next);
  }
  function addClosetVariant(productId, variant) {
    const next = {
      ...data,
      closet: data.closet.map((p) =>
        p.id === productId ? { ...p, variants: [...p.variants, { id: uid(), qty: 0, sold: 0, remaining: 0, ...variant }] } : p
      ),
    };
    persist(next);
  }
  function saveClosetVariant(productId, variantId, patch) {
    const next = {
      ...data,
      closet: data.closet.map((p) =>
        p.id === productId ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)) } : p
      ),
    };
    persist(next);
  }
  function delClosetVariant(productId, variantId) {
    const next = {
      ...data,
      closet: data.closet.map((p) => (p.id === productId ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) } : p)),
    };
    persist(next);
  }
  function bumpClosetVariant(productId, variantId, delta) {
    const p = data.closet.find((x) => x.id === productId);
    const v = p && p.variants.find((x) => x.id === variantId);
    if (!v) return;
    const nextRemaining = Math.max(0, (Number(v.remaining) || 0) + delta);
    saveClosetVariant(productId, variantId, { remaining: nextRemaining });
  }
  function saveClosetDiscount(patch) {
    const next = { ...data, closetDiscount: { ...(data.closetDiscount || DEFAULT_DISCOUNT), ...patch } };
    persist(next);
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader icon="👜" title="Hàng Closet sẵn" current="/closet" maxWidth={900} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        <ClosetSection
          data={data}
          addClosetProduct={addClosetProduct}
          saveClosetProduct={saveClosetProduct}
          delClosetProduct={delClosetProduct}
          addClosetVariant={addClosetVariant}
          saveClosetVariant={saveClosetVariant}
          delClosetVariant={delClosetVariant}
          bumpClosetVariant={bumpClosetVariant}
          discount={data.closetDiscount || DEFAULT_DISCOUNT}
          saveClosetDiscount={saveClosetDiscount}
          T={T}
        />
      </div>
    </main>
  );
}

// Modal nhập ảnh hàng loạt: dán 1 danh sách nhiều dòng "mã: link ảnh", app tự
// khớp từng dòng với đúng sản phẩm rồi nhập ảnh cho tất cả cùng 1 lúc, thay vì
// phải mở từng sản phẩm ra làm tay 200 lần.
function BulkImportModal({ list, saveClosetProduct, onClose, T }) {
  const { THEME, card, inp, btn, btnSub } = T;
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [rows, setRows] = useState(null); // null = chưa xem trước
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  function preview() {
    const parsed = parseBulkImageLines(text).map((r) => {
      if (!r.url) return { ...r, status: "no-link", matches: [] };
      const matches = matchClosetProductsByCode(list, r.code);
      if (!matches.length) return { ...r, status: "not-found", matches: [] };
      if (matches.length > 1) return { ...r, status: "ambiguous", matches };
      const p = matches[0];
      if (p.image && !overwrite) return { ...r, status: "skip-has-image", matches };
      return { ...r, status: "ok", matches };
    });
    setRows(parsed);
  }

  async function runImport() {
    setRunning(true);
    let n = 0;
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (row.status !== "ok") continue;
      try {
        const url = await importGomcanImageFromUrl(row.matches[0].id, row.url);
        saveClosetProduct(row.matches[0].id, { image: url });
        next[i] = { ...row, status: "imported" };
      } catch {
        next[i] = { ...row, status: "failed" };
      }
      n++;
      setDoneCount(n);
      setRows([...next]);
    }
    setRunning(false);
  }

  const STATUS_LABEL = {
    ok: "✅ Sẵn sàng nhập",
    imported: "✅ Đã nhập",
    failed: "❌ Lỗi khi tải ảnh",
    "not-found": "❓ Không tìm thấy sản phẩm khớp mã",
    ambiguous: `⚠️ Khớp nhiều sản phẩm — bỏ qua`,
    "skip-has-image": "⏭️ Đã có ảnh — bỏ qua (tích \"Ghi đè\" để thay)",
    "no-link": "❌ Không thấy link ảnh trong dòng này",
  };

  const okCount = rows ? rows.filter((r) => r.status === "ok").length : 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(60,20,25,0.45)", zIndex: 90, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="hnCard" style={{ ...card, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>📥 Nhập ảnh hàng loạt</h3>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: THEME.chipBg, fontSize: 15, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: THEME.subtext, marginBottom: 8 }}>
          Mỗi dòng 1 sản phẩm, theo dạng <b>mã sản phẩm: link ảnh</b>, ví dụ:
          <div style={{ background: THEME.chipBg, borderRadius: 8, padding: 8, marginTop: 4, fontFamily: "monospace", fontSize: 12 }}>
            1044A081-250: https://.../anh1.jpg{"\n"}IR7843: https://.../anh2.jpg
          </div>
          App sẽ tự tìm sản phẩm có mã đó rồi lấy ảnh về, không cần đúng tuyệt đối dấu cách/gạch ngang.
        </div>
        <textarea
          style={{ ...inp, width: "100%", minHeight: 140, fontFamily: "monospace", fontSize: 12.5 }}
          placeholder={"Dán danh sách mã + link ảnh vào đây, mỗi dòng 1 sản phẩm..."}
          value={text}
          onChange={(e) => { setText(e.target.value); setRows(null); }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setRows(null); }} />
          Ghi đè cả những sản phẩm đã có ảnh (mặc định chỉ nhập cho sản phẩm còn thiếu ảnh)
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={btnSub} onClick={preview} disabled={!text.trim() || running}>👀 Xem trước</button>
          <button style={btn} onClick={runImport} disabled={!rows || !okCount || running}>
            {running ? `Đang nhập… (${doneCount}/${okCount})` : `📥 Nhập ${okCount || ""} ảnh`}
          </button>
        </div>

        {rows && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, padding: "5px 8px", background: THEME.chipBg, borderRadius: 6, alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.matches && r.matches[0] ? r.matches[0].name : r.code || r.raw}
                </span>
                <span style={{ flexShrink: 0, color: THEME.subtext }}>{STATUS_LABEL[r.status] || r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClosetSection({ data, addClosetProduct, saveClosetProduct, delClosetProduct, addClosetVariant, saveClosetVariant, delClosetVariant, bumpClosetVariant, discount, saveClosetDiscount, T }) {
  const { THEME, card, btn, btnSub, inp, iconBtn } = T;
  const list = data.closet || [];
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [addingCategory, setAddingCategory] = useState(null); // category đang thêm sản phẩm mới
  const [viewMode, setViewMode] = useState("small");
  const [activeCat, setActiveCat] = useState(null); // null = xem tất cả danh mục
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [genderFilter, setGenderFilter] = useState(null); // null | "nam" | "nu"
  const [sizeFilter, setSizeFilter] = useState([]); // các số size EU đang chọn — chọn được nhiều size cùng lúc
  const [sortPriceAsc, setSortPriceAsc] = useState(false);
  const [xaKhoFilter, setXaKhoFilter] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const tokens = norm(q).split(" ").filter(Boolean);
  const searched = !tokens.length
    ? list
    : list.filter((p) => {
        const h = norm(p.name + " " + p.category + " " + (p.variants || []).map((v) => v.label).join(" "));
        return tokens.every((t) => h.includes(t));
      });

  // 3 bộ lọc dưới đây có thể bật cùng lúc 1, 2 hay cả 3 cái — mỗi cái thu hẹp
  // thêm trên kết quả của cái trước.
  const genderFiltered = !genderFilter
    ? searched
    : searched.filter((p) => {
        const g = genderOf(p);
        return g === genderFilter || g === "both";
      });

  const availableSizes = Array.from(new Set(genderFiltered.flatMap((p) => Array.from(euSizesOf(p))))).sort(
    (a, b) => Number(a) - Number(b)
  );
  // Nếu đổi bộ lọc giới tính khiến 1 size đang chọn không còn xuất hiện nữa
  // thì tự bỏ qua size đó thay vì lọc ra danh sách rỗng mãi.
  const effectiveSizeFilter = sizeFilter.filter((s) => availableSizes.includes(s));
  const sizeFiltered = !effectiveSizeFilter.length
    ? genderFiltered
    : genderFiltered.filter((p) => {
        const sizes = euSizesOf(p);
        return effectiveSizeFilter.some((s) => sizes.has(s));
      });

  const xaKhoFilteredList = xaKhoFilter ? sizeFiltered.filter((p) => isXaKho(p)) : sizeFiltered;

  const filtered = sortPriceAsc ? [...xaKhoFilteredList].sort((a, b) => minPriceOf(a) - minPriceOf(b)) : xaKhoFilteredList;

  const categories = [];
  const seen = new Set();
  filtered.forEach((p) => {
    if (!seen.has(p.category)) {
      seen.add(p.category);
      categories.push(p.category);
    }
  });

  // Bấm 1 danh mục thì chỉ hiện đúng danh mục đó (thay vì phải kéo xuống);
  // bấm lại lần nữa (hoặc bấm "Tất cả") thì quay về xem hết.
  const shownCategories = activeCat && categories.includes(activeCat) ? [activeCat] : categories;

  const viewingProduct = viewId ? list.find((p) => p.id === viewId) : null;
  const confirmDelProduct = confirmDelId ? list.find((p) => p.id === confirmDelId) : null;

  return (
    <div style={{ ...card, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ fontWeight: 800, margin: 0 }}>👜 Hàng Closet sẵn ({list.length} mẫu)</h3>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button style={btnSub} onClick={() => setShowBulkImport(true)}>📥 Nhập ảnh hàng loạt</button>
          <ViewModeToggle mode={viewMode} setMode={setViewMode} T={T} />
        </div>
      </div>

      {showBulkImport && (
        <BulkImportModal list={list} saveClosetProduct={saveClosetProduct} onClose={() => setShowBulkImport(false)} T={T} />
      )}

      {/* Chương trình giảm giá áp dụng chung cho cả tab: tích vào là tự động
          giảm giá cho mọi sản phẩm từ mức giá đã đặt, bấm ✏️ để đổi % giảm
          hoặc mức giá áp dụng theo từng đợt khuyến mãi khác nhau. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          padding: "8px 10px",
          background: discount.enabled ? "#eafaf0" : THEME.chipBg,
          border: `1px solid ${discount.enabled ? "#c9ecd6" : THEME.chipLine}`,
          borderRadius: 10,
          flexWrap: "wrap",
        }}
      >
        <input
          type="checkbox"
          checked={!!discount.enabled}
          onChange={(e) => saveClosetDiscount({ enabled: e.target.checked })}
          style={{ width: 18, height: 18, flexShrink: 0 }}
        />
        {editingDiscount ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
            <span style={{ fontSize: 13.5 }}>Giảm</span>
            <input
              style={{ ...inp, width: 56, padding: "4px 6px" }}
              defaultValue={discount.percent}
              onBlur={(e) => saveClosetDiscount({ percent: Number(e.target.value) || 0 })}
            />
            <span style={{ fontSize: 13.5 }}>% cho sản phẩm từ</span>
            <input
              style={{ ...inp, width: 80, padding: "4px 6px" }}
              defaultValue={discount.threshold}
              onBlur={(e) => saveClosetDiscount({ threshold: Number(e.target.value) || 0 })}
            />
            <span style={{ fontSize: 13.5 }}>k trở lên</span>
            <button style={btnSub} onClick={() => setEditingDiscount(false)}>Xong</button>
          </div>
        ) : (
          <>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 13.5, color: discount.enabled ? "#1f7a3d" : THEME.text }}>
              🏷️ Giảm {discount.percent}% cho sản phẩm từ {fmtClosetPrice(discount.threshold)} trở lên
            </span>
            <button style={iconBtn} title="Sửa chương trình giảm giá" onClick={() => setEditingDiscount(true)}>✏️</button>
          </>
        )}
      </div>

      <input
        style={{ ...inp, marginTop: 12, marginBottom: 10 }}
        placeholder="🔍 Tìm theo tên, mã, size, màu... (VD: 38, onitsuka, wilson)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {/* Bộ lọc: Nam/Nữ, giá thấp-cao, xả kho, size EU — bật được 1, nhiều hay cả cùng lúc. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <button
          onClick={() => setGenderFilter(genderFilter === "nam" ? null : "nam")}
          style={{ ...btnSub, background: genderFilter === "nam" ? THEME.primary : THEME.chipBg }}
        >
          👨 Nam
        </button>
        <button
          onClick={() => setGenderFilter(genderFilter === "nu" ? null : "nu")}
          style={{ ...btnSub, background: genderFilter === "nu" ? THEME.primary : THEME.chipBg }}
        >
          👩 Nữ
        </button>
        <button
          onClick={() => setSortPriceAsc((v) => !v)}
          style={{ ...btnSub, background: sortPriceAsc ? THEME.primary : THEME.chipBg }}
        >
          💰 Giá thấp → cao
        </button>
        <button
          onClick={() => setXaKhoFilter((v) => !v)}
          style={{
            ...btnSub,
            background: xaKhoFilter ? XA_KHO_COLOR : THEME.chipBg,
            color: xaKhoFilter ? "#fff" : THEME.brand,
          }}
        >
          🏷️ Xả kho
        </button>
      </div>

      {availableSizes.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          <span style={{ fontSize: 12.5, color: THEME.subtext, flexShrink: 0 }}>Size EU:</span>
          {availableSizes.map((s) => {
            const active = effectiveSizeFilter.includes(s);
            return (
              <button
                key={s}
                onClick={() => setSizeFilter(active ? sizeFilter.filter((x) => x !== s) : [...sizeFilter, s])}
                style={{ ...btnSub, whiteSpace: "nowrap", flexShrink: 0, padding: "5px 10px", background: active ? THEME.primary : THEME.chipBg }}
              >
                {s}
              </button>
            );
          })}
          {effectiveSizeFilter.length > 0 && (
            <button onClick={() => setSizeFilter([])} style={{ ...btnSub, whiteSpace: "nowrap", flexShrink: 0, padding: "5px 10px" }}>
              Xoá size ✕
            </button>
          )}
        </div>
      )}

      {/* Thanh nhấn nhanh chọn danh mục — bấm vào là chỉ hiện đúng danh mục đó,
          khỏi phải kéo tay xuống mới xem được mục khác. */}
      {categories.length > 1 && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: THEME.surface,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            maxWidth: "100%",
            padding: "6px 0 10px",
            marginBottom: 6,
            WebkitOverflowScrolling: "touch",
          }}
        >
          <button
            onClick={() => setActiveCat(null)}
            style={{ ...btnSub, whiteSpace: "nowrap", flexShrink: 0, background: !activeCat ? THEME.primary : THEME.chipBg }}
          >
            Tất cả
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(activeCat === cat ? null : cat)}
              style={{ ...btnSub, whiteSpace: "nowrap", flexShrink: 0, background: activeCat === cat ? THEME.primary : THEME.chipBg }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && <div style={{ color: THEME.subtext, fontSize: 16, marginBottom: 8 }}>Không tìm thấy mẫu nào khớp</div>}

      {shownCategories.map((cat) => (
        <div key={cat} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: THEME.brand, marginBottom: 8, borderBottom: `1px dashed ${THEME.chipLine}`, paddingBottom: 4 }}>
            {cat}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: gridColumnsFor(viewMode), gap: 10, marginBottom: 10 }}>
            {filtered
              .filter((p) => p.category === cat)
              .map((p) => (
                <ClosetProductCard key={p.id} p={p} listMode={viewMode === "list"} onOpen={() => setViewId(p.id)} discount={discount} T={T} />
              ))}
          </div>
          <button style={btnSub} onClick={() => setAddingCategory(addingCategory === cat ? null : cat)}>
            {addingCategory === cat ? "Đóng" : `＋ Thêm mẫu vào "${cat}"`}
          </button>
          {addingCategory === cat && (
            <ClosetAddProductForm
              category={cat}
              onAdd={(product) => {
                addClosetProduct(product);
                setAddingCategory(null);
              }}
              T={T}
            />
          )}
        </div>
      ))}

      <div style={{ borderTop: `1px dashed ${THEME.chipLine}`, paddingTop: 14, marginTop: 4 }}>
        <button style={btnSub} onClick={() => setAddingCategory(addingCategory === "__new__" ? null : "__new__")}>
          {addingCategory === "__new__" ? "Đóng" : "＋ Thêm mẫu vào danh mục mới"}
        </button>
        {addingCategory === "__new__" && (
          <ClosetAddProductForm
            category=""
            askCategory
            onAdd={(product) => {
              addClosetProduct(product);
              setAddingCategory(null);
            }}
            T={T}
          />
        )}
      </div>

      {viewingProduct && (
        <ClosetDetailModal
          p={viewingProduct}
          onClose={() => setViewId(null)}
          onDelete={() => setConfirmDelId(viewingProduct.id)}
          saveClosetProduct={saveClosetProduct}
          addClosetVariant={addClosetVariant}
          saveClosetVariant={saveClosetVariant}
          delClosetVariant={delClosetVariant}
          bumpClosetVariant={bumpClosetVariant}
          discount={discount}
          T={T}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelProduct}
        message={`Xoá mẫu "${confirmDelProduct ? confirmDelProduct.name.split("\n")[0] : ""}"? Không thể hoàn tác.`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delClosetProduct(confirmDelId);
          setConfirmDelId(null);
          setViewId(null);
        }}
      />
    </div>
  );
}

/* ---- Thẻ sản phẩm ở ngoài: ảnh (không hiện số lượng nữa) + tên + giá +
   các mã/size (chip). Ở chế độ danh sách thì gọn thành 1 dòng ngang. ---- */
function ClosetProductCard({ p, listMode, onOpen, discount, T }) {
  const { THEME, card, chip } = T;
  const variants = p.variants || [];
  // Ở ngoài chỉ hiện các size CÒN HÀNG (màu xanh) — size hết hàng không hiện nữa.
  const inStock = variants.filter((v) => Number(v.remaining) > 0);
  const shown = inStock.slice(0, 6);
  const extra = inStock.length - shown.length;
  const xaKho = isXaKho(p);
  const priceLine = priceRangeLine(variants, xaKho ? null : discount);
  // Mã dùng chung hiện 1 lần duy nhất; mỗi biến thể chỉ còn hiện phần size.
  const code = commonCodePrefix(variants);
  const sizeChip = (v) => (code ? sizePartFor(v.label, code) : v.label);
  const inStockChipStyle = { ...chip, fontSize: 10.5, padding: "1px 6px", background: "#eafaf0", borderColor: "#c9ecd6", color: "#1f7a3d" };
  const priceColor = xaKho ? XA_KHO_COLOR : THEME.brand;

  if (listMode) {
    return (
      <div className="hnCard" onClick={onOpen} style={{ ...card, minWidth: 0, maxWidth: "100%", cursor: "pointer", display: "flex", gap: 10, padding: 10, alignItems: "center" }}>
        <div style={{ position: "relative", width: 56, height: 56, minWidth: 56, borderRadius: 10, overflow: "hidden", background: THEME.chipBg }}>
          {p.image ? (
            <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 22 }}>👜</div>
          )}
          {xaKho && (
            <div className="hnBlink" style={{ position: "absolute", top: 4, left: 4, background: XA_KHO_COLOR, color: "#fff", fontSize: 8.5, fontWeight: 800, padding: "1px 5px", borderRadius: 5 }}>
              XẢ KHO
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, minWidth: 0 }}>
            {priceLine.originalText && <span style={{ fontSize: 11, color: THEME.subtext, textDecoration: "line-through", flexShrink: 0 }}>{priceLine.originalText}</span>}
            <span style={{ fontWeight: 800, color: priceColor, fontSize: 14, flexShrink: 0 }}>{priceLine.text}</span>
            {code && <span style={{ fontSize: 11, color: THEME.subtext, flexShrink: 0 }}>Mã {code}</span>}
            <div style={{ display: "flex", gap: 4, overflow: "hidden", minWidth: 0 }}>
              {shown.length ? (
                shown.slice(0, 3).map((v) => (
                  <span key={v.id} style={{ ...inStockChipStyle, flexShrink: 0 }}>{sizeChip(v)}</span>
                ))
              ) : (
                <span style={{ fontSize: 11, color: THEME.subtext, flexShrink: 0 }}>Hết hàng</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hnCard" onClick={onOpen} style={{ ...card, minWidth: 0, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", width: "100%", paddingTop: "100%", background: THEME.chipBg }}>
        <div style={{ position: "absolute", inset: 0 }}>
          {p.image ? (
            <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 38 }}>👜</div>
          )}
          {xaKho && (
            <div className="hnBlink" style={{ position: "absolute", top: 6, left: 6, background: XA_KHO_COLOR, color: "#fff", fontSize: 10.5, fontWeight: 800, padding: "2px 9px", borderRadius: 7, letterSpacing: 0.3 }}>
              XẢ KHO
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "8px 10px 10px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>
          {p.name}
        </div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6 }}>
          {priceLine.originalText && <span style={{ fontSize: 12, color: THEME.subtext, textDecoration: "line-through" }}>{priceLine.originalText}</span>}
          <span style={{ fontWeight: 800, color: priceColor, fontSize: 15 }}>{priceLine.text}</span>
        </div>
        {code && (
          <div style={{ fontSize: 11, color: THEME.subtext, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Mã {code}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
          {shown.length ? (
            shown.map((v) => (
              <span key={v.id} title={`Mã: ${v.label}`} style={inStockChipStyle}>
                {sizeChip(v)}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 11.5, color: THEME.subtext, fontWeight: 700 }}>Hết hàng</span>
          )}
          {extra > 0 && <span style={{ ...chip, fontSize: 10.5, padding: "1px 6px" }}>+{extra}</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{ marginTop: 8, width: "100%", background: "none", border: `1px solid ${THEME.chipLine}`, color: THEME.brand, borderRadius: 8, padding: "6px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
        >
          Xem chi tiết
        </button>
      </div>
    </div>
  );
}

function ClosetAddProductForm({ category, askCategory, onAdd, T }) {
  const { THEME, inp, btn } = T;
  const [name, setName] = useState("");
  const [cat, setCat] = useState(category || "");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [remaining, setRemaining] = useState("");

  function handleAdd() {
    if (!name.trim() || (askCategory && !cat.trim())) return;
    const variants = label.trim() ? [{ id: uid(), label: label.trim(), price: Number(price) || 0, qty: Number(remaining) || 0, sold: 0, remaining: Number(remaining) || 0 }] : [];
    onAdd({ id: uid(), name: name.trim(), category: cat.trim(), image: "", variants });
  }

  return (
    <div style={{ marginTop: 10, padding: 10, border: `1px dashed ${THEME.chipLine}`, borderRadius: 10 }}>
      <input style={{ ...inp, marginBottom: 6 }} placeholder="Tên sản phẩm" value={name} onChange={(e) => setName(e.target.value)} />
      {askCategory && <input style={{ ...inp, marginBottom: 6 }} placeholder="Tên danh mục mới (VD: Giày Nike)" value={cat} onChange={(e) => setCat(e.target.value)} />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
        <input style={inp} placeholder="Mã/Size đầu tiên" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input style={inp} placeholder="Giá (k)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input style={inp} placeholder="Còn lại" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
      </div>
      <button style={btn} onClick={handleAdd}>＋ Thêm sản phẩm</button>
    </div>
  );
}

function ClosetDetailModal({ p, onClose, onDelete, saveClosetProduct, addClosetVariant, saveClosetVariant, delClosetVariant, bumpClosetVariant, discount, T }) {
  const { THEME, card, inp, btnSub, btn, iconBtn, chip } = T;
  const [pendingImg, setPendingImg] = useState(null);
  const [editVariantId, setEditVariantId] = useState(null);
  const [nf, setNf] = useState({ code: "", size: "", color: "", price: "", remaining: "" });
  const [editName, setEditName] = useState(false);
  const [imgLinkInput, setImgLinkInput] = useState("");
  const [importingImg, setImportingImg] = useState(false);
  const xaKho = isXaKho(p);
  const effectiveDiscount = xaKho ? null : discount;
  const quote = buildClosetQuote(p, effectiveDiscount);
  const searchQuery = `${p.name || ""} ${productCodeGuess(p)}`.trim();

  async function onPickImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 1280, 0.85);
      setPendingImg(dataUrl);
      const url = await uploadGomcanImage(p.id, dataUrl);
      saveClosetProduct(p.id, { image: url });
    } catch {
      alert("Không đọc được ảnh này (thường do ảnh chụp thẳng trên iPhone ở định dạng HEIC). Bạn thử lưu ảnh dạng JPG/PNG rồi chọn lại, hoặc chụp màn hình ảnh đó rồi dùng ảnh chụp màn hình nhé.");
    }
  }

  function openImageSearch() {
    const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function onImportImageLink() {
    const link = imgLinkInput.trim();
    if (!link) return;
    setImportingImg(true);
    try {
      const url = await importGomcanImageFromUrl(p.id, link);
      saveClosetProduct(p.id, { image: url });
      setImgLinkInput("");
    } catch {
      alert("Không lấy được ảnh từ link này. Bạn thử bấm chuột phải vào ảnh trên Google → \"Sao chép địa chỉ liên kết hình ảnh\" rồi dán lại nhé (link phải là link ảnh trực tiếp, không phải link trang web).");
    } finally {
      setImportingImg(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(60,20,25,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="hnCard" style={{ ...card, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", padding: 0 }}>
        <div style={{ position: "relative", width: "100%", paddingTop: "70%", background: THEME.chipBg }}>
          <div style={{ position: "absolute", inset: 0 }}>
            {pendingImg || p.image ? (
              <img src={pendingImg || p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 64 }}>👜</div>
            )}
            {xaKho && (
              <div className="hnBlink" style={{ position: "absolute", top: 10, left: 10, background: XA_KHO_COLOR, color: "#fff", fontSize: 12.5, fontWeight: 800, padding: "3px 11px", borderRadius: 8, letterSpacing: 0.3 }}>
                XẢ KHO
              </div>
            )}
            <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", fontSize: 16, cursor: "pointer" }}>
              ✕
            </button>
            <label style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(255,255,255,0.92)", color: THEME.brand, fontWeight: 700, fontSize: 12.5, borderRadius: 999, padding: "5px 12px", cursor: "pointer" }}>
              📷 {p.image ? "Đổi ảnh" : "Thêm ảnh"}
              <input type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
            </label>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            {editName ? (
              <input style={{ ...inp, flex: 1 }} defaultValue={p.name} onBlur={(e) => { saveClosetProduct(p.id, { name: e.target.value }); setEditName(false); }} autoFocus />
            ) : (
              <h3 style={{ margin: 0, fontSize: 16, lineHeight: 1.35, whiteSpace: "pre-line", flex: 1, minWidth: 0, overflowWrap: "break-word" }}>{p.name}</h3>
            )}
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button style={iconBtn} title="Sửa tên" onClick={() => setEditName(true)}>✏️</button>
              <button style={iconBtn} title="Xoá" onClick={onDelete}>🗑️</button>
            </div>
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: THEME.subtext }}>{p.category}</div>

          <label style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: xaKho ? XA_KHO_COLOR : THEME.text, cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={!!p.xaKho}
              onChange={(e) => saveClosetProduct(p.id, { xaKho: e.target.checked })}
              style={{ width: 17, height: 17, accentColor: XA_KHO_COLOR, cursor: "pointer" }}
            />
            🏷️ Xả kho (tự tích/bỏ tích, không cần đổi tên sản phẩm)
          </label>

          <div style={{ marginTop: 10, background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: THEME.subtext }}>Tìm ảnh theo tên + mã sản phẩm</span>
              <button style={{ ...btnSub, flexShrink: 0 }} onClick={openImageSearch}>🔍 Tìm ảnh</button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                style={{ ...inp, flex: 1 }}
                placeholder="Dán link ảnh vừa tìm được rồi bấm Nhập"
                value={imgLinkInput}
                onChange={(e) => setImgLinkInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onImportImageLink(); }}
              />
              <button style={btnSub} disabled={importingImg || !imgLinkInput.trim()} onClick={onImportImageLink}>
                {importingImg ? "Đang lấy…" : "Nhập ảnh"}
              </button>
            </div>
          </div>

          {quote && (
            <div style={{ marginTop: 10, background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: "8px 10px", fontSize: 14, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span style={{ flex: 1 }}>{quote}</span>
              <button style={{ ...iconBtn, width: 28, height: 28 }} title="Sao chép câu báo giá" onClick={() => navigator.clipboard && navigator.clipboard.writeText(quote)}>📋</button>
            </div>
          )}

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {(p.variants || []).map((v) => {
              const isEdit = editVariantId === v.id;
              if (isEdit) {
                const parts = splitLabelForEdit(v.label);
                return (
                  <div key={v.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0", borderBottom: `1px dashed ${THEME.line}` }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <input
                        style={{ ...inp, flex: 2, minWidth: 130 }}
                        defaultValue={parts.code}
                        placeholder="Mã"
                        onBlur={(e) => saveClosetVariant(p.id, v.id, { label: composeLabel(e.target.value, parts.size) })}
                      />
                      <input
                        style={{ ...inp, flex: 1, minWidth: 90 }}
                        defaultValue={parts.size}
                        placeholder="Size"
                        onBlur={(e) => saveClosetVariant(p.id, v.id, { label: composeLabel(parts.code, e.target.value) })}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <input style={{ ...inp, flex: 1, minWidth: 90 }} defaultValue={v.color || ""} placeholder="Màu (không bắt buộc)" onBlur={(e) => saveClosetVariant(p.id, v.id, { color: e.target.value })} />
                      <input style={{ ...inp, width: 80 }} defaultValue={v.price} placeholder="Giá (k)" onBlur={(e) => saveClosetVariant(p.id, v.id, { price: Number(e.target.value) || 0 })} />
                      <input style={{ ...inp, width: 80 }} defaultValue={v.remaining} placeholder="Còn lại" onBlur={(e) => saveClosetVariant(p.id, v.id, { remaining: Number(e.target.value) || 0 })} />
                    </div>
                    <button style={btnSub} onClick={() => setEditVariantId(null)}>Xong</button>
                  </div>
                );
              }
              return (
                <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: `1px dashed ${THEME.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {v.label || "(không có mã)"}
                      {v.color ? <span style={{ ...chip, marginLeft: 6, fontSize: 11, padding: "1px 7px" }}>{v.color}</span> : null}
                    </div>
                    <div style={{ fontSize: 13, color: THEME.subtext }}>
                      {(() => {
                        const orig = Number(v.price) || 0;
                        const disc = applyDiscount(orig, effectiveDiscount);
                        return disc !== orig ? (
                          <>
                            <span style={{ textDecoration: "line-through" }}>{fmtClosetPrice(orig)}</span>{" "}
                            <span style={{ color: "#1f7a3d", fontWeight: 700 }}>{fmtClosetPrice(disc)}</span>
                          </>
                        ) : (
                          fmtClosetPrice(orig)
                        );
                      })()}{" "}
                      ·{" "}
                      <span style={{ color: v.remaining > 0 ? "#1f7a3d" : THEME.brand, fontWeight: 700 }}>
                        {v.remaining > 0 ? `Còn ${v.remaining}` : "Hết hàng"}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {/* Tách riêng nhóm +/- số lượng và nhóm sửa/xoá, cách xa nhau để tránh bấm
                        nhầm (VD định bấm sửa mã nhưng lỡ chạm phải +1 làm sai số lượng). */}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ ...iconBtn, width: 28, height: 28, fontSize: 16 }} title="Bán 1 đôi (-1 còn lại)" onClick={() => bumpClosetVariant(p.id, v.id, -1)}>－</button>
                      <button style={{ ...iconBtn, width: 28, height: 28, fontSize: 16 }} title="Nhập thêm (+1 còn lại)" onClick={() => bumpClosetVariant(p.id, v.id, 1)}>＋</button>
                    </div>
                    <div style={{ width: 1, alignSelf: "stretch", background: THEME.chipLine }} />
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ ...iconBtn, width: 28, height: 28, fontSize: 12 }} title="Sửa mã/size này" onClick={() => setEditVariantId(v.id)}>✏️</button>
                      <button style={{ ...iconBtn, width: 28, height: 28, fontSize: 12 }} title="Xoá" onClick={() => delClosetVariant(p.id, v.id)}>✕</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!p.variants || p.variants.length === 0) && <div style={{ color: THEME.subtext, fontSize: 14 }}>Chưa có mã/size nào</div>}
          </div>

          <div style={{ marginTop: 12, padding: 10, border: `1px dashed ${THEME.chipLine}`, borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.subtext, marginBottom: 6 }}>＋ Thêm mã/size mới</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <input style={{ ...inp, flex: 2, minWidth: 130 }} placeholder="Mã" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} />
              <input style={{ ...inp, flex: 1, minWidth: 90 }} placeholder="Size" value={nf.size} onChange={(e) => setNf({ ...nf, size: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <input style={{ ...inp, flex: 1, minWidth: 90 }} placeholder="Màu (không bắt buộc)" value={nf.color} onChange={(e) => setNf({ ...nf, color: e.target.value })} />
              <input style={{ ...inp, width: 80 }} placeholder="Giá (k)" value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} />
              <input style={{ ...inp, width: 80 }} placeholder="Còn" value={nf.remaining} onChange={(e) => setNf({ ...nf, remaining: e.target.value })} />
            </div>
            <button
              style={{ ...btnSub, width: "100%" }}
              onClick={() => {
                const label = composeLabel(nf.code, nf.size);
                if (!label.trim()) return;
                addClosetVariant(p.id, {
                  label: label.trim(),
                  color: nf.color.trim(),
                  price: Number(nf.price) || 0,
                  qty: Number(nf.remaining) || 0,
                  sold: 0,
                  remaining: Number(nf.remaining) || 0,
                });
                setNf({ code: "", size: "", color: "", price: "", remaining: "" });
              }}
            >
              ＋ Thêm mã/size
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
