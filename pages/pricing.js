// pages/pricing.js — Báo giá nhanh
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { createSyncer, loadDoc } from "../lib/syncer";
import { usePerm, readRoleCookie } from "../lib/perm";
import { Plane, PackageCheck, History, Trash2, Pencil, Check, Copy, WifiOff, RotateCw } from "lucide-react";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function roundUp5k(n) {
  return Math.ceil(n / 5000) * 5000;
}
function fmtK(n) {
  const k = n / 1000;
  return (Number.isInteger(k) ? k : Math.round(k * 10) / 10).toString().replace(".", ",") + "k";
}
function numOnly(s) {
  s = (s || "").toString();
  const labeled = s.match(/gi[aá]\s*:?\s*([\d.,]+)/i);
  const raw = labeled ? labeled[1] : (s.match(/[\d.,]+/) || [""])[0];
  if (!raw) return NaN;
  const seps = (raw.match(/[.,]/g) || []).length;
  if (seps === 1) {
    const dec = raw.match(/[.,](\d+)$/);
    if (dec && dec[1].length <= 2) return parseFloat(raw.replace(",", "."));
  }
  return parseFloat(raw.replace(/[.,]/g, ""));
}
function parsePrice(s) {
  s = (s || "").toString().toLowerCase();
  const labeled = s.match(/gi[aá]\s*:?\s*([\d.,]+\s*k?)/i);
  let core = labeled ? labeled[1] : s;
  core = core.replace(/[^0-9.,k]/g, "").trim();
  if (!core) return NaN;
  if (core.includes("k")) {
    const n = parseFloat(core.replace("k", "").replace(",", "."));
    return isNaN(n) ? NaN : Math.round(n * 1000);
  }
  const n = numOnly(core);
  if (isNaN(n)) return NaN;
  return n < 10000 ? n * 1000 : n;
}
function histDetail(h) {
  if (h.type === "Order" && h.jpy) {
    let s = `¥${Number(h.jpy).toLocaleString("vi-VN")} × ${h.rate}`;
    if (h.disc) s += ` - giảm ${h.disc}%`;
    return s;
  }
  if (h.type === "Hàng sẵn" && h.base) {
    return `Giá gốc: ${fmtK(h.base)}`;
  }
  return "";
}

const DEFAULT_DATA = { priceHist: [], lastRate: 202 };

