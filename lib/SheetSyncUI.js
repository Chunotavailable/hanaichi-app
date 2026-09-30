// lib/SheetSyncUI.js — CHỈ dùng ở trình duyệt.
// Phần giao diện dùng chung cho các tab tự đối chiếu với file Google Sheet:
// dòng trạng thái + nút "Cập nhật ngay", dải "chờ duyệt", và cửa sổ Duyệt / Lịch sử.
import { useEffect, useState } from "react";
import { goLogin } from "./gomcanHelpers";

// reloadData(): tải lại dữ liệu của trang sau khi có thay đổi.
export function useSheetSync(syncUrl, reloadData) {
  const [st, setSt] = useState({ busy: false, at: null, error: "", summary: null, pending: [] });
  async function run(force, action) {
    setSt((s) => ({ ...s, busy: true, error: "" }));
    try {
      const r = await fetch(`${syncUrl}${force ? "?force=1" : ""}`, action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action), cache: "no-store" } : { cache: "no-store" });
      if (r.status === 401) return goLogin();
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Không đọc được file Google Sheet");
      if (j.changed) await reloadData();
      setSt((s) => ({ busy: false, at: j.at || new Date().toISOString(), error: "", summary: j.changed ? j.summary : s.summary, pending: j.pending || [] }));
      // Bấm "Cập nhật ngay" thì tải lại trang cho sạch số liệu mới; duyệt/bỏ qua thì giữ nguyên trang.
      if (force && !action) setTimeout(() => window.location.reload(), 500);
      return true;
    } catch (e) {
      setSt((s) => ({ ...s, busy: false, error: (e && e.message) || "Không cập nhật được từ file gốc" }));
      return false;
    }
  }
  return [st, run];
}

export function SheetSyncBar({ st, run, canEdit, onOpen, T, summaryText }) {
  const { THEME, btn, btnSub } = T;
  const time = st.at ? new Date(st.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12.5, marginBottom: 10, color: st.error ? THEME.danger : THEME.muted }}>
        <span>
          {st.error ? `⚠️ ${st.error} — đang dùng số liệu lần trước` : st.busy ? "Đang đối chiếu với file gốc..." : st.at ? `Đã đối chiếu file gốc · ${time}${st.summary && summaryText ? ` · ${summaryText(st.summary)}` : ""}` : ""}
        </span>
        <span style={{ display: "inline-flex", gap: 6 }}>
          <button style={{ ...btnSub, padding: "4px 10px", fontSize: 12.5 }} onClick={() => onOpen("log")}>Lịch sử thay đổi</button>
          <button style={{ ...btnSub, padding: "4px 10px", fontSize: 12.5 }} disabled={st.busy} onClick={() => run(true)}>{st.busy ? "Đang cập nhật..." : "Cập nhật ngay"}</button>
        </span>
      </div>
      {canEdit && st.pending.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "#fff3d6", border: "1px solid #f0d28a", color: "#6b4a00", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
          <span>⚠️ File công ty có {st.pending.length} thay đổi đang chờ bạn duyệt</span>
          <button style={{ ...btn, padding: "6px 12px", fontSize: 13 }} onClick={() => onOpen("pending")}>Xem & duyệt</button>
        </div>
      )}
    </>
  );
}

