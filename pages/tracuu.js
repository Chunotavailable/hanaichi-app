// pages/tracuu.js
// Trang "Tra cứu nhanh": gom các câu trả lời mẫu, thông tin cửa hàng, link,
// bảng size, mẫu đăng bài... (từ file "Viết tắt tổng hợp Hanaichi") thành
// từng thẻ có nút Chép — tìm nhanh bằng ô tìm kiếm hoặc lọc theo nhóm.
// Cùng cơ chế lưu phần sửa + hoàn tác xoá 10s như các trang khác.
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { uid, norm, resizeImageFile, uploadGomcanImage, showToast } from "../lib/gomcanHelpers";
import { createSyncer, loadDoc } from "../lib/syncer";
import { usePerm } from "../lib/perm";
import { FilterChip, SearchInput, EmptyState, UndoToast } from "../lib/ui";
import { REPLY_GROUPS } from "../lib/repliesSeed";
import { ArrowUp, Plus, Pencil, Trash2, Copy, Check, SearchX, Lock, ImagePlus, X, Loader2, Maximize2, ArrowUpDown, LayoutList, Store, MessagesSquare, Receipt, Ruler, RefreshCcw, Users, Megaphone, FolderOpen } from "lucide-react";

const GROUP_ICONS = {
  "Tất cả": LayoutList,
  "Thông tin cửa hàng": Store,
  "Mẫu trả lời khách": MessagesSquare,
  "Giá & đặt hàng": Receipt,
  Size: Ruler,
  "Quy đổi size": ArrowUpDown,
  "Đổi trả & thanh toán": RefreshCcw,
  "Khách sỉ / CTV": Users,
  "Mẫu đăng bài": Megaphone,
  "Tài khoản Zalo": Lock,
};
function groupIcon(g) {
  return GROUP_ICONS[g] || FolderOpen;
}

function copyText(text) {
  if (navigator.clipboard) navigator.clipboard.writeText(text || "").catch(() => {});
}

