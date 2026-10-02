// Menu chuột phải + phím tắt + biểu tượng: báo giá, khoanh vùng đọc mã.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "hn-quote", title: "Hanaichi: báo giá \"%s\"", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "hn-area", title: "Hanaichi: khoanh vùng đọc mã (Alt+Shift+Q)", contexts: ["all"] });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "sel" && sender.tab) sendToTab(sender.tab.id, { type: "quote", text: msg.text, auto: true }).catch(() => {});
  if (msg.type === "open" && msg.url && /^https:\/\//.test(msg.url)) chrome.tabs.create({ url: msg.url, active: msg.active !== false });
  if (msg.type === "ocr") {
    runOcr(msg.data).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

// ---------- Đọc chữ (trang ẩn offscreen) ----------
let creating = null;
async function ensureOffscreen() {
  const url = chrome.runtime.getURL("offscreen.html");
  const has = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] });
  if (has.length) return;
  if (!creating) creating = chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Đọc mã sản phẩm trong ảnh khoanh vùng bằng Tesseract" }).finally(() => { creating = null; });
  await creating;
}
// Làm nóng sẵn máy đọc chữ (nạp ~7MB dữ liệu) để lúc khoanh xong là đọc được ngay.
function warm() { ensureOffscreen().then(() => chrome.runtime.sendMessage({ target: "offscreen", type: "warm" })).catch(() => {}); }
chrome.runtime.onStartup.addListener(warm);
chrome.runtime.onInstalled.addListener(warm);
async function runOcr(data) {
  await ensureOffscreen();
  return await chrome.runtime.sendMessage({ target: "offscreen", type: "ocr", data });
}

// Gửi lệnh cho khung chính của tab. Tab mở từ TRƯỚC khi cài/tải lại extension chưa có script -> tự nạp script rồi gửi lại.
async function sendToTab(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
  } catch (e) {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ["guard.js", "content.js"] });
    await new Promise((r) => setTimeout(r, 150));
    return await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
  }
}

// ---------- Khoanh vùng ----------
async function startArea(tab) {
  if (!tab || tab.id == null) return;
  warm(); // trong lúc bạn kéo khoanh, máy đọc chữ được nạp sẵn
  try {
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await sendToTab(tab.id, { type: "area", shot });
  } catch (e) {
    // Trang đặc biệt (chrome://, cửa hàng extension...) không khoanh được.
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#d11a2a", tabId: tab.id });
    chrome.action.setTitle({ title: "Không khoanh được trên trang này: " + String((e && e.message) || e).slice(0, 120), tabId: tab.id });
    setTimeout(() => { chrome.action.setBadgeText({ text: "", tabId: tab.id }); chrome.action.setTitle({ title: "Khoanh vùng đọc mã (Alt+Shift+Q)", tabId: tab.id }); }, 4000);
  }
}
chrome.action.onClicked.addListener((tab) => startArea(tab));
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== "khoanh-ma") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  startArea(tab);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "hn-quote") {
    try { await sendToTab(tab.id, { type: "quote", text: info.selectionText || "" }); } catch {}
    return;
  }
  if (info.menuItemId === "hn-area") return startArea(tab);
});
