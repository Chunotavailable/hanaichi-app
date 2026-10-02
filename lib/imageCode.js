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

async function loadImg(blob) {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  } finally {
    URL.revokeObjectURL(url);
  }
}
// mode "plain": phóng/thu vừa phải. mode "contrast": ảnh xám, tăng tương phản, phóng to hơn (chữ nhỏ/chữ trắng trên nền tối).
function drawCanvas(img, mode) {
  let k = img.width < 1000 ? 2 : img.width > 2200 ? 2200 / img.width : 1;
  if (mode === "contrast") k = img.width < 1400 ? Math.min(3, 1800 / img.width) : k;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const g = c.getContext("2d");
  if (mode === "contrast") g.filter = "grayscale(1) contrast(1.6)";
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

async function ocrPass(w, canvas) {
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

// Đọc 2 lần theo 2 cách xử lý ảnh khác nhau; mã trùng nhau ở cả 2 lần được xếp lên đầu, mã chỉ 1 lần xếp sau.
export async function readCodesFromImage(blob) {
  const w = await getWorker();
  const img = await loadImg(blob);
  const r1 = await ocrPass(w, drawCanvas(img, "plain"));
  const r2 = await ocrPass(w, drawCanvas(img, "contrast"));
  const score = new Map();
  for (const c of r1.codes) score.set(c, (score.get(c) || 0) + 1);
  for (const c of r2.codes) score.set(c, (score.get(c) || 0) + 1);
  const codes = Array.from(score.keys()).sort((a, b) => (score.get(b) - score.get(a)) || (b.includes("-") - a.includes("-")) || b.length - a.length);
  return { codes, text: r1.text + "\n" + r2.text };
}

// Chuyển thành ảnh đen-trắng bằng ngưỡng Otsu (tự chọn ngưỡng), có viền trắng rộng quanh chữ cho dễ đọc.
function binarize(src, invert) {
  const w = src.width, h = src.height;
  const ctx = src.getContext("2d");
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) { const g = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]); gray[i] = g; hist[g]++; }
  const total = w * h;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let wB = 0, sumB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  const pad = 20;
  const out = document.createElement("canvas");
  out.width = w + pad * 2;
  out.height = h + pad * 2;
  const octx = out.getContext("2d");
  octx.fillStyle = "#fff";
  octx.fillRect(0, 0, out.width, out.height);
  const img = octx.getImageData(pad, pad, w, h);
  for (let i = 0; i < w * h; i++) {
    const bright = gray[i] > thr;
    const v = (invert ? bright : !bright) ? 0 : 255; // chữ đen trên nền trắng (cả 2 chiều sáng/tối)
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  octx.putImageData(img, pad, pad);
  return out;
}

// Đọc chữ trong 1 VÙNG do người dùng khoanh (giống PowerToys Text Extractor) -> chính xác hơn đọc cả ảnh.
// rect: { x, y, w, h } theo kích thước THẬT của ảnh.
export async function readCodesFromRegion(blob, rect) {
  const w = await getWorker();
  const img = await loadImg(blob);
  const pad = 0; // vùng khoanh dùng đúng như người dùng chọn (thêm lề làm đọc kém đi vì lẫn nền)
  const x = Math.max(0, Math.floor(rect.x - pad));
  const y = Math.max(0, Math.floor(rect.y - pad));
  const cw = Math.min(img.width - x, Math.ceil(rect.w + pad * 2));
  const ch = Math.min(img.height - y, Math.ceil(rect.h + pad * 2));
  // Phóng to khoảng 4 lần (đã thử: vùng nhỏ cần phóng đủ lớn mới đọc chuẩn), nhưng không quá lớn để khỏi chậm.
  const k = Math.max(1, Math.min(4, 3000 / Math.max(cw, 1), 2400 / Math.max(ch, 1)));
  const c = document.createElement("canvas");
  c.width = Math.max(8, Math.round(cw * k));
  c.height = Math.max(8, Math.round(ch * k));
  const cctx = c.getContext("2d");
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(img, x, y, cw, ch, 0, 0, c.width, c.height);
  // Đọc vùng khoanh theo nhiều cách (ảnh gốc / đen-trắng 2 chiều), rồi "bỏ phiếu": mã nào được đọc ra nhiều lần nhất thắng.
  const variants = [
    { cv: c, psm: ["7", "6"] },
    { cv: binarize(c, false), psm: ["7"] },
    { cv: binarize(c, true), psm: ["7"] },
  ];
  const texts = [];
  const votes = new Map();
  for (const v of variants) {
    for (const psm of v.psm) {
      await w.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await w.recognize(v.cv);
      texts.push(data.text);
      for (const code of new Set(extractCodes(data.text))) votes.set(code, (votes.get(code) || 0) + 1);
    }
  }
  await w.setParameters({ tessedit_pageseg_mode: "3" });
  const codes = Array.from(votes.keys()).sort((p, q) => (votes.get(q) - votes.get(p)) || (q.includes("-") - p.includes("-")) || q.length - p.length);
  try { console.debug("[OCR vùng]", JSON.stringify({ x, y, cw, ch, k }), JSON.stringify(texts)); } catch {}
  if (!codes.length) {
    // Mã lạ không khớp mẫu: lấy nguyên chữ đọc được trong vùng khoanh.
    for (const t of texts) {
      const tok = t.replace(/\s+/g, " ").trim();
      if (tok.length >= 3 && tok.length <= 24 && /\d/.test(tok) && !codes.includes(tok)) codes.push(tok);
    }
  }
  return { codes, text: texts.join("\n") };
}

