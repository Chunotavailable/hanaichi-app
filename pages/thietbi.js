// pages/thietbi.js
// Trang "Thiết bị bếp & vệ sinh": tra cứu nhanh thông tin sản phẩm (chậu rửa,
// vòi nước, bộ sen...) để tư vấn khách kỹ hơn — kèm sẵn các mẫu câu trả lời
// cho câu hỏi khách hay hỏi (lắp đặt, bảo hành...). Cùng cơ chế lưu trữ và
// hoàn tác xoá 10s như trang "Hàng Closet sẵn" (pages/closet.js).
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { uid, norm, loadJson, saveJson } from "../lib/gomcanHelpers";

function copyText(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text || "").catch(() => {});
}

// Ô "Giá bán về tay" đôi khi là 1 kịch bản báo giá soạn sẵn nhiều dòng (chứ
// không chỉ là con số) — nhận diện để hiển thị/sao chép cho đúng.
function isQuoteScript(price) {
  return !!price && (price.includes("\n") || /báo giá/i.test(price));
}
function priceBadgeText(price) {
  if (!price) return "Liên hệ";
  return isQuoteScript(price) ? "📜 Có kịch bản báo giá" : price;
}
// Câu tư vấn nhanh để sao chép gửi khách: ưu tiên dùng kịch bản báo giá đã
// soạn sẵn (bỏ dòng hướng dẫn đầu), không có thì tự ghép từ tên/giá/ưu điểm.
function buildThietbiQuote(p) {
  const priceText = (p.price || "").trim();
  if (isQuoteScript(priceText)) {
    const cleaned = priceText
      .split("\n")
      .filter((l) => !/^báo giá bằng câu/i.test(l.trim()))
      .join("\n")
      .trim();
    if (cleaned) return cleaned;
  }
  const name = (p.name || "").replace(/\n/g, " ").trim();
  const lines = [`Dạ ${name}${p.brand ? " " + p.brand : ""} ạ`];
  if (p.size) lines.push(`Kích thước ${p.size.replace(/\n/g, " ")} ạ`);
  if (priceText) lines.push(`Giá về tới VN ${priceText} ạ`);
  lines.push("Hàng nội địa Nhật chuẩn xịn em mang từ Nhật chuyển về ạ");
  const bullets = (p.highlights || "")
    .split("\n")
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (bullets.length) lines.push(...bullets);
  return lines.join("\n");
}
// Hiện 1 khối text nhiều dòng thành các dòng bullet gọn gàng.
function Bullets({ text, T }) {
  const { THEME } = T;
  const lines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 13, lineHeight: 1.5, color: THEME.text, display: "flex", gap: 6 }}>
          <span style={{ color: THEME.brand, flexShrink: 0 }}>{/^[-•]/.test(l) ? "" : "•"}</span>
          <span>{l.replace(/^[-•]\s*/, "")}</span>
        </div>
      ))}
    </div>
  );
}

