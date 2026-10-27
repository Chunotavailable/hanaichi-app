// Menu chuột phải + phím tắt + biểu tượng: báo giá, khoanh vùng đọc mã, kiểm tra giá link gốc.
// Nếu thiếu file pricecheck.js (copy chưa đủ file) thì chỉ mất tính năng kiểm tra link, báo giá/khoanh mã vẫn chạy.
try { importScripts("pricecheck.js"); } catch (e) { console.warn("Hanaichi: thiếu pricecheck.js", e); }
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
  if (msg.type === "checkPrices" && sender.tab && fromHanaichiWeb(sender)) startCheck(sender.tab.id, msg.runId, msg.items);
  if (msg.type === "checkCancel" && fromHanaichiWeb(sender) && checkRun && checkRun.runId === msg.runId) checkRun.cancelled = true;
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

// ---------- Kiểm tra giá Yên / hết hàng của các link gốc (bấm nút từ web Hanaichi) ----------
// Đọc từng link bằng chính Chrome của bạn (cách nhau vài giây cho giống người dùng thật), chỉ các trang Amazon.co.jp / Rakuten.
const HN_HOSTS = ["hanaichi-app.hghanhh2403.workers.dev", "localhost"];
function fromHanaichiWeb(sender) {
  try { return HN_HOSTS.indexOf(new URL(sender.url || (sender.tab && sender.tab.url) || "").hostname) >= 0; } catch { return false; }
}
let checkRun = null; // { runId, cancelled }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function emit(tabId, payload) {
  return chrome.tabs.sendMessage(tabId, { type: "checkEvent", payload }, { frameId: 0 }).then(() => true, () => false);
}
async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { credentials: "include", redirect: "follow", signal: ctrl.signal, headers: { "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.5" } });
    const html = await r.text();
    return { status: r.status, html, url: r.url || url };
  } finally {
    clearTimeout(t);
  }
}
async function startCheck(tabId, runId, items) {
  if (checkRun && !checkRun.done) { // đang chạy 1 lượt khác -> huỷ lượt cũ
    checkRun.cancelled = true;
    await sleep(300);
  }
  const run = (checkRun = { runId, cancelled: false, done: false });
  const list = (Array.isArray(items) ? items : []).slice(0, 400);
  const keep = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch {} }, 20000); // giữ extension không "ngủ" giữa chừng
  let errStreak = 0;
  let aborted = null;
  try {
    for (let i = 0; i < list.length; i++) {
      if (run.cancelled) break;
      const it = list[i] || {};
      let result;
      if (!it.id || !HNPriceCheck.allowedUrl(it.link)) {
        result = { id: it.id, status: "skip", jpy: null, note: "Trang này chưa hỗ trợ kiểm tra tự động" };
      } else {
        try {
          const page = await fetchPage(it.link);
          if (!HNPriceCheck.allowedUrl(page.url)) {
            result = { id: it.id, status: "skip", jpy: null, note: "Link chuyển sang trang khác" };
          } else {
            const parsed = HNPriceCheck.parsePage(page.html, page.url, page.status);
            if (parsed.status === "blocked") { aborted = "Amazon đang yêu cầu xác nhận không phải robot. Bạn mở 1 trang Amazon.co.jp bằng Chrome, làm theo xác nhận, đợi ít phút rồi chạy lại."; break; }
            result = { id: it.id, status: parsed.status, jpy: parsed.jpy, note: parsed.note };
            errStreak = 0;
          }
        } catch (e) {
          errStreak++;
          result = { id: it.id, status: "error", jpy: null, note: "Không tải được trang (lỗi mạng / quá lâu)" };
          if (errStreak >= 5) { aborted = "Lỗi tải trang nhiều lần liên tiếp — kiểm tra mạng rồi chạy lại."; }
        }
      }
      const alive = await emit(tabId, { kind: "progress", runId, done: i + 1, total: list.length, result });
      if (!alive) { run.cancelled = true; break; } // đóng tab web -> dừng
      if (aborted) break;
      if (i < list.length - 1 && !run.cancelled) await sleep(1800 + Math.random() * 2400);
    }
  } finally {
    clearInterval(keep);
    run.done = true;
    await emit(tabId, { kind: "finished", runId, cancelled: run.cancelled, aborted: !!aborted, reason: aborted || "" });
  }
}