// Đọc 1 ảnh (từ dán / chọn file / kéo thả) và báo kết quả. onCode(mã, tất cả mã, file).
let busyNow = false;
export async function codesFromFile(file, onCode) {
  if (busyNow) return;
  busyNow = true;
  showToast("Đang đọc mã trên ảnh...", 4000, "info");
  try {
    const { codes } = await readCodesFromImage(file);
    if (!codes.length) {
      onCode("", [], file); // vẫn hiện ảnh để người dùng khoanh vùng chứa mã
      showToast("Chưa tự đọc được mã — hãy KÉO NGÓN TAY/CHUỘT KHOANH quanh mã trong ảnh", 6000);
    } else {
      onCode(codes[0], codes, file);
      showToast(`Đã đọc mã: ${codes[0]}${codes.length > 1 ? " (còn: " + codes.slice(1, 3).join(", ") + ")" : ""}`, 4500, "info");
    }
  } catch {
    onCode("", [], file);
    showToast("Chưa đọc được ảnh (kiểm tra mạng rồi thử lại)");
  } finally {
    busyNow = false;
  }
}

// Lấy ảnh từ clipboard (nhiều kiểu: ảnh trực tiếp, file ảnh, hoặc thẻ <img> trong nội dung HTML).
async function imageFromClipboardData(cd) {
  if (!cd) return null;
  const items = Array.from(cd.items || []);
  const it = items.find((x) => x.kind === "file" && /^image\//.test(x.type));
  if (it && it.getAsFile()) return it.getAsFile();
  const f = Array.from(cd.files || []).find((x) => /^image\//.test(x.type));
  if (f) return f;
  const html = cd.getData && cd.getData("text/html");
  const m = html && /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  if (m) {
    try {
      const r = await fetch(m[1]);
      const b = await r.blob();
      if (/^image\//.test(b.type)) return new File([b], "anh.png", { type: b.type });
    } catch {}
  }
  return null;
}

// Dùng trong trang có ô tìm kiếm: onCode(mã) được gọi khi đọc ra mã từ ảnh vừa dán.
export function useImageCodeSearch(onCode) {
  const cb = useRef(onCode);
  cb.current = onCode;
  useEffect(() => {
    async function onPaste(e) {
      const cd = e.clipboardData;
      const hasText = !!(cd && cd.getData && cd.getData("text/plain"));
      const hasImgItem = !!cd && (Array.from(cd.items || []).some((x) => x.kind === "file" && /^image\//.test(x.type)) || Array.from(cd.files || []).some((x) => /^image\//.test(x.type)));
      const html = cd && cd.getData && cd.getData("text/html");
      // Dán chữ bình thường vào ô nhập thì để yên.
      if (hasText && !hasImgItem && !(html && /<img/i.test(html))) return;
      const file = await imageFromClipboardData(cd);
      if (!file) {
        if (!hasText) showToast("Không thấy ảnh trong thứ vừa sao chép. Hãy chuột phải vào ảnh → Sao chép ảnh, hoặc dùng nút 'Chọn ảnh từ máy'.", 6000);
        return;
      }
      e.preventDefault();
      codesFromFile(file, (c, all, f) => cb.current(c, all, f));
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}
