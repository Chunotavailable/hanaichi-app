// lib/Highlight.js — tô vàng chữ khớp với từ khoá tìm kiếm (dùng chung mọi tab có tìm kiếm).
// Tô sáng chữ khớp với từ khoá tìm kiếm (không phân biệt hoa thường, có dấu
// hay không dấu đều khớp).
function baseChar(c) {
  const t = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  return /[\p{L}\p{N}]/u.test(t[0] || "") ? t[0] : " ";
}
export function Highlight({ text, tokens, color }) {
  if (!tokens.length) return text;
  const flat = Array.from(text).map(baseChar).join("");
  const mark = new Array(text.length).fill(false);
  for (const tk of tokens) {
    let i = flat.indexOf(tk);
    while (i >= 0) {
      for (let k = i; k < i + tk.length; k++) mark[k] = true;
      i = flat.indexOf(tk, i + tk.length);
    }
  }
  if (!mark.some(Boolean)) return text;
  const out = [];
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && mark[j] === mark[i]) j++;
    const part = text.slice(i, j);
    out.push(mark[i] ? <mark key={i} style={{ background: color, color: "inherit", borderRadius: 3, padding: "0 1px" }}>{part}</mark> : <span key={i}>{part}</span>);
    i = j;
  }
  return out;
}

// Tách từ khoá giống cách các ô tìm kiếm đang dùng (bỏ dấu, chữ thường).
export function searchTokens(q) {
  return Array.from(String(q || "")).map(baseChar).join("").split(" ").filter(Boolean);
}
export const HL_COLOR = "#fbe3a6";
