// lib/gomcanHelpers.js
// Các hàm dùng chung giữa trang "Giá gồm cân" (pages/gomcan.js) và trang
// "Hàng Closet sẵn" (pages/closet.js) — vì cả 2 trang đều đọc/ghi vào cùng
// 1 nguồn dữ liệu (api/gomcan) và cùng cần upload/xoá ảnh, tạo id, chuẩn hoá
// chuỗi tìm kiếm... Tách ra đây để không phải chép lại 2 lần.

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

export function sortByFavorite(arr) {
  const fav = arr.filter((x) => x.favorite);
  const rest = arr.filter((x) => !x.favorite);
  return fav.concat(rest);
}

export function resizeImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
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
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("img load failed"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("file read failed"));
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

export async function deleteGomcanImage(id) {
  try {
    await fetch(`/api/gomcan-image?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {}
}

/* ================== Chế độ hiển thị lưới to / lưới nhỏ / danh sách ================== */
export const VIEW_MODES = [
  ["large", "🔳", "Lưới to"],
  ["small", "▦", "Lưới nhỏ"],
  ["list", "☰", "Danh sách"],
];

export function ViewModeToggle({ mode, setMode, T }) {
  const { THEME } = T;
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      {VIEW_MODES.map(([key, icon, title]) => (
        <button
          key={key}
          title={title}
          onClick={() => setMode(key)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${THEME.chipLine}`,
            background: mode === key ? THEME.brand : THEME.chipBg,
            color: mode === key ? "#fff" : THEME.brand,
            fontSize: 14,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

export function gridColumnsFor(mode) {
  if (mode === "large") return "repeat(auto-fill, minmax(190px, 1fr))";
  if (mode === "list") return "1fr";
  return "repeat(auto-fill, minmax(136px, 1fr))";
}
