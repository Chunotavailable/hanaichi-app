// Cầu nối giữa web Hanaichi (trang Giá gồm cân) và extension — CHỈ chạy trên web Hanaichi (xem manifest.json).
// Trang web gửi: ping / check (danh sách link cần kiểm tra) / cancel. Extension trả: pong / progress / finished.
(() => {
  if (window.top !== window) return;
  const VERSION = chrome.runtime.getManifest().version;
  const post = (m) => window.postMessage(Object.assign({ hnExt: 1 }, m), location.origin);

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || d.hnPage !== 1) return;
    try {
      if (d.kind === "ping") post({ kind: "pong", version: VERSION });
      else if (d.kind === "check") chrome.runtime.sendMessage({ type: "checkPrices", runId: d.runId, items: d.items });
      else if (d.kind === "cancel") chrome.runtime.sendMessage({ type: "checkCancel", runId: d.runId });
    } catch (err) {
      // Extension vừa được cập nhật/tải lại mà trang web chưa tải lại -> báo để người dùng F5.
      post({ kind: "finished", runId: d.runId, aborted: true, reason: "Extension vừa được cập nhật — bấm F5 tải lại trang rồi thử lại." });
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "checkEvent" && msg.payload) post(msg.payload);
  });
})();
