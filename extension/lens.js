// Chạy trên trang kết quả Google Lens: nếu bạn chọn tìm theo hãng (Uniqlo, GU...) thì thêm tên hãng vào ô tìm (cố gắng hết sức).
(async () => {
  let st;
  try { st = (await chrome.storage.session.get("hnBrand")).hnBrand; } catch { return; }
  if (!st || Date.now() - st.t > 60000) return;
  await chrome.storage.session.remove("hnBrand");
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 800));
    const box = document.querySelector('textarea[name="q"], input[name="q"]');
    if (box) {
      box.focus();
      box.value = st.brand;
      box.dispatchEvent(new Event("input", { bubbles: true }));
      const form = box.closest("form");
      if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
      return;
    }
  }
})();
