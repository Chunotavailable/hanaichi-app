// pages/pricing.js — Báo giá nhanh
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme, makeStyles, ThemeToggle, Loading } from "../lib/theme";
import { playTick, playSuccess, playDelete, playClick } from "../lib/sound";

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
  const { card, btn, btnSub, inp } = makeStyles(THEME);
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
  const saveTimer = useRef(null);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => {
        const next = { ...DEFAULT_DATA, ...d };
        setData(next);
        if (next.lastRate) setRate(String(next.lastRate));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function persist(next) {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
        .then((r) => {
          if (!r.ok) throw new Error("save failed");
        })
        .catch(() => {
          alert("⚠️ KHÔNG lưu được thay đổi vừa rồi! Kiểm tra lại kết nối mạng hoặc dung lượng Blob Storage trên Vercel, rồi thử lại giúp em ạ.");
        });
    }, 250);
  }

  function calcOrder() {
    const jpyN = numOnly(jpy) || 0;
    const rateN = numOnly(rate) || 202;
    const discN = numOnly(disc) || 0;
    if (jpyN <= 0) {
      alert("Bác nhập giá Yên giúp em ạ");
      return;
    }
    const total = roundUp5k(jpyN * rateN * (1 - discN / 100));
    const msg = `Dạ mã này đang sale còn ${fmtK(total)} + KG ạ`;
    setOrderResult({ total, msg });
    const h = { id: uid(), type: "Order", output: total, note: "", date: Date.now(), jpy: jpyN, rate: rateN, disc: discN, msg };
    persist({ ...data, priceHist: [h, ...data.priceHist], lastRate: rateN });
    playSuccess();
  }

  function calcReady() {
    const base = (numOnly(ready) || 0) * 1000;
    if (base <= 0) {
      alert("Bác nhập giá gốc giúp em ạ");
      return;
    }
    const total = roundUp5k(base * 0.95);
    const msg = `Dạ bên em sẵn đang giảm còn ${fmtK(total)} ạ`;
    setReadyResult({ total, msg });
    const h = { id: uid(), type: "Hàng sẵn", output: total, note: "", date: Date.now(), base, msg };
    persist({ ...data, priceHist: [h, ...data.priceHist] });
    playSuccess();
  }

  function copyMsg(msg) {
    if (!msg) return;
    playClick();
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
    playTick();
  }
  function delHist(id) {
    persist({ ...data, priceHist: data.priceHist.filter((h) => h.id !== id) });
    playDelete();
  }

  if (!loaded) {
    return <Loading />;
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <header style={{ background: `linear-gradient(135deg, ${THEME.brand}18, ${THEME.bg})`, borderBottom: `1px solid ${THEME.line}` }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, margin: 0, fontFamily: THEME.headingFont }}>💰 Báo giá nhanh</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" style={{ ...btnSub, textDecoration: "none" }}>🏠 Trang chủ</Link>
            <Link href="/gomcan" style={{ ...btnSub, textDecoration: "none" }}>🧮 Giá gồm cân</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px" }}>
        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Phần 1: Báo giá Order</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input style={inp} inputMode="decimal" placeholder="Giá Yên (JPY)" value={jpy} onChange={(e) => setJpy(e.target.value)} onKeyDown={(e) => e.key === "Enter" && calcOrder()} />
            <input style={inp} inputMode="decimal" placeholder="Tỷ giá" value={rate} onChange={(e) => setRate(e.target.value)} onKeyDown={(e) => e.key === "Enter" && calcOrder()} />
            <input style={inp} inputMode="decimal" placeholder="% Giảm giá (nếu có)" value={disc} onChange={(e) => setDisc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && calcOrder()} />
          </div>
          <button style={{ ...btn, marginTop: 10 }} onClick={calcOrder}>
            Tính giá
          </button>
          {orderResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: THEME.brand }}>Giá: {fmtK(orderResult.total)}</div>
              <div style={{ background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: 10, marginTop: 6, fontSize: 14 }}>{orderResult.msg}</div>
              <button style={{ ...btn, marginTop: 8 }} onClick={() => copyMsg(orderResult.msg)}>
                📋 Copy câu báo giá
              </button>
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Phần 2: Báo giá Hàng sẵn (giảm 5%)</div>
          <input style={inp} inputMode="decimal" placeholder="Giá gốc (nghìn VNĐ), VD: 850 = 850.000đ" value={ready} onChange={(e) => setReadyPrice(e.target.value)} onKeyDown={(e) => e.key === "Enter" && calcReady()} />
          <button style={{ ...btn, marginTop: 10 }} onClick={calcReady}>
            Tính giá
          </button>
          {readyResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: THEME.brand }}>Giá sau giảm 5%: {fmtK(readyResult.total)}</div>
              <div style={{ background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: 10, marginTop: 6, fontSize: 14 }}>{readyResult.msg}</div>
              <button style={{ ...btn, marginTop: 8 }} onClick={() => copyMsg(readyResult.msg)}>
                📋 Copy câu báo giá
              </button>
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Lịch sử báo giá gần đây</div>
          {data.priceHist.length === 0 ? (
            <div style={{ color: THEME.subtext, fontSize: 15 }}>Chưa có lịch sử</div>
          ) : (
            data.priceHist.slice(0, 20).map((h) => {
              const detail = histDetail(h);
              const isEdit = editId === h.id;
              if (isEdit) {
                return (
                  <div key={h.id} className="hnCard" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, borderBottom: `1px solid ${THEME.line}`, padding: "8px 0" }}>
                    <span style={{ fontWeight: 700 }}>{h.type}:</span>
                    <input
                      style={{ ...inp, width: 100 }}
                      value={ehPrice}
                      onChange={(e) => setEhPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(h.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <input
                      style={{ ...inp, flex: 1, minWidth: 120 }}
                      placeholder="Ghi chú"
                      value={ehNote}
                      onChange={(e) => setEhNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(h.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <button style={btnSub} onClick={() => saveEdit(h.id)}>Lưu</button>
                    <button style={btnSub} onClick={cancelEdit}>Hủy</button>
                  </div>
                );
              }
              return (
                <div key={h.id} className="hnCard" style={{ borderBottom: `1px solid ${THEME.line}`, padding: "8px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span>
                        {h.type}: <b style={{ color: THEME.brand }}>{fmtK(h.output)}</b>
                        <button style={{ ...btnSub, padding: "1px 9px", fontSize: 12, marginLeft: 6 }} title="Sửa" onClick={() => startEdit(h)}>
                          ✏️
                        </button>
                        {h.note ? <span style={{ color: THEME.subtext }}> — {h.note}</span> : null}
                      </span>
                      {detail && <div style={{ fontSize: 13, color: THEME.subtext, marginTop: 2 }}>{detail}</div>}
                    </div>
                    <button style={{ ...btnSub, flexShrink: 0 }} onClick={() => delHist(h.id)}>
                      Xóa
                    </button>
                  </div>
                  {h.msg && (
                    <div style={{ marginTop: 6, background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 14 }}>
                      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{h.msg}</span>
                      <button style={{ ...btnSub, flexShrink: 0, padding: "1px 9px", fontSize: 12 }} title="Copy" onClick={() => copyMsg(h.msg)}>
                        📋
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
