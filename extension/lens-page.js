// Trang trung gian của extension: gửi ảnh thẳng lên Google Lens bằng form (giống nút "tải ảnh lên"), rồi Lens hiện kết quả luôn.
(async () => {
  const { hnPending: st } = await chrome.storage.session.get("hnPending");
  if (!st) { location.href = "https://lens.google.com/"; return; }
  await chrome.storage.session.remove("hnPending");
  if (st.brand) await chrome.storage.session.set({ hnBrand: { brand: st.brand, t: Date.now() } });
  const blob = await (await fetch(st.data)).blob();
  const file = new File([blob], "image.png", { type: blob.type || "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const form = document.createElement("form");
  form.method = "POST";
  form.enctype = "multipart/form-data";
  form.action = "https://lens.google.com/v3/upload?hl=vi&re=df&st=" + Date.now() + "&ep=gisbubb";
  const inp = document.createElement("input");
  inp.type = "file";
  inp.name = "encoded_image";
  inp.files = dt.files;
  form.appendChild(inp);
  document.body.appendChild(form);
  form.submit();
})();
