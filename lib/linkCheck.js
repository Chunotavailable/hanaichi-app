// lib/linkCheck.js — Nút "Kiểm tra giá các link" ở trang Giá gồm cân.
// Web chỉ NHỜ extension Hanaichi (bản 0.6.0 trở lên) mở từng link gốc bằng Chrome của bạn, đọc giá Yên + còn/hết hàng,
// rồi trả về đây để so với giá đang lưu. Chỉ báo: giá Yên TĂNG, hết hàng, link không còn.
import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, Check, Plus } from "lucide-react";
import { vndForNewYen } from "./gomcanHelpers";

const ORIGIN = () => window.location.origin;
const sendExt = (msg) => window.postMessage({ hnPage: 1, ...msg }, ORIGIN());

export function useLinkCheck() {
  const [extVersion, setExtVersion] = useState(null);
  const [run, setRun] = useState(null); // { runId, phase: noext|running|done|cancelled|aborted, total, done, results:{id:{status,jpy,note}}, items:[{id,name,link,ref}], reason }
  // Kết quả lần kiểm tra gần nhất được nhớ lại (kể cả khi F5), để bấm xem lại không phải chạy lại từ đầu.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hn_linkcheck_last");
      if (raw) {
        const r = JSON.parse(raw);
        if (r && r.phase && r.phase !== "running" && r.phase !== "noext") setRun((cur) => cur || r);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (!run || run.phase === "running" || run.phase === "noext") return;
    try {
      localStorage.setItem("hn_linkcheck_last", JSON.stringify({ ...run, savedAt: run.savedAt || Date.now() }));
    } catch {}
  }, [run && run.phase]);
  const runIdRef = useRef("");
  const pongWaiters = useRef([]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== window || e.origin !== ORIGIN()) return;
      const d = e.data;
      if (!d || d.hnExt !== 1) return;
      if (d.kind === "pong") {
        setExtVersion(d.version || "?");
        pongWaiters.current.splice(0).forEach((f) => f(d.version || "?"));
      } else if (d.kind === "progress" && d.runId === runIdRef.current) {
        setRun((r) => (r && r.runId === d.runId ? { ...r, done: d.done, total: d.total, results: { ...r.results, [d.result.id]: d.result } } : r));
      } else if (d.kind === "finished" && d.runId === runIdRef.current) {
        setRun((r) => (r && r.runId === d.runId ? { ...r, phase: d.aborted ? "aborted" : d.cancelled ? "cancelled" : "done", reason: d.reason || "" } : r));
      }
    };
    window.addEventListener("message", onMsg);
    sendExt({ kind: "ping" });
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function ping() {
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), 1500);
      pongWaiters.current.push((v) => {
        clearTimeout(t);
        resolve(v);
      });
      sendExt({ kind: "ping" });
    });
  }

  async function start(items) {
    const v = extVersion || (await ping());
    if (!v) {
      setRun({ runId: "", phase: "noext", total: 0, done: 0, results: {}, items });
      return;
    }
    const runId = Math.random().toString(36).slice(2, 10);
    runIdRef.current = runId;
    setRun({ runId, phase: "running", total: items.length, done: 0, results: {}, items, savedAt: Date.now() });
    sendExt({ kind: "check", runId, items: items.map(({ id, link, name }) => ({ id, link, name })) });
  }
  function cancel() {
    if (run && run.phase === "running") sendExt({ kind: "cancel", runId: run.runId });
  }
  return { extVersion, run, start, cancel };
}

function Section({ title, color, count, children, T }) {
  const { THEME } = T;
  if (!count) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: color || THEME.text, marginBottom: 8 }}>
        {title} ({count})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ children, T, accent }) {
  const { THEME } = T;
  return <div style={{ border: `1px solid ${accent || THEME.line}`, background: THEME.surface, borderRadius: 12, padding: "10px 12px" }}>{children}</div>;
}

