// pages/tracuu.js
// Trang "Tra cứu nhanh": gom các câu trả lời mẫu, thông tin cửa hàng, link,
// bảng size, mẫu đăng bài... (từ file "Viết tắt tổng hợp Hanaichi") thành
// từng thẻ có nút Chép — tìm nhanh bằng ô tìm kiếm hoặc lọc theo nhóm.
// Cùng cơ chế lưu phần sửa + hoàn tác xoá 10s như các trang khác.
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { uid, norm } from "../lib/gomcanHelpers";
import { createSyncer, loadDoc } from "../lib/syncer";
import { usePerm } from "../lib/perm";
import { FilterChip, SearchInput, EmptyState, GroupTitle, UndoToast } from "../lib/ui";
import { REPLY_GROUPS } from "../lib/repliesSeed";
import { Plus, Pencil, Trash2, Copy, Check, SearchX, Lock, ChevronDown } from "lucide-react";

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
  const filtered = list.filter((r) => {
    if (group !== "Tất cả" && (r.group || "Khác") !== group) return false;
    if (!nq) return true;
    return norm(`${r.title} ${r.content} ${r.group}`).includes(nq);
  });
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

        <div style={{ ...card, padding: 14, marginBottom: 16 }}>
          <SearchInput value={q} onChange={setQ} placeholder="Tìm câu trả lời, số điện thoại, link, size..." T={T} />
          <div className="hnHScroll" style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto" }}>
            {["Tất cả", ...groups].map((g) => (
              <FilterChip key={g} T={T} active={group === g} onClick={() => setGroup(g)}>
                {g}
              </FilterChip>
            ))}
          </div>
        </div>

        {groups.map((g) => {
          const items = filtered.filter((r) => (r.group || "Khác") === g);
          if (!items.length) return null;
          return (
            <section key={g} style={{ marginBottom: 22 }}>
              <div style={{ marginBottom: 10 }}>
                <GroupTitle T={T} count={items.length}>
                  {g}
                </GroupTitle>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 380px), 1fr))", gap: 12, alignItems: "start" }}>
                {items.map((r) => (
                  <ReplyCard key={r.id} r={r} groups={groups} saveReply={saveReply} onDelete={() => setConfirmDelId(r.id)} T={T} />
                ))}
              </div>
            </section>
          );
        })}
        {!filtered.length && <EmptyState icon={SearchX} title="Không tìm thấy mục nào" hint="Thử từ khác, hoặc chọn lại nhóm “Tất cả”." T={T} />}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        message={`Xoá "${confirmDel ? confirmDel.title : ""}"? (có 10s để hoàn tác sau khi xoá)`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delReply(confirmDelId);
          setConfirmDelId(null);
        }}
      />
      {undoInfo && <UndoToast message={undoInfo.message} onUndo={undoDelete} />}
    </main>
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

const LONG_LINES = 8;

function ReplyCard({ r, groups, saveReply, onDelete, T }) {
  const { THEME, card, iconBtn } = T;
  const perm = usePerm();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const smallIcon = { ...iconBtn, width: 30, height: 30 };
  const isLong = (r.content || "").split("\n").length > LONG_LINES || (r.content || "").length > 420;

  if (editing && perm.canEdit) {
    return (
      <ReplyForm
        T={T}
        groups={groups}
        initial={r}
        submitLabel="Lưu"
        onSubmit={(patch) => {
          saveReply(r.id, patch);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="hnCard" style={{ ...card, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 650, fontSize: 14.5, color: THEME.brand, paddingTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {r.title}
          {r.private && (
            <span title="Chế độ Khách không nhìn thấy mục này" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 600, color: THEME.subtext, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 999, padding: "1px 7px" }}>
              <Lock size={11} /> Chỉ Quản lý
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <CopyButton text={r.content} T={T} />
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
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          color: THEME.text,
          background: THEME.surfaceAlt,
          border: `1px solid ${THEME.line}`,
          borderRadius: 10,
          padding: "9px 11px",
          // Nội dung dài: thu gọn còn ~7 dòng, mờ dần ở cuối cho biết còn nữa.
          ...(isLong && !expanded
            ? { maxHeight: 175, overflow: "hidden", WebkitMaskImage: "linear-gradient(#000 70%, transparent)", maskImage: "linear-gradient(#000 70%, transparent)" }
            : {}),
        }}
      >
        <Linkified text={r.content} color={THEME.brand} />
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((x) => !x)}
          style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: THEME.subtext, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
        >
          {expanded ? "Thu gọn" : "Xem hết"} <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
        </button>
      )}
    </div>
  );
}

function ReplyForm({ initial, groups, onSubmit, onCancel, submitLabel, T }) {
  const { THEME, card, inp, btn, btnSub } = T;
  const [title, setTitle] = useState(initial.title || "");
  const [group, setGroup] = useState(initial.group || "");
  const [content, setContent] = useState(initial.content || "");
  const [priv, setPriv] = useState(!!initial.private);
  const ok = title.trim() && content.trim();
  return (
    <div style={{ ...card, padding: 14, marginBottom: 14, borderColor: THEME.chipLine }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 8 }}>
        <input style={{ ...inp, fontWeight: 600 }} placeholder="Tiêu đề (VD: Địa chỉ cửa hàng)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input style={inp} placeholder="Nhóm (VD: Mẫu trả lời khách)" value={group} onChange={(e) => setGroup(e.target.value)} list="reply-groups" />
        <datalist id="reply-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      <textarea style={{ ...inp, minHeight: 130, resize: "vertical", lineHeight: 1.5 }} placeholder="Nội dung (câu trả lời, số điện thoại, link...)" value={content} onChange={(e) => setContent(e.target.value)} />
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
