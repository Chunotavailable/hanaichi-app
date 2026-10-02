// lib/CodeFinder.js — Ô "Tìm mã sản phẩm từ ảnh" cho hàng Order (trang Tính giá).
// Dán ảnh khách gửi (Ctrl+V) -> đọc mã ngay trên máy -> các nút mở thẳng trang tìm kiếm của Nike JP, Rakuten, Amazon JP...
// Hoàn toàn chạy trên trình duyệt, không gọi máy chủ nên không tốn giới hạn Cloudflare.
import { useEffect, useState } from "react";
import { Search, ExternalLink, Copy, Check, X, Plus, ClipboardPaste } from "lucide-react";
import { useImageCodeSearch } from "./imageCode";
import { showToast } from "./gomcanHelpers";

const BUILTIN = [
  { name: "Nike JP", url: "https://www.nike.com/jp/w?q={code}" },
  { name: "Rakuten", url: "https://search.rakuten.co.jp/search/mall/{code}/" },
  { name: "Amazon JP", url: "https://www.amazon.co.jp/s?k={code}" },
  { name: "Adidas JP", url: "https://www.google.com/search?q={code}+site%3Aadidas.jp" },
  { name: "Google", url: "https://www.google.com/search?q={code}" },
  { name: "Google ảnh", url: "https://www.google.com/search?tbm=isch&q={code}" },
];
const LS = "hnCodeSites";

function loadCustom() {
  try { const v = JSON.parse(localStorage.getItem(LS) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
function cleanDomain(s) {
  return String(s || "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\s+/g, "").replace(/\/+$/, "");
}

export default function CodeFinder({ T, cardTitle }) {
  const { THEME, card, btn, btnSub, inp } = T;
  const [code, setCode] = useState("");
  const [alts, setAlts] = useState([]);
  const [custom, setCustom] = useState([]);
  const [newSite, setNewSite] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setCustom(loadCustom()), []);
  const [preview, setPreview] = useState("");
  useImageCodeSearch((c, all, file) => {
    setCode(c);
    setAlts((all || []).slice(1, 4));
    if (file) setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
  });

  function saveCustom(next) {
    setCustom(next);
    try { localStorage.setItem(LS, JSON.stringify(next)); } catch {}
  }
  function addSite() {
    const d = cleanDomain(newSite);
    if (!d || !/\./.test(d)) return showToast("Nhập tên web, ví dụ: asics.com/jp");
    if (custom.includes(d)) return setNewSite("");
    saveCustom([...custom, d]);
    setNewSite("");
  }
  const c = code.trim();
  const enc = encodeURIComponent(c);
  const sites = [
    ...BUILTIN.map((s) => ({ key: s.name, name: s.name, href: s.url.replace("{code}", enc) })),
    ...custom.map((d) => ({ key: "c:" + d, name: d, custom: true, href: `https://www.google.com/search?q=${enc}+site%3A${encodeURIComponent(d)}` })),
  ];
  const linkStyle = { ...btnSub, textDecoration: "none", opacity: c ? 1 : 0.45, pointerEvents: c ? "auto" : "none" };

  return (
    <section style={{ ...card, padding: 18, marginBottom: 14 }}>
      {cardTitle(Search, "Tìm mã sản phẩm từ ảnh", "Dán ảnh khách gửi (Ctrl+V) hoặc gõ mã, rồi bấm trang muốn tìm")}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input
          style={{ ...inp, flex: "1 1 220px", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}
          placeholder="VD: HV9972-003"
          value={code}
          onChange={(e) => { setCode(e.target.value); setAlts([]); }}
          aria-label="Mã sản phẩm"
        />
        <button
          style={btnSub}
          disabled={!c}
          onClick={() => { try { navigator.clipboard.writeText(c); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép mã"}
        </button>
      </div>
      {preview && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, fontSize: 13, color: THEME.subtext }}>
          <img src={preview} alt="Ảnh vừa dán" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: `1px solid ${THEME.line}` }} />
          <span>Ảnh vừa dán — nhìn mã trong ảnh và so với ô trên cho chắc trước khi tìm.</span>
        </div>
      )}
      {!c && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: THEME.subtext, marginBottom: 10 }}>
          <ClipboardPaste size={16} style={{ flexShrink: 0 }} /> Sao chép ảnh khách gửi rồi bấm Ctrl+V ở trang này, web sẽ tự đọc mã.
        </div>
      )}
      {alts.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: 13, color: THEME.subtext }}>
          Mã khác trong ảnh:
          {alts.map((a) => (
            <button key={a} style={{ ...btnSub, padding: "4px 10px", fontSize: 13 }} onClick={() => { setAlts([code, ...alts.filter((x) => x !== a)].slice(0, 3)); setCode(a); }}>{a}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {sites.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <a href={c ? s.href : undefined} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              <ExternalLink size={14} /> {s.name}
            </a>
            {s.custom && (
              <button aria-label={`Bỏ ${s.name}`} title="Bỏ trang này" style={{ border: 0, background: "transparent", color: THEME.subtext, cursor: "pointer", padding: 4 }} onClick={() => saveCustom(custom.filter((d) => d !== s.name))}>
                <X size={14} />
              </button>
            )}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <input
          style={{ ...inp, flex: "1 1 200px", fontSize: 14 }}
          placeholder="Thêm web chính hãng, VD: asics.com/jp"
          value={newSite}
          onChange={(e) => setNewSite(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSite()}
          aria-label="Thêm trang web"
        />
        <button style={btnSub} onClick={addSite}><Plus size={15} /> Thêm web</button>
      </div>
    </section>
  );
}
