// lib/docApi.js — CHỈ dùng ở server.
// Tạo API đọc/ghi cho 1 file dữ liệu JSON, hỗ trợ 3 kiểu:
//   GET   -> trả dữ liệu + header "x-hn-etag" (phiên bản của dữ liệu đó).
//   PATCH -> { baseEtag, patch }: CHỈ nhận phần thay đổi, ghép vào bản mới
//            nhất trên server. Nếu server không chắc đang có bản mới nhất
//            (CDN còn trả bản cũ) thì từ chối ghép và báo lại:
//              needFull:   máy gửi đang cầm đúng bản mới nhất -> gửi cả khối.
//              retryLater: chờ vài giây rồi gửi lại phần thay đổi.
//   POST  -> ghi cả khối (dùng cho khôi phục sao lưu và đường dự phòng).
//            Có header "x-if-match" thì chỉ ghi khi đúng phiên bản đó.
// Phân quyền (vai trò do middleware.js gắn vào header "x-hn-role"):
//   Quản lý: tất cả. Nhân viên: chỉ PATCH và không được xoá gì (kể cả xoá
//   lồng bên trong như bớt size của 1 sản phẩm). Khách: không ghi gì.
import { readDoc, writeDoc, isPrecondition, sameEtag, peekCache } from "./blobDoc";
import { applyPatch, patchRemovesItems } from "./dataSync";

function roleOf(req) {
  const r = req.headers["x-hn-role"];
  return r === "admin" || r === "staff" || r === "guest" ? r : "guest";
}
function forbid(res, message) {
  return res.status(403).json({ error: message, forbidden: true });
}
const STAFF_NO_DELETE = "Chế độ Nhân viên không xoá được — nhờ Quản lý xoá giúp";

function parseBody(req) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  return body && typeof body === "object" ? body : null;
}

