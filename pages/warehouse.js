// pages/warehouse.js — Kho sản phẩm
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { playTick, playDelete, playSuccess, playClick } from "../lib/sound";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function norm(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
async function uploadImage(id, dataUrl) {
  const r = await fetch("/api/gomcan-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, dataUrl }),
  });
  if (!r.ok) throw new Error("upload failed");
  const d = await r.json();
  return d.url;
}
async function deleteImage(id) {
  try {
    await fetch(`/api/gomcan-image?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {}
}

const BACKUP_SECTIONS = [
  { key: "gomcan", api: "/api/gomcan" },
  { key: "todo", api: "/api/todo" },
  { key: "content", api: "/api/content" },
  { key: "customers", api: "/api/customers" },
  { key: "news", api: "/api/news" },
  { key: "warehouse", api: "/api/warehouse" },
];

export default function WarehousePage() {
  const { theme: THEME, mode, toggleTheme } = useTheme();
  const { card, btn, btnSub, inp, chip, thumb } = makeStyles(THEME);
  const [products, setProducts] = useState([]);
  const [gomcanData, setGomcanData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", code: "", price: "", note: "" });
  const [pendingImg, setPendingImg] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editImg, setEditImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/warehouse").then((r) => r.json()),
      fetch("/api/gomcan").then((r) => r.json()),
    ])
      .then(([w, g]) => {
        setProducts(Array.isArray(w.products) ? w.products : []);
        setGomcanData(g);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function persistProducts(next) {
    setProducts(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: next }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("save failed");
        })
        .catch(() => {
          alert("⚠️ KHÔNG lưu được thay đổi vừa rồi! Kiểm tra lại kết nối mạng hoặc dung lượng Blob Storage trên Vercel, rồi thử lại giúp em ạ.");
        });
    }, 250);
  }

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

  async function addProduct() {
    const name = form.name.trim();
    if (!name) return;
    const newId = uid();
    let image = "";
    if (pendingImg) {
      try {
        image = await uploadImage(newId, pendingImg);
      } catch {}
    }
    persistProducts([{ id: newId, name, code: form.code.trim(), price: form.price.trim(), note: form.note.trim(), image }, ...products]);
    setForm({ name: "", code: "", price: "", note: "" });
    setPendingImg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    playTick();
  }

  function saveProduct(id, patch) {
    persistProducts(products.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function delProduct(id) {
    deleteImage(id);
    persistProducts(products.filter((p) => p.id !== id));
    playDelete();
  }

  /* ---------- Gộp tìm kiếm: kho tự thêm + toàn bộ Giá gồm cân ---------- */
  function getAllCombined() {
    const out = products.map((p) => ({ ...p, _source: "products" }));
    if (gomcanData) {
      const gcMeta = [
        { key: "oniAdult", label: "Oni gồm cân · Người lớn" },
        { key: "oniKid", label: "Oni gồm cân · Trẻ em" },
        { key: "giadung", label: "Gia dụng + TPCN" },
        { key: "unigu", label: "Uni + GU" },
      ];
      gcMeta.forEach(({ key, label }) => {
        (gomcanData[key] || []).forEach((it) => {
          const noteParts = [];
          if (it.jpy) noteParts.push("Giá Yên: ¥" + it.jpy);
          if (it.ready) noteParts.push("Giá hàng sẵn: " + it.ready);
          if (it.link) noteParts.push("Link: " + it.link);
          if (it.orderType) noteParts.push(it.orderType === "ready" ? "Hàng sẵn" : "Hàng order");
          out.push({
            id: it.id,
            name: it.name,
            code: it.code || "",
            price: it.vnd || "",
            note: noteParts.join(" • "),
            image: it.image || "",
            _source: key,
            _sourceLabel: label,
          });
        });
      });
    }
    return out;
  }
  const all = getAllCombined();
  const tokens = norm(q).split(" ").filter(Boolean);
  const joined = tokens.join("");
  const list = !tokens.length
    ? all
    : all.filter((p) => {
        const h = norm(p.name + " " + (p.code || "") + " " + (p.note || ""));
        return tokens.every((t) => h.includes(t)) || h.replace(/ /g, "").includes(joined);
      });

  /* ---------- Xuất / Nhập toàn bộ dữ liệu ---------- */
  async function exportAll() {
    setBusy(true);
    try {
      const entries = await Promise.all(
        BACKUP_SECTIONS.map(async (s) => {
          const r = await fetch(s.api);
          const d = await r.json();
          return [s.key, d];
        })
      );
      const backup = Object.fromEntries(entries);
      backup.exportedAt = new Date().toISOString();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hanaichi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      playSuccess();
    } catch (e) {
      alert("Không xuất được dữ liệu, thử lại giúp em ạ.");
    }
    setBusy(false);
  }

  async function importAll(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const uploads = BACKUP_SECTIONS.filter((s) => data && typeof data[s.key] === "object" && data[s.key] !== null).map((s) =>
        fetch(s.api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data[s.key]),
        })
      );
      await Promise.all(uploads);
      playSuccess();
      alert("✓ Đã nhập dữ liệu, tải lại trang để thấy đầy đủ nhé.");
      window.location.reload();
    } catch (e) {
      alert("File không đúng định dạng backup, thử lại giúp em ạ.");
    }
    setBusy(false);
  }

  if (!loaded) {
    return <Loading />;
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader icon="📦" title="Kho sản phẩm" current="/warehouse" maxWidth={800} />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 18px" }}>
        <p style={{ fontSize: 14, color: THEME.subtext, marginTop: 0 }}>
          Nơi tra cứu nhanh toàn bộ sản phẩm — tự gộp mọi thứ bạn thêm ở "Giá gồm cân". Nút xuất/nhập JSON bên dưới backup <b>toàn bộ dữ liệu app</b>: kho sản phẩm, giá gồm cân, việc cần làm, khung bài viết, khách hàng, tin tức.
        </p>

        <input style={{ ...inp, marginBottom: 8 }} placeholder="🔍 Gõ tên, mã, mô tả để tìm nhanh..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 14, color: THEME.subtext }}>
            {q.trim() ? `Tìm thấy ${list.length}/${all.length} sản phẩm` : `Đang có ${all.length} sản phẩm (gồm cả Giá gồm cân)`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnSub} onClick={exportAll} disabled={busy}>
              ⬇ Xuất toàn bộ dữ liệu (JSON)
            </button>
            <label style={{ ...btnSub, cursor: "pointer" }}>
              ⬆ Nhập dữ liệu (JSON)
              <input type="file" accept="application/json" style={{ display: "none" }} onChange={importAll} disabled={busy} />
            </label>
          </div>
        </div>

        {list.length === 0 ? (
          <div style={{ ...card, padding: 16, color: THEME.subtext, fontSize: 15, textAlign: "center", marginBottom: 16 }}>
            {all.length === 0 ? "Chưa có sản phẩm nào, thêm ở form bên dưới nhé" : "Không tìm thấy sản phẩm nào khớp từ khóa"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {list.map((p) => {
              const isOwn = p._source === "products";
              const isEditing = isOwn && editId === p.id;
              if (isEditing) {
                return (
                  <div key={p.id} style={{ ...card, padding: 14, border: `1.5px solid ${THEME.primary600}` }}>
                    <input style={inp} defaultValue={p.name} placeholder="Tên sản phẩm" onBlur={(e) => saveProduct(p.id, { name: e.target.value })} />
                    <div style={{ marginBottom: 8 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          onPickImage(e, async (dataUrl) => {
                            setEditImg(dataUrl);
                            const url = await uploadImage(p.id, dataUrl);
                            saveProduct(p.id, { image: url });
                          })
                        }
                      />
                      {(editImg || p.image) && (
                        <img src={editImg || p.image} alt="" style={{ maxWidth: 130, maxHeight: 130, borderRadius: 10, marginTop: 6, objectFit: "contain", background: "#fff" }} />
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input style={inp} defaultValue={p.code} placeholder="Mã sản phẩm" onBlur={(e) => saveProduct(p.id, { code: e.target.value })} />
                      <input style={inp} defaultValue={p.price} placeholder="Giá" onBlur={(e) => saveProduct(p.id, { price: e.target.value })} />
                    </div>
                    <textarea
                      style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
                      rows={3}
                      defaultValue={p.note}
                      placeholder="Thông tin chi tiết"
                      onBlur={(e) => saveProduct(p.id, { note: e.target.value })}
                    />
                    <button
                      style={btnSub}
                      onClick={() => {
                        setEditId(null);
                        setEditImg(null);
                      }}
                    >
                      Xong
                    </button>
                  </div>
                );
              }
              return (
                <div key={p.id} className="hnCard" style={{ ...card, padding: 14, display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={thumb}>{p.image ? <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#fff" }} /> : "📦"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: THEME.text }}>
                      {p.name || <span style={{ color: THEME.subtext }}>(chưa có tên)</span>}
                      {!isOwn && <span style={{ ...chip, marginLeft: 6 }}>{p._sourceLabel}</span>}
                    </div>
                    <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      {p.code && <span style={chip}>Mã: {p.code}</span>}
                      {p.price && <b style={{ color: THEME.brand, fontSize: 17 }}>{p.price}</b>}
                    </div>
                    {p.note && <div style={{ marginTop: 6, fontSize: 14, color: THEME.subtext, whiteSpace: "pre-line" }}>{p.note}</div>}
                  </div>
                  {isOwn && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      <button style={btnSub} onClick={() => setEditId(p.id)}>
                        ✏️
                      </button>
                      <button style={btnSub} onClick={() => delProduct(p.id)}>
                        ✕
                      </button>
                    </div>
                  )}
                  {!isOwn && (
                    <div style={{ fontSize: 12, color: THEME.subtext, flexShrink: 0, alignSelf: "center" }}>
                      Sửa ở "Giá gồm cân"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>➕ Thêm sản phẩm vào kho</div>
          <input style={inp} placeholder="Tên sản phẩm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div style={{ marginBottom: 8 }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => onPickImage(e, setPendingImg)} />
            {pendingImg && <img src={pendingImg} alt="" style={{ maxWidth: 130, maxHeight: 130, borderRadius: 10, marginTop: 6, objectFit: "contain", background: "#fff" }} />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input style={inp} placeholder="Mã sản phẩm" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input style={inp} placeholder="Giá" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <textarea
            style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
            rows={3}
            placeholder="Thông tin chi tiết"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <button style={btn} onClick={addProduct}>
            + Thêm sản phẩm
          </button>
        </div>
      </div>
    </main>
  );
}
