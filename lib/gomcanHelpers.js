// lib/gomcanHelpers.js
// Các hàm dùng chung giữa trang "Giá gồm cân" (pages/gomcan.js) và trang
// "Hàng Closet sẵn" (pages/closet.js) — vì cả 2 trang đều đọc/ghi vào cùng
// 1 nguồn dữ liệu (api/gomcan) và cùng cần upload/xoá ảnh, tạo id, chuẩn hoá
// chuỗi tìm kiếm... Tách ra đây để không phải chép lại 2 lần.

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Grid3x3, List } from "lucide-react";

// Ảnh sản phẩm dùng chung: (1) chỉ tải khi sắp cuộn tới (loading="lazy") —
// trước đây mở trang Closet là tải cùng lúc hơn 200 ảnh, rất nặng trên mạng
// điện thoại; (2) link ảnh bị hỏng/die thì tự hiện icon mặc định thay vì
// biểu tượng ảnh vỡ xấu. Ảnh to ở màn chi tiết thì truyền lazy={false} để
// hiện ngay không chờ.
export function SmartImage({ src, style, fallback, lazy = true }) {
  const [broken, setBroken] = useState(false);
  const [tries, setTries] = useState(0);
  const [lastSrc, setLastSrc] = useState(src);
  const timer = useRef(null);
  // Đổi sang ảnh khác (VD vừa thay ảnh mới) thì thử tải lại từ đầu.
  if (src !== lastSrc) {
    setLastSrc(src);
    setBroken(false);
    setTries(0);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!src || broken) return fallback || null;
  // Ảnh của web này thỉnh thoảng bị từ chối tạm thời khi nhiều ảnh được xin cùng lúc -> tự thử lại vài lần (chờ lâu dần, lệch nhau).
  const own = typeof src === "string" && src.startsWith("/api/img/");
  const url = tries ? src + (src.includes("?") ? "&" : "?") + "_r=" + tries : src;
  return (
    <img
      key={tries}
      src={url}
      alt=""
      style={style}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      onError={() => {
        if (own && tries < 4) {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setTries((t) => t + 1), 700 * (tries + 1) + Math.random() * 800);
        } else setBroken(true);
      }}
    />
  );
}

