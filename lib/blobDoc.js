// lib/blobDoc.js — CHỈ dùng ở server (API route).
// Đọc/ghi 1 file JSON dữ liệu trên Vercel Blob sao cho luôn biết chắc mình
// đang cầm bản MỚI NHẤT hay không.
//
// Vì sao cần: Vercel Blob (loại public) sau khi ghi đè 1 file có thể vẫn trả
// bản CŨ qua CDN tới ~60 giây. Nếu chỉ gửi phần sửa lên rồi server ghép vào
// "bản đang có" mà bản đó lại là bản cũ, thì lần sửa trước đó sẽ bị mất âm
// thầm. Nên ở đây:
//   - head() luôn cho ETag MỚI NHẤT (hỏi thẳng API, không qua CDN).
//   - Nội dung lấy từ bộ nhớ tạm của chính server nếu vừa ghi (đúng ETag),
//     không thì tải qua CDN và so ETag trả về với ETag mới nhất -> biết là
//     "fresh" (mới nhất) hay đang bị cũ.
//   - Ghi luôn kèm ifMatch (chỉ ghi nếu file chưa bị ai đổi từ lúc đọc).
import { put, head, BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";

export function normEtag(e) {
  return (e || "").replace(/^W\//, "").replace(/"/g, "").trim();
}
export function sameEtag(a, b) {
  const x = normEtag(a);
  return !!x && x === normEtag(b);
}

// Bộ nhớ tạm trong 1 instance server: nội dung vừa ghi/đọc được xác nhận là
// mới nhất. Chỉ dùng khi ETag khớp với head() nên không bao giờ trả bản cũ.
const docCache = globalThis.__hnDocCache || (globalThis.__hnDocCache = new Map());
const cacheDisabled = process.env.HANAICHI_DISABLE_DOC_CACHE === "1";
function cacheGet(pathname, etag) {
  if (cacheDisabled) return null;
  const c = docCache.get(pathname);
  return c && sameEtag(c.etag, etag) ? c.data : null;
}
// Bản server này vừa ghi/đọc gần nhất (chưa chắc còn mới nhất — chỉ dùng kèm
// ghi có điều kiện ifMatch, sai thì bị từ chối nên vẫn an toàn).
export function peekCache(pathname) {
  if (cacheDisabled) return null;
  return docCache.get(pathname) || null;
}
function cacheSet(pathname, etag, data) {
  if (!etag) return;
  docCache.set(pathname, { etag, data });
}

export class PreconditionError extends Error {
  constructor() {
    super("precondition failed");
    this.name = "PreconditionError";
  }
}
export function isPrecondition(e) {
  return e instanceof PreconditionError || e instanceof BlobPreconditionFailedError || (e && e.name === "BlobPreconditionFailedError");
}

/* ---------- Bản giả lập Vercel Blob trong bộ nhớ — CHỈ để test trên máy ----------
   Bật bằng HANAICHI_MEMORY_BLOB=1. HANAICHI_MEMORY_STALE_MS giả lập CDN trả
   bản cũ trong N ms sau mỗi lần ghi. Không bao giờ bật trên Vercel. */
const useMemory = process.env.HANAICHI_MEMORY_BLOB === "1";
const memStore = globalThis.__hnMemBlob || (globalThis.__hnMemBlob = new Map());
const memStaleMs = Number(process.env.HANAICHI_MEMORY_STALE_MS || 0);
let memCounter = 0;
const memBackend = {
  async head(pathname) {
    const vs = memStore.get(pathname);
    if (!vs || !vs.length) throw new BlobNotFoundError();
    return { etag: vs[vs.length - 1].etag, url: `mem://${pathname}` };
  },
  async fetchContent(pathname) {
    const vs = memStore.get(pathname) || [];
    const now = Date.now();
    const visible = vs.filter((v) => now - v.at >= memStaleMs);
    const v = visible.length ? visible[visible.length - 1] : vs[0];
    return { raw: JSON.parse(v.body), etag: v.etag };
  },
  async put(pathname, body, ifMatch) {
    const vs = memStore.get(pathname) || [];
    if (ifMatch && (!vs.length || !sameEtag(vs[vs.length - 1].etag, ifMatch))) throw new PreconditionError();
    const etag = `"mem-${++memCounter}-${Math.random().toString(36).slice(2, 8)}"`;
    vs.push({ etag, body, at: Date.now() });
    memStore.set(pathname, vs);
    return etag;
  },
};

// Đọc file + cho biết nội dung đó có chắc chắn là bản mới nhất không.
// Trả về { exists:false } nếu file chưa từng được tạo. Lỗi khác (mạng, Blob
// trục trặc) thì NÉM LỖI — tuyệt đối không giả vờ là "chưa có dữ liệu", vì
// như vậy lần lưu kế tiếp sẽ ghi đè dữ liệu thật bằng dữ liệu mặc định.
export async function readDoc(pathname) {
  let meta;
  try {
    meta = useMemory ? await memBackend.head(pathname) : await head(pathname);
  } catch (e) {
    if (e instanceof BlobNotFoundError || (e && e.name === "BlobNotFoundError")) return { exists: false };
    throw e;
  }
  const cached = cacheGet(pathname, meta.etag);
  if (cached) return { exists: true, raw: cached, etag: meta.etag, contentEtag: meta.etag, fresh: true };

  let raw;
  let contentEtag;
  if (useMemory) {
    ({ raw, etag: contentEtag } = await memBackend.fetchContent(pathname));
  } else {
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Không tải được dữ liệu (mã lỗi ${r.status})`);
    raw = await r.json();
    contentEtag = r.headers.get("etag") || "";
  }
  const fresh = sameEtag(contentEtag, meta.etag);
  if (fresh) cacheSet(pathname, meta.etag, raw);
  return { exists: true, raw, etag: meta.etag, contentEtag, fresh };
}

// Ghi file. ifMatch: chỉ ghi nếu file hiện tại đúng phiên bản đó (không thì
// ném lỗi PreconditionError để bên gọi đọc lại và thử lại).
export async function writeDoc(pathname, data, { ifMatch } = {}) {
  const body = JSON.stringify(data);
  let etag;
  if (useMemory) {
    etag = await memBackend.put(pathname, body, ifMatch);
  } else {
    const result = await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      ...(ifMatch ? { ifMatch } : {}),
    });
    etag = result.etag;
  }
  cacheSet(pathname, etag, data);
  return etag;
}
