// lib/DysonGuide.js
// Tab "Dyson" trong Giá gồm cân (cạnh Gia dụng, Onitsuka, Uniqlo + GU). Nội dung là các bài so sánh của
// sếp, lấy từ tab "SO SÁNH CÁC DÒNG HÚT BỤI DYSON" trong file gốc (đối chiếu giống tab Gia dụng, xem
// lib/dysonSheet.js). Mỗi bài gập sẵn, bấm vào mới mở; có nút Chép để gửi nguyên văn cho khách.
import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Sparkles } from "lucide-react";
import { SEED_DYSON } from "./dysonSeed";

// Tách phần "Nên chọn loại nào?" ra thành ô nổi bật riêng (nếu bài có).
function splitBody(body) {
  const m = body.match(/\n*(Nên chọn loại nào\?[^\n]*)\n?([\s\S]*)$/);
  if (!m) return { main: body, pick: "" };
  return { main: body.slice(0, m.index).trim(), pick: (m[2] || "").trim() };
}

function Guide({ g, T }) {
  const { THEME, btnSub } = T;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { main, pick } = splitBody(g.body);
  function copy() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(`${g.title}\n\n${g.body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div style={{ border: `1px solid ${THEME.line}`, borderRadius: 12, background: THEME.surface, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px", cursor: "pointer" }}
      >
        {open ? <ChevronDown size={17} color={THEME.muted} /> : <ChevronRight size={17} color={THEME.muted} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: THEME.text, lineHeight: 1.35 }}>{g.title}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: THEME.text, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{main}</div>
          {pick && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5 }}>
              <Sparkles size={16} color={THEME.brand} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                <b>Nên chọn loại nào? </b>
                {"\n" + pick}
              </span>
            </div>
          )}
          <button style={{ ...btnSub, alignSelf: "flex-start", padding: "6px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text }} onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép để gửi khách"}
          </button>
        </div>
      )}
    </div>
  );
}

// items: data.dyson (đã đối chiếu từ file); chưa có thì dùng bản chụp sẵn.
export default function DysonGuide({ items, T }) {
  const list = items && items.length ? items : SEED_DYSON;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {list.map((g) => (
        <Guide key={g.id} g={g} T={T} />
      ))}
    </div>
  );
}
