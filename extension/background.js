// Menu chuột phải + phím tắt + biểu tượng: báo giá, khoanh vùng đọc mã.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "hn-quote", title: "Hanaichi: báo giá \"%s\"", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "hn-area", title: "Hanaichi: khoanh vùng đọc mã (Alt+Shift+Q)", contexts: ["all"] });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "sel" && sender.tab) chrome.tabs.sendMessage(sender.tab.id, { type: "quote", text: msg.text, auto: true }, { frameId: 0 }).catch(() => {});
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
async function runOcr(data) {
  await ensureOffscreen();
  return await chrome.runtime.sendMessage({ target: "offscreen", type: "ocr", data });
}

// ---------- Khoanh vùng ----------
async function startArea(tab) {
  if (!tab || tab.id == null) return;
  try {
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await chrome.tabs.sendMessage(tab.id, { type: "area", shot }, { frameId: 0 });
  } catch (e) {
    // Trang đặc biệt (chrome://, cửa hàng extension...) không khoanh được.
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: "", tabId: tab.id }), 2500);
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
    try { await chrome.tabs.sendMessage(tab.id, { type: "quote", text: info.selectionText || "" }, { frameId: 0 }); } catch {}
    return;
  }
  if (info.menuItemId === "hn-area") return startArea(tab);
});
