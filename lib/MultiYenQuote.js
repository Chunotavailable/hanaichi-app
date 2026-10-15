// lib/MultiYenQuote.js
// Khung "Báo giá nhiều giá Yên" trong Giá gồm cân (tab Gia dụng): sản phẩm có nhiều phân loại, mỗi loại
// một giá Yên. Giá = Yên × tỷ giá, trừ % giảm nếu có, làm tròn lên 5k (cùng công thức với trang Tính giá).
// Gập sẵn cho gọn; tỷ giá nhớ trong máy. Ô % giảm đang có số thì bôi đỏ để khỏi quên xoá.
import { useState } from "react";
import { ChevronDown, ChevronRight, Layers, Plus, X, Copy, Check } from "lucide-react";

const roundUp5k = (n) => Math.ceil(n / 5000) * 5000;
function fmtK(n) {
  const k = n / 1000;
  return (Number.isInteger(k) ? k : Math.round(k * 10) / 10).toString().replace(".", ",") + "k";
}
function numOnly(s) {
  s = (s || "").toString();
  const raw = (s.match(/[\d.,]+/) || [""])[0];
  if (!raw) return NaN;
  const seps = (raw.match(/[.,]/g) || []).length;
  if (seps === 1) {
    const dec = raw.match(/[.,](\d+)$/);
    if (dec && dec[1].length <= 2) return parseFloat(raw.replace(",", "."));
  }
  return parseFloat(raw.replace(/[.,]/g, ""));
}
const RATE_KEY = "hnMultiYenRate";
const readRate = () => {
  try {
    return localStorage.getItem(RATE_KEY) || "202";
  } catch {
    return "202";
  }
};
const blankRows = () => [
  { label: "", jpy: "" },
  { label: "", jpy: "" },
];

function CopyRow({ text, T }) {
  const { THEME, btnSub } = T;
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 10, padding: "8px 8px 8px 12px", marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 14 }}>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</span>
      <button
        style={{ ...btnSub, flexShrink: 0, padding: "6px 11px", fontSize: 13, color: copied ? THEME.success : THEME.text }}
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

export default function MultiYenQuote({ T }) {
  const { THEME, card, btnSub, inp, iconBtn } = T;
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState("202");
  const [disc, setDisc] = useState("");
  const [rows, setRows] = useState(blankRows);

  const r = numOnly(rate) || 202;
  const d = numOnly(disc) || 0;
  const priceOf = (jpy) => ((numOnly(jpy) || 0) > 0 ? roundUp5k(numOnly(jpy) * r * (1 - d / 100)) : 0);
  const done = rows.map((x, i) => ({ label: x.label.trim() || `Loại ${i + 1}`, total: priceOf(x.jpy) })).filter((x) => x.total > 0);
  let detail = "";
  let short = "";
  if (done.length) {
    const prices = done.map((x) => x.total);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const sale = d > 0 ? "đang sale " : "";
    detail = `Mã này ${sale}có nhiều mức giá ạ:\n${done.map((x) => `${x.label}: ${fmtK(x.total)}`).join("\n")}\n(giá trên chưa gồm KG)`;
    short = `Mã này ${sale}giá ${min === max ? fmtK(min) : `${fmtK(min)} - ${fmtK(max)}`} + KG ạ`;
  }
  const setRow = (i, patch) => setRows((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const lbl = { fontSize: 12.5, fontWeight: 600, color: THEME.subtext, marginBottom: 5, display: "block" };

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => {
          // Đọc tỷ giá đã nhớ ở máy khi mở khung lần đầu (không đọc lúc render để khỏi lệch với server).
          if (!open) setRate(readRate());
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        style={{ all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", border: `1px solid ${d > 0 ? THEME.danger : THEME.line}`, borderRadius: 12, background: THEME.surfaceAlt }}
      >
        <Layers size={17} color={THEME.brand} />
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: THEME.text }}>
          Báo giá nhiều giá Yên{" "}
          <span style={{ fontWeight: 500, color: d > 0 ? THEME.danger : THEME.subtext, fontSize: 12.5 }}>{d > 0 ? `(đang trừ ${d}% giảm)` : "(sản phẩm nhiều phân loại)"}</span>
        </span>
        {open ? <ChevronDown size={18} color={THEME.muted} /> : <ChevronRight size={18} color={THEME.muted} />}
      </button>
      {open && (
        <div style={{ ...card, padding: 14, marginTop: 8 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl} htmlFor="my-rate">
                Tỷ giá
              </label>
              <input
                id="my-rate"
                style={inp}
                inputMode="decimal"
                value={rate}
                onChange={(e) => {
                  setRate(e.target.value);
                  try {
                    localStorage.setItem(RATE_KEY, e.target.value);
                  } catch {}
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...lbl, ...(d > 0 ? { color: THEME.danger, fontWeight: 700 } : null) }} htmlFor="my-disc">
                {d > 0 ? "⚠ % Giảm đang áp dụng" : "% Giảm (nếu có)"}
              </label>
              <input
                id="my-disc"
                style={{ ...inp, ...(d > 0 ? { border: `2px solid ${THEME.danger}`, background: THEME.dangerBg, color: THEME.danger, fontWeight: 700 } : null) }}
                inputMode="decimal"
                placeholder="0"
                value={disc}
                onChange={(e) => setDisc(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.map((x, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input style={{ ...inp, flex: 1.2, minWidth: 0 }} placeholder={`Tên loại ${i + 1} (không bắt buộc)`} value={x.label} onChange={(e) => setRow(i, { label: e.target.value })} />
                <input style={{ ...inp, flex: 1, minWidth: 0, fontWeight: 600 }} inputMode="decimal" placeholder="Giá Yên" value={x.jpy} onChange={(e) => setRow(i, { jpy: e.target.value })} />
                <span style={{ width: 62, textAlign: "right", fontWeight: 700, color: THEME.brand, fontSize: 14, flexShrink: 0 }}>{priceOf(x.jpy) ? fmtK(priceOf(x.jpy)) : ""}</span>
                {rows.length > 2 && (
                  <button style={{ ...iconBtn, flexShrink: 0 }} onClick={() => setRows((m) => m.filter((_, j) => j !== i))} title="Xoá dòng" aria-label="Xoá dòng">
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button style={btnSub} onClick={() => setRows((m) => [...m, { label: "", jpy: "" }])}>
              <Plus size={15} /> Thêm giá
            </button>
            <button
              style={btnSub}
              onClick={() => {
                setRows(blankRows());
                setDisc("");
              }}
            >
              Làm lại
            </button>
          </div>
          {detail && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${THEME.line}` }}>
              <div style={{ fontSize: 12.5, color: THEME.subtext, fontWeight: 600 }}>Câu báo giá</div>
              <CopyRow text={detail} T={T} />
              <CopyRow text={short} T={T} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