export default function ThietBiPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef(null);
  const undoRef = useRef(null);
  const [undoInfo, setUndoInfo] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  function loadData() {
    setLoading(true);
    setLoadFailed(false);
    loadJson("/api/thietbi")
      .then((d) => setData(d))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    return () => {
      if (undoRef.current) {
        clearTimeout(undoRef.current.timer);
        undoRef.current.onCommit();
        undoRef.current = null;
      }
    };
  }, []);

  function saveToServer(next) {
    saveJson("/api/thietbi", next);
  }
  function persist(next) {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToServer(next), 250);
  }
  // Xoá kèm hoàn tác 10s — cùng cơ chế đã dùng ở hàng Closet sẵn (xem
  // pages/closet.js để rõ vì sao cần hoãn lưu thật sự thay vì lưu ngay).
  function scheduleUndoableDelete({ message, prevData, nextData, onCommit }) {
    if (undoRef.current) {
      clearTimeout(undoRef.current.timer);
      undoRef.current.onCommit();
      undoRef.current = null;
    }
    setData(nextData);
    const timer = setTimeout(() => {
      onCommit();
      undoRef.current = null;
      setUndoInfo(null);
    }, 10000);
    undoRef.current = { prevData, timer, onCommit };
    setUndoInfo({ message });
  }
  function undoDelete() {
    if (!undoRef.current) return;
    clearTimeout(undoRef.current.timer);
    const { prevData } = undoRef.current;
    undoRef.current = null;
    setUndoInfo(null);
    persist(prevData);
  }

  if (loadFailed && !loading) return <LoadError onRetry={loadData} />;
  if (loading || !data) return <Loading />;

  function addProduct(product) {
    const next = { ...data, thietbi: [...(data.thietbi || []), { id: uid(), ...product }] };
    persist(next);
  }
  function saveProduct(id, patch) {
    const next = { ...data, thietbi: data.thietbi.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    persist(next);
  }
  function delProduct(id) {
    const prevData = data;
    const product = data.thietbi.find((p) => p.id === id);
    const deletedIds = Array.from(new Set([...(data.thietbiDeletedIds || []), id]));
    const next = { ...data, thietbi: data.thietbi.filter((p) => p.id !== id), thietbiDeletedIds: deletedIds };
    scheduleUndoableDelete({
      message: `Đã xoá "${product ? product.name.split("\n")[0] : "sản phẩm"}"`,
      prevData,
      nextData: next,
      onCommit: () => saveToServer(next),
    });
  }
  function addFaq(item) {
    const next = { ...data, thietbiFaq: [...(data.thietbiFaq || []), { id: uid(), ...item }] };
    persist(next);
  }
  function saveFaq(id, patch) {
    const next = { ...data, thietbiFaq: data.thietbiFaq.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
    persist(next);
  }
  function delFaq(id) {
    const prevData = data;
    const faq = data.thietbiFaq.find((f) => f.id === id);
    const deletedFaqIds = Array.from(new Set([...(data.thietbiFaqDeletedIds || []), id]));
    const next = { ...data, thietbiFaq: data.thietbiFaq.filter((f) => f.id !== id), thietbiFaqDeletedIds: deletedFaqIds };
    scheduleUndoableDelete({
      message: `Đã xoá mẫu câu "${faq ? faq.title : ""}"`,
      prevData,
      nextData: next,
      onCommit: () => saveToServer(next),
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader icon="🛁" title="Thiết bị bếp & vệ sinh" current="/thietbi" maxWidth={900} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        <FaqSection list={data.thietbiFaq || []} addFaq={addFaq} saveFaq={saveFaq} delFaq={delFaq} T={T} />
        <ProductSection list={data.thietbi || []} addProduct={addProduct} saveProduct={saveProduct} delProduct={delProduct} T={T} />
      </div>
      {undoInfo && <UndoToast message={undoInfo.message} onUndo={undoDelete} T={T} />}
    </main>
  );
}

function UndoToast({ message, onUndo, T }) {
  const { THEME } = T;
  const [secondsLeft, setSecondsLeft] = useState(10);
  useEffect(() => {
    setSecondsLeft(10);
    const iv = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [message]);
  return (
    <div
      className="hnPop"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        zIndex: 200,
        background: "#1f2937",
        color: "#fff",
        borderRadius: 12,
        padding: "10px 12px 10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message}</span>
      <button
        onClick={onUndo}
        style={{ flexShrink: 0, background: "#fff", color: "#1f2937", border: "none", borderRadius: 8, padding: "6px 12px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
      >
        Hoàn tác ({secondsLeft}s)
      </button>
    </div>
  );
}

/* ============================= Mẫu câu tư vấn (FAQ) ============================= */
function FaqSection({ list, addFaq, saveFaq, delFaq, T }) {
  const { THEME, card, btn, btnSub, iconBtn, inp } = T;
  const [open, setOpen] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const confirmDel = confirmDelId ? list.find((f) => f.id === confirmDelId) : null;

  return (
    <div style={{ ...card, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setOpen((o) => !o)}>
        <div style={{ fontWeight: 800, fontSize: 15.5 }}>💬 Mẫu câu tư vấn nhanh ({list.length})</div>
        <span style={{ fontSize: 13, color: THEME.subtext }}>{open ? "Thu gọn ▲" : "Mở rộng ▼"}</span>
      </div>
      {open && (
        <>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((f) => (
              <FaqCard key={f.id} f={f} saveFaq={saveFaq} onDelete={() => setConfirmDelId(f.id)} T={T} />
            ))}
          </div>
          {showAdd ? (
            <FaqAddForm
              T={T}
              onAdd={(item) => {
                addFaq(item);
                setShowAdd(false);
              }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button style={{ ...btnSub, marginTop: 10 }} onClick={() => setShowAdd(true)}>
              ＋ Thêm mẫu câu
            </button>
          )}
        </>
      )}
      <ConfirmDialog
        open={!!confirmDel}
        message={`Xoá mẫu câu "${confirmDel ? confirmDel.title : ""}"? (có 10s để hoàn tác sau khi xoá)`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delFaq(confirmDelId);
          setConfirmDelId(null);
        }}
      />
    </div>
  );
}

function FaqCard({ f, saveFaq, onDelete, T }) {
  const { THEME, inp, iconBtn } = T;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(f.title);
  const [content, setContent] = useState(f.content);

  if (editing) {
    return (
      <div style={{ background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: 10 }}>
        <input style={{ ...inp, marginBottom: 6, fontWeight: 700 }} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...inp, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} value={content} onChange={(e) => setContent(e.target.value)} />
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            style={{ ...T.btn, padding: "6px 14px", fontSize: 13 }}
            onClick={() => {
              saveFaq(f.id, { title: title.trim() || f.title, content });
              setEditing(false);
            }}
          >
            Lưu
          </button>
          <button style={{ ...T.btnSub, padding: "6px 14px", fontSize: 13 }} onClick={() => setEditing(false)}>
            Huỷ
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: "9px 10px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: THEME.brand }}>{f.title}</div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button title="Sao chép" style={{ ...iconBtn, width: 28, height: 28, fontSize: 13 }} onClick={() => copyText(f.content)}>📋</button>
          <button title="Sửa" style={{ ...iconBtn, width: 28, height: 28, fontSize: 13 }} onClick={() => setEditing(true)}>✏️</button>
          <button title="Xoá" style={{ ...iconBtn, width: 28, height: 28, fontSize: 13 }} onClick={onDelete}>🗑️</button>
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 4, whiteSpace: "pre-wrap" }}>{f.content}</div>
    </div>
  );
}

function FaqAddForm({ onAdd, onCancel, T }) {
  const { THEME, inp, btn, btnSub } = T;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <div style={{ marginTop: 10, padding: 10, border: `1px dashed ${THEME.chipLine}`, borderRadius: 10 }}>
      <input style={{ ...inp, marginBottom: 6 }} placeholder="Câu hỏi khách hay hỏi (VD: Có bảo hành không?)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea style={{ ...inp, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} placeholder="Câu trả lời mẫu..." value={content} onChange={(e) => setContent(e.target.value)} />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button
          style={btn}
          disabled={!title.trim() || !content.trim()}
          onClick={() => onAdd({ title: title.trim(), content: content.trim() })}
        >
          ＋ Thêm mẫu câu
        </button>
        <button style={btnSub} onClick={onCancel}>Huỷ</button>
      </div>
    </div>
  );
}

/* ============================= Danh sách sản phẩm ============================= */
function ProductSection({ list, addProduct, saveProduct, delProduct, T }) {
  const { THEME, card, btn, btnSub, inp, chip } = T;
  const [q, setQ] = useState("");
  const [area, setArea] = useState("Tất cả");
  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState(null);

  const areas = ["Tất cả", ...Array.from(new Set(list.map((p) => p.area).filter(Boolean)))];
  const nq = norm(q);
  const filtered = list.filter((p) => {
    if (area !== "Tất cả" && p.area !== area) return false;
    if (!nq) return true;
    const hay = norm([p.name, p.code, p.brand, p.area].join(" "));
    return hay.includes(nq);
  });
  const viewingProduct = viewId ? list.find((p) => p.id === viewId) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>🚿 Sản phẩm ({list.length})</div>
        <button style={btnSub} onClick={() => setShowAdd((s) => !s)}>
          {showAdd ? "Đóng" : "＋ Thêm sản phẩm"}
        </button>
      </div>

      {showAdd && (
        <ProductAddForm
          areas={areas.filter((a) => a !== "Tất cả")}
          T={T}
          onAdd={(product) => {
            addProduct(product);
            setShowAdd(false);
          }}
        />
      )}

      <input
        style={{ ...inp, marginTop: 10 }}
        placeholder="🔍 Tìm theo tên, mã, thương hiệu..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {areas.map((a) => (
          <button
            key={a}
            onClick={() => setArea(a)}
            style={{ ...chip, cursor: "pointer", background: area === a ? THEME.brand : THEME.chipBg, color: area === a ? "#fff" : THEME.brand, border: `1px solid ${area === a ? THEME.brand : THEME.chipLine}` }}
          >
            {a}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {filtered.map((p) => (
          <ProductCard key={p.id} p={p} onOpen={() => setViewId(p.id)} T={T} />
        ))}
        {!filtered.length && <div style={{ color: THEME.subtext, fontSize: 14, padding: 16 }}>Không tìm thấy sản phẩm nào.</div>}
      </div>

      {viewingProduct && (
        <ProductDetailModal
          p={viewingProduct}
          onClose={() => setViewId(null)}
          saveProduct={saveProduct}
          onDelete={() => {
            delProduct(viewingProduct.id);
            setViewId(null);
          }}
          T={T}
        />
      )}
    </div>
  );
}

function ProductCard({ p, onOpen, T }) {
  const { THEME, card, chip } = T;
  return (
    <div className="hnCard" onClick={onOpen} style={{ ...card, padding: 12, cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 20 }}>🚿</span>
        {p.area && <span style={{ ...chip, fontSize: 10.5, padding: "1px 7px" }}>{p.area}</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.35, whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 36 }}>
        {p.name}
      </div>
      <div style={{ fontSize: 11.5, color: THEME.subtext }}>
        {p.brand}
        {p.code ? ` · Mã ${p.code}` : ""}
      </div>
      <div style={{ fontWeight: 800, color: THEME.brand, fontSize: 14 }}>{priceBadgeText(p.price)}</div>
    </div>
  );
}

function ProductAddForm({ areas, onAdd, T }) {
  const { THEME, inp, btn } = T;
  const [name, setName] = useState("");
  const [area, setArea] = useState(areas[0] || "");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      area: area.trim(),
      code: "",
      brand: "",
      size: "",
      material: "",
      price: price.trim(),
      link: link.trim(),
      highlights: "",
      installNotes: "",
    });
  }

  return (
    <div style={{ marginTop: 10, padding: 10, border: `1px dashed ${THEME.chipLine}`, borderRadius: 10 }}>
      <input style={{ ...inp, marginBottom: 6 }} placeholder="Tên sản phẩm" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
        <input style={inp} placeholder="Khu vực (VD: Bếp, Phòng tắm)" value={area} onChange={(e) => setArea(e.target.value)} list="tb-areas" />
        <datalist id="tb-areas">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <input style={inp} placeholder="Giá bán về tay" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <input style={{ ...inp, marginBottom: 6 }} placeholder="Link mua (không bắt buộc)" value={link} onChange={(e) => setLink(e.target.value)} />
      <div style={{ fontSize: 12, color: THEME.subtext, marginBottom: 6 }}>Các thông tin khác (mã, thương hiệu, kích thước, ưu điểm, lưu ý lắp đặt...) sửa thêm sau khi mở chi tiết sản phẩm.</div>
      <button style={btn} disabled={!name.trim()} onClick={handleAdd}>＋ Thêm sản phẩm</button>
    </div>
  );
}

