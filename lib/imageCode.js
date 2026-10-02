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
      await w.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_/ :", preserve_interword_spaces: "1" });
      return w;
    })().catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

// Các kiểu mã hay gặp: HV9972-003, IW5977, JI8861, FV8963-451/FB7..., 1041A370-107
const CODE_RE = /\b([A-Z]{1,3}\d{3,5}[A-Z]?(?:[-\/][A-Z0-9]{2,4})?|\d{4}[A-Z]\d{3}(?:[-\/][A-Z0-9]{2,4})?)\b/g;

// Máy đọc chữ hay nhầm chữ <-> số: I/1, O/0, S/5, B/8, Z/2, G/6. Mã Nike/adidas hiện nay bắt đầu bằng 2 CHỮ + 4 số (VD IO8449-661, HV9972-003),
// nên nếu 2 ký tự đầu bị đọc thành số thì đổi lại thành chữ (mã gốc vẫn được giữ làm mã phụ).
const TO_LETTER = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G" };
const fixLead = (c) => c.slice(0, 2).replace(/[0-9]/g, (d) => TO_LETTER[d] || d) + c.slice(2);
const leadLetters = (c) => (/^[A-Z]/.test(c) ? 1 : 0) + (/^.[A-Z]/.test(c) ? 1 : 0);
// Xếp hạng khi bằng điểm: có gạch nối > nhiều chữ cái ở đầu > dài hơn.
const hasDigit = (c) => (/\d/.test(c) ? 1 : 0);
export const codeTieBreak = (a, b) => (hasDigit(b) - hasDigit(a)) || (b.includes("-") - a.includes("-")) || ((a.includes("-") && b.includes("-")) ? leadLetters(b) - leadLetters(a) : 0) || b.length - a.length;

export function extractCodes(text) {
  const up = String(text || "").toUpperCase().replace(/[|]/g, "I");
  const out = [];
  const add = (c) => { if (c && !out.includes(c)) out.push(c); };
  // Mã Michael Kors: 14 ký tự chữ+số bắt đầu bằng 2 số (VD 35S6G4XS2L7278).
  for (const m of up.matchAll(/\b\d{2}[A-Z0-9]{12}\b/g)) if ((m[0].match(/[A-Z]/g) || []).length >= 3 && (m[0].match(/\d/g) || []).length >= 4) add(m[0]);
  // Mã Michael Kors dạng 35S6G4XS2L7278: 12-15 ký tự chữ + số trộn lẫn, bắt đầu bằng 2 số (cần ít nhất 3 chữ cái và 4 số để khỏi nhầm với dãy số thường).
  for (const m of up.matchAll(/\b\d{2}[A-Z0-9]{10,13}\b/g)) if ((m[0].match(/[A-Z]/g) || []).length >= 3 && (m[0].match(/\d/g) || []).length >= 4) add(m[0]);
  // Mã Uniqlo / GU: 6 số bắt đầu bằng 4 (Uniqlo) hoặc 3 (GU), có thể có chữ E ở đầu; sau dấu gạch là mã màu (VD E361081-64, E456261).
  for (const m of up.matchAll(/\b(E?[34]\d{5})(?:\s*-\s*(\d{1,3}))?\b/g)) { const base = m[1].startsWith("E") ? m[1] : "E" + m[1]; add(m[2] ? base + "-" + m[2] : base); if (m[2]) add(base); }
  // Mã Amazon (ASIN): 10 ký tự, luôn bắt đầu bằng "B0" — máy đọc hay nhầm số 0 thành chữ O (BOG5GHDJ56 -> B0G5GHDJ56).
  for (const m of up.matchAll(/\bB[0O][A-Z0-9]{8}\b/g)) { add("B0" + m[0].slice(2)); add(m[0]); }
  // Kiểu Nike: 2 ký tự + 4 số + "-" + 3 số (kể cả khi 2 ký tự đầu bị đọc thành số)
  for (const m of up.matchAll(/\b([A-Z0-9]{2}\d{4}-\d{3})\b/g)) { add(fixLead(m[1])); add(m[1]); }
  for (const m of up.matchAll(CODE_RE)) {
    const c = m[1];
    if (/^(?:[A-Z]{1,3}\d{3,5})$/.test(c) && /^(?:OFF|SALE)/.test(c)) continue;
    add(c);
    // 1 chữ + 5 số (VD J18861) có thể là 2 chữ + 4 số bị đọc nhầm (JI8861) -> thêm làm mã phụ.
    if (/^[A-Z]\d{5}$/.test(c)) add(c[0] + (TO_LETTER[c[1]] || c[1]) + c.slice(2));
  }
  // Mã toàn chữ dạng tên sản phẩm có gạch nối (VD SPOXIA-SWIMSUIT-SEPARATE), hay gặp ở hàng Rakuten.
  for (const m of up.matchAll(/\b([A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]{2,}){1,})\b/g)) add(m[1]);
  return out.sort(codeTieBreak);
}

