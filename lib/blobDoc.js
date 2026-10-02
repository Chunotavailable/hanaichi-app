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
import { getCloudflareContext } from "@opennextjs/cloudflare";

// ===== Bản chạy trên Cloudflare: dữ liệu lưu trong cơ sở dữ liệu D1 (binding tên "DB") =====
// Mỗi tài liệu 1 dòng (path, body, etag). Ghi có điều kiện bằng UPDATE ... WHERE etag = ?.
// D1 luôn nhất quán nên không còn chuyện "bản cũ qua CDN" như Vercel Blob.
class BlobNotFoundError extends Error {
  constructor() { super("not found"); this.name = "BlobNotFoundError"; }
}
class BlobPreconditionFailedError extends Error {
  constructor() { super("precondition failed"); this.name = "BlobPreconditionFailedError"; }
}
let schemaP = globalThis.__hnSchemaP || null;
export async function getDb() {
  const db = getCloudflareContext().env.DB;
  if (!db) throw new Error("Chưa gắn cơ sở dữ liệu D1 (binding tên DB) cho web");
  if (!schemaP) {
    schemaP = globalThis.__hnSchemaP = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, body TEXT NOT NULL, etag TEXT NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS img_chunks (name TEXT NOT NULL, i INTEGER NOT NULL, type TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (name, i))"),
    ]).catch((e) => { schemaP = globalThis.__hnSchemaP = null; throw e; });
  }
  await schemaP;
  return db;
}
const newEtag = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const d1Backend = {
  async read(pathname) {
    const db = await getDb();
    const row = await db.prepare("SELECT body, etag FROM docs WHERE path = ?1").bind(pathname).first();
    if (!row) throw new BlobNotFoundError();
    return { raw: JSON.parse(row.body), etag: row.etag };
  },
  async put(pathname, body, ifMatch) {
    const db = await getDb();
    const etag = newEtag();
    if (ifMatch) {
      const r = await db.prepare("UPDATE docs SET body = ?1, etag = ?2 WHERE path = ?3 AND etag = ?4").bind(body, etag, pathname, normEtag(ifMatch)).run();
      if (!r.meta || !r.meta.changes) throw new PreconditionError();
    } else {
      await db.prepare("INSERT INTO docs (path, body, etag) VALUES (?1, ?2, ?3) ON CONFLICT(path) DO UPDATE SET body = excluded.body, etag = excluded.etag").bind(pathname, body, etag).run();
    }
    return etag;
  },
};

// ===== Ảnh: lưu dạng base64, cắt thành các đoạn <= 700KB (D1 giới hạn ~2MB / dòng) =====
const IMG_CHUNK = 700 * 1024;
export async function putImage(name, contentType, base64) {
  if (useMemory) { memImages.set(name, { type: contentType, b64: base64 }); return; }
  const db = await getDb();
  const stmts = [db.prepare("DELETE FROM img_chunks WHERE name = ?1").bind(name)];
  for (let i = 0, k = 0; i < base64.length || k === 0; i += IMG_CHUNK, k++) {
    stmts.push(db.prepare("INSERT INTO img_chunks (name, i, type, data) VALUES (?1, ?2, ?3, ?4)").bind(name, k, contentType, base64.slice(i, i + IMG_CHUNK)));
  }
  await db.batch(stmts);
}
export async function getImage(name) {
  if (useMemory) return memImages.get(name) || null;
  const db = await getDb();
  const { results } = await db.prepare("SELECT type, data FROM img_chunks WHERE name = ?1 ORDER BY i").bind(name).all();
  if (!results || !results.length) return null;
  return { type: results[0].type, b64: results.map((r) => r.data).join("") };
}
export async function deleteImagesByPrefix(prefix) {
  if (useMemory) { for (const k of [...memImages.keys()]) if (k.startsWith(prefix)) memImages.delete(k); return; }
  const db = await getDb();
  await db.prepare("DELETE FROM img_chunks WHERE name LIKE ?1 ESCAPE '\\'").bind(prefix.replace(/[%_\\]/g, "\\$&") + "%").run();
}
const memImages = globalThis.__hnMemImages || (globalThis.__hnMemImages = new Map());

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
  docCache.set(pathname, { etag, data, at: Date.now() });
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
  async readLatest(pathname) {
    const vs = memStore.get(pathname);
    if (!vs || !vs.length) throw new BlobNotFoundError();
    const v = vs[vs.length - 1];
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
// maxAgeMs (không bắt buộc): chỉ dùng cho việc ĐỌC để hiển thị. Nếu server này vừa đọc/ghi file đó
// trong vòng maxAgeMs thì dùng luôn bản nhớ tạm, KHÔNG hỏi Vercel Blob (mỗi lần hỏi = 1 "Advanced Operation"
// trong hạn mức miễn phí 2.000 lượt/tháng). Việc ghi/duyệt vẫn đọc bản mới nhất (không truyền maxAgeMs).
export async function readDoc(pathname, { maxAgeMs = 0 } = {}) {
  if (maxAgeMs > 0 && !cacheDisabled) {
    const c = docCache.get(pathname);
    if (c && c.at && Date.now() - c.at < maxAgeMs) return { exists: true, raw: c.data, etag: c.etag, contentEtag: c.etag, fresh: true };
  }
  let r;
  try {
    r = useMemory ? await memBackend.readLatest(pathname) : await d1Backend.read(pathname);
  } catch (e) {
    if (e instanceof BlobNotFoundError || (e && e.name === "BlobNotFoundError")) return { exists: false };
    throw e;
  }
  cacheSet(pathname, r.etag, r.raw);
  return { exists: true, raw: r.raw, etag: r.etag, contentEtag: r.etag, fresh: true };
}

// Ghi file. ifMatch: chỉ ghi nếu file hiện tại đúng phiên bản đó (không thì
// ném lỗi PreconditionError để bên gọi đọc lại và thử lại).
export async function writeDoc(pathname, data, { ifMatch } = {}) {
  const body = JSON.stringify(data);
  const etag = useMemory ? await memBackend.put(pathname, body, ifMatch) : await d1Backend.put(pathname, body, ifMatch);
  cacheSet(pathname, etag, data);
  return etag;
}
