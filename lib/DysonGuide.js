// lib/DysonGuide.js
// Tab "Dyson" trong Giá gồm cân (cạnh Gia dụng, Onitsuka, Uniqlo + GU). Nội dung là các bài so sánh của
// sếp, lấy từ tab "SO SÁNH CÁC DÒNG HÚT BỤI DYSON" trong file gốc (đối chiếu giống tab Gia dụng, xem
// lib/dysonSheet.js). Bài là chữ thường sếp gõ tay, nên ở đây đọc từng dòng rồi dàn lại cho dễ nhìn:
//   👌 dòng máy  -> thẻ riêng có tên máy nổi bật      💕 / 🌈 -> tiêu đề mục
//   - gạch đầu dòng -> danh sách                       -> ...  -> ô tổng kết
//   "Nên chọn loại nào?" -> ô khuyên chọn ở cuối
// Mỗi bài gập sẵn (bài đầu mở sẵn), có nút Chép để gửi nguyên văn cho khách.
import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { SEED_DYSON } from "./dysonSeed";

const PICK_RE = /\n*Nên chọn loại nào\?[^\n]*\n?([\s\S]*)$/;

// -> [{ t: "head"|"model"|"bullet"|"sum"|"p", text, name? }]
function parseBlocks(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(💕|🌈)/.test(line)) out.push({ t: "head", text: line.replace(/^(💕|🌈)\s*/, "") });
    else if (line.startsWith("👌")) {
      const body = line.replace(/^👌\s*/, "");
      const m = body.match(/^(.+?)\s+(Gồm|Chỉ|có|Có)\s+([\s\S]*)$/);
      out.push(m ? { t: "model", name: m[1], text: `${m[2][0].toUpperCase()}${m[2].slice(1)} ${m[3]}` } : { t: "model", name: "", text: body });
    } else if (line.startsWith("->")) out.push({ t: "sum", text: line.replace(/^->\s*/, "") });
    else if (/^-\s/.test(line)) out.push({ t: "bullet", text: line.replace(/^-\s+/, "") });
    else out.push({ t: "p", text: line });
  }
  return out;
}

// Bôi đậm phần mở đầu của câu: "Ưu điểm là", "Nhược điểm:", "Chọn Dyson V10 nếu".
function Lead({ text, THEME }) {
  const m = text.match(/^(Ưu điểm|Nhược điểm)\b[ :là]*|^(Chọn [^,]+? nếu)\b/);
  if (!m) return text;
  const lead = m[0];
  const color = /^Ưu/.test(lead) ? THEME.success : /^Nhược/.test(lead) ? THEME.danger : THEME.brand;
  return (
    <>
      <b style={{ color }}>{lead.replace(/\s+$/, "")}</b>
      {text.slice(lead.replace(/\s+$/, "").length)}
    </>
  );
}

function Blocks({ blocks, THEME }) {
  const rows = [];
  let list = [];
  const flush = () => {
    if (!list.length) return;
    rows.push(
      <div key={`l${rows.length}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((b, i) => {
          const Icon = /^Ưu điểm/.test(b.text) ? ThumbsUp : /^Nhược điểm/.test(b.text) ? ThumbsDown : null;
          const dot = /^Ưu điểm/.test(b.text) ? THEME.success : /^Nhược điểm/.test(b.text) ? THEME.danger : THEME.brand;
          return (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13.5, lineHeight: 1.55, color: THEME.text }}>
              {Icon ? <Icon size={14} color={dot} style={{ flexShrink: 0, marginTop: 4 }} /> : <span style={{ width: 6, height: 6, borderRadius: 3, background: dot, opacity: 0.7, flexShrink: 0, marginTop: 8 }} />}
              <span style={{ flex: 1, overflowWrap: "anywhere" }}>
                <Lead text={b.text} THEME={THEME} />
              </span>
            </div>
          );
        })}
      </div>
    );
    list = [];
  };
  blocks.forEach((b, i) => {
    if (b.t === "bullet") return list.push(b);
    flush();
    if (b.t === "head")
      rows.push(
        <div key={i} style={{ fontSize: 14, fontWeight: 700, color: THEME.brand, marginTop: 4, paddingBottom: 4, borderBottom: `1px solid ${THEME.line}` }}>
          {b.text}
        </div>
      );
    else if (b.t === "model")
      rows.push(
        <div key={i} style={{ background: THEME.surfaceAlt, borderLeft: `3px solid ${THEME.brand}`, borderRadius: 10, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.5, color: THEME.text, overflowWrap: "anywhere" }}>
          {b.name && <div style={{ fontWeight: 700, color: THEME.brand, fontSize: 14, marginBottom: 2 }}>{b.name}</div>}
          {b.text}
        </div>
      );
    else if (b.t === "sum")
      rows.push(
        <div key={i} style={{ background: THEME.surfaceAlt, border: `1px dashed ${THEME.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.55, color: THEME.text, overflowWrap: "anywhere" }}>
          <b>Tóm lại: </b>
          {b.text}
        </div>
      );
    else
      rows.push(
        <div key={i} style={{ fontSize: 13.5, lineHeight: 1.6, color: THEME.text, overflowWrap: "anywhere" }}>
          {b.text}
        </div>
      );
  });
  flush();
  return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{rows}</div>;
}

function Guide({ g, n, defaultOpen, T }) {
  const { THEME, btnSub } = T;
  const [open, setOpen] = useState(!!defaultOpen);
  const [copied, setCopied] = useState(false);
  const pm = g.body.match(PICK_RE);
  const main = pm ? g.body.slice(0, pm.index) : g.body;
  const pickLines = pm ? parseBlocks(pm[1]) : [];
  function copy() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(`${g.title}\n\n${g.body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div style={{ border: `1px solid ${open ? THEME.brand : THEME.line}`, borderRadius: 14, background: THEME.surface, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px", cursor: "pointer" }}
      >
        <span style={{ width: 26, height: 26, borderRadius: 13, background: THEME.brand, color: "#fff", fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{n}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: THEME.text, lineHeight: 1.35 }}>{g.title}</span>
        {open ? <ChevronDown size={18} color={THEME.muted} /> : <ChevronRight size={18} color={THEME.muted} />}
      </button>
      {open && (
        <div style={{ padding: "2px 12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          <Blocks blocks={parseBlocks(main)} THEME={THEME} />
          {pm && (
            <div style={{ background: THEME.surfaceAlt, border: `1px solid ${THEME.brand}`, borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, color: THEME.brand, marginBottom: 6 }}>
                <Sparkles size={16} /> Nên chọn loại nào?
              </div>
              <Blocks blocks={pickLines.map((b) => (b.t === "p" ? { ...b, t: "bullet" } : b))} THEME={THEME} />
            </div>
          )}
          <button style={{ ...btnSub, alignSelf: "flex-start", padding: "6px 12px", fontSize: 13, color: copied ? THEME.success : THEME.text }} onClick={copy}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {list.map((g, i) => (
        <Guide key={g.id} g={g} n={i + 1} defaultOpen={i === 0} T={T} />
      ))}
    </div>
  );
}
