// lib/CodeFinder.js — Ô "Tìm mã sản phẩm từ ảnh" cho hàng Order (trang Tính giá).
// Dán ảnh khách gửi (Ctrl+V) -> đọc mã ngay trên máy -> các nút mở thẳng trang tìm kiếm của Nike JP, Rakuten, Amazon JP...
// Hoàn toàn chạy trên trình duyệt, không gọi máy chủ nên không tốn giới hạn Cloudflare.
import { useEffect, useRef, useState } from "react";
import { Search, ExternalLink, Copy, Check, X, Plus, ClipboardPaste, Image as ImageIcon } from "lucide-react";
import { useImageCodeSearch, readCodesFromRegion, codesFromFile } from "./imageCode";
import { showToast } from "./gomcanHelpers";
import { usePerm } from "./perm";

const BUILTIN = [
  { name: "Nike JP", url: "https://www.nike.com/jp/w?q={code}" },
  { name: "Rakuten", url: "https://search.rakuten.co.jp/search/mall/{code}/" },
  { name: "Amazon JP", url: "https://www.amazon.co.jp/s?k={code}" },
  { name: "Adidas JP", url: "https://www.google.com/search?q={code}+site%3Aadidas.jp" },
  { name: "Uniqlo JP", url: "https://www.google.com/search?q={code}+site%3Auniqlo.com%2Fjp" },
  { name: "GU JP", url: "https://www.google.com/search?q={code}+site%3Agu-global.com%2Fjp" },
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
  const perm = usePerm();
  const [code, setCode] = useState("");
  const [alts, setAlts] = useState([]);
  const [shop, setShop] = useState(null); // { shop, slug } khi ảnh ghi "TÊN SHOP: tên-sản-phẩm" (Rakuten)
  const [note, setNote] = useState(""); // ghi chú tự gõ để tìm khi ảnh không có mã (VD: áo khoác nâu nữ)
  const [manShop, setManShop] = useState(""); // tự điền khi ảnh chỉ có mã sản phẩm
  const [manName, setManName] = useState("");
  const [custom, setCustom] = useState([]);
  const [newSite, setNewSite] = useState("");
  const [copied, setCopied] = useState(false);
  const etagRef = useRef("");
  // Danh sách web nằm trên máy chủ để Khách cũng thấy; trước đây lưu trên từng máy (localStorage) -> Quản lý tự chuyển lên 1 lần.
  useEffect(() => {
    let dead = false;
    fetch("/api/codesites", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        etagRef.current = r.headers.get("x-hn-etag") || "";
        const d = await r.json();
        let list = Array.isArray(d.sites) ? d.sites : [];
        if (!list.length && perm.isAdmin) {
          const old = loadCustom();
          if (old.length) { list = old; pushSites(old); }
        }
        if (!dead) setCustom(list);
      })
      .catch(() => { if (!dead) setCustom(loadCustom()); });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function pushSites(list) {
    fetch("/api/codesites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sites: list }) })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => showToast("Chưa lưu được danh sách web lên máy chủ, thử lại sau"));
  }
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState(null);
  const [sel, setSel] = useState(null); // ô đang kéo, theo toạ độ trên màn hình (px trong khung ảnh)
  const [reading, setReading] = useState(false);
  const [fail, setFail] = useState(null); // thông tin chẩn đoán khi vùng khoanh không đọc ra chữ
  const imgRef = useRef(null);
  const dragRef = useRef(null);
  const onCodeFound = (c, all, file, meta) => {
    setCode(c);
    setShop(meta || null);
    setAlts((all || []).slice(1, 4));
    if (file) { setFile(file); setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); }); }
  };
  useImageCodeSearch(onCodeFound);
  const pickRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  function useFile(f) {
    if (f && /^image\//.test(f.type)) codesFromFile(f, onCodeFound);
    else if (f) showToast("File này không phải ảnh");
  }
  async function pasteFromButton() {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const t = it.types.find((x) => x.startsWith("image/"));
        if (t) return useFile(new File([await it.getType(t)], "anh.png", { type: t }));
      }
      showToast("Chưa thấy ảnh nào được sao chép. Chuột phải vào ảnh → Sao chép ảnh, rồi bấm lại nút này.", 6000);
    } catch {
      showToast("Trình duyệt chưa cho đọc ảnh đã sao chép — bấm Ctrl+V, hoặc dùng 'Chọn ảnh từ máy'.", 6000);
    }
  }

  // Tìm bằng hình trên Google Lens: web không đưa được ảnh sang Google qua đường dẫn, nên chép ảnh vào bộ nhớ tạm rồi mở Lens để bấm Ctrl+V (hoặc "Dán").
  function openLens() {
    if (!file) return;
    const toPng = async () => {
      if (file.type === "image/png") return file;
      const bmp = await createImageBitmap(file);
      const cv = document.createElement("canvas");
      cv.width = bmp.width; cv.height = bmp.height;
      cv.getContext("2d").drawImage(bmp, 0, 0);
      return await new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("png"))), "image/png"));
    };
    let copied = false;
    try {
      navigator.clipboard.write([new ClipboardItem({ "image/png": toPng() })]).then(
        () => showToast("Đã chép ảnh — trên trang Google Lens bấm Ctrl+V (điện thoại: bấm giữ rồi chọn Dán)", 7000, "info"),
        () => showToast("Chưa chép được ảnh — trên trang Google Lens hãy bấm 'tải ảnh lên' và chọn ảnh", 7000)
      );
      copied = true;
    } catch {}
    if (!copied) showToast("Trình duyệt chưa cho chép ảnh — trên trang Google Lens hãy chọn 'tải ảnh lên'", 7000);
    window.open("https://lens.google.com/", "_blank", "noopener,noreferrer");
  }

  function saveCustom(next) {
    setCustom(next);
    try { localStorage.setItem(LS, JSON.stringify(next)); } catch {}
    pushSites(next);
  }
  function addSite() {
    const d = cleanDomain(newSite);
    if (!d || !/\./.test(d)) return showToast("Nhập tên web, ví dụ: asics.com/jp");
    if (custom.includes(d)) return setNewSite("");
    saveCustom([...custom, d]);
    setNewSite("");
  }
  function pt(e) {
    const r = imgRef.current.getBoundingClientRect();
    return { x: Math.min(Math.max(e.clientX - r.left, 0), r.width), y: Math.min(Math.max(e.clientY - r.top, 0), r.height), w: r.width, h: r.height };
  }
  function onDown(e) {
    if (!imgRef.current || reading) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const p = pt(e);
    dragRef.current = { x0: p.x, y0: p.y };
    setSel({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const p = pt(e);
    setSel({ x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), w: Math.abs(p.x - d.x0), h: Math.abs(p.y - d.y0) });
  }
  async function onUp(e) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !imgRef.current || !file) return;
    const p = pt(e);
    const box = { x: Math.min(d.x0, p.x), y: Math.min(d.y0, p.y), w: Math.abs(p.x - d.x0), h: Math.abs(p.y - d.y0) };
    if (box.w < 8 || box.h < 6) return setSel(null);
    const sx = imgRef.current.naturalWidth / p.w;
    const sy = imgRef.current.naturalHeight / p.h;
    setSel(box);
    setReading(true);
    try {
      setFail(null);
      const { codes, meta, crop, text, info } = await readCodesFromRegion(file, { x: box.x * sx, y: box.y * sy, w: box.w * sx, h: box.h * sy });
      if (!codes.length) { setFail({ crop, text: String(text || "").replace(/\s+/g, " ").trim(), info }); showToast("Không đọc được chữ trong vùng này — khoanh lại gần sát mã hơn nhé"); }
      else { setCode(codes[0]); setShop(meta || null); setAlts(codes.slice(1, 4)); showToast(`Đã đọc: ${codes[0]}`, 3500, "info"); }
    } catch {
      showToast("Chưa đọc được (kiểm tra mạng rồi thử lại)");
    } finally {
      setReading(false);
    }
  }
  const c = code.trim();
  const term = c || note.trim();
  const enc = encodeURIComponent(term);
  const direct = shop && c.toLowerCase() === shop.slug ? [{ key: "rk-direct", name: `Rakuten · ${shop.shop}`, href: `https://item.rakuten.co.jp/${shop.shop}/${shop.slug}/` }] : [];
  const slugify = (t) => String(t || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const mShop = slugify(manShop);
  const mName = manName.trim();
  const manual = [];
  if (!shop && c && (mShop || mName)) {
    const q = encodeURIComponent([manShop.trim(), mName, c].filter(Boolean).join(" "));
    if (mShop) manual.push({ key: "rk-man", name: `Rakuten · ${mShop}`, href: `https://item.rakuten.co.jp/${mShop}/${slugify(mName) || c.toLowerCase()}/` });
    manual.push({ key: "g-man", name: "Google · shop + tên + mã", href: `https://www.google.com/search?q=${q}` });
    if (mName) manual.push({ key: "rk-s-man", name: "Rakuten · tìm theo tên", href: `https://search.rakuten.co.jp/search/mall/${encodeURIComponent([mName, c].join(" "))}/` });
  }
  const sites = [
    ...direct,
    ...manual,
    ...BUILTIN.map((s) => ({ key: s.name, name: s.name, href: s.url.replace("{code}", enc) })),
    ...custom.map((d) => ({ key: "c:" + d, name: d, custom: true, href: `https://www.google.com/search?q=${enc}+site%3A${encodeURIComponent(d)}` })),
  ];
  const linkStyle = { ...btnSub, textDecoration: "none", opacity: term ? 1 : 0.45, pointerEvents: term ? "auto" : "none" };

  return (
    <section
      style={{ ...card, padding: 18, marginBottom: 14, outline: dragOver ? `2px dashed ${THEME.brand}` : "none" }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); useFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
    >
      <style>{`.hnCodeIn::placeholder{font-size:14px;font-weight:500;letter-spacing:0}`}</style>
      {cardTitle(Search, "Tìm mã sản phẩm từ ảnh", "Dán ảnh khách gửi (Ctrl+V) hoặc gõ mã, rồi bấm trang muốn tìm")}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input
          style={{ ...inp, flex: "1 1 220px", fontSize: 17, fontWeight: 700, letterSpacing: 0.3 }}
          className="hnCodeIn"
          placeholder="Dán mã hoặc dán ảnh đã copy vào đây"
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
        <button
          style={btnSub}
          disabled={!code && !preview && !note}
          onClick={() => {
            setCode(""); setAlts([]); setSel(null); setFile(null); setShop(null); setFail(null); setManShop(""); setManName(""); setNote("");
            setPreview((old) => { if (old) URL.revokeObjectURL(old); return ""; });
          }}
        >
          <X size={15} /> Xoá
        </button>
      </div>
      {preview && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: THEME.subtext, marginBottom: 6 }}>
            {reading ? "Đang đọc vùng vừa khoanh..." : "Ảnh vừa dán — nếu mã sai/không có, KÉO NGÓN TAY (hoặc chuột) KHOANH quanh mã trong ảnh, web sẽ đọc lại đúng vùng đó."}
          </div>
          <div
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            style={{ position: "relative", display: "inline-block", maxWidth: "100%", cursor: "crosshair", touchAction: "none", userSelect: "none", lineHeight: 0, borderRadius: 10, overflow: "hidden", border: `1px solid ${THEME.line}` }}
          >
            <img ref={imgRef} src={preview} alt="Ảnh vừa dán" draggable={false} style={{ display: "block", maxWidth: "100%", maxHeight: 380 }} />
            {sel && sel.w > 0 && (
              <div style={{ position: "absolute", left: sel.x, top: sel.y, width: sel.w, height: sel.h, border: `2px solid ${THEME.brand}`, background: "rgba(255,255,255,0.18)", pointerEvents: "none" }} />
            )}
          </div>
        </div>
      )}
      {fail && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: THEME.surfaceAlt || "#f6efe9", fontSize: 12.5, color: THEME.subtext }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Máy nhìn thấy vùng bạn khoanh như thế này:</div>
          {fail.crop && <img src={fail.crop} alt="Vùng đã khoanh" style={{ maxWidth: "100%", border: `1px solid ${THEME.line}`, borderRadius: 6, background: "#fff" }} />}
          <div style={{ marginTop: 4 }}>
            Đọc được: “{fail.text || "(trống)"}” · vùng {fail.info ? `${Math.round(fail.info.cw)}×${Math.round(fail.info.ch)}` : "?"} điểm ảnh, ảnh {fail.info ? `${fail.info.iw}×${fail.info.ih}` : "?"}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button style={btn} onClick={() => pickRef.current && pickRef.current.click()}><ImageIcon size={15} /> Chọn ảnh từ máy</button>
        <button style={btnSub} onClick={pasteFromButton}><ClipboardPaste size={15} /> Dán ảnh đã sao chép</button>
        <input ref={pickRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { useFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      </div>
      {alts.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: 13, color: THEME.subtext }}>
          Mã khác trong ảnh:
          {alts.map((a) => (
            <button key={a} style={{ ...btnSub, padding: "4px 10px", fontSize: 13 }} onClick={() => { setAlts([code, ...alts.filter((x) => x !== a)].slice(0, 3)); setCode(a); }}>{a}</button>
          ))}
        </div>
      )}
      {!c && (
        <div style={{ marginBottom: 10 }}>
          <input
            style={{ ...inp, width: "100%", fontSize: 14 }}
            placeholder="Ảnh không có mã? Ghi chú để tìm, VD: áo khoác nâu nữ, hãng Uniqlo"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Ghi chú để tìm"
          />
          <div style={{ fontSize: 12.5, color: THEME.subtext, marginTop: 4 }}>Gõ ghi chú rồi bấm trang muốn tìm bên dưới (nên gõ tiếng Anh hoặc tiếng Nhật cho dễ ra).</div>
        </div>
      )}
      {c && !shop && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: THEME.subtext }}>Chỉ thấy mã — điền thêm nếu biết:</span>
          <input style={{ ...inp, flex: "1 1 150px", fontSize: 14 }} placeholder="Tên shop (VD: shizenshop)" value={manShop} onChange={(e) => setManShop(e.target.value)} aria-label="Tên shop" />
          <input style={{ ...inp, flex: "1 1 200px", fontSize: 14 }} placeholder="Tên sản phẩm (VD: spoxia-swimsuit)" value={manName} onChange={(e) => setManName(e.target.value)} aria-label="Tên sản phẩm" />
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {preview && (
          <button style={{ ...btn, textDecoration: "none" }} onClick={openLens} title="Tìm sản phẩm giống ảnh trên Google Lens">
            <ImageIcon size={14} /> Tìm bằng hình (Google Lens)
          </button>
        )}
        {sites.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            <a href={term ? s.href : undefined} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              <ExternalLink size={14} /> {s.name}
            </a>
            {s.custom && perm.isAdmin && (
              <button aria-label={`Bỏ ${s.name}`} title="Bỏ trang này" style={{ border: 0, background: "transparent", color: THEME.subtext, cursor: "pointer", padding: 4 }} onClick={() => saveCustom(custom.filter((d) => d !== s.name))}>
                <X size={14} />
              </button>
            )}
          </span>
        ))}
      </div>
      {perm.isAdmin && (
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
      )}
    </section>
  );
}
