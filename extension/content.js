// Giao diện trên trang (Pancake...): 1) bảng báo giá khi bôi đen giá rồi chuột phải; 2) khoanh vùng màn hình để đọc mã.
(() => {
  if (window.top !== window) return;
  const K = { rate: "hnRate", disc: "hnDisc", auto: "hnAutoOpen", mode: "hnMode" };
  const SITES = [
    { name: "Nike JP", url: "https://www.nike.com/jp/w?q={q}" },
    { name: "Rakuten", url: "https://search.rakuten.co.jp/search/mall/{q}/" },
    { name: "Amazon JP", url: "https://www.amazon.co.jp/s?k={q}" },
    { name: "Adidas JP", url: "https://www.google.com/search?q={q}+site%3Aadidas.jp" },
    { name: "Uniqlo JP", url: "https://www.google.com/search?q={q}+site%3Auniqlo.com%2Fjp" },
    { name: "GU JP", url: "https://www.google.com/search?q={q}+site%3Agu-global.com%2Fjp" },
    { name: "Google", url: "https://www.google.com/search?q={q}" },
    { name: "Google ảnh", url: "https://www.google.com/search?tbm=isch&q={q}" },
  ];
  const store = {
    get: (k, d) => new Promise((ok) => { try { chrome.storage.local.get(k, (r) => ok(r && r[k] !== undefined ? r[k] : d)); } catch { ok(d); } }),
    set: (k, v) => { try { chrome.storage.local.set({ [k]: v }); } catch {} },
  };

  // ---------- tính giá (giống tab Tính giá của web Hanaichi) ----------
  const roundUp5k = (n) => Math.ceil(n / 5000) * 5000;
  const fmtK = (n) => { const k = n / 1000; return (Number.isInteger(k) ? k : Math.round(k * 10) / 10).toString().replace(".", ",") + "k"; };
  function numOnly(s) {
    s = (s || "").toString();
    const raw = (s.match(/[\d.,]+/) || [""])[0];
    if (!raw) return NaN;
    const seps = (raw.match(/[.,]/g) || []).length;
    if (seps === 1) { const dec = raw.match(/[.,](\d+)$/); if (dec && dec[1].length <= 2) return parseFloat(raw.replace(",", ".")); }
    return parseFloat(raw.replace(/[.,]/g, ""));
  }

  // ---------- khung nổi (shadow DOM để không lẫn kiểu của trang) ----------
  let host = null, root = null;
  function mount() {
    if (host) host.remove();
    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:16px;top:16px;";
    root = host.attachShadow({ mode: "open" });
    const st = document.createElement("style");
    st.textContent = `
      *{box-sizing:border-box;font-family:system-ui,"Segoe UI",sans-serif}
      .box{width:330px;max-height:92vh;overflow:auto;background:#fffaf6;color:#2a1f21;border:1px solid #e8d6cf;border-radius:14px;box-shadow:0 10px 36px rgba(0,0,0,.28);padding:14px;font-size:14px}
      h3{margin:0 0 10px;font-size:15px;display:flex;justify-content:space-between;align-items:center}
      .x{cursor:pointer;border:0;background:transparent;font-size:18px;color:#7a6a6d}
      label{display:block;font-size:12px;color:#7a6a6d;margin:8px 0 3px}
      input,select,textarea{width:100%;padding:7px 9px;border:1px solid #e0cdc6;border-radius:9px;font-size:14px;background:#fff;color:#2a1f21}
      .row{display:flex;gap:8px}.row>div{flex:1}
      .tabs{display:flex;gap:6px;margin-bottom:6px}
      .tab{flex:1;text-align:center;padding:6px;border-radius:9px;border:1px solid #e0cdc6;cursor:pointer;background:#fff;font-size:13px}
      .tab.on{background:#9e2a3b;color:#fff;border-color:#9e2a3b}
      .big{font-size:22px;font-weight:700;color:#9e2a3b;margin:10px 0 2px}
      .msg{display:flex;gap:6px;align-items:flex-start;margin-top:6px}
      .msg div{flex:1;background:#f6ece6;border-radius:9px;padding:7px 9px;font-size:13.5px}
      button.b{cursor:pointer;border:1px solid #e0cdc6;background:#fff;border-radius:9px;padding:6px 10px;font-size:13px;color:#2a1f21}
      button.b.p{background:#9e2a3b;color:#fff;border-color:#9e2a3b}
      .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      a.chip{text-decoration:none;color:#2a1f21;border:1px solid #e0cdc6;background:#fff;border-radius:9px;padding:5px 9px;font-size:13px}
      a.chip.hot{background:#9e2a3b;color:#fff;border-color:#9e2a3b}
      .muted{color:#7a6a6d;font-size:12px;margin-top:6px}
      img.crop{max-width:100%;border:1px solid #e0cdc6;border-radius:8px;background:#fff;margin-bottom:6px}
    `;
    root.appendChild(st);
    document.documentElement.appendChild(host);
    return root;
  }
  const el = (tag, props = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) { if (k === "text") e.textContent = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (k === "class") e.className = v; else e.setAttribute(k, v); }
    for (const c of [].concat(kids)) if (c) e.appendChild(c);
    return e;
  };
  const closeBtn = () => el("button", { class: "x", text: "✕", title: "Đóng", onclick: () => { host && host.remove(); host = null; } });
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; root.appendChild(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove();
    }
    if (btn) { const o = btn.textContent; btn.textContent = "Đã chép"; setTimeout(() => (btn.textContent = o), 1200); }
  }

  // ---------- 1) Bảng báo giá ----------
  async function showQuote(selected) {
    const r = mount();
    const looksYen = /[¥円]|yen|jpy/i.test(selected);
    const looksVnd = !looksYen && /(₫|vnd|đ\b|\bk\b)/i.test(selected);
    let mode = looksVnd ? "ready" : await store.get(K.mode, "order");
    if (looksYen) mode = "order";
    const rate = await store.get(K.rate, "202");
    const disc = await store.get(K.disc, "");
    const amount = el("input", { inputmode: "decimal", value: (selected.match(/[\d.,]+/) || [""])[0] });
    const rateI = el("input", { inputmode: "decimal", value: String(rate) });
    const discI = el("input", { inputmode: "decimal", value: String(disc) });
    const code = el("input", { placeholder: "VD: HV9972-003 (không bắt buộc)" });
    const out = el("div");
    const tabO = el("div", { class: "tab", text: "Order (Yên)", onclick: () => setMode("order") });
    const tabR = el("div", { class: "tab", text: "Hàng sẵn (VNĐ)", onclick: () => setMode("ready") });
    const lblAmt = el("label", { text: "" });
    const rowOrder = el("div", { class: "row" }, [el("div", {}, [el("label", { text: "Tỷ giá" }), rateI]), el("div", {}, [el("label", { text: "% giảm (nếu có)" }), discI])]);
    function setMode(m) { mode = m; store.set(K.mode, m); render(); }
    function render() {
      tabO.className = "tab" + (mode === "order" ? " on" : "");
      tabR.className = "tab" + (mode === "ready" ? " on" : "");
      lblAmt.textContent = mode === "order" ? "Giá Yên (JPY)" : "Giá gốc (nghìn VNĐ, VD 450)";
      rowOrder.style.display = mode === "order" ? "flex" : "none";
      out.textContent = "";
      const n = numOnly(amount.value) || 0;
      if (n <= 0) return;
      const c = code.value.trim();
      let total, lines;
      if (mode === "order") {
        const rt = numOnly(rateI.value) || 202, d = numOnly(discI.value) || 0;
        total = roundUp5k(n * rt * (1 - d / 100));
        const who = c ? `Mã ${c}` : "Mã này";
        lines = [`${who} đang sale còn ${fmtK(total)} + KG ạ`, `${who} giá ${fmtK(total)} + KG ạ`];
      } else {
        const base = n >= 10000 ? n : n * 1000; // gõ 450 hoặc 450000 đều được
        total = roundUp5k(base * 0.95);
        lines = [`${c ? `Mã ${c} bên` : "Bên"} em sẵn đang giảm còn ${fmtK(total)} ạ`];
      }
      out.appendChild(el("div", { class: "big", text: `${fmtK(total)}  (${total.toLocaleString("vi-VN")}đ)` }));
      for (const l of lines) {
        const b = el("button", { class: "b", text: "Chép" });
        b.addEventListener("click", () => copy(l, b));
        out.appendChild(el("div", { class: "msg" }, [el("div", { text: l }), b]));
      }
    }
    for (const i of [amount, rateI, discI, code]) i.addEventListener("input", () => { if (i === rateI) store.set(K.rate, rateI.value); if (i === discI) store.set(K.disc, discI.value); render(); });
    r.appendChild(el("div", { class: "box" }, [
      el("h3", {}, [el("span", { text: "Báo giá Hanaichi" }), closeBtn()]),
      el("div", { class: "tabs" }, [tabO, tabR]),
      lblAmt, amount, rowOrder,
      el("label", { text: "Mã sản phẩm (chèn vào câu mẫu)" }), code,
      out,
      el("div", { class: "muted", text: "Công thức giống tab Tính giá: Yên × tỷ giá × (1 − %giảm), làm tròn lên 5k." }),
    ]));
    render();
    amount.focus();
  }

  // ---------- 2) Khoanh vùng đọc mã ----------
  function startArea(shot) {
    if (host) { host.remove(); host = null; }
    const img = new Image();
    img.onload = () => {
      const ov = document.createElement("div");
      ov.style.cssText = `all:initial;position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:url(${shot}) 0 0/100% 100% no-repeat;`;
      const tip = document.createElement("div");
      tip.textContent = "Kéo chuột khoanh quanh mã sản phẩm — Esc để huỷ";
      tip.style.cssText = "all:initial;position:fixed;left:50%;top:14px;transform:translateX(-50%);background:#9e2a3b;color:#fff;padding:8px 14px;border-radius:10px;font:600 14px system-ui;z-index:2147483647;pointer-events:none";
      const box = document.createElement("div");
      box.style.cssText = "all:initial;position:fixed;border:2px solid #ff3b5c;background:rgba(255,255,255,.18);display:none;pointer-events:none;z-index:2147483647";
      ov.appendChild(tip); ov.appendChild(box);
      document.documentElement.appendChild(ov);
      let x0 = 0, y0 = 0, drag = false;
      const done = () => { ov.remove(); document.removeEventListener("keydown", onKey, true); };
      const onKey = (e) => { if (e.key === "Escape") done(); };
      document.addEventListener("keydown", onKey, true);
      ov.addEventListener("mousedown", (e) => { drag = true; x0 = e.clientX; y0 = e.clientY; box.style.display = "block"; e.preventDefault(); });
      ov.addEventListener("mousemove", (e) => {
        if (!drag) return;
        box.style.left = Math.min(x0, e.clientX) + "px"; box.style.top = Math.min(y0, e.clientY) + "px";
        box.style.width = Math.abs(e.clientX - x0) + "px"; box.style.height = Math.abs(e.clientY - y0) + "px";
      });
      ov.addEventListener("mouseup", (e) => {
        if (!drag) return; drag = false;
        const x = Math.min(x0, e.clientX), y = Math.min(y0, e.clientY), w = Math.abs(e.clientX - x0), h = Math.abs(e.clientY - y0);
        done();
        if (w < 8 || h < 6) return;
        const sx = img.naturalWidth / window.innerWidth, sy = img.naturalHeight / window.innerHeight;
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(w * sx)); cv.height = Math.max(1, Math.round(h * sy));
        cv.getContext("2d").drawImage(img, x * sx, y * sy, w * sx, h * sy, 0, 0, cv.width, cv.height);
        readCrop(cv.toDataURL("image/png"));
      });
    };
    img.src = shot;
  }

  async function readCrop(data) {
    const r = mount();
    r.appendChild(el("div", { class: "box" }, [el("h3", {}, [el("span", { text: "Đang đọc vùng vừa khoanh..." }), closeBtn()]), el("img", { class: "crop", src: data })]));
    let res;
    try { res = await chrome.runtime.sendMessage({ type: "ocr", data }); } catch (e) { res = { ok: false, error: String(e) }; }
    showResult(data, res);
  }

  async function showResult(data, res) {
    const r = mount();
    const auto = await store.get(K.auto, "Rakuten");
    const codes = res && res.ok ? res.codes || [] : [];
    const code = el("input", { value: codes[0] || "", placeholder: "Gõ mã nếu máy đọc sai" });
    const chips = el("div", { class: "chips" });
    const alts = el("div", { class: "chips" });
    const meta = res && res.meta;
    function links() {
      chips.textContent = "";
      const c = code.value.trim();
      if (!c) return;
      const q = encodeURIComponent(c);
      if (meta && c.toLowerCase() === meta.slug) chips.appendChild(el("a", { class: "chip hot", target: "_blank", rel: "noopener", href: `https://item.rakuten.co.jp/${meta.shop}/${meta.slug}/`, text: `Rakuten · ${meta.shop}` }));
      for (const s of SITES) chips.appendChild(el("a", { class: "chip", target: "_blank", rel: "noopener", href: s.url.replace("{q}", q), text: s.name }));
    }
    code.addEventListener("input", links);
    for (const a of codes.slice(1, 5)) alts.appendChild(el("a", { class: "chip", href: "#", text: a, onclick: (e) => { e.preventDefault(); code.value = a; links(); } }));
    const autoSel = el("select", {}, ["Không tự mở"].concat(SITES.map((s) => s.name)).map((n) => el("option", { value: n, text: n })));
    autoSel.value = auto === "Không tự mở" || SITES.some((s) => s.name === auto) ? auto : "Rakuten";
    autoSel.addEventListener("change", () => store.set(K.auto, autoSel.value));
    r.appendChild(el("div", { class: "box" }, [
      el("h3", {}, [el("span", { text: codes.length ? "Đã đọc mã" : "Chưa đọc được mã" }), closeBtn()]),
      el("img", { class: "crop", src: data }),
      code, alts, chips,
      el("label", { text: "Sau khi đọc xong, tự mở trang:" }), autoSel,
      el("div", { class: "muted", text: res && res.ok ? "Máy đọc sai thì sửa mã ngay ô trên rồi bấm trang muốn tìm." : "Lỗi đọc: " + ((res && res.error) || "không rõ") + ". Thử khoanh sát mã hơn." }),
    ]));
    links();
    if (codes[0]) {
      copy(codes[0]);
      const s = SITES.find((x) => x.name === autoSel.value);
      if (s) chrome.runtime.sendMessage({ type: "open", url: s.url.replace("{q}", encodeURIComponent(codes[0])) });
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    if (msg.type === "quote") showQuote(String(msg.text || ""));
    if (msg.type === "area") startArea(msg.shot);
  });
})();