export function LinkCheckModal({ run, items, onClose, onCancel, onAddNew, onView, T }) {
  const { THEME, btn, btnSub, iconBtn } = T;
  const [added, setAdded] = useState({}); // id -> true: đã bấm "Thêm giá Yên mới"
  const byId = new Map((items || []).map((it) => [it.id, it]));
  const snap = new Map((run.items || []).map((x) => [x.id, x]));
  const fmt = (n) => (n == null ? "—" : `¥${Number(n).toLocaleString("vi-VN")}`);

  const inc = [], oos = [], gone = [], manual = [], other = [];
  let same = 0;
  Object.entries(run.results || {}).forEach(([id, r]) => {
    const it = byId.get(id);
    const sn = snap.get(id);
    if (!it || !sn) return;
    const ref = sn.ref; // giá Yên đang lưu lúc bắt đầu kiểm tra
    if (r.status === "oos") oos.push({ it, r });
    else if (r.status === "gone") gone.push({ it, r });
    else if (r.status === "ok") {
      if (ref == null) manual.push({ it, r });
      else if (r.jpy > ref) inc.push({ it, r, ref });
      else same++;
    } else other.push({ it, r });
  });
  inc.sort((a, b) => b.r.jpy - b.ref - (a.r.jpy - a.ref));

  const link = (it) =>
    /^https?:\/\//i.test(it.link || "") ? (
      <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ color: THEME.brand, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
        Mở link <ExternalLink size={13} />
      </a>
    ) : null;
  const small = { ...btnSub, padding: "5px 10px", fontSize: 13 };
  const pct = run.total ? Math.round((run.done / run.total) * 100) : 0;
  const running = run.phase === "running";

  return (
    <div onClick={onClose} className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(44,26,30,0.45)", zIndex: 90, display: "grid", placeItems: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="hnPop" style={{ background: THEME.surface, borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 20, boxShadow: "0 24px 60px rgba(44,26,30,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Kiểm tra giá các link gốc</h3>
          <button onClick={onClose} aria-label="Đóng" style={iconBtn}>
            <X size={17} />
          </button>
        </div>

        {run.phase === "noext" && (
          <div style={{ lineHeight: 1.6, fontSize: 14.5 }}>
            Chưa thấy extension Hanaichi <b>bản 0.6.0 trở lên</b> trên Chrome này. Bạn cài/cập nhật extension (xem file HUONG_DAN), rồi bấm <b>F5</b> tải lại trang này và thử lại. Nút này chỉ chạy trên Chrome/Edge có extension.
          </div>
        )}

        {run.phase !== "noext" && (
          <>
            <div style={{ fontSize: 13.5, color: THEME.subtext, marginBottom: 6 }}>
              {running ? `Đang kiểm tra ${run.done}/${run.total} link… (mỗi link cách nhau vài giây, bạn cứ để tab này mở)` : `Đã kiểm tra ${run.done}/${run.total} link`}
              {run.phase === "cancelled" && " — đã dừng"}
            </div>
            <div style={{ height: 8, background: THEME.line, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: THEME.brand, transition: "width .3s" }} />
            </div>
            {running && (
              <button style={{ ...small, marginTop: 10 }} onClick={onCancel}>
                Dừng
              </button>
            )}
            {run.phase === "aborted" && (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: THEME.dangerBg, color: THEME.danger, fontWeight: 600, fontSize: 14 }}>{run.reason || "Đã dừng giữa chừng."}</div>
            )}

            <div style={{ marginTop: 10, fontSize: 13.5, color: THEME.subtext }}>
              Giá Yên không đổi hoặc giảm: <b style={{ color: THEME.text }}>{same}</b> sản phẩm
            </div>

            <Section title="⚠ Giá Yên TĂNG" color={THEME.danger} count={inc.length} T={T}>
              {inc.map(({ it, r, ref }) => {
                const calc = vndForNewYen(it, String(r.jpy));
                const done = !!added[it.id];
                return (
                  <Row key={it.id} T={T} accent={THEME.danger}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>{it.name}</div>
                    <div style={{ marginTop: 3, fontSize: 14 }}>
                      {fmt(ref)} → <b style={{ color: THEME.danger }}>{fmt(r.jpy)}</b> <span style={{ color: THEME.danger }}>(+{(r.jpy - ref).toLocaleString("vi-VN")}¥)</span>
                      {calc && <span style={{ color: THEME.subtext }}> · giá gồm cân mới: <b style={{ color: THEME.brand }}>{calc.vnd}</b></span>}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                      {link(it)}
                      <button style={small} onClick={() => onView(it.id)}>
                        Xem sản phẩm
                      </button>
                      <button
                        style={{ ...small, ...(done ? {} : { background: THEME.brand, color: "#fff", borderColor: THEME.brand }) }}
                        disabled={done}
                        onClick={() => {
                          onAddNew(it, r.jpy);
                          setAdded((a) => ({ ...a, [it.id]: true }));
                        }}
                      >
                        {done ? (
                          <>
                            <Check size={14} /> Đã thêm
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> {it.sizeOf ? "Cập nhật giá size" : "Thêm giá Yên mới"}
                          </>
                        )}
                      </button>
                    </div>
                  </Row>
                );
              })}
            </Section>

            <Section title="⚠ HẾT HÀNG" color={THEME.danger} count={oos.length} T={T}>
              {oos.map(({ it }) => (
                <Row key={it.id} T={T} accent={THEME.danger}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>{it.name}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                    {link(it)}
                    <button style={small} onClick={() => onView(it.id)}>
                      Xem sản phẩm
                    </button>
                  </div>
                </Row>
              ))}
            </Section>

            <Section title="Link không còn (trang bị xoá)" color={THEME.danger} count={gone.length} T={T}>
              {gone.map(({ it }) => (
                <Row key={it.id} T={T}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>{it.name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    {link(it)}
                    <button style={small} onClick={() => onView(it.id)}>
                      Xem sản phẩm
                    </button>
                  </div>
                </Row>
              ))}
            </Section>

            <Section title="Đọc được giá nhưng chưa so được (giá cũ không phải số) — bạn xem tay" count={manual.length} T={T}>
              {manual.map(({ it, r }) => (
                <Row key={it.id} T={T}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>{it.name}</div>
                  <div style={{ marginTop: 3, fontSize: 14 }}>
                    Giá trên trang: <b>{fmt(r.jpy)}</b> · đang lưu: <span style={{ color: THEME.subtext }}>{it.jpy || "—"}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    {link(it)}
                    <button style={small} onClick={() => onView(it.id)}>
                      Xem sản phẩm
                    </button>
                  </div>
                </Row>
              ))}
            </Section>

            {other.length > 0 && (
              <details style={{ marginTop: 16 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: THEME.subtext }}>Không đọc được / bỏ qua ({other.length}) — bạn kiểm tra tay</summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {other.map(({ it, r }) => (
                    <div key={it.id} style={{ fontSize: 13.5, display: "flex", gap: 8, justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ overflowWrap: "anywhere" }}>
                        {it.name} <span style={{ color: THEME.subtext }}>· {r.note || r.status}</span>
                      </span>
                      <span style={{ flexShrink: 0 }}>{link(it)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {run.phase !== "running" && inc.length + oos.length + gone.length === 0 && (
              <div style={{ marginTop: 14, fontWeight: 700, color: THEME.success }}>Không có sản phẩm nào tăng giá Yên hoặc hết hàng.</div>
            )}

            <div style={{ marginTop: 18, fontSize: 12.5, color: THEME.subtext, lineHeight: 1.5 }}>
              So với giá Yên đang lưu (nếu đã thêm “giá gồm cân khác” thì lấy giá Yên của dòng thêm sau cùng). Giá trên Amazon có thể khác theo màu/size/người bán, nên <b>mở link kiểm tra lại trước khi báo khách</b>. Giá giảm thì không báo.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