function FieldRow({ label, value, onSave, T, multiline }) {
  const { THEME, inp } = T;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  if (editing) {
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: THEME.subtext, marginBottom: 3 }}>{label}</div>
        {multiline ? (
          <textarea autoFocus style={{ ...inp, minHeight: 80, resize: "vertical", fontFamily: "inherit" }} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { onSave(val); setEditing(false); }} />
        ) : (
          <input autoFocus style={inp} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { onSave(val); setEditing(false); }} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
        )}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => setEditing(true)}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: THEME.subtext, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", color: value ? THEME.text : THEME.subtext }}>{value || "(bấm để thêm)"}</div>
    </div>
  );
}

function BulletField({ label, value, onSave, T }) {
  const { THEME, inp } = T;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: THEME.subtext, marginBottom: 4 }}>{label}</div>
      {editing ? (
        <textarea
          autoFocus
          style={{ ...inp, minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            onSave(val);
            setEditing(false);
          }}
        />
      ) : value ? (
        <div onClick={() => setEditing(true)} style={{ cursor: "pointer" }}>
          <Bullets text={value} T={T} />
        </div>
      ) : (
        <div onClick={() => setEditing(true)} style={{ cursor: "pointer", fontSize: 13, color: THEME.subtext }}>
          (bấm để thêm)
        </div>
      )}
    </div>
  );
}

