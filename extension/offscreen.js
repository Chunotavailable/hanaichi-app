// Chạy ở "trang ẩn" của extension: đọc chữ trong ảnh khoanh vùng bằng Tesseract (tự có sẵn trong extension, không cần mạng).
let workerP = null;
async function getWorker() {
  if (!workerP) {
    workerP = (async () => {
      const base = chrome.runtime.getURL("vendor");
      const w = await Tesseract.createWorker("eng", 1, { workerPath: base + "/worker.min.js", corePath: base, langPath: base, gzip: true, workerBlobURL: false });
      await w.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_/ :", preserve_interword_spaces: "1" });
      return w;
    })().catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== "offscreen" || msg.type !== "ocr") return;
  (async () => {
    try {
      const blob = await (await fetch(msg.data)).blob();
      const bmp = await createImageBitmap(blob);
      const r = await readCodesFromRegion(blob, { x: 0, y: 0, w: bmp.width, h: bmp.height });
      sendResponse({ ok: true, codes: r.codes, meta: r.meta, text: r.text });
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true;
});
