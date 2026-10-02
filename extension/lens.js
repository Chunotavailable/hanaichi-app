// Chạy trên trang Google Lens: nếu có ảnh đang chờ thì dán vào, rồi (nếu chọn hãng) thêm tên hãng vào ô tìm.
(async () => {
  let st;
  try { st = (await chrome.storage.session.get("hnPending")).hnPending; } catch { return; }
  if (!st || Date.now() - st.t > 60000) return;
  if (!/^https:\/\/lens\.google\.com\//.test(location.href)) return;
  await chrome.storage.session.remove("hnPending");
  const blob = await (await fetch(st.data)).blob();
  const file = new File([blob], "anh.png", { type: blob.type || "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const tryPaste = () => document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  const tryInput = () => {
    const inp = document.querySelector('input[type="file"]');
    if (!inp) return false;
    inp.files = dt.files;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  const startUrl = location.href;
  for (let i = 0; i < 12 && location.href === startUrl; i++) {
    if (!tryInput()) tryPaste();
    await new Promise((r) => setTimeout(r, 700));
  }
  if (!st.brand) return;
  // Thêm tên hãng vào ô tìm của trang kết quả (cố gắng hết sức; trang Google đổi giao diện thì bước này có thể không chạy).
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
