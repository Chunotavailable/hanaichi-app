// pages/closet.js
// Trang riêng "Hàng Closet sẵn" — tra cứu nhanh hàng có sẵn (giày Wilson/
// Onitsuka/Nike/Asics, quần áo, túi/balo/phụ kiện...) theo mã, size, tên...
// Dùng chung nguồn dữ liệu với "Giá gồm cân" (api/gomcan, field "closet").
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { uid, norm, resizeImageFile, uploadGomcanImage, deleteGomcanImage, ViewModeToggle, gridColumnsFor } from "../lib/gomcanHelpers";

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
// Dòng giá hiện ra ngoài thẻ sản phẩm: nếu các mã/size có cùng 1 giá thì
// hiện 1 số, khác giá thì hiện khoảng giá "thấp nhất - cao nhất".
function priceRangeLine(variants) {
  const prices = (variants || []).map((v) => Number(v.price) || 0).filter((n) => n > 0);
  if (!prices.length) return "------";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? fmtClosetPrice(min) : `${fmtClosetPrice(min)} - ${fmtClosetPrice(max)}`;
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
          T={T}
        />
      </div>
    </main>
  );
}

function ClosetSection({ data, addClosetProduct, saveClosetProduct, delClosetProduct, addClosetVariant, saveClosetVariant, delClosetVariant, bumpClosetVariant, T }) {
  const { THEME, card, btn, btnSub, inp } = T;
  const list = data.closet || [];
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [addingCategory, setAddingCategory] = useState(null); // category đang thêm sản phẩm mới
  const [viewMode, setViewMode] = useState("small");
  const [activeCat, setActiveCat] = useState(null); // null = xem tất cả danh mục

  const tokens = norm(q).split(" ").filter(Boolean);
  const filtered = !tokens.length
    ? list
    : list.filter((p) => {
        const h = norm(p.name + " " + p.category + " " + (p.variants || []).map((v) => v.label).join(" "));
        return tokens.every((t) => h.includes(t));
      });

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
        <ViewModeToggle mode={viewMode} setMode={setViewMode} T={T} />
      </div>
      <input
        style={{ ...inp, marginTop: 12, marginBottom: 10 }}
        placeholder="🔍 Tìm theo tên, mã, size, màu... (VD: 38, onitsuka, wilson)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

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
                <ClosetProductCard key={p.id} p={p} listMode={viewMode === "list"} onOpen={() => setViewId(p.id)} T={T} />
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
function ClosetProductCard({ p, listMode, onOpen, T }) {
  const { THEME, card, chip } = T;
  const variants = p.variants || [];
  const shown = variants.slice(0, 6);
  const extra = variants.length - shown.length;
  const priceLine = priceRangeLine(variants);
  // Mã dùng chung hiện 1 lần duy nhất; mỗi biến thể chỉ còn hiện phần size.
  const code = commonCodePrefix(variants);
  const sizeChip = (v) => (code ? sizePartFor(v.label, code) : v.label);

  if (listMode) {
    return (
      <div className="hnCard" onClick={onOpen} style={{ ...card, minWidth: 0, maxWidth: "100%", cursor: "pointer", display: "flex", gap: 10, padding: 10, alignItems: "center" }}>
        <div style={{ position: "relative", width: 56, height: 56, minWidth: 56, borderRadius: 10, overflow: "hidden", background: THEME.chipBg }}>
          {p.image ? (
            <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 22 }}>👜</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, minWidth: 0 }}>
            <span style={{ fontWeight: 800, color: THEME.brand, fontSize: 14, flexShrink: 0 }}>{priceLine}</span>
            {code && <span style={{ fontSize: 11, color: THEME.subtext, flexShrink: 0 }}>Mã {code}</span>}
            <div style={{ display: "flex", gap: 4, overflow: "hidden", minWidth: 0 }}>
              {shown.slice(0, 3).map((v) => (
                <span key={v.id} style={{ ...chip, fontSize: 10.5, padding: "1px 6px", flexShrink: 0 }}>{sizeChip(v)}</span>
              ))}
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
        </div>
      </div>
      <div style={{ padding: "8px 10px 10px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>
          {p.name}
        </div>
        <div style={{ marginTop: 4, fontWeight: 800, color: THEME.brand, fontSize: 15 }}>{priceLine}</div>
        {code && (
          <div style={{ fontSize: 11, color: THEME.subtext, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Mã {code}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
          {shown.map((v) => (
            <span
              key={v.id}
              title={`Mã: ${v.label}`}
              style={{
                ...chip, fontSize: 10.5, padding: "1px 6px",
                background: v.remaining > 0 ? "#eafaf0" : THEME.chipBg,
                borderColor: v.remaining > 0 ? "#c9ecd6" : THEME.chipLine,
                color: v.remaining > 0 ? "#1f7a3d" : THEME.subtext,
                textDecoration: v.remaining > 0 ? "none" : "line-through",
              }}
            >
              {sizeChip(v)}
            </span>
          ))}
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

function ClosetDetailModal({ p, onClose, onDelete, saveClosetProduct, addClosetVariant, saveClosetVariant, delClosetVariant, bumpClosetVariant, T }) {
  const { THEME, card, inp, btnSub, btn, iconBtn, chip } = T;
  const [pendingImg, setPendingImg] = useState(null);
  const [editVariantId, setEditVariantId] = useState(null);
  const [nf, setNf] = useState({ code: "", size: "", color: "", price: "", remaining: "" });
  const [editName, setEditName] = useState(false);

  async function onPickImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 1280, 0.85);
      setPendingImg(dataUrl);
      const url = await uploadGomcanImage(p.id, dataUrl);
      saveClosetProduct(p.id, { image: url });
    } catch {
      alert("Không đọc được ảnh này, thử ảnh khác giúp em ạ");
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
                      {fmtClosetPrice(v.price)} ·{" "}
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
