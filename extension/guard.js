// Giữ cho bảng Hanaichi gõ được: nhiều trang (Pancake...) bắt phím tắt/cướp con trỏ nên ô nhập trong bảng bị "đơ".
// Chạy sớm nhất có thể, chặn các sự kiện bàn phím/dán phát ra TỪ TRONG bảng để mã của trang không nhìn thấy.
(() => {
  const inPanel = (e) => { const p = e.composedPath ? e.composedPath() : []; for (const n of p) if (n && n.id === "hn-quote-host") return true; return false; };
  for (const t of ["keydown", "keypress", "keyup", "beforeinput", "input", "paste", "copy", "cut", "compositionstart", "compositionend", "focusin", "focusout", "blur"]) {
    window.addEventListener(t, (e) => { if (inPanel(e)) e.stopImmediatePropagation(); }, true);
  }
  // Trang tự giành lại con trỏ khi bấm vào bảng (focus trap) -> ngăn mousedown/click lan ra ngoài.
  for (const t of ["mousedown", "mouseup", "click", "pointerdown", "pointerup", "focus"]) {
    window.addEventListener(t, (e) => { if (inPanel(e) && t !== "mouseup") e.stopImmediatePropagation(); }, true);
  }
})();
