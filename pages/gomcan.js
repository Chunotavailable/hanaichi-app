// pages/gomcan.js
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";

/* ================== Helpers ================== */
function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function norm(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function sortByFavorite(arr) {
  const fav = arr.filter((x) => x.favorite);
  const rest = arr.filter((x) => !x.favorite);
  return fav.concat(rest);
}
function buildGiadungQuote(it) {
  if (!it.name) return "";
  if (it.orderType === "ready") {
    if (!it.vnd) return "";
    return `Dạ ${it.name} giá ${it.vnd} bên em có sẵn ạ`;
  }
  if (!it.vnd) return `Dạ ${it.name} (phí cân hiện 19k/lạng) ạ`;
  if (!it.jpy) return `Dạ ${it.name} bên em nhận order giá ${it.vnd} (phí cân hiện 19k/lạng) ạ`;
  return `Dạ ${it.name} bên em nhận order về tay ${it.vnd} ạ`;
}
function resizeImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width,
          h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("img load failed"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}
async function uploadGomcanImage(id, dataUrl) {
  const r = await fetch("/api/gomcan-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, dataUrl }),
  });
  if (!r.ok) throw new Error("upload failed");
  const d = await r.json();
  return d.url;
}
async function deleteGomcanImage(id) {
  try {
    await fetch(`/api/gomcan-image?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {}
}

const RATE_CAT = { oniAdult: "adult", oniKid: "kid", unigu: "unigu" };

export default function GomCan() {
  const { theme: THEME, mode, toggleTheme } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip, thumb } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip, thumb };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState("giadung");
  const [gcQuery, setGcQuery] = useState("");
  const [editKey, setEditKey] = useState(null); // { area, id } đang sửa
  const [viewGiadungId, setViewGiadungId] = useState(null); // id sản phẩm đang xem chi tiết
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/gomcan");
        const d = await r.json();
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function persist(next) {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/gomcan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
    }, 250);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function quickAddGiadung() {
    setSubTab("giadung");
    setTimeout(() => {
      const el = document.getElementById("giadung-add-form");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      const inputEl = document.getElementById("giadung-add-name-input");
      if (inputEl) inputEl.focus();
    }, 60);
  }

  if (loading || !data) {
    return <Loading />;
  }

  /* ---------- Bảng giá theo Yên (Oni / Uni+GU) ---------- */
  function addRate(cat, jpy, vnd, note) {
    if (!jpy || !vnd) return;
    const next = { ...data, oniRates: { ...data.oniRates, [cat]: [...data.oniRates[cat], { id: uid(), jpy, vnd, note: note || "" }] } };
    persist(next);
  }
  function saveRate(cat, id, patch) {
    const next = { ...data, oniRates: { ...data.oniRates, [cat]: data.oniRates[cat].map((r) => (r.id === id ? { ...r, ...patch } : r)) } };
    persist(next);
  }
  function delRate(cat, id) {
    const next = { ...data, oniRates: { ...data.oniRates, [cat]: data.oniRates[cat].filter((r) => r.id !== id) } };
    persist(next);
  }

  /* ---------- Sản phẩm đã note (Oni / Uni+GU) ---------- */
  function addOniItem(areaKey, item) {
    const next = { ...data, [areaKey]: [{ id: uid(), favorite: false, ...item }, ...data[areaKey]] };
    persist(next);
  }
  function saveOniItem(areaKey, id, patch) {
    const next = { ...data, [areaKey]: data[areaKey].map((it) => (it.id === id ? { ...it, ...patch } : it)) };
    persist(next);
  }
  function delOniItem(areaKey, id) {
    const next = { ...data, [areaKey]: data[areaKey].filter((it) => it.id !== id) };
    persist(next);
  }
  function toggleOniFavorite(areaKey, id) {
    const it = data[areaKey].find((x) => x.id === id);
    saveOniItem(areaKey, id, { favorite: !it.favorite });
  }

  /* ---------- Gia dụng ---------- */
  function addGiadungItem(item) {
    const next = { ...data, giadung: [...data.giadung, { id: uid(), favorite: false, ...item }] };
    persist(next);
  }
  function saveGiadungItem(id, patch) {
    const next = { ...data, giadung: data.giadung.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
    persist(next);
  }
  function delGiadungItem(id) {
    deleteGomcanImage(id);
    const next = { ...data, giadung: data.giadung.filter((it) => it.id !== id) };
    persist(next);
  }
  function toggleGiadungFavorite(id) {
    const it = data.giadung.find((x) => x.id === id);
    saveGiadungItem(id, { favorite: !it.favorite });
  }

  /* ---------- Tìm kiếm theo tên (đầu trang) ---------- */
  function searchAll(q) {
    const tokens = norm(q).split(" ").filter(Boolean);
    if (!tokens.length) return [];
    const all = [];
    [["oniAdult", "Oni · Người lớn"], ["oniKid", "Oni · Trẻ em"], ["unigu", "Uni + GU"]].forEach(([key, label]) => {
      (data[key] || []).forEach((it) => all.push({ ...it, sourceLabel: label, kind: "oni" }));
    });
    (data.giadung || []).forEach((it) => all.push({ ...it, sourceLabel: "Gia dụng + TPCN", kind: "giadung" }));
    const joined = tokens.join("");
    return all.filter((p) => {
      const h = norm(p.name + " " + (p.code || "") + " " + (p.productNote || ""));
      return tokens.every((t) => h.includes(t)) || h.replace(/ /g, "").includes(joined);
    });
  }
  const searchResults = gcQuery.trim() ? searchAll(gcQuery) : [];

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader icon="🧮" title="Giá gồm cân" current="/gomcan" maxWidth={900} />

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        <input style={{ ...inp, marginBottom: 8 }} placeholder="🔍 Khách hỏi đôi nào, tìm nhanh ở đây..." value={gcQuery} onChange={(e) => setGcQuery(e.target.value)} />
        {gcQuery.trim() && (
          <div style={{ marginBottom: 16 }}>
            {searchResults.length === 0 ? (
              <div style={{ ...card, padding: 12, color: THEME.subtext, fontSize: 16 }}>Không tìm thấy sản phẩm nào khớp, thử từ khóa khác giúp em ạ</div>
            ) : (
              searchResults.map((p) => {
                const isReady = p.kind === "giadung" && p.orderType === "ready";
                let priceLine;
                if (p.kind === "oni") priceLine = <>¥{p.jpy || "-"} → <b style={{ color: THEME.brand }}>{p.vnd || "-"}</b>{p.ready ? <span style={{ color: THEME.subtext }}> | Hàng sẵn: {p.ready}</span> : null}</>;
                else if (isReady) priceLine = <b style={{ color: THEME.brand }}>{p.vnd || "-"}</b>;
                else priceLine = p.jpy ? <b style={{ color: THEME.brand }}>{p.jpy}</b> : <span style={{ color: THEME.subtext }}>Tính giá như bình thường</span>;
                return (
                  <div key={p.id} className="hnCard" style={{ ...card, padding: 12, marginBottom: 8, display: "flex", gap: 12 }}>
                    <div style={thumb}>{p.image ? <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} /> : "📦"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{p.name} <span style={chip}>{p.sourceLabel}</span>{p.code ? <span style={{ ...chip, marginLeft: 4 }}>Mã: {p.code}</span> : null}</div>
                      <div style={{ marginTop: 4, fontSize: 16 }}>{priceLine}</div>
                      {p.productNote && <div style={{ marginTop: 4, fontSize: 14, color: THEME.subtext, whiteSpace: "pre-line" }}>{p.productNote}</div>}
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: THEME.brand }}>Link gốc ↗</a>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["giadung", "Gia dụng + TPCN"], ["oni", "Giày Onitsuka gồm cân"], ["unigu", "Uni + GU"]].map(([k, label]) => (
            <div key={k} onClick={() => setSubTab(k)} style={{ ...btnSub, cursor: "pointer", background: subTab === k ? THEME.primary : THEME.chipBg }}>
              {label}
            </div>
          ))}
        </div>

        {subTab === "oni" && (
          <>
            <OniCategory
              label="👞 Giày người lớn" areaKey="oniAdult" cat="adult" data={data}
              editKey={editKey} setEditKey={setEditKey}
              addRate={addRate} saveRate={saveRate} delRate={delRate}
              addOniItem={addOniItem} saveOniItem={saveOniItem} delOniItem={delOniItem} toggleOniFavorite={toggleOniFavorite}
              T={T}
            />
            <OniCategory
              label="👟 Giày trẻ em" areaKey="oniKid" cat="kid" data={data}
              editKey={editKey} setEditKey={setEditKey}
              addRate={addRate} saveRate={saveRate} delRate={delRate}
              addOniItem={addOniItem} saveOniItem={saveOniItem} delOniItem={delOniItem} toggleOniFavorite={toggleOniFavorite}
              T={T}
            />
          </>
        )}
        {subTab === "unigu" && (
          <OniCategory
            label="👕 Uniqlo + GU" areaKey="unigu" cat="unigu" data={data}
            editKey={editKey} setEditKey={setEditKey}
            addRate={addRate} saveRate={saveRate} delRate={delRate}
            addOniItem={addOniItem} saveOniItem={saveOniItem} delOniItem={delOniItem} toggleOniFavorite={toggleOniFavorite}
            T={T}
          />
        )}
        {subTab === "giadung" && (
          <GiadungSection
            data={data} editKey={editKey} setEditKey={setEditKey}
            addGiadungItem={addGiadungItem} saveGiadungItem={saveGiadungItem} delGiadungItem={delGiadungItem} toggleGiadungFavorite={toggleGiadungFavorite}
            viewGiadungId={viewGiadungId} setViewGiadungId={setViewGiadungId}
            T={T}
          />
        )}
      </div>

      <button
        onClick={quickAddGiadung}
        title="Thêm nhanh sản phẩm"
        style={{
          position: "fixed",
          right: 18,
          bottom: 146,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: THEME.brand,
          color: "#fff",
          border: "none",
          fontSize: 20,
          cursor: "pointer",
          boxShadow: THEME.glow,
          zIndex: 45,
          display: "grid",
          placeItems: "center",
        }}
      >
        ✏️
      </button>
      <button
        onClick={scrollToTop}
        title="Lên đầu trang"
        style={{
          position: "fixed",
          right: 18,
          bottom: 82,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: THEME.chipBg,
          color: THEME.brand,
          border: `1px solid ${THEME.chipLine}`,
          fontSize: 20,
          cursor: "pointer",
          boxShadow: THEME.glow,
          zIndex: 45,
          display: "grid",
          placeItems: "center",
        }}
      >
        ⬆️
      </button>
    </main>
  );
}

/* ================== Oni / Uni+GU Category ================== */
function OniCategory({ label, areaKey, cat, data, editKey, setEditKey, addRate, saveRate, delRate, addOniItem, saveOniItem, delOniItem, toggleOniFavorite, T }) {
  const { THEME, card, btn, btnSub, iconBtn, inp, chip } = T;
  const rates = data.oniRates[cat] || [];
  const log = sortByFavorite(data[areaKey] || []);
  const [rf, setRf] = useState({ jpy: "", vnd: "", note: "" });
  const [nf, setNf] = useState({ name: "", code: "", link: "", jpy: "", vnd: "", ready: "" });

  return (
    <div style={{ ...card, padding: 16, marginBottom: 16 }}>
      <h3 style={{ fontWeight: 800, marginTop: 0 }}>{label}</h3>

      <div style={{ fontSize: 14, fontWeight: 700, color: THEME.subtext, marginBottom: 6 }}>📋 Bảng giá theo giá Yên (không gắn sản phẩm cụ thể)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        {rates.length === 0 && <div style={{ color: THEME.subtext, fontSize: 16 }}>Chưa có dòng giá nào</div>}
        {rates.map((r) => {
          const isEdit = editKey && editKey.area === `rate-${cat}` && editKey.id === r.id;
          if (isEdit) {
            return (
              <div key={r.id} style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "4px 0" }}>
                <input style={{ ...inp, width: 100 }} defaultValue={r.jpy} onBlur={(e) => saveRate(cat, r.id, { jpy: e.target.value })} />
                <input style={{ ...inp, width: 110 }} defaultValue={r.vnd} onBlur={(e) => saveRate(cat, r.id, { vnd: e.target.value })} />
                <input style={{ ...inp, flex: 1, minWidth: 120 }} defaultValue={r.note} onBlur={(e) => saveRate(cat, r.id, { note: e.target.value })} />
                <button style={btnSub} onClick={() => setEditKey(null)}>Xong</button>
              </div>
            );
          }
          return (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: `1px dashed ${THEME.line}` }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 16 }}>¥{r.jpy} → <b style={{ color: THEME.brand }}>{r.vnd}</b></span>
                {r.note ? <span style={{ fontSize: 14, color: THEME.text, marginTop: 2 }}>{r.note}</span> : null}
              </div>
              <span style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button style={{ ...iconBtn, width: 24, height: 24, fontSize: 12 }} onClick={() => setEditKey({ area: `rate-${cat}`, id: r.id })}>✏️</button>
                <button style={{ ...iconBtn, width: 24, height: 24, fontSize: 12 }} onClick={() => delRate(cat, r.id)}>✕</button>
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input style={inp} placeholder="Giá Yên" value={rf.jpy} onChange={(e) => setRf({ ...rf, jpy: e.target.value })} />
        <input style={inp} placeholder="Giá gồm cân" value={rf.vnd} onChange={(e) => setRf({ ...rf, vnd: e.target.value })} />
        <input style={inp} placeholder="Ghi chú (không bắt buộc)" value={rf.note} onChange={(e) => setRf({ ...rf, note: e.target.value })} />
      </div>
      <button style={{ ...btnSub, marginBottom: 20 }} onClick={() => { addRate(cat, rf.jpy, rf.vnd, rf.note); setRf({ jpy: "", vnd: "", note: "" }); }}>＋ Thêm dòng giá</button>

      <div style={{ borderTop: `1px dashed ${THEME.chipLine}`, paddingTop: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: THEME.subtext, marginBottom: 6 }}>🗂 Sản phẩm đã note ({log.length})</div>
        {log.length === 0 && <div style={{ color: THEME.subtext, fontSize: 16, marginBottom: 8 }}>Chưa note sản phẩm nào</div>}
        {log.map((it, i) => {
          const isEdit = editKey && editKey.area === areaKey && editKey.id === it.id;
          if (isEdit) {
            return (
              <div key={it.id} style={{ ...card, padding: 10, marginBottom: 8, border: `1.5px solid ${THEME.primary600}` }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input style={{ ...inp, minWidth: 120, flex: 1 }} defaultValue={it.name} placeholder="Tên" onBlur={(e) => saveOniItem(areaKey, it.id, { name: e.target.value })} />
                  <input style={{ ...inp, width: 100 }} defaultValue={it.code} placeholder="Mã" onBlur={(e) => saveOniItem(areaKey, it.id, { code: e.target.value })} />
                  <input style={{ ...inp, width: 130 }} defaultValue={it.link} placeholder="Link" onBlur={(e) => saveOniItem(areaKey, it.id, { link: e.target.value })} />
                  <input style={{ ...inp, width: 90 }} defaultValue={it.jpy} placeholder="Giá Yên" onBlur={(e) => saveOniItem(areaKey, it.id, { jpy: e.target.value })} />
                  <input style={{ ...inp, width: 110 }} defaultValue={it.vnd} placeholder="Giá gồm cân" onBlur={(e) => saveOniItem(areaKey, it.id, { vnd: e.target.value })} />
                  <input style={{ ...inp, width: 110 }} defaultValue={it.ready} placeholder="Giá hàng sẵn" onBlur={(e) => saveOniItem(areaKey, it.id, { ready: e.target.value })} />
                </div>
                <button style={{ ...btnSub, marginTop: 8 }} onClick={() => setEditKey(null)}>Xong</button>
              </div>
            );
          }
          const linkOk = it.link && /^https?:\/\//i.test(it.link);
          return (
            <div key={it.id} className="hnCard" style={{ ...card, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>
                    <span style={{ color: THEME.subtext, fontWeight: 400 }}>{i + 1}.</span> {it.name}
                    {it.code ? <span style={{ ...chip, marginLeft: 4 }}>Mã: {it.code}</span> : null}
                    {linkOk ? <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: 13, color: THEME.brand }}>↗</a> : null}
                  </div>
                  <div style={{ marginTop: 4, color: THEME.subtext, fontSize: 16 }}>
                    ¥{it.jpy || "-"} → <b style={{ color: THEME.brand, fontSize: 18 }}>{it.vnd || "-"}</b>
                    {it.ready ? <span style={{ opacity: 0.8 }}> | Hàng sẵn: {it.ready}</span> : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button style={iconBtn} title="Yêu thích" onClick={() => toggleOniFavorite(areaKey, it.id)}>{it.favorite ? "❤️" : "🤍"}</button>
                  <button style={iconBtn} title="Sửa" onClick={() => setEditKey({ area: areaKey, id: it.id })}>✏️</button>
                  <button style={iconBtn} onClick={() => delOniItem(areaKey, it.id)}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input style={inp} placeholder="Tên sản phẩm" value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} />
          <input style={inp} placeholder="Mã sản phẩm" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} />
          <input style={inp} placeholder="Link sản phẩm" value={nf.link} onChange={(e) => setNf({ ...nf, link: e.target.value })} />
          <input style={inp} placeholder="Giá Yên" value={nf.jpy} onChange={(e) => setNf({ ...nf, jpy: e.target.value })} />
          <input style={inp} placeholder="Giá Việt gồm cân" value={nf.vnd} onChange={(e) => setNf({ ...nf, vnd: e.target.value })} />
          <input style={inp} placeholder="Giá hàng sẵn (để so sánh)" value={nf.ready} onChange={(e) => setNf({ ...nf, ready: e.target.value })} />
        </div>
        <button style={btn} onClick={() => { if (!nf.name.trim()) return; addOniItem(areaKey, nf); setNf({ name: "", code: "", link: "", jpy: "", vnd: "", ready: "" }); }}>＋ Note sản phẩm này</button>
      </div>
    </div>
  );
}

/* ================== Gia dụng ================== */
function GiadungSection({ data, editKey, setEditKey, addGiadungItem, saveGiadungItem, delGiadungItem, toggleGiadungFavorite, viewGiadungId, setViewGiadungId, T }) {
  const { THEME, card, btn, inp } = T;
  const list = sortByFavorite(data.giadung || []);
  const [form, setForm] = useState({ name: "", link: "", jpy: "", vnd: "", orderType: "order" });
  const [pendingImg, setPendingImg] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);

  async function onPickImage(e, onDone) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 1280, 0.85);
      onDone(dataUrl);
    } catch {
      alert("Không đọc được ảnh này, thử ảnh khác giúp em ạ");
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    const newId = uid();
    let imageUrl = "";
    if (pendingImg) {
      try { imageUrl = await uploadGomcanImage(newId, pendingImg); } catch {}
    }
    addGiadungItem({ id: newId, name: form.name, link: form.orderType === "ready" ? "" : form.link, jpy: form.orderType === "ready" ? "" : form.jpy, vnd: form.vnd, orderType: form.orderType, image: imageUrl });
    setForm({ name: "", link: "", jpy: "", vnd: "", orderType: "order" });
    setPendingImg(null);
  }

  const viewingItem = viewGiadungId ? list.find((x) => x.id === viewGiadungId) : null;
  const editingItem = editKey && editKey.area === "giadung" ? list.find((x) => x.id === editKey.id) : null;
  const confirmDelItem = confirmDelId ? list.find((x) => x.id === confirmDelId) : null;

  return (
    <div style={{ ...card, padding: 16, marginBottom: 16 }}>
      <h3 style={{ fontWeight: 800, marginTop: 0 }}>🏠 Gia dụng + Thực phẩm chức năng ({list.length})</h3>
      {list.length === 0 && <div style={{ color: THEME.subtext, fontSize: 16, marginBottom: 8 }}>Chưa có sản phẩm nào</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(136px, 1fr))", gap: 10, marginBottom: 16 }}>
        {list.map((it, i) => (
          <GiadungCard
            key={it.id} it={it} idx={i + 1}
            onOpen={() => setViewGiadungId(it.id)}
            onFavorite={() => toggleGiadungFavorite(it.id)}
            T={T}
          />
        ))}
      </div>

      {viewingItem && (
        <GiadungDetailModal
          it={viewingItem}
          onClose={() => setViewGiadungId(null)}
          onEdit={() => { setViewGiadungId(null); setEditKey({ area: "giadung", id: viewingItem.id }); }}
          onDelete={() => setConfirmDelId(viewingItem.id)}
          onFavorite={() => toggleGiadungFavorite(viewingItem.id)}
          T={T}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelItem}
        message={`Xoá sản phẩm "${confirmDelItem ? confirmDelItem.name : ""}"? Không thể hoàn tác.`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delGiadungItem(confirmDelId);
          setConfirmDelId(null);
          setViewGiadungId(null);
        }}
      />

      {editingItem && (
        <GiadungEditModal
          it={editingItem}
          onDone={() => setEditKey(null)}
          onSave={(patch) => saveGiadungItem(editingItem.id, patch)}
          onPickImage={onPickImage}
          T={T}
        />
      )}

      <div id="giadung-add-form" style={{ borderTop: `1px dashed ${THEME.chipLine}`, paddingTop: 12, marginTop: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>➕ Thêm sản phẩm</div>
        <input id="giadung-add-name-input" style={{ ...inp, marginBottom: 8 }} placeholder="Tên sản phẩm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div style={{ marginBottom: 8 }}>
          <input type="file" accept="image/*" onChange={(e) => onPickImage(e, setPendingImg)} />
          {pendingImg && <img src={pendingImg} alt="" style={{ maxWidth: 130, maxHeight: 130, borderRadius: 10, marginTop: 6, objectFit: "contain", background: "#fff" }} />}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 16 }}>
          <label><input type="radio" checked={form.orderType === "order"} onChange={() => setForm({ ...form, orderType: "order" })} /> Hàng order</label>
          <label><input type="radio" checked={form.orderType === "ready"} onChange={() => setForm({ ...form, orderType: "ready" })} /> Hàng sẵn</label>
        </div>
        {form.orderType !== "ready" && (
          <input style={{ ...inp, marginBottom: 8 }} placeholder="Link gốc sản phẩm" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {form.orderType !== "ready" && <input style={inp} placeholder="Giá Yên (JPY)" value={form.jpy} onChange={(e) => setForm({ ...form, jpy: e.target.value })} />}
          <input style={inp} placeholder="Giá Việt gồm cân (VNĐ)" value={form.vnd} onChange={(e) => setForm({ ...form, vnd: e.target.value })} />
        </div>
        <button style={btn} onClick={handleAdd}>＋ Thêm</button>
      </div>
    </div>
  );
}

/* ---- Ô vuông trong lưới sản phẩm ---- */
function GiadungCard({ it, idx, onOpen, onFavorite, T }) {
  const { THEME, card, chip, iconBtn } = T;
  const isReady = it.orderType === "ready";
  let priceLine;
  if (isReady) priceLine = it.vnd || "-";
  else if (it.jpy) priceLine = it.jpy;
  else priceLine = "Tính giá như bình thường";

  return (
    <div
      className="hnCard"
      onClick={onOpen}
      style={{ ...card, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: THEME.chipBg }}>
        {it.image ? (
          <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 38 }}>🛍️</div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          title="Yêu thích"
          style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.88)", fontSize: 13, cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          {it.favorite ? "❤️" : "🤍"}
        </button>
        <span style={{ position: "absolute", top: 6, left: 6, background: "rgba(255,255,255,0.85)", color: THEME.subtext, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "1px 6px" }}>{idx}</span>
      </div>
      <div style={{ padding: "8px 10px 10px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>
          {it.name}
        </div>
        <span style={{ ...chip, alignSelf: "flex-start", fontSize: 11, padding: "1px 8px", marginTop: 6 }}>{isReady ? "Hàng sẵn" : "Hàng order"}</span>
        <div style={{ marginTop: 4, fontWeight: 800, color: THEME.brand, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {priceLine}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={{ marginTop: 8, width: "100%", background: "none", border: `1px solid ${THEME.chipLine}`, color: THEME.brand, borderRadius: 8, padding: "6px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
        >
          Xem chi tiết
        </button>
      </div>
    </div>
  );
}

/* ---- Popup xem nhanh, gọn, bao quát 1 sản phẩm ---- */
function GiadungDetailModal({ it, onClose, onEdit, onDelete, onFavorite, T }) {
  const { THEME, card, chip, iconBtn } = T;
  const isReady = it.orderType === "ready";
  const quote = buildGiadungQuote(it);
  const linkOk = it.link && /^https?:\/\//i.test(it.link);
  let priceLine;
  if (isReady) priceLine = it.vnd || "-";
  else if (it.jpy) priceLine = it.jpy;
  else priceLine = "Tính giá như bình thường";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(60,20,25,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="hnCard" style={{ ...card, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto", padding: 0 }}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: THEME.chipBg }}>
          {it.image ? (
            <img src={it.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 64 }}>🛍️</div>
          )}
          <button
            onClick={onClose}
            style={{ position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", fontSize: 16, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 17, lineHeight: 1.35 }}>{it.name}</h3>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              <button style={iconBtn} title="Yêu thích" onClick={onFavorite}>{it.favorite ? "❤️" : "🤍"}</button>
              <button style={iconBtn} title="Sửa" onClick={onEdit}>✏️</button>
              <button style={iconBtn} title="Xoá" onClick={onDelete}>🗑️</button>
            </div>
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={chip}>{isReady ? "Hàng sẵn" : "Hàng order"}</span>
            {linkOk && <a href={it.link} target="_blank" rel="noopener noreferrer" style={{ color: THEME.brand, fontSize: 13 }}>Link gốc ↗</a>}
          </div>
          <div style={{ marginTop: 10, fontSize: 22, fontWeight: 800, color: THEME.brand }}>{priceLine}</div>
          {quote && (
            <div style={{ marginTop: 12, background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: "8px 10px", fontSize: 14, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <span style={{ flex: 1 }}>{quote}</span>
              <button style={{ ...iconBtn, width: 28, height: 28 }} onClick={() => navigator.clipboard && navigator.clipboard.writeText(quote)}>📋</button>
            </div>
          )}
          {it.productNote && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: THEME.subtext, marginBottom: 4 }}>🧾 Tính năng sản phẩm</div>
              <div style={{ fontSize: 15, color: THEME.text, whiteSpace: "pre-line" }}>{it.productNote}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Popup sửa sản phẩm ---- */
function GiadungEditModal({ it, onDone, onSave, onPickImage, T }) {
  const { THEME, card, inp, btnSub, btn } = T;
  const [editImg, setEditImg] = useState(null);

  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, background: "rgba(60,20,25,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="hnCard" style={{ ...card, width: "100%", maxWidth: 420, maxHeight: "88vh", overflowY: "auto", padding: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>✏️ Sửa sản phẩm</div>
        <input style={{ ...inp, marginBottom: 8 }} defaultValue={it.name} placeholder="Tên sản phẩm" onBlur={(e) => onSave({ name: e.target.value })} />
        <div style={{ marginBottom: 8 }}>
          <input type="file" accept="image/*" onChange={(e) => onPickImage(e, async (dataUrl) => { setEditImg(dataUrl); const url = await uploadGomcanImage(it.id, dataUrl); onSave({ image: url }); })} />
          {(editImg || it.image) && <img src={editImg || it.image} alt="" style={{ maxWidth: 130, maxHeight: 130, borderRadius: 10, marginTop: 6, objectFit: "contain", background: "#fff" }} />}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 16 }}>
          <label><input type="radio" defaultChecked={it.orderType !== "ready"} name={`type-${it.id}`} onChange={() => onSave({ orderType: "order" })} /> Hàng order</label>
          <label><input type="radio" defaultChecked={it.orderType === "ready"} name={`type-${it.id}`} onChange={() => onSave({ orderType: "ready" })} /> Hàng sẵn</label>
        </div>
        {it.orderType !== "ready" && <input style={{ ...inp, marginBottom: 8 }} defaultValue={it.link} placeholder="Link gốc" onBlur={(e) => onSave({ link: e.target.value })} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          {it.orderType !== "ready" && <input style={inp} defaultValue={it.jpy} placeholder="Giá Yên" onBlur={(e) => onSave({ jpy: e.target.value })} />}
          <input style={inp} defaultValue={it.vnd} placeholder="Giá gồm cân" onBlur={(e) => onSave({ vnd: e.target.value })} />
        </div>
        <textarea style={{ ...inp, minHeight: 70, marginBottom: 10 }} defaultValue={it.productNote || ""} placeholder="Ghi chú riêng cho sản phẩm này: đặc điểm, size, màu, lưu ý khi bán..." onBlur={(e) => onSave({ productNote: e.target.value })} />
        <button style={btn} onClick={onDone}>Xong</button>
      </div>
    </div>
  );
}
