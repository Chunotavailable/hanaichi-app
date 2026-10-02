// Bôi đen 1 con số (giá) ở bất kỳ khung nào của trang -> báo cho khung chính hiện bảng báo giá.
(() => {
  let last = "", timer = null;
  function check(e) {
    if (e && e.target && e.target.id === "hn-quote-host") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const t = String(window.getSelection ? window.getSelection() : "").trim();
      if (!t || t.length > 24 || t === last) return;
      const digits = (t.match(/\d/g) || []).length;
      if (digits < 3) return;
      if (!/^[^\d]{0,6}\d[\d.,\s]*[^\d]{0,6}$/.test(t)) return; // chỉ 1 số (có thể kèm ký hiệu tiền ở đầu/cuối), không phải đoạn chữ dài
      last = t;
      setTimeout(() => { last = ""; }, 3000);
      try { chrome.runtime.sendMessage({ type: "sel", text: t }); } catch {}
    }, 120);
  }
  document.addEventListener("mouseup", check, true);
  document.addEventListener("keyup", (e) => { if (e.shiftKey) check(e); }, true);
})();