// normalize(raw) -> { data, upgraded }: chuẩn hoá/bổ sung dữ liệu mẫu như cũ.
// defaults(): dữ liệu khởi tạo khi file chưa từng tồn tại.
// viewFor(data, role) (không bắt buộc): lọc bớt dữ liệu trước khi trả về
// cho vai trò không phải Quản lý (VD ẩn mục "chỉ Quản lý xem").
// guestPatchOk(base, patch) (không bắt buộc): cho phép Khách gửi đúng những
// thay đổi hẹp mà hàm này chấp nhận (VD chỉ THÊM 1 mục lịch sử báo giá).
// Không khai báo thì Khách không ghi được gì.
export function makeDocHandler({ pathname, normalize, defaults, viewFor, guestPatchOk }) {
  async function readCurrent() {
    const doc = await readDoc(pathname);
    if (!doc.exists) return { exists: false, data: defaults(), fresh: true, etag: "", upgraded: false };
    const { data, upgraded } = normalize(doc.raw);
    return { exists: true, data, fresh: doc.fresh, etag: doc.etag, contentEtag: doc.contentEtag, upgraded };
  }

  async function handleGet(req, res) {
    const cur = await readCurrent();
    let etag = cur.exists ? (cur.fresh ? cur.etag : cur.contentEtag) : "";
    if (cur.exists && cur.upgraded && cur.fresh) {
      // Ghi lại bản đã chuẩn hoá — có ifMatch nên không đè mất lần ghi khác.
      try {
        etag = await writeDoc(pathname, cur.data, { ifMatch: cur.etag });
      } catch (e) {
        // Không ghi được (VD vừa có lần ghi khác chen vào) thì thôi, lần sau thử lại.
      }
    }
    res.setHeader("x-hn-etag", etag || "");
    res.setHeader("Cache-Control", "no-store");
    const role = roleOf(req);
    const out = viewFor && role !== "admin" ? viewFor(cur.data, role) : cur.data;
    return res.status(200).json(out);
  }

  async function handlePatch(req, res) {
    const body = parseBody(req);
    if (!body || !body.patch || typeof body.patch !== "object") return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const { baseEtag = "", patch } = body;
    const role = roleOf(req);
    if (role === "guest" && !guestPatchOk) return forbid(res, "Chế độ Khách chỉ xem, không sửa được");
    const GUEST_LIMIT = "Chế độ Khách chỉ được thêm mục mới, không sửa/xoá được";
    const blocked = (base) => role === "guest" && !guestPatchOk(base, patch);

    // Đường nhanh: server này còn nhớ bản nó vừa ghi -> ghép thẳng vào đó và
    // ghi có điều kiện ifMatch (bỏ qua bước hỏi head). Nếu trong lúc đó có ai
    // ghi khác, Blob từ chối lần ghi này -> rơi xuống đường chậm bên dưới.
    const cached = peekCache(pathname);
    if (cached) {
      const { data: base, upgraded } = normalize(cached.data);
      if (role === "staff" && patchRemovesItems(base, patch)) return forbid(res, STAFF_NO_DELETE);
      if (blocked(base)) return forbid(res, GUEST_LIMIT);
      const next = applyPatch(base, patch);
      try {
        const etag = await writeDoc(pathname, next, { ifMatch: cached.etag });
        const clientWasCurrent = sameEtag(baseEtag, cached.etag) && !upgraded;
        return res.status(200).json(clientWasCurrent ? { ok: true, etag } : { ok: true, etag, data: next });
      } catch (e) {
        if (!isPrecondition(e)) throw e;
      }
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const cur = await readCurrent();
      if (cur.exists && !cur.fresh) {
        // Nhân viên không được ghi cả khối -> chờ vài giây rồi gửi lại phần sửa.
        if (role === "admin" && sameEtag(baseEtag, cur.etag)) return res.status(409).json({ needFull: true, etag: cur.etag });
        return res.status(409).json({ retryLater: true });
      }
      if (role === "staff" && patchRemovesItems(cur.data, patch)) return forbid(res, STAFF_NO_DELETE);
      if (blocked(cur.data)) return forbid(res, GUEST_LIMIT);
      const next = applyPatch(cur.data, patch);
      let etag;
      try {
        etag = await writeDoc(pathname, next, cur.exists ? { ifMatch: cur.etag } : {});
      } catch (e) {
        if (isPrecondition(e)) continue; // có lần ghi khác chen vào -> đọc lại, ghép lại
        throw e;
      }
      // Máy gửi đang cầm đúng bản mới nhất -> không cần trả lại cả khối dữ
      // liệu. Còn nếu trên server có thay đổi từ nơi khác (máy khác vừa sửa)
      // thì trả về bản đã ghép để máy này cập nhật theo.
      const clientWasCurrent = cur.exists ? sameEtag(baseEtag, cur.etag) && !cur.upgraded : !baseEtag;
      return res.status(200).json(clientWasCurrent ? { ok: true, etag } : { ok: true, etag, data: next });
    }
    return res.status(409).json({ retryLater: true });
  }

  async function handlePost(req, res) {
    if (roleOf(req) !== "admin") return forbid(res, "Chỉ Quản lý mới ghi đè cả khối dữ liệu được");
    const body = parseBody(req);
    if (!body) return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    const ifMatch = req.headers["x-if-match"] || undefined;
    try {
      const etag = await writeDoc(pathname, body, ifMatch ? { ifMatch } : {});
      return res.status(200).json({ ok: true, etag });
    } catch (e) {
      if (isPrecondition(e)) return res.status(409).json({ conflict: true });
      throw e;
    }
  }

  return async function handler(req, res) {
    try {
      if (req.method === "GET") return await handleGet(req, res);
      if (req.method === "PATCH") return await handlePatch(req, res);
      if (req.method === "POST" || req.method === "PUT") return await handlePost(req, res);
      res.setHeader("Allow", ["GET", "POST", "PUT", "PATCH"]);
      return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
      return res.status(500).json({ error: (e && e.message) || "Lỗi máy chủ" });
    }
  };
}