// Biến link trong đoạn chữ thành link bấm được.
const LINK_RE = /(https?:\/\/[^\s]+|m\.me\/[^\s]+)/g;
function Linkified({ text, color }) {
  const parts = (text || "").split(LINK_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={/^https?:/.test(part) ? part : `https://${part}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color, wordBreak: "break-all" }}>
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function TraCuuPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip };
  const perm = usePerm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("Tất cả");
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const undoRef = useRef(null);
  const [undoInfo, setUndoInfo] = useState(null);
  const dataRef = useRef(null);
  dataRef.current = data;
  const syncerRef = useRef(null);
  if (!syncerRef.current) syncerRef.current = createSyncer("/api/replies", { onServerData: setData });

  function loadData() {
    setLoading(true);
    setLoadFailed(false);
    loadDoc("/api/replies")
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

  if (loadFailed && !loading) return <LoadError onRetry={loadData} />;
  if (loading || !data) return <Loading />;

  const list = data.replies || [];

  function persist(next) {
    setData(next);
    syncerRef.current.schedule(next);
  }
  function addReply(item) {
    persist({ ...data, replies: [...list, { id: uid(), ...item }] });
  }
  function saveReply(id, patch) {
    persist({ ...data, replies: list.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  // Sửa danh sách ảnh dựa trên dữ liệu MỚI NHẤT (upload ảnh mất vài giây,
  // trong lúc đó có thể đã sửa chỗ khác).
  function updateImages(id, fn) {
    const cur = dataRef.current;
    persist({ ...cur, replies: (cur.replies || []).map((r) => (r.id === id ? { ...r, images: fn(r.images || []) } : r)) });
  }
  function delReply(id) {
    const index = list.findIndex((r) => r.id === id);
    const item = list[index];
    if (!item) return;
    if (undoRef.current) clearTimeout(undoRef.current.timer);
    persist({
      ...data,
      replies: list.filter((r) => r.id !== id),
      repliesDeletedIds: Array.from(new Set([...(data.repliesDeletedIds || []), id])),
    });
    const restore = (cur) => {
      const out = (cur.replies || []).filter((r) => r.id !== id);
      out.splice(Math.min(index, out.length), 0, item);
      return { ...cur, replies: out, repliesDeletedIds: (cur.repliesDeletedIds || []).filter((x) => x !== id) };
    };
    const timer = setTimeout(() => {
      undoRef.current = null;
      setUndoInfo(null);
    }, 10000);
    undoRef.current = { restore, timer };
    setUndoInfo({ message: `Đã xoá "${item.title}"` });
  }
  function undoDelete() {
    if (!undoRef.current) return;
    clearTimeout(undoRef.current.timer);
    const { restore } = undoRef.current;
    undoRef.current = null;
    setUndoInfo(null);
    persist(restore(dataRef.current));
  }

  // Thứ tự nhóm: theo file gốc trước, nhóm tự thêm xếp sau.
  const present = Array.from(new Set(list.map((r) => r.group || "Khác")));
  const groups = [...REPLY_GROUPS.filter((g) => present.includes(g)), ...present.filter((g) => !REPLY_GROUPS.includes(g))];
  const nq = norm(q);
  let filtered = list.filter((r) => {
    // Đang gõ tìm kiếm thì tìm trong TẤT CẢ các nhóm, không bị giới hạn ở nhóm đang chọn.
    if (!nq && group !== "Tất cả" && (r.group || "Khác") !== group) return false;
    if (!nq) return true;
    return norm(`${r.title} ${r.content} ${r.group}`).includes(nq);
  });
  if (nq) {
    // Khớp ở tiêu đề xếp trước, chỉ khớp ở nội dung xếp sau (giữ nguyên thứ tự gốc trong mỗi nhóm).
    const inTitle = (r) => norm(r.title).includes(nq);
    filtered = [...filtered.filter(inTitle), ...filtered.filter((r) => !inTitle(r))];
  }
  const confirmDel = confirmDelId ? list.find((r) => r.id === confirmDelId) : null;

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Tra cứu nhanh" current="/tracuu" maxWidth={960} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: THEME.subtext }}>
            <b style={{ color: THEME.text }}>{list.length}</b> mục · bấm <b style={{ color: THEME.text }}>Chép</b> để copy gửi khách
          </div>
          {perm.canEdit && (
            <button style={showAdd ? btnSub : btn} onClick={() => setShowAdd((s) => !s)}>
              {showAdd ? "Đóng" : (<><Plus size={16} /> Thêm mục</>)}
            </button>
          )}
        </div>

        {showAdd && perm.canEdit && (
          <ReplyForm
            T={T}
            groups={groups}
            initial={{ title: "", content: "", group: group !== "Tất cả" ? group : groups[0] || "", private: false }}
            submitLabel="Thêm mục"
            onSubmit={(item) => {
              addReply(item);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
          />
        )}

        <div className="tcLayout">
          {/* Cột trái (máy tính): danh sách nhóm để nhảy nhanh. */}
          <aside className="tcSide">
            <div style={{ ...card, padding: 6 }}>
              {["Tất cả", ...groups].map((g) => {
                const Icon = groupIcon(g);
                const active = nq ? g === "Tất cả" : group === g;
                const count = g === "Tất cả" ? list.length : list.filter((r) => (r.group || "Khác") === g).length;
                return (
                  <button
                    key={g}
                    onClick={() => {
                      setQ("");
                      setGroup(g);
                    }}
                    aria-pressed={active}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "8px 10px",
                      border: "none",
                      borderRadius: 9,
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 13.5,
                      fontWeight: active ? 700 : 500,
                      background: active ? THEME.chipBg : "transparent",
                      color: active ? THEME.brand : THEME.text,
                    }}
                  >
                    <Icon size={16} color={active ? THEME.brand : THEME.subtext} />
                    <span style={{ flex: 1 }}>{g}</span>
                    <span style={{ fontSize: 12, color: THEME.muted, fontWeight: 600 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div style={{ minWidth: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <SearchInput value={q} onChange={setQ} placeholder="Tìm câu trả lời, số điện thoại, link, size..." T={T} />
              {/* Điện thoại: nhóm hiện thành hàng nút vuốt ngang. */}
              <div className="hnHScroll tcChips" style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto" }}>
                {["Tất cả", ...groups].map((g) => (
                  <FilterChip
                    key={g}
                    T={T}
                    active={nq ? g === "Tất cả" : group === g}
                    onClick={() => {
                      setQ("");
                      setGroup(g);
                    }}
                  >
                    {g}
                  </FilterChip>
                ))}
              </div>
            </div>

            {groups.map((g) => {
              const items = filtered.filter((r) => (r.group || "Khác") === g);
              if (!items.length) return null;
              const Icon = groupIcon(g);
              return (
                <section key={g} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 8px", color: THEME.subtext, fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <Icon size={15} color={THEME.brand} /> {g}
                    <span style={{ fontWeight: 600, color: THEME.muted }}>· {items.length}</span>
                  </div>
                  <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                    {items.map((r, i) => (
                      <ReplyRow key={r.id} r={r} first={i === 0} groups={groups} saveReply={saveReply} updateImages={updateImages} onDelete={() => setConfirmDelId(r.id)} T={T} />
                    ))}
                  </div>
                </section>
              );
            })}
        {!filtered.length && <EmptyState icon={SearchX} title="Không tìm thấy mục nào" hint="Thử từ khác, hoặc chọn lại nhóm “Tất cả”." T={T} />}
          </div>
        </div>
      </div>
      <style jsx>{`
        .tcLayout {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .tcSide {
          position: sticky;
          top: 12px;
        }
        .tcChips {
          display: none !important;
        }
        @media (max-width: 760px) {
          .tcLayout {
            grid-template-columns: minmax(0, 1fr);
          }
          .tcSide {
            display: none;
          }
          .tcChips {
            display: flex !important;
          }
        }
      `}</style>

      <ConfirmDialog
        open={!!confirmDel}
        message={`Xoá "${confirmDel ? confirmDel.title : ""}"? (có 10s để hoàn tác sau khi xoá)`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delReply(confirmDelId);
          setConfirmDelId(null);
        }}
      />
      <ScrollTopButton THEME={THEME} />
      {undoInfo && <UndoToast message={undoInfo.message} onUndo={undoDelete} />}
    </main>
  );
}

// Nút nổi góc phải dưới: cuộn xuống 1 đoạn thì hiện, bấm để lên đầu trang.
function ScrollTopButton({ THEME }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      className="hnPop"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Lên đầu trang"
      aria-label="Lên đầu trang"
      style={{ position: "fixed", right: 18, bottom: 22, zIndex: 45, width: 44, height: 44, borderRadius: 14, background: THEME.surface, color: THEME.text, border: `1px solid ${THEME.line}`, cursor: "pointer", boxShadow: "0 6px 18px rgba(44,26,30,0.12)", display: "grid", placeItems: "center" }}
    >
      <ArrowUp size={19} />
    </button>
  );
}

function CopyButton({ text, T }) {
  const { THEME, btnSub } = T;
  const [copied, setCopied] = useState(false);
  return (
    <button
      title="Sao chép"
      style={{ ...btnSub, padding: "5px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text, flexShrink: 0 }}
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

// 1 mục: tiêu đề + nút Chép (và Sửa/Xoá/Thêm ảnh với Quản lý) ở trên, toàn
// bộ nội dung và ảnh luôn hiện đầy đủ bên dưới.
function ReplyRow({ r, first, groups, saveReply, updateImages, onDelete, T }) {
  const { THEME, iconBtn } = T;
  const perm = usePerm();
  const [editing, setEditing] = useState(false);
  const fileRef = useRef(null);
  const border = first ? "none" : `1px solid ${THEME.line}`;
  const images = r.images || [];
  const smallIcon = { ...iconBtn, width: 30, height: 30 };

  if (editing && perm.canEdit) {
    return (
      <div style={{ borderTop: border, padding: 10 }}>
        <ReplyForm
          T={T}
          groups={groups}
          initial={r}
          submitLabel="Lưu"
          flat
          onSubmit={(patch) => {
            saveReply(r.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ borderTop: border, padding: "12px 14px 14px" }} onMouseEnter={() => (pasteTargetId = r.id)} onFocus={() => (pasteTargetId = r.id)}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: r.content || images.length || perm.canEdit ? 8 : 0 }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 650, fontSize: 14.5, color: THEME.brand, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", paddingTop: 4 }}>
          <span style={{ lineHeight: 1.35 }}>{r.title}</span>
          {r.private && (
            <span title="Chế độ Khách không nhìn thấy mục này" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: THEME.subtext, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 999, padding: "0 7px", flexShrink: 0 }}>
              <Lock size={10} /> Chỉ Quản lý
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {r.content ? <CopyButton text={r.content} T={T} /> : null}
          {perm.canEdit && (
            <button title="Thêm ảnh (hoặc rê chuột vào mục rồi Ctrl+V)" aria-label="Thêm ảnh" style={smallIcon} onClick={() => fileRef.current && fileRef.current.click()}>
              <ImagePlus size={14} />
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
      {r.content ? (
        <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: THEME.text, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 10, padding: "10px 12px" }}>
          <Linkified text={r.content} color={THEME.brand} />
        </div>
      ) : null}
      <ReplyImages r={r} images={images} updateImages={updateImages} fileRef={fileRef} T={T} />
    </div>
  );
}

// Ảnh của 1 mục (VD bảng quy đổi size): bấm ảnh để mở to (điện thoại thì
// phóng to/lưu ảnh được). Quản lý thêm ảnh bằng nút chọn file hoặc dán thẳng
// ảnh chụp màn hình (Ctrl+V) khi mục đang mở.
// Nhiều mục cùng mở thì ảnh dán vào mục được mở / rê chuột gần nhất.
let pasteTargetId = null;
function ReplyImages({ r, images, updateImages, fileRef, T }) {
  const { THEME, btnSub, iconBtn } = T;
  const perm = usePerm();
  const [busy, setBusy] = useState(0);
  const [confirmUrl, setConfirmUrl] = useState(null);

  async function addFiles(files) {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setBusy(list.length);
    const urls = [];
    for (const f of list) {
      try {
        // Bảng size nhiều chữ nhỏ -> giữ ảnh nét (tối đa 2200px).
        const dataUrl = await resizeImageFile(f, 2200, 0.9);
        urls.push(await uploadGomcanImage(`tracuu-${r.id}-${uid()}`, dataUrl));
      } catch {
        showToast("Không tải được 1 ảnh lên — thử lại hoặc chụp lại ảnh dạng PNG/JPG.");
      }
      setBusy((b) => b - 1);
    }
    if (urls.length) updateImages(r.id, (cur) => [...cur, ...urls]);
    setBusy(0);
  }

  useEffect(() => {
    if (!perm.canEdit) return undefined;
    function onPaste(e) {
      if (pasteTargetId !== r.id) return;
      const files = Array.from(e.clipboardData?.items || [])
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter(Boolean);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [perm.canEdit, r.id]);

  const showDrop = perm.canEdit && !images.length && !r.content;
  if (!images.length && !perm.canEdit) return null;
  return (
    <div style={{ marginTop: r.content && (images.length || showDrop || busy > 0) ? 10 : 0 }}>
      {images.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {images.map((url) => (
            <div key={url} style={{ position: "relative", background: "#fff", border: `1px solid ${THEME.line}`, borderRadius: 10, overflow: "hidden" }}>
              <a href={url} target="_blank" rel="noreferrer" title="Mở ảnh to">
                <img src={url} alt={r.title} loading="lazy" style={{ display: "block", width: "100%", height: "auto" }} />
              </a>
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                <a href={url} target="_blank" rel="noreferrer" title="Mở ảnh to" style={{ ...iconBtn, background: "rgba(255,250,245,0.92)", textDecoration: "none" }}>
                  <Maximize2 size={14} />
                </a>
                {perm.canDelete && (
                  <button title="Xoá ảnh" aria-label="Xoá ảnh" style={{ ...iconBtn, background: "rgba(255,250,245,0.92)", color: THEME.danger }} onClick={() => setConfirmUrl(url)}>
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {busy > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: THEME.subtext, marginTop: images.length ? 10 : 0 }}>
          <Loader2 size={15} style={{ animation: "hnSpin 0.8s linear infinite" }} /> Đang tải {busy} ảnh lên...
        </div>
      )}
      {showDrop && busy === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: `1.5px dashed ${THEME.chipLine}`, borderRadius: 10, padding: "14px 12px", background: THEME.surfaceAlt }}>
          <button style={{ ...btnSub, padding: "6px 12px", fontSize: 13 }} onClick={() => fileRef.current && fileRef.current.click()}>
            <ImagePlus size={15} /> Thêm ảnh
          </button>
          <span style={{ fontSize: 12.5, color: THEME.muted }}>hoặc rê chuột vào đây rồi dán ảnh chụp màn hình (Ctrl+V)</span>
        </div>
      )}
      {perm.canEdit && <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />}
      <ConfirmDialog
        open={!!confirmUrl}
        message="Xoá ảnh này khỏi mục?"
        onCancel={() => setConfirmUrl(null)}
        onConfirm={() => {
          const u = confirmUrl;
          setConfirmUrl(null);
          updateImages(r.id, (cur) => cur.filter((x) => x !== u));
        }}
      />
    </div>
  );
}

function ReplyForm({ initial, groups, onSubmit, onCancel, submitLabel, flat, T }) {
  const { THEME, card, inp, btn, btnSub } = T;
  const [title, setTitle] = useState(initial.title || "");
  const [group, setGroup] = useState(initial.group || "");
  const [content, setContent] = useState(initial.content || "");
  const [priv, setPriv] = useState(!!initial.private);
  const ok = !!title.trim();
  return (
    <div style={flat ? { padding: 4 } : { ...card, padding: 14, marginBottom: 14, borderColor: THEME.chipLine }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 8 }}>
        <input style={{ ...inp, fontWeight: 600 }} placeholder="Tiêu đề (VD: Địa chỉ cửa hàng)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input style={inp} placeholder="Nhóm (VD: Mẫu trả lời khách)" value={group} onChange={(e) => setGroup(e.target.value)} list="reply-groups" />
        <datalist id="reply-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      <textarea style={{ ...inp, minHeight: 130, resize: "vertical", lineHeight: 1.5 }} placeholder="Nội dung (câu trả lời, số điện thoại, link...) — có thể để trống nếu chỉ cần ảnh, ảnh thêm sau khi lưu" value={content} onChange={(e) => setContent(e.target.value)} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: THEME.subtext, marginTop: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} />
        <Lock size={13} /> Chỉ Quản lý xem (ẩn với chế độ Khách — VD mật khẩu, thông tin nội bộ)
      </label>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={btn} disabled={!ok} onClick={() => onSubmit({ title: title.trim(), group: group.trim() || "Khác", content: content.replace(/\s+$/, ""), private: priv })}>
          <Check size={16} /> {submitLabel}
        </button>
        <button style={btnSub} onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </div>
  );
}
