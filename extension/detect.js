// Bôi đen giá Yên (¥5,980 / 5980円 / 5,980 yen) ở bất kỳ khung nào của trang -> báo cho khung chính hiện bảng báo giá.
(() => {
  const YEN = /^[¥￥]\s*\d[\d,.]*$|^\d[\d,.]*\s*(?:円|yen|jpy)$|^(?:jpy|yen)\s*\d[\d,.]*$|^\d[\d,.]*\s*[¥￥]$/i;
  let last = "", timer = null;
  function check(e) {
    if (e && e.target && e.target.id === "hn-quote-host") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const t = String(window.getSelection ? window.getSelection() : "").trim();
      if (!t || t.length > 24 || t === last) return;
      if ((t.match(/\d/g) || []).length < 3) return;
      if (!YEN.test(t)) {
        // Bôi đúng phần số (VD nhấp đúp vào 5,980 trong "¥5,980"): chỉ nhận khi ngay quanh đó có ký hiệu Yên.
        if (!/^\d[\d,.]*$/.test(t)) return;
        const sel = window.getSelection();
        const n = sel && sel.anchorNode;
        let box = n && (n.nodeType === 3 ? n.parentElement : n);
        const ctx = box ? (box.textContent || "").slice(0, 60) : "";
        if (!/[¥￥円]|\byen\b|\bjpy\b/i.test(ctx)) return;
      }
      last = t;
      setTimeout(() => { last = ""; }, 3000);
      try { chrome.runtime.sendMessage({ type: "sel", text: t }); } catch {}
    }, 120);
  }
  document.addEventListener("mouseup", check, true);
  document.addEventListener("keyup", (e) => { if (e.shiftKey) check(e); }, true);
})();
