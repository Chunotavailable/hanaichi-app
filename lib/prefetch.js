// lib/prefetch.js — CHỈ dùng ở trình duyệt.
// Tải trước dữ liệu của các tab (lúc rảnh hoặc khi rê/chạm vào tab) để bấm sang
// là có ngay. Mỗi bản tải trước chỉ dùng 1 lần và sống tối đa 45 giây, nên
// không bao giờ hiện dữ liệu cũ quá lâu.
const TTL = 45000;
const store = new Map(); // url -> { t, promise }

export const TAB_API = {
  "/pricing": "/api/pricing",
  "/sieuthi": "/api/sieuthi",
  "/closet": "/api/gomcan",
  "/gomcan": "/api/gomcan",
  "/thietbi": "/api/thietbi",
  "/tracuu": "/api/replies",
};

// Trả về Promise<{status, data, etag}>; dùng chung cho loadDoc.
export function fetchRaw(url) {
  return fetch(url, { cache: url === "/api/sieuthi" ? "no-cache" : "no-store" }).then(async (r) => ({
    status: r.status,
    ok: r.ok,
    data: r.ok ? await r.json() : null,
    etag: r.headers.get("x-hn-etag") || "",
  }));
}

export function prefetchApi(url) {
  if (typeof window === "undefined" || !url) return;
  const hit = store.get(url);
  if (hit && Date.now() - hit.t < TTL) return;
  const promise = fetchRaw(url).catch(() => null);
  store.set(url, { t: Date.now(), promise });
}

export function prefetchTab(href) {
  prefetchApi(TAB_API[href]);
}

// Lấy (và xoá) bản tải trước nếu còn mới; không có thì null.
export function takePrefetched(url) {
  const hit = store.get(url);
  if (!hit) return null;
  store.delete(url);
  if (Date.now() - hit.t >= TTL) return null;
  return hit.promise;
}
