// pages/thietbi.js
// Trang "Thiết bị bếp & vệ sinh": tra cứu nhanh thông tin sản phẩm (chậu rửa,
// vòi nước, bộ sen...) để tư vấn khách kỹ hơn — kèm sẵn các mẫu câu trả lời
// cho câu hỏi khách hay hỏi (lắp đặt, bảo hành...). Cùng cơ chế lưu trữ và
// hoàn tác xoá 10s như trang "Hàng Closet sẵn" (pages/closet.js).
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { useImageCodeSearch } from "../lib/imageCode";
import { uid, norm } from "../lib/gomcanHelpers";
import { createSyncer, loadDoc } from "../lib/syncer";
import { usePerm } from "../lib/perm";
import { useSheetSync, SheetSyncBar, SheetSyncModal } from "../lib/SheetSyncUI";
import { Highlight, searchTokens, HL_COLOR } from "../lib/Highlight";
import { FilterChip, SearchInput, EmptyState, GroupTitle, UndoToast } from "../lib/ui";
import {
  MessagesSquare,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  X,
  SearchX,
  CookingPot,
  ShowerHead,
  Droplets,
  Wrench,
  ScrollText,
  ExternalLink,
  MessageSquareQuote,
} from "lucide-react";

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
  return isQuoteScript(price) ? "Có kịch bản báo giá" : price;
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
  const undoRef = useRef(null); // { restore, timer }
  const [undoInfo, setUndoInfo] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const dataRef = useRef(null);
  dataRef.current = data;
  // Chỉ gửi phần thay đổi lên server khi lưu — xem lib/syncer.js.
  const syncerRef = useRef(null);
  if (!syncerRef.current) syncerRef.current = createSyncer("/api/thietbi", { onServerData: setData });

  function loadData() {
    setLoading(true);
    setLoadFailed(false);
    loadDoc("/api/thietbi")
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

  const [tbSync, runTbSync, actTbSync] = useSheetSync("thietbi", () => dataRef.current, async (patch) => { const next = { ...dataRef.current, ...patch }; dataRef.current = next; persist(next); try { await syncerRef.current.flushNow(); } catch {} });
  const [tbModal, setTbModal] = useState(null); // null | "pending" | "log"
  useEffect(() => {
    runTbSync(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const permTb = usePerm();

  function persist(next) {
    setData(next);
    syncerRef.current.schedule(next);
  }
  // Xoá kèm hoàn tác 10s — cùng cơ chế với hàng Closet sẵn: xoá thì lưu
  // ngay, hoàn tác thì chèn lại đúng món đó vào dữ liệu hiện tại.
  function scheduleUndoableDelete({ message, nextData, restore }) {
    if (undoRef.current) clearTimeout(undoRef.current.timer);
    persist(nextData);
    const timer = setTimeout(() => {
      undoRef.current = null;
      setUndoInfo(null);
    }, 10000);
    undoRef.current = { restore, timer };
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
    const index = data.thietbi.findIndex((p) => p.id === id);
    const product = data.thietbi[index];
    if (!product) return;
    const deletedIds = Array.from(new Set([...(data.thietbiDeletedIds || []), id]));
    const next = { ...data, thietbi: data.thietbi.filter((p) => p.id !== id), thietbiDeletedIds: deletedIds };
    scheduleUndoableDelete({
      message: `Đã xoá "${product.name.split("\n")[0]}"`,
      nextData: next,
      restore: (cur) => ({
        ...cur,
        thietbi: reinsert(cur.thietbi, product, index),
        thietbiDeletedIds: (cur.thietbiDeletedIds || []).filter((x) => x !== id),
      }),
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
    const index = data.thietbiFaq.findIndex((f) => f.id === id);
    const faq = data.thietbiFaq[index];
    if (!faq) return;
    const deletedFaqIds = Array.from(new Set([...(data.thietbiFaqDeletedIds || []), id]));
    const next = { ...data, thietbiFaq: data.thietbiFaq.filter((f) => f.id !== id), thietbiFaqDeletedIds: deletedFaqIds };
    scheduleUndoableDelete({
      message: `Đã xoá mẫu câu "${faq.title}"`,
      nextData: next,
      restore: (cur) => ({
        ...cur,
        thietbiFaq: reinsert(cur.thietbiFaq, faq, index),
        thietbiFaqDeletedIds: (cur.thietbiFaqDeletedIds || []).filter((x) => x !== id),
      }),
    });
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Thiết bị bếp & vệ sinh" current="/thietbi" maxWidth={900} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        <SheetSyncBar note="tự cập nhật mỗi ngày 1 lần" st={tbSync} run={runTbSync} canEdit={permTb.canEdit} onOpen={setTbModal} T={T} summaryText={(m) => `đã thêm ${m.added} sản phẩm`} />
        <FaqSection list={data.thietbiFaq || []} addFaq={addFaq} saveFaq={saveFaq} delFaq={delFaq} T={T} />
        <ProductSection list={data.thietbi || []} addProduct={addProduct} saveProduct={saveProduct} delProduct={delProduct} T={T} />
      </div>
      {undoInfo && <UndoToast message={undoInfo.message} onUndo={undoDelete} />}
      {tbModal && (
        <SheetSyncModal
          onClose={() => setTbModal(null)}
          changesUrl="/api/sheet-state?tab=thietbi&log=1"
          st={tbSync}
          onAct={actTbSync}
          canEdit={permTb.canEdit}
          initialTab={tbModal}
          refOf={(x) => ({ k: x.k, key: x.key })}
          pendingView={(x, TH) => ({ kind: "Sản phẩm mới", color: TH.success, text: `· ${[x.area, x.code && "Mã " + x.code, x.price].filter(Boolean).join(" · ")}` })}
          logView={(it, TH) => ({ text: `Sản phẩm mới${it.to ? " · Mã " + it.to : ""}`, color: TH.success })}
          T={T}
        />
      )}
    </main>
  );
}

// Nút "Chép" đổi thành "Đã chép" 1.5 giây sau khi bấm, để biết là đã copy.
function CopyButton({ text, T, compact }) {
  const { THEME, btnSub } = T;
  const [copied, setCopied] = useState(false);
  return (
    <button
      title="Sao chép"
      style={{ ...btnSub, padding: compact ? "5px 9px" : "6px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text, flexShrink: 0 }}
      onClick={() => {
        copyText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép"}
    </button>
  );
}

/* ============================= Mẫu câu tư vấn (FAQ) ============================= */
function FaqSection({ list, addFaq, saveFaq, delFaq, T }) {
  const { THEME, card, btnSub } = T;
  const perm = usePerm();
  const [open, setOpen] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const confirmDel = confirmDelId ? list.find((f) => f.id === confirmDelId) : null;

  return (
    <section style={{ ...card, padding: 0, marginBottom: 20, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", color: THEME.text }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: THEME.chipBg, color: THEME.brand, display: "grid", placeItems: "center" }}>
            <MessagesSquare size={17} />
          </span>
          Mẫu câu tư vấn nhanh
          <span style={{ fontSize: 12, fontWeight: 600, color: THEME.subtext, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 999, padding: "1px 8px" }}>{list.length}</span>
        </span>
        <ChevronDown size={18} color={THEME.subtext} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((f) => (
              <FaqCard key={f.id} f={f} saveFaq={saveFaq} onDelete={() => setConfirmDelId(f.id)} T={T} />
            ))}
          </div>
          {perm.canEdit &&
            (showAdd ? (
              <FaqAddForm
                T={T}
                onAdd={(item) => {
                  addFaq(item);
                  setShowAdd(false);
                }}
                onCancel={() => setShowAdd(false)}
              />
            ) : (
              <button style={{ ...btnSub, marginTop: 12 }} onClick={() => setShowAdd(true)}>
                <Plus size={15} /> Thêm mẫu câu
              </button>
            ))}
        </div>
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
    </section>
  );
}

function FaqCard({ f, saveFaq, onDelete, T }) {
  const { THEME, inp, iconBtn, btn, btnSub } = T;
  const perm = usePerm();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(f.title);
  const [content, setContent] = useState(f.content);
  const smallIcon = { ...iconBtn, width: 30, height: 30 };

  if (editing && perm.canEdit) {
    return (
      <div style={{ background: THEME.surfaceAlt, border: `1px solid ${THEME.chipLine}`, borderRadius: 12, padding: 12 }}>
        <input style={{ ...inp, marginBottom: 8, fontWeight: 600 }} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea style={{ ...inp, minHeight: 100, resize: "vertical", lineHeight: 1.5 }} value={content} onChange={(e) => setContent(e.target.value)} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            style={{ ...btn, padding: "7px 14px" }}
            onClick={() => {
              saveFaq(f.id, { title: title.trim() || f.title, content });
              setEditing(false);
            }}
          >
            <Check size={15} /> Lưu
          </button>
          <button style={{ ...btnSub, padding: "7px 14px" }} onClick={() => setEditing(false)}>
            Huỷ
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 12, padding: "11px 12px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: THEME.brand, paddingTop: 5 }}>{f.title}</div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <CopyButton text={f.content} T={T} compact />
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
      <div style={{ fontSize: 14, lineHeight: 1.6, marginTop: 6, whiteSpace: "pre-wrap", color: THEME.text }}>{f.content}</div>
    </div>
  );
}

function FaqAddForm({ onAdd, onCancel, T }) {
  const { THEME, inp, btn, btnSub } = T;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  return (
    <div style={{ marginTop: 12, padding: 12, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 12 }}>
      <input style={{ ...inp, marginBottom: 8 }} placeholder="Câu hỏi khách hay hỏi (VD: Có bảo hành không?)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea style={{ ...inp, minHeight: 100, resize: "vertical", lineHeight: 1.5 }} placeholder="Câu trả lời mẫu..." value={content} onChange={(e) => setContent(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button style={btn} disabled={!title.trim() || !content.trim()} onClick={() => onAdd({ title: title.trim(), content: content.trim() })}>
          <Plus size={16} /> Thêm mẫu câu
        </button>
        <button style={btnSub} onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </div>
  );
}

/* ============================= Danh sách sản phẩm ============================= */
function ProductSection({ list, addProduct, saveProduct, delProduct, T }) {
  const { THEME, card, btn, btnSub } = T;
  const perm = usePerm();
  const [q, setQ] = useState("");
  useImageCodeSearch(setQ); // dán ảnh khách gửi (Ctrl+V) -> tự đọc mã và tìm
  const [area, setArea] = useState("Tất cả");
  const [showAdd, setShowAdd] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);

  const areas = ["Tất cả", ...Array.from(new Set(list.map((p) => p.area).filter(Boolean)))];
  const nq = norm(q);
  const filtered = list.filter((p) => {
    if (area !== "Tất cả" && p.area !== area) return false;
    if (!nq) return true;
    const hay = norm([p.name, p.code, p.brand, p.area].join(" "));
    return hay.includes(nq);
  });
  const viewingProduct = viewId ? list.find((p) => p.id === viewId) : null;
  const confirmDelProduct = confirmDelId ? list.find((p) => p.id === confirmDelId) : null;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <GroupTitle T={T} count={list.length}>
          Sản phẩm
        </GroupTitle>
        {perm.canEdit && (
          <button style={showAdd ? btnSub : btn} onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? (
              "Đóng"
            ) : (
              <>
                <Plus size={16} /> Thêm sản phẩm
              </>
            )}
          </button>
        )}
      </div>

      {showAdd && perm.canEdit && (
        <ProductAddForm
          areas={areas.filter((a) => a !== "Tất cả")}
          T={T}
          onAdd={(product) => {
            addProduct(product);
            setShowAdd(false);
          }}
        />
      )}

      <div style={{ ...card, padding: 14, marginBottom: 14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên, mã, thương hiệu..." T={T} />
        <div className="hnHScroll" style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" }}>
          {areas.map((a) => (
            <FilterChip key={a} T={T} active={area === a} onClick={() => setArea(a)}>
              {a}
            </FilterChip>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {filtered.map((p) => (
          <ProductCard tokens={searchTokens(q)} key={p.id} p={p} onOpen={() => setViewId(p.id)} T={T} />
        ))}
      </div>
      {!filtered.length && <EmptyState icon={SearchX} title="Không tìm thấy sản phẩm nào" hint="Thử bỏ bộ lọc khu vực hoặc tìm bằng từ khác." T={T} />}

      {viewingProduct && (
        <ProductDetailModal p={viewingProduct} onClose={() => setViewId(null)} saveProduct={saveProduct} onDelete={() => setConfirmDelId(viewingProduct.id)} T={T} />
      )}
      <ConfirmDialog
        open={!!confirmDelProduct}
        message={`Xoá sản phẩm "${confirmDelProduct ? confirmDelProduct.name.split("\n")[0] : ""}"? (có 10s để hoàn tác sau khi xoá)`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delProduct(confirmDelId);
          setConfirmDelId(null);
          setViewId(null);
        }}
      />
    </section>
  );
}

// Biểu tượng theo khu vực cho thẻ sản phẩm.
function areaIcon(area) {
  const a = norm(area || "");
  if (a.includes("bep")) return CookingPot;
  if (a.includes("tam")) return ShowerHead;
  if (a.includes("rua mat") || a.includes("lavabo")) return Droplets;
  return Wrench;
}

function ProductCard({ p, onOpen, T, tokens = [] }) {
  const { THEME, card, chip } = T;
  const Icon = areaIcon(p.area);
  const hasScript = isQuoteScript(p.price);
  return (
    <div
      className="hnCard hnClickable"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      style={{ ...card, padding: 14, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: THEME.chipBg, color: THEME.brand, display: "grid", placeItems: "center" }}>
          <Icon size={18} />
        </span>
        {p.area && <span style={{ ...chip, fontSize: 11.5, background: THEME.surfaceAlt, borderColor: THEME.line, color: THEME.subtext }}>{p.area}</span>}
      </div>
      <div style={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.35, whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 39, color: THEME.text }}>
        <Highlight text={p.name || ""} tokens={tokens} color={HL_COLOR} />
      </div>
      <div style={{ fontSize: 12.5, color: THEME.subtext }}>
        <Highlight text={p.brand || ""} tokens={tokens} color={HL_COLOR} />
        {p.code ? <> · Mã <Highlight text={p.code} tokens={tokens} color={HL_COLOR} /></> : ""}
      </div>
      <div style={{ fontWeight: 700, color: hasScript ? THEME.subtext : THEME.brand, fontSize: hasScript ? 13.5 : 16, display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
        {hasScript && <ScrollText size={15} />}
        {hasScript ? "Có kịch bản báo giá" : priceBadgeText(p.price)}
      </div>
    </div>
  );
}

function ProductAddForm({ areas, onAdd, T }) {
  const { THEME, inp, btn, card } = T;
  const [name, setName] = useState("");
  const [area, setArea] = useState(areas[0] || "");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), area: area.trim(), code: "", brand: "", size: "", material: "", price: price.trim(), link: link.trim(), highlights: "", installNotes: "" });
  }

  return (
    <div style={{ ...card, padding: 16, marginBottom: 14 }}>
      <input style={{ ...inp, marginBottom: 8 }} placeholder="Tên sản phẩm" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input style={inp} placeholder="Khu vực (VD: Bếp, Phòng tắm)" value={area} onChange={(e) => setArea(e.target.value)} list="tb-areas" />
        <datalist id="tb-areas">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <input style={inp} placeholder="Giá bán về tay" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <input style={{ ...inp, marginBottom: 8 }} placeholder="Link mua (không bắt buộc)" value={link} onChange={(e) => setLink(e.target.value)} />
      <div style={{ fontSize: 12.5, color: THEME.subtext, marginBottom: 12 }}>Các thông tin khác (mã, thương hiệu, kích thước, ưu điểm, lưu ý lắp đặt...) sửa thêm sau khi mở chi tiết sản phẩm.</div>
      <button style={btn} disabled={!name.trim()} onClick={handleAdd}>
        <Plus size={16} /> Thêm sản phẩm
      </button>
    </div>
  );
}

const fieldLabelStyle = (THEME) => ({ fontSize: 12, fontWeight: 600, color: THEME.subtext, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 });

// 1 ô thông tin: bấm vào để sửa (nếu có quyền), Khách chỉ xem.
function FieldRow({ label, value, onSave, T, multiline }) {
  const { THEME, inp } = T;
  const perm = usePerm();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  if (editing && perm.canEdit) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={fieldLabelStyle(THEME)}>{label}</div>
        {multiline ? (
          <textarea autoFocus style={{ ...inp, minHeight: 80, resize: "vertical", lineHeight: 1.5 }} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { onSave(val); setEditing(false); }} />
        ) : (
          <input autoFocus style={inp} value={val} onChange={(e) => setVal(e.target.value)} onBlur={() => { onSave(val); setEditing(false); }} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
        )}
      </div>
    );
  }
  if (!value && !perm.canEdit) return null;
  return (
    <div
      className={perm.canEdit ? "hnEditable" : undefined}
      style={{ marginBottom: 12, cursor: perm.canEdit ? "text" : "default", borderRadius: 8 }}
      onClick={() => perm.canEdit && setEditing(true)}
      title={perm.canEdit ? "Bấm để sửa" : undefined}
    >
      <div style={fieldLabelStyle(THEME)}>
        {label}
        {perm.canEdit && <Pencil size={11} style={{ opacity: 0.6 }} />}
      </div>
      <div style={{ fontSize: 14.5, whiteSpace: "pre-wrap", color: value ? THEME.text : THEME.muted, lineHeight: 1.5 }}>{value || "Bấm để thêm"}</div>
    </div>
  );
}

function BulletField({ label, value, onSave, T }) {
  const { THEME, inp } = T;
  const perm = usePerm();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  if (!value && !perm.canEdit) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={fieldLabelStyle(THEME)}>
        {label}
        {perm.canEdit && <Pencil size={11} style={{ opacity: 0.6 }} />}
      </div>
      {editing && perm.canEdit ? (
        <textarea
          autoFocus
          style={{ ...inp, minHeight: 100, resize: "vertical", lineHeight: 1.5 }}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            onSave(val);
            setEditing(false);
          }}
        />
      ) : value ? (
        <div onClick={() => perm.canEdit && setEditing(true)} style={{ cursor: perm.canEdit ? "text" : "default" }}>
          <Bullets text={value} T={T} />
        </div>
      ) : (
        <div onClick={() => setEditing(true)} style={{ cursor: "text", fontSize: 14, color: THEME.muted }}>
          Bấm để thêm
        </div>
      )}
    </div>
  );
}

function ProductDetailModal({ p, onClose, saveProduct, onDelete, T }) {
  const { THEME, card, btnSub, iconBtn } = T;
  const perm = usePerm();
  const quote = buildThietbiQuote(p);
  const Icon = areaIcon(p.area);
  return (
    <div onClick={onClose} className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(44,26,30,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="hnPop" style={{ ...card, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 0, boxShadow: "0 24px 60px rgba(44,26,30,0.25)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${THEME.line}`, position: "sticky", top: 0, background: THEME.surface, zIndex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, color: THEME.subtext, fontSize: 13.5, fontWeight: 600 }}>
            <Icon size={17} color={THEME.brand} /> {p.area || "Sản phẩm"}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {perm.canDelete && (
              <button title="Xoá sản phẩm" aria-label="Xoá sản phẩm" style={{ ...iconBtn, color: THEME.danger }} onClick={onDelete}>
                <Trash2 size={15} />
              </button>
            )}
            <button title="Đóng" aria-label="Đóng" style={iconBtn} onClick={onClose}>
              <X size={17} />
            </button>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <FieldRow label="Tên sản phẩm" value={p.name} onSave={(v) => saveProduct(p.id, { name: v })} T={T} multiline />

          {quote && (
            <div style={{ background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 12, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
              <MessageSquareQuote size={17} color={THEME.brand} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{quote}</span>
              <CopyButton text={quote} T={T} />
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", columnGap: 16 }}>
            <FieldRow label="Khu vực" value={p.area} onSave={(v) => saveProduct(p.id, { area: v })} T={T} />
            <FieldRow label="Thương hiệu" value={p.brand} onSave={(v) => saveProduct(p.id, { brand: v })} T={T} />
            <FieldRow label="Mã sản phẩm" value={p.code} onSave={(v) => saveProduct(p.id, { code: v })} T={T} />
            <FieldRow label="Kích thước" value={p.size} onSave={(v) => saveProduct(p.id, { size: v })} T={T} />
          </div>
          <FieldRow label="Chất liệu / cân nặng" value={p.material} onSave={(v) => saveProduct(p.id, { material: v })} T={T} />
          <FieldRow label="Giá bán về tay" value={p.price} onSave={(v) => saveProduct(p.id, { price: v })} T={T} multiline />
          <FieldRow label="Link mua" value={p.link} onSave={(v) => saveProduct(p.id, { link: v })} T={T} />
          {p.link && /^https?:\/\//i.test(p.link) && (
            <a href={p.link} target="_blank" rel="noreferrer" style={{ ...btnSub, textDecoration: "none", marginBottom: 16 }}>
              <ExternalLink size={15} /> Xem trang gốc
            </a>
          )}

          <div style={{ borderTop: `1px solid ${THEME.line}`, margin: "4px 0 14px" }} />
          <BulletField label="Ưu điểm nổi bật" value={p.highlights} onSave={(v) => saveProduct(p.id, { highlights: v })} T={T} />
          <BulletField label="Lưu ý khi lắp đặt" value={p.installNotes} onSave={(v) => saveProduct(p.id, { installNotes: v })} T={T} />
        </div>
      </div>
    </div>
  );
}