function ProductDetailModal({ p, onClose, saveProduct, onDelete, T }) {
  const { THEME, card, btn, btnSub, iconBtn } = T;
  const quote = buildThietbiQuote(p);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(60,20,25,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="hnCard" style={{ ...card, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <FieldRow label="Tên sản phẩm" value={p.name} onSave={(v) => saveProduct(p.id, { name: v })} T={T} multiline />
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button title="Xoá" style={iconBtn} onClick={onDelete}>🗑️</button>
            <button title="Đóng" style={iconBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FieldRow label="Khu vực" value={p.area} onSave={(v) => saveProduct(p.id, { area: v })} T={T} />
          <FieldRow label="Thương hiệu" value={p.brand} onSave={(v) => saveProduct(p.id, { brand: v })} T={T} />
          <FieldRow label="Mã sản phẩm" value={p.code} onSave={(v) => saveProduct(p.id, { code: v })} T={T} />
          <FieldRow label="Kích thước" value={p.size} onSave={(v) => saveProduct(p.id, { size: v })} T={T} />
        </div>
        <FieldRow label="Chất liệu/cân nặng" value={p.material} onSave={(v) => saveProduct(p.id, { material: v })} T={T} />
        <FieldRow label="Giá bán về tay" value={p.price} onSave={(v) => saveProduct(p.id, { price: v })} T={T} multiline />
        <FieldRow label="Link mua" value={p.link} onSave={(v) => saveProduct(p.id, { link: v })} T={T} />
        {p.link && (
          <a href={p.link} target="_blank" rel="noreferrer" style={{ ...btnSub, display: "inline-block", textDecoration: "none", marginBottom: 8 }}>
            🔗 Xem trang gốc
          </a>
        )}

        <BulletField label="Ưu điểm nổi bật" value={p.highlights} onSave={(v) => saveProduct(p.id, { highlights: v })} T={T} />
        <BulletField label="Lưu ý khi lắp đặt" value={p.installNotes} onSave={(v) => saveProduct(p.id, { installNotes: v })} T={T} />

        <div style={{ background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <span style={{ flex: 1, fontSize: 13, whiteSpace: "pre-wrap" }}>{quote}</span>
          <button style={{ ...iconBtn, width: 28, height: 28 }} title="Sao chép câu tư vấn" onClick={() => copyText(quote)}>📋</button>
        </div>
      </div>
    </div>
  );
}