// Trả mã về đúng kiểu chữ (hoa/thường) như máy đọc được trong ảnh, thay vì ép chữ HOA. Không tìm thấy thì giữ nguyên.
export function restoreCase(code, text) {
  const t = String(text || "");
  const i = t.toUpperCase().indexOf(code);
  return i >= 0 && t.length === t.toUpperCase().length ? t.slice(i, i + code.length) : code;
}

// Tên shop đứng trước mã, VD "SHIZENSHOP: SPOXIA-SWIMSUIT-SEPARATE" -> { shop: "shizenshop", slug: "spoxia-swimsuit-separate" }
export function extractShop(text) {
  const up = String(text || "").toUpperCase();
  const m = /\b([A-Z][A-Z0-9_-]{2,})\s*:\s*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\b/.exec(up);
  return m ? { shop: m[1].toLowerCase(), slug: m[2].toLowerCase() } : null;
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
  const codes = Array.from(score.keys()).sort((a, b) => (score.get(b) - score.get(a)) || codeTieBreak(a, b));
  const raw = r1.text + "\n" + r2.text;
  return { codes: codes.map((c) => restoreCase(c, raw)), text: raw };
}

function scaleCanvas(img, x, y, cw, ch, k) {
  const c = document.createElement("canvas");
  c.width = Math.max(8, Math.round(cw * k));
  c.height = Math.max(8, Math.round(ch * k));
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(img, x, y, cw, ch, 0, 0, c.width, c.height);
  return c;
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
  // Phóng/thu về chiều cao vùng khoảng 150 điểm ảnh: vùng nhỏ phóng lên (tối đa 4 lần), vùng lớn KHÔNG phóng thêm (phóng quá lớn chỉ làm chậm mà không đọc tốt hơn).
  const k = ch >= 150 ? Math.min(1, 1800 / Math.max(cw, 1)) : Math.max(1, Math.min(4, 150 / Math.max(ch, 1), 2400 / Math.max(cw, 1)));
  const c = document.createElement("canvas");
  c.width = Math.max(8, Math.round(cw * k));
  c.height = Math.max(8, Math.round(ch * k));
  const cctx = c.getContext("2d");
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(img, x, y, cw, ch, 0, 0, c.width, c.height);
  // Đọc vùng khoanh theo nhiều cách rồi "bỏ phiếu"; NHƯNG dừng sớm ngay khi 2 cách khác nhau cùng ra 1 mã đúng dạng quen thuộc
  // (Nike, Uniqlo/GU, Amazon, adidas...) — phần lớn ảnh chỉ cần 2 lượt thay vì 5.
  const STRONG = /^(?:[A-Z]{2}\d{4}-\d{3}|E[34]\d{5}(?:-\d{1,3})?|B0[A-Z0-9]{8}|\d{2}[A-Z0-9]{10,13}|[A-Z]{1,3}\d{4,5}[A-Z]?(?:-[A-Z0-9]{2,4})?)$/;
  // Cách thứ 2 đọc ở cỡ gấp đôi: các lỗi nhầm S/5, O/0 thường khác nhau giữa 2 cỡ nên 2 cách "đồng ý" mới đáng tin.
  const k2 = Math.max(1, Math.min(k * 2, 8, 3000 / Math.max(cw, 1)));
  const variants = [
    () => ({ cv: c, psm: "7" }),
    () => ({ cv: scaleCanvas(img, x, y, cw, ch, k2), psm: "7" }),
    () => ({ cv: binarize(c, false), psm: "7" }),
    () => ({ cv: binarize(c, true), psm: "7" }),
    () => ({ cv: c, psm: "6" }),
  ];
  const texts = [];
  const votes = new Map();
  let lastPsm = "";
  for (const make of variants) {
    const v = make();
    if (v.psm !== lastPsm) { await w.setParameters({ tessedit_pageseg_mode: v.psm }); lastPsm = v.psm; }
    const { data } = await w.recognize(v.cv);
    texts.push(data.text);
    for (const code of new Set(extractCodes(data.text))) votes.set(code, (votes.get(code) || 0) + 1);
    if ([...votes].some(([code, n]) => n >= 2 && STRONG.test(code))) break;
    // Lượt đầu ra mã đúng dạng quen thuộc và máy cực kỳ tự tin (nhầm S/5, O/0 thường làm độ tự tin tụt xuống) -> khỏi đọc thêm.
    if (texts.length === 1 && data.confidence >= 86 && [...votes.keys()].some((code) => STRONG.test(code))) break;
  }
  await w.setParameters({ tessedit_pageseg_mode: "3" });
  const codes = Array.from(votes.keys()).sort((p, q) => (votes.get(q) - votes.get(p)) || codeTieBreak(p, q));
  try { console.debug("[OCR vùng]", JSON.stringify({ x, y, cw, ch, k }), JSON.stringify(texts)); } catch {}
  const rawAll = texts.join("\n");
  for (let i = 0; i < codes.length; i++) codes[i] = restoreCase(codes[i], rawAll);
  // Cứ máy đọc ra gì thì hiện ra: thêm nguyên chữ đọc được trong vùng khoanh làm lựa chọn (hoặc mã chính nếu chưa có mã nào khớp mẫu).
  const addRaw = (t) => {
    const tok = t.replace(/\s+/g, " ").trim();
    if (tok.length >= 2 && tok.length <= 60 && /[A-Za-z0-9]{2}/.test(tok) && !codes.some((x) => x.toUpperCase() === tok.toUpperCase())) codes.push(tok);
  };
  if (!codes.length) {
    // Mã lạ không khớp mẫu: lấy nguyên chữ đọc được trong vùng khoanh.
    for (const t of texts) addRaw(t);
  } else {
    for (const t of texts.slice(0, 1)) addRaw(t);
  }
  let crop = "";
  try {
    const t = document.createElement("canvas");
    const kk = Math.min(1, 320 / Math.max(c.width, 1));
    t.width = Math.max(1, Math.round(c.width * kk));
    t.height = Math.max(1, Math.round(c.height * kk));
    t.getContext("2d").drawImage(c, 0, 0, t.width, t.height);
    crop = t.toDataURL("image/jpeg", 0.8);
  } catch {}
  return { codes, text: texts.join("\n"), meta: extractShop(texts.join("\n")), crop, info: { x, y, cw, ch, iw: img.width, ih: img.height } };
}

// Đọc 1 ảnh (từ dán / chọn file / kéo thả) và báo kết quả. onCode(mã, tất cả mã, file).
let busyNow = false;
export async function codesFromFile(file, onCode) {
  if (busyNow) return;
  busyNow = true;
  showToast("Đang đọc mã trên ảnh...", 4000, "info");
  try {
    const { codes, text } = await readCodesFromImage(file);
    const meta = extractShop(text);
    if (!codes.length) {
      onCode("", [], file, null); // vẫn hiện ảnh để người dùng khoanh vùng chứa mã
      showToast("Chưa tự đọc được mã — hãy KÉO NGÓN TAY/CHUỘT KHOANH quanh mã trong ảnh", 6000);
    } else {
      onCode(codes[0], codes, file, meta);
      showToast(`Đã đọc mã: ${codes[0]}${codes.length > 1 ? " (còn: " + codes.slice(1, 3).join(", ") + ")" : ""}`, 4500, "info");
    }
  } catch {
    onCode("", [], file, null);
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
      codesFromFile(file, (c, all, f, meta) => cb.current(c, all, f, meta));
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);
}