export default function PricingPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, inp, iconBtn, chip } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, inp, iconBtn, chip };
  const perm = usePerm();
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [jpy, setJpy] = useState("");
  const [rate, setRate] = useState("202");
  const [disc, setDisc] = useState("");
  const [ready, setReadyPrice] = useState("");
  const [orderResult, setOrderResult] = useState(null); // { total, msg }
  const [readyResult, setReadyResult] = useState(null);
  const [editId, setEditId] = useState(null);
  const [ehPrice, setEhPrice] = useState("");
  const [ehNote, setEhNote] = useState("");
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const orderHistTimer = useRef(null);
  const readyHistTimer = useRef(null);
  // Không tải được lịch sử thì KHÔNG được lưu gì lên server — nếu không, lần
  // lưu kế tiếp sẽ ghi đè lịch sử thật trên server bằng danh sách rỗng đang
  // có trên máy. Syncer chỉ bắt đầu gửi sau khi init() (tải thành công), nên
  // tự động được bảo vệ. Máy tính giá thì vẫn dùng bình thường.
  const [loadFailed, setLoadFailed] = useState(false);
  // Chỉ gửi phần thay đổi lên server khi lưu — xem lib/syncer.js.
  const syncerRef = useRef(null);
  if (!syncerRef.current) syncerRef.current = createSyncer("/api/pricing", { onServerData: setData });

  function loadData() {
    loadDoc("/api/pricing")
      .then(({ data: d, etag }) => {
        const next = { ...DEFAULT_DATA, ...d };
        syncerRef.current.init(next, etag);
        setData(next);
        if (next.lastRate) setRate(String(next.lastRate));
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoaded(true));
  }
  useEffect(() => {
    loadData();
    return syncerRef.current.attachLifecycle();
  }, []);

  // Nhận cả giá trị thường lẫn hàm cập nhật kiểu setState(prev => ...) — dùng
  // hàm cập nhật ở những chỗ lưu có độ trễ (debounce tính giá tự động bên
  // dưới) để luôn tính từ state MỚI NHẤT, tránh lỗi ghi đè mất dữ liệu do
  // dùng nhầm "data" cũ chụp lại từ lúc bắt đầu chờ (đã từng gặp lỗi này ở
  // hàng Closet sẵn).
  function persist(nextOrFn) {
    setData((prev) => {
      const next = typeof nextOrFn === "function" ? nextOrFn(prev) : nextOrFn;
      syncerRef.current.schedule(next);
      return next;
    });
  }

  // Tự động tính giá ngay khi gõ (không cần bấm nút): hiện giá luôn cho mượt,
  // nhưng chỉ THẬT SỰ lưu vào lịch sử sau khi ngừng gõ ~900ms — nếu lưu ngay
  // từng phím gõ thì lịch sử sẽ bị spam đầy các giá trị gõ dở (VD gõ "1500"
  // sẽ tạo ra cả "1k, 15k, 150k, 1500k").
  useEffect(() => {
    const jpyN = numOnly(jpy) || 0;
    if (orderHistTimer.current) clearTimeout(orderHistTimer.current);
    if (jpyN <= 0) {
      setOrderResult(null);
      return;
    }
    const rateN = numOnly(rate) || 202;
    const discN = numOnly(disc) || 0;
    const total = roundUp5k(jpyN * rateN * (1 - discN / 100));
    const msg = `Mã này đang sale còn ${fmtK(total)} + KG ạ`;
    const altMsg = `Mã này giá ${fmtK(total)} + KG ạ`;
    setOrderResult({ total, msg, altMsg });
    orderHistTimer.current = setTimeout(() => {
      if (readRoleCookie() === "guest") return; // Khách: chỉ tính giá, không lưu lịch sử
      const h = { id: uid(), type: "Order", output: total, note: "", date: Date.now(), jpy: jpyN, rate: rateN, disc: discN, msg, altMsg };
      persist((prev) => ({ ...prev, priceHist: [h, ...prev.priceHist], lastRate: rateN }));
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jpy, rate, disc]);

  useEffect(() => {
    const base = (numOnly(ready) || 0) * 1000;
    if (readyHistTimer.current) clearTimeout(readyHistTimer.current);
    if (base <= 0) {
      setReadyResult(null);
      return;
    }
    const total = roundUp5k(base * 0.95);
    const msg = `Bên em sẵn đang giảm còn ${fmtK(total)} ạ`;
    setReadyResult({ total, msg });
    readyHistTimer.current = setTimeout(() => {
      if (readRoleCookie() === "guest") return;
      const h = { id: uid(), type: "Hàng sẵn", output: total, note: "", date: Date.now(), base, msg };
      persist((prev) => ({ ...prev, priceHist: [h, ...prev.priceHist] }));
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function copyMsg(msg) {
    if (!msg) return;
    navigator.clipboard.writeText(msg).catch(() => {});
  }

  function startEdit(h) {
    setEditId(h.id);
    setEhPrice(fmtK(h.output));
    setEhNote(h.note || "");
  }
  function cancelEdit() {
    setEditId(null);
  }
  function saveEdit(id) {
    const v = parsePrice(ehPrice);
    if (isNaN(v) || v <= 0) {
      alert("Giá chưa đúng, bác nhập như 405k giúp em ạ");
      return;
    }
    persist({
      ...data,
      priceHist: data.priceHist.map((h) => (h.id === id ? { ...h, output: v, note: ehNote.trim() } : h)),
    });
    setEditId(null);
  }
  function delHist(id) {
    persist({ ...data, priceHist: data.priceHist.filter((h) => h.id !== id) });
  }
  function delAllHist() {
    if (data.priceHist.length === 0) return;
    setConfirmDeleteAll(true);
  }
  function confirmDelAllHist() {
    persist({ ...data, priceHist: [] });
    setConfirmDeleteAll(false);
  }

  if (!loaded) {
    return <Loading />;
  }

  const fieldLabel = { fontSize: 12.5, fontWeight: 600, color: THEME.subtext, marginBottom: 5, display: "block" };
  const resultBox = { marginTop: 14, paddingTop: 14, borderTop: `1px solid ${THEME.line}` };
  const cardTitle = (Icon, text, sub) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: THEME.chipBg, color: THEME.brand, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15.5, color: THEME.text }}>{text}</div>
        {sub && <div style={{ fontSize: 12.5, color: THEME.subtext }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Tính giá" current="/pricing" maxWidth={900} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        {loadFailed && (
          <div
            style={{
              background: THEME.dangerBg,
              border: "1px solid #f3c9cb",
              color: THEME.danger,
              borderRadius: 12,
              padding: "10px 12px",
              marginBottom: 14,
              fontSize: 14,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <WifiOff size={17} style={{ flexShrink: 0 }} /> Không tải được lịch sử báo giá — vẫn tính giá bình thường, nhưng tạm chưa lưu lịch sử.
            </span>
            <button style={{ ...btnSub, flexShrink: 0 }} onClick={loadData}>
              <RotateCw size={15} /> Thử lại
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14, alignItems: "start" }}>
          <section style={{ ...card, padding: 18 }}>
            {cardTitle(Plane, "Báo giá hàng Order", "Giá Yên × tỷ giá, trừ % giảm nếu có")}
            <label style={fieldLabel} htmlFor="pr-jpy">Giá Yên (JPY)</label>
            <input id="pr-jpy" style={{ ...inp, marginBottom: 10, fontSize: 18, fontWeight: 600 }} inputMode="decimal" placeholder="VD: 5000" value={jpy} onChange={(e) => setJpy(e.target.value)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={fieldLabel} htmlFor="pr-rate">Tỷ giá</label>
                <input id="pr-rate" style={inp} inputMode="decimal" placeholder="202" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
              <div>
                <label style={fieldLabel} htmlFor="pr-disc">% Giảm (nếu có)</label>
                <input id="pr-disc" style={inp} inputMode="decimal" placeholder="0" value={disc} onChange={(e) => setDisc(e.target.value)} />
              </div>
            </div>
            {orderResult && (
              <div style={resultBox}>
                <div style={{ fontSize: 12.5, color: THEME.subtext, fontWeight: 600 }}>Giá báo khách</div>
                <div style={{ fontWeight: 700, fontSize: 30, color: THEME.brand, lineHeight: 1.2, margin: "2px 0 10px" }}>{fmtK(orderResult.total)}</div>
                <MsgRow text={orderResult.msg} T={T} />
                <MsgRow text={orderResult.altMsg} T={T} />
              </div>
            )}
          </section>

          <section style={{ ...card, padding: 18 }}>
            {cardTitle(PackageCheck, "Báo giá hàng sẵn", "Tự giảm 5%, làm tròn lên 5k")}
            <label style={fieldLabel} htmlFor="pr-ready">Giá gốc (nghìn VNĐ)</label>
            <input id="pr-ready" style={{ ...inp, fontSize: 18, fontWeight: 600 }} inputMode="decimal" placeholder="VD: 850 = 850.000đ" value={ready} onChange={(e) => setReadyPrice(e.target.value)} />
            {readyResult && (
              <div style={resultBox}>
                <div style={{ fontSize: 12.5, color: THEME.subtext, fontWeight: 600 }}>Giá sau giảm 5%</div>
                <div style={{ fontWeight: 700, fontSize: 30, color: THEME.brand, lineHeight: 1.2, margin: "2px 0 10px" }}>{fmtK(readyResult.total)}</div>
                <MsgRow text={readyResult.msg} T={T} />
              </div>
            )}
          </section>
        </div>

        <section style={{ ...card, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, display: "flex", alignItems: "center", gap: 8 }}>
              <History size={18} color={THEME.brand} /> Lịch sử báo giá gần đây
            </div>
            {perm.isAdmin && data.priceHist.length > 0 && (
              <button style={{ ...btnSub, flexShrink: 0, color: THEME.danger }} onClick={delAllHist}>
                <Trash2 size={15} /> Xoá tất cả
              </button>
            )}
          </div>
          {perm.role === "guest" && (
            <div style={{ fontSize: 13, color: THEME.subtext, marginBottom: 10 }}>Chế độ Khách: giá vừa tính sẽ không được lưu vào lịch sử.</div>
          )}
          {data.priceHist.length === 0 ? (
            <div style={{ color: THEME.subtext, fontSize: 14 }}>Chưa có lịch sử</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.priceHist.slice(0, 20).map((h) => {
                const detail = histDetail(h);
                const isEdit = perm.canEdit && editId === h.id;
                if (isEdit) {
                  return (
                    <div key={h.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, background: THEME.surfaceAlt, border: `1px solid ${THEME.chipLine}` }}>
                      <span style={{ fontWeight: 600 }}>{h.type}:</span>
                      <input
                        style={{ ...inp, width: 110 }}
                        value={ehPrice}
                        onChange={(e) => setEhPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(h.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <input
                        style={{ ...inp, flex: 1, minWidth: 140 }}
                        placeholder="Ghi chú"
                        value={ehNote}
                        onChange={(e) => setEhNote(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(h.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button style={{ ...btn, padding: "7px 14px" }} onClick={() => saveEdit(h.id)}>
                        <Check size={15} /> Lưu
                      </button>
                      <button style={{ ...btnSub, padding: "7px 14px" }} onClick={cancelEdit}>
                        Huỷ
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={h.id} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${THEME.line}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ ...T.chip, fontSize: 11.5, ...(h.type === "Hàng sẵn" ? { background: THEME.successBg, borderColor: THEME.successLine, color: THEME.success } : {}) }}>{h.type}</span>
                          <b style={{ color: THEME.brand, fontSize: 16, fontWeight: 700 }}>{fmtK(h.output)}</b>
                          {h.note ? <span style={{ color: THEME.subtext, fontSize: 13.5 }}>— {h.note}</span> : null}
                        </div>
                        {detail && <div style={{ fontSize: 12.5, color: THEME.subtext, marginTop: 3 }}>{detail}</div>}
                      </div>
                      {(perm.canEdit || perm.canDelete) && (
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {perm.canEdit && (
                            <button style={{ ...iconBtn, width: 30, height: 30 }} title="Sửa" aria-label="Sửa" onClick={() => startEdit(h)}>
                              <Pencil size={14} />
                            </button>
                          )}
                          {perm.canDelete && (
                            <button style={{ ...iconBtn, width: 30, height: 30, color: THEME.danger }} title="Xoá" aria-label="Xoá" onClick={() => delHist(h.id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {(h.msg || h.altMsg) && (
                      <div style={{ marginTop: 8 }}>
                        {h.msg && <MsgRow text={h.msg} T={T} small />}
                        {h.altMsg && <MsgRow text={h.altMsg} T={T} small />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmDeleteAll}
        message="Xoá toàn bộ lịch sử báo giá? Không thể hoàn tác."
        onCancel={() => setConfirmDeleteAll(false)}
        onConfirm={confirmDelAllHist}
      />
    </main>
  );
}

// 1 câu báo giá kèm nút "Chép" (đổi thành "Đã chép" 1.5 giây sau khi bấm).
function MsgRow({ text, T, small }) {
  const { THEME, btnSub } = T;
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 10, padding: small ? "6px 6px 6px 10px" : "8px 8px 8px 12px", marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: small ? 13.5 : 14.5 }}>
      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word", lineHeight: 1.45 }}>{text}</span>
      <button
        style={{ ...btnSub, flexShrink: 0, padding: small ? "4px 9px" : "6px 11px", fontSize: 13, color: copied ? THEME.success : THEME.text }}
        title="Sao chép"
        onClick={() => {
          if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}
