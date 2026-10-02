// lib/imageCode.js — CHỈ chạy ở trình duyệt.
// Dán (Ctrl+V) ảnh khách gửi vào trang -> đọc chữ trên ảnh NGAY TRÊN MÁY BẠN (thư viện Tesseract, file nằm trong /public/tess)
// -> tìm ra mã sản phẩm (VD HV9972-003) -> điền vào ô tìm kiếm. Không gửi ảnh lên máy chủ, không tốn lượt nào của Cloudflare.
import { useEffect, useRef } from "react";
import { showToast } from "./gomcanHelpers";

let workerP = null;
async function getWorker() {
  if (!workerP) {
    workerP = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng", 1, { workerPath: "/tess/worker.min.js", corePath: "/tess", langPath: "/tess", gzip: true });
      await w.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/ ", preserve_interword_spaces: "1" });
      return w;
    })().catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

// Các kiểu mã hay gặp: HV9972-003, IW5977, JI8861, FV8963-451/FB7..., 1041A370-107
const CODE_RE = /\b([A-Z]{1,3}\d{3,5}[A-Z]?(?:[-\/][A-Z0-9]{2,4})?|\d{4}[A-Z]\d{3}(?:[-\/][A-Z0-9]{2,4})?)\b/g;

export function extractCodes(text) {
  const out = [];
  for (const m of String(text || "").toUpperCase().replace(/[|]/g, "I").matchAll(CODE_RE)) {
    const c = m[1];
    if (/^(?:[A-Z]{1,3}\d{3,5})$/.test(c) && /^(?:OFF|SALE)/.test(c)) continue;
    if (!out.includes(c)) out.push(c);
  }
  // Mã có gạch nối (đủ mã) đứng trước, rồi tới mã dài hơn.
  return out.sort((a, b) => (b.includes("-") - a.includes("-")) || b.length - a.length);
}

async function toCanvas(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = img.width < 1000 ? 2 : img.width > 2200 ? 2200 / img.width : 1;
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readCodesFromImage(blob) {
  const w = await getWorker();
  const canvas = await toCanvas(blob);
  let { data } = await w.recognize(canvas);
  let codes = extractCodes(data.text);
  if (!codes.length) {
    await w.setParameters({ tessedit_pageseg_mode: "11" }); // chữ rải rác
    ({ data } = await w.recognize(canvas));
    codes = extractCodes(data.text);
    await w.setParameters({ tessedit_pageseg_mode: "3" });
  }
  return { codes, text: data.text };
}

// Dùng trong trang có ô tìm kiếm: onCode(mã) được gọi khi đọc ra mã từ ảnh vừa dán.
export function useImageCodeSearch(onCode) {
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    let busy = false;
    async function onPaste(e) {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      const it = Array.from(items).find((x) => x.kind === "file" && /^image\//.test(x.type));
      if (!it || busy) return;
      const file = it.getAsFile();
      if (!file) return;
      e.preventDefault();
      busy = true;
      showToast("Đang đọc mã trên ảnh...", 4000, "info");
      try {
        const { codes } = await readCodesFromImage(file);
        if (!codes.length) showToast("Không thấy mã sản phẩm trong ảnh này — gõ mã tay giúp mình nhé");
        else {
          cb.current(codes[0]);
          showToast(`Đã đọc mã: ${codes[0]}${codes.length > 1 ? " (còn: " + codes.slice(1, 3).join(", ") + ")" : ""}`, 4500, "info");
        }
      } catch {
        showToast("Chưa đọc được ảnh (kiểm tra mạng rồi thử lại)");
      } finally {
        busy = false;
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}