// Thông báo nhỏ nổi ở đáy màn hình, tự tắt sau vài giây — dùng DOM trực tiếp
// để gọi được từ bất cứ đâu (kể cả trong hàm lưu chạy ngầm) mà không cần nối
// state React qua từng trang.
export function showToast(message, ms = 5000, kind = "error") {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = message;
  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    bottom: "18px",
    transform: "translateX(-50%)",
    zIndex: "300",
    background: kind === "info" ? "#1f2937" : "#b91c1c",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: "700",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
    maxWidth: "calc(100vw - 32px)",
    textAlign: "center",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function goLogin() {
  if (typeof window === "undefined") return;
  window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function norm(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ================== Tự tính giá gồm cân khi đổi giá Yên (giữ nguyên phí cân) ==================
   Giá gồm cân = (giá Yên × tỷ giá, làm tròn lên 5k) + phí cân.
   Phí cân của 1 sản phẩm suy ra từ cặp "giá Yên → giá gồm cân" cũ; khi có giá Yên mới thì
   áp lại đúng phí cân đó để ra giá gồm cân mới. Chỉ tính khi giá ở dạng số rõ ràng
   (VD "885y" -> "390k"); các dòng dạng chữ như "Nhiều mức giá", "Tự tính giá..." thì bỏ qua. */
export const GOMCAN_RATE = 202;

function roundUp5k(n) {
  return Math.ceil(n / 5000) * 5000;
}
// "885y", "¥885", "2200" -> số Yên; chữ khác -> NaN.
export function parseYenNum(s) {
  const t = String(s == null ? "" : s).trim();
  // Chỉ có số: "885", "885y", "¥1.280"
  let m = /^¥?\s*(\d[\d.,]*)\s*y?$/i.exec(t);
  // Có chữ đi kèm nhưng chỉ có ĐÚNG 1 mức giá Yên: "1436y trở xuống", "746y/cái", "chỉ nhận màu trắng: 2322y".
  // Có từ 2 mức giá trở lên (VD "màu trắng 35.000y, màu khác 38.000y") thì không đoán, bỏ qua.
  if (!m) {
    const all = t.match(/\d[\d.,]*\s*y(?![a-zà-ỹ])/gi) || [];
    if (all.length === 1) m = /(\d[\d.,]*)/.exec(all[0]);
  }
  if (!m) return NaN;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return n > 0 ? n : NaN;
}
// "390k", "6990k", "390.000" -> số VNĐ; chữ khác (VD "250k/1 gói") -> NaN.
export function parseVndNum(s) {
  const t = String(s == null ? "" : s).trim().toLowerCase();
  let m = /^(\d+(?:[.,]\d+)?)\s*k$/.exec(t);
  if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1000);
  m = /^(\d{1,3}(?:[.,]\d{3})+|\d{5,})$/.exec(t);
  if (m) return parseInt(m[1].replace(/[.,]/g, ""), 10);
  return NaN;
}
export function formatVndK(n) {
  if (n % 1000 === 0) return `${n / 1000}k`;
  return `${Math.round(n / 100) / 10}k`;
}
// Phí cân của 1 sản phẩm: lấy từ giá chính, nếu giá chính không ở dạng số thì thử các giá gồm cân khác.
export function weightFeeOf(it) {
  const pairs = [{ jpy: it.jpy, vnd: it.vnd }, ...(it.altPrices || [])];
  for (const p of pairs) {
    const jpy = parseYenNum(p.jpy);
    const vnd = parseVndNum(p.vnd);
    if (isNaN(jpy) || isNaN(vnd)) continue;
    const fee = vnd - roundUp5k(jpy * GOMCAN_RATE);
    if (fee >= 0) return { fee, fromJpy: jpy, fromVnd: vnd };
  }
  return null;
}
// Giá gồm cân MỚI (chuỗi, VD "410k") cho giá Yên mới; null nếu chưa tính được.
export function vndForNewYen(it, newJpyText) {
  const jpy = parseYenNum(newJpyText);
  const wf = weightFeeOf(it);
  if (isNaN(jpy) || !wf) return null;
  return { vnd: formatVndK(roundUp5k(jpy * GOMCAN_RATE) + wf.fee), ...wf };
}

export function sortByFavorite(arr) {
  const fav = arr.filter((x) => x.favorite);
  const rest = arr.filter((x) => !x.favorite);
  return fav.concat(rest);
}

export function resizeImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    // Một số ảnh (đặc biệt ảnh chụp thẳng bằng iPhone ở định dạng HEIC) trình
    // duyệt không giải mã được qua canvas — trước đây gặp trường hợp này thì
    // Promise "treo" mãi không resolve cũng không reject, khiến người dùng
    // chọn ảnh xong không thấy gì xảy ra và cũng không có lỗi hiện ra. Đặt
    // thời gian chờ tối đa để luôn báo lỗi rõ ràng thay vì treo im lặng.
    let settled = false;
    const settle = (fn, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(val);
    };
    const timer = setTimeout(() => settle(reject, new Error("timeout")), 8000);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width,
          h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        settle(resolve, canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => settle(reject, new Error("img load failed"));
      img.src = reader.result;
    };
    reader.onerror = () => settle(reject, new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

export async function uploadGomcanImage(id, dataUrl) {
  const r = await fetch("/api/gomcan-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, dataUrl }),
  });
  if (!r.ok) throw new Error("upload failed");
  const d = await r.json();
  return d.url;
}

// Dán 1 link ảnh (VD copy từ Google Images, từ trang web bán hàng...) — server
// sẽ tải giúp ảnh đó về rồi lưu như ảnh upload bình thường, trả về url đã lưu.
export async function importGomcanImageFromUrl(id, imageUrl) {
  const r = await fetch("/api/gomcan-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, imageUrl }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "import failed");
  return d.url;
}

export async function deleteGomcanImage(id) {
  try {
    await fetch(`/api/gomcan-image?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {}
}

/* ================== Chế độ hiển thị lưới to / lưới nhỏ / danh sách ================== */
export const VIEW_MODES = [
  ["large", LayoutGrid, "Lưới to"],
  ["small", Grid3x3, "Lưới nhỏ"],
  ["list", List, "Danh sách"],
];

// Nhóm 3 nút liền nhau (kiểu segmented control) để đổi cách hiển thị.
export function ViewModeToggle({ mode, setMode, T }) {
  const { THEME } = T;
  return (
    <div role="group" aria-label="Cách hiển thị" style={{ display: "inline-flex", flexShrink: 0, background: THEME.surface, border: `1px solid ${THEME.line}`, borderRadius: 10, padding: 3, gap: 2 }}>
      {VIEW_MODES.map(([key, Icon, title]) => {
        const active = mode === key;
        return (
          <button
            key={key}
            title={title}
            aria-label={title}
            aria-pressed={active}
            onClick={() => setMode(key)}
            style={{
              width: 30,
              height: 28,
              borderRadius: 7,
              border: "none",
              background: active ? THEME.chipBg : "transparent",
              color: active ? THEME.brand : THEME.subtext,
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              padding: 0,
            }}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}

export function gridColumnsFor(mode) {
  if (mode === "large") return "repeat(auto-fill, minmax(190px, 1fr))";
  if (mode === "list") return "1fr";
  return "repeat(auto-fill, minmax(136px, 1fr))";
}