// pendingView(x, THEME) -> { kind, color, text }   logView(it, THEME) -> { text, color }
export function SheetSyncModal({ onClose, changesUrl, st, run, canEdit, initialTab, pendingView, logView, refOf, T }) {
  const { THEME, card, btn, btnSub } = T;
  const [tab, setTab] = useState(initialTab);
  const [log, setLog] = useState(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(0);
  const pending = st.pending;
  useEffect(() => {
    fetch(changesUrl, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setLog).catch(() => setErr(true));
  }, [changesUrl]);
  const fmt = (iso) => new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const act = (a, r) => run(true, { approve: a, reject: r });
  return (
    <div className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(40,20,25,0.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }} onClick={onClose}>
      <div role="dialog" className="hnPop" onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 640, maxHeight: "86vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${THEME.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Thay đổi từ file công ty</div>
            {st.at && <div style={{ fontSize: 12.5, color: THEME.muted }}>Lần kiểm tra gần nhất: {fmt(st.at)}</div>}
          </div>
          <button style={btnSub} onClick={onClose}>Đóng</button>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "8px 16px 0" }}>
          {[["pending", `Chờ duyệt (${pending.length})`], ["log", "Đã cập nhật"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", borderRadius: 999, fontSize: 13.5, fontWeight: 700, background: tab === k ? THEME.brand : THEME.chipBg, color: tab === k ? "#fff" : THEME.text }}>
              {label}
            </button>
          ))}
        </div>
        {tab === "pending" && (
          <div style={{ overflowY: "auto", padding: "8px 16px 16px" }}>
            {!pending.length && <div style={{ color: THEME.muted, padding: 12 }}>Không có thay đổi nào chờ duyệt.</div>}
            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: THEME.subtext, padding: "4px 0 8px", lineHeight: 1.5 }}>Các thay đổi này chỉ vào app sau khi bạn duyệt.</div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <button style={{ ...btn, padding: "6px 12px", fontSize: 13 }} disabled={st.busy} onClick={() => act(pending.map(refOf), [])}>Duyệt tất cả ({pending.length})</button>
                    <button style={{ ...btnSub, padding: "6px 12px", fontSize: 13 }} disabled={st.busy} onClick={() => act([], pending.map(refOf))}>Bỏ qua tất cả</button>
                  </div>
                )}
                {pending.map((x) => {
                  const v = pendingView(x, THEME);
                  return (
                    <div key={x.k + x.key} style={{ padding: "8px 0", borderTop: `1px solid ${THEME.line}`, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
                        <div style={{ fontWeight: 600 }}>{x.p}</div>
                        <div>
                          <span style={{ color: v.color, fontWeight: 700 }}>{v.kind}</span>
                          {v.text ? <span style={{ color: THEME.subtext, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}> {v.text}</span> : null}
                        </div>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button style={{ ...btn, padding: "5px 10px", fontSize: 12.5 }} disabled={st.busy} onClick={() => act([refOf(x)], [])}>Duyệt</button>
                          <button style={{ ...btnSub, padding: "5px 10px", fontSize: 12.5 }} disabled={st.busy} onClick={() => act([], [refOf(x)])}>Bỏ qua</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
        <div style={{ overflowY: "auto", padding: "8px 16px 16px", display: tab === "log" ? "block" : "none" }}>
          {err && <div style={{ color: THEME.danger, padding: 12 }}>Không tải được lịch sử.</div>}
          {!log && !err && <div style={{ color: THEME.muted, padding: 12 }}>Đang tải...</div>}
          {log && !(log.entries || []).length && <div style={{ color: THEME.muted, padding: 12 }}>Chưa có thay đổi nào được ghi.</div>}
          {log && (log.entries || []).map((e, i) => {
            const isOpen = open === i;
            return (
              <div key={e.at} style={{ borderBottom: `1px solid ${THEME.line}`, padding: "10px 0" }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(e.at)} {e.approved ? "· đã duyệt " : ""}{isOpen ? "▾" : "▸"}</div>
                  <div style={{ fontSize: 13, color: THEME.subtext, marginTop: 2 }}>{(e.items || []).length + (e.more || 0)} thay đổi</div>
                </button>
                {isOpen && (
                  <div style={{ marginTop: 8 }}>
                    {(e.items || []).map((it, j) => {
                      const v = logView(it, THEME);
                      return (
                        <div key={j} style={{ padding: "6px 0", borderTop: j ? `1px dashed ${THEME.line}` : "none", fontSize: 13, lineHeight: 1.45 }}>
                          <div style={{ fontWeight: 600 }}>{it.p}</div>
                          <div style={{ color: v.color, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{v.text}</div>
                        </div>
                      );
                    })}
                    {e.more > 0 && <div style={{ color: THEME.muted, fontSize: 12.5, paddingTop: 6 }}>… và {e.more} thay đổi nữa</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
