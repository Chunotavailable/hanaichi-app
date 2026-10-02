// Ghi nhớ ảnh nằm dưới con trỏ khi bấm chuột phải (kể cả ảnh nền / ảnh bị phủ lớp khác mà Chrome không coi là "ảnh").
document.addEventListener("contextmenu", (e) => {
  let url = "";
  const els = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [e.target];
  for (const el of els) {
    if (el.tagName === "IMG" && (el.currentSrc || el.src)) { url = el.currentSrc || el.src; break; }
    if (el.tagName === "CANVAS") { try { url = el.toDataURL("image/png"); break; } catch {} }
    const bg = getComputedStyle(el).backgroundImage;
    const m = bg && bg !== "none" && /url\(["']?(.*?)["']?\)/.exec(bg);
    if (m && m[1]) { url = m[1]; break; }
    if (el.tagName === "VIDEO" && el.poster) { url = el.poster; break; }
  }
  try { chrome.runtime.sendMessage({ type: "pick", url: url ? new URL(url, location.href).href : "" }); } catch {}
}, true);
