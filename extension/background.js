// Menu chuột phải: tìm ảnh trên Google Lens, có thể kèm tên hãng.
const BRANDS = [
  { id: "lens", title: "Tìm bằng Google Lens", brand: "" },
  { id: "uniqlo", title: "Tìm trên Uniqlo JP", brand: "uniqlo" },
  { id: "gu", title: "Tìm trên GU JP", brand: "GU" },
  { id: "nike", title: "Tìm trên Nike JP", brand: "nike" },
  { id: "adidas", title: "Tìm trên Adidas JP", brand: "adidas" },
  { id: "rakuten", title: "Tìm trên Rakuten", brand: "rakuten" },
];
const lastPick = {}; // tabId -> url ảnh dưới con trỏ

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "hn", title: "Hanaichi: tìm sản phẩm từ ảnh", contexts: ["all"] });
    for (const b of BRANDS) chrome.contextMenus.create({ id: "hn-" + b.id, parentId: "hn", title: b.title, contexts: ["all"] });
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "pick" && sender.tab) lastPick[sender.tab.id] = msg.url || "";
});

async function toDataUrl(url) {
  if (url.startsWith("data:")) return url;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const blob = await r.blob();
  return await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = no; f.readAsDataURL(blob); });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const b = BRANDS.find((x) => "hn-" + x.id === info.menuItemId);
  if (!b) return;
  const url = info.srcUrl || (tab && lastPick[tab.id]) || "";
  if (!url) {
    chrome.tabs.create({ url: "https://lens.google.com/" });
    return;
  }
  // Lấy ảnh bằng chính phiên đăng nhập của trình duyệt rồi gửi thẳng lên Google Lens (không phụ thuộc ảnh có công khai hay không).
  try {
    const data = await toDataUrl(url);
    await chrome.storage.session.set({ hnPending: { data, brand: b.brand, t: Date.now() } });
    chrome.tabs.create({ url: chrome.runtime.getURL("lens.html") });
  } catch {
    // Không lấy được ảnh -> thử gửi đường dẫn ảnh cho Google.
    if (/^https?:\/\//i.test(url)) chrome.tabs.create({ url: "https://lens.google.com/uploadbyurl?url=" + encodeURIComponent(url) });
    else chrome.tabs.create({ url: "https://lens.google.com/" });
  }
});
