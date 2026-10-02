// middleware.js
// Chạy trước MỌI request: xác định vai trò (Quản lý / Khách) từ
// cookie đăng nhập và chặn thật những gì vai trò đó không được làm:
//   - Chưa đăng nhập: trang -> chuyển sang /login; API -> 401.
//   - Khách: mọi thao tác ghi vào API -> 403 (trừ việc THÊM mã vào lịch sử báo giá).
//   - Trang Sao lưu dữ liệu: chỉ Quản lý.
// Vai trò được gắn vào header "x-hn-role" (ghi đè mọi giá trị trình duyệt tự
// gửi) để API phía sau biết, và vào cookie hn_role để giao diện ẩn/hiện nút.
import { NextResponse } from "next/server";
import { roleForToken, AUTH_COOKIE_NAME, ROLE_COOKIE_NAME } from "./lib/authToken";
import { getImage, peekDocEtagRaw, readDocText } from "./lib/blobDoc";

function isPublicPath(pathname) {
  if (pathname === "/login" || pathname === "/api/login" || pathname === "/api/logout") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.png" || pathname === "/favicon.ico") return true;
  return false;
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const ADMIN_ONLY_PAGES = new Set(["/backup"]);

function forbidden(message) {
  return NextResponse.json({ error: message, forbidden: true }, { status: 403 });
}

// Mã file Google Sheet (để truyền thẳng file về trình duyệt, xem bên dưới).
const SHEET_IDS = {
  closet: process.env.CLOSET_SHEET_ID || "1Tiu2VBfxwtACu5wpOTXrNSznoaxBdJj9u3J_WB0uLbc",
  giadung: process.env.GIADUNG_SHEET_ID || "1veT2iJyBcVh8xeZDHCX671z4gVSzfdYI6NPGzeelbJs",
  thietbi: process.env.THIETBI_SHEET_ID || "1uiRqJREl5qmeR_18eGAeVWc29B8Yt5b4tMPLZxLgR2k",
  sieuthi: process.env.SIEUTHI_SHEET_ID || "1lvYNvdZ0wfoxGPXM8vn2UMLLKg_9CtLDCT5pJ8HiikA",
};
const TESTING = !!(process.env.HANAICHI_CLOSET_FILE || process.env.HANAICHI_GIADUNG_FILE || process.env.HANAICHI_THIETBI_FILE || process.env.HANAICHI_SHEET_FILE);

// File Excel của Google có thể nặng vài MB. Truyền THẲNG từ Google về trình duyệt (không qua phần xử lý API,
// vốn tốn bộ nhớ/tính toán và bị Cloudflare gói miễn phí cắt giữa chừng). Không được thì trả lại cho API xử lý (có phương án dự phòng).
async function passThroughSheet(req, role) {
  const tab = req.nextUrl.searchParams.get("tab") || "";
  const id = SHEET_IDS[tab];
  if (!id || TESTING) return null;
  try {
    const up = await fetch(`${process.env.SHEET_UPSTREAM || "https://docs.google.com"}/spreadsheets/d/${id}/export?format=xlsx`, { redirect: "follow", signal: AbortSignal.timeout(50000) });
    const ct = up.headers.get("content-type") || "";
    if (!up.ok || !up.body || /text\/html/i.test(ct)) { try { await up.body?.cancel(); } catch {} return null; }
    return new Response(up.body, { status: 200, headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "x-sheet-format": "xlsx" } });
  } catch {
    return null;
  }
}

// Phục vụ ảnh bằng đường ngắn nhất (bỏ qua phần xử lý API nặng) để mỗi ảnh tốn ít thời gian tính toán nhất.
// Lỗi gì thì trả lại cho API cũ xử lý như trước.
async function serveImage(req) {
  try {
    const name = decodeURIComponent(req.nextUrl.pathname.slice("/api/img/".length)).replace(/[^\w.-]/g, "_");
    const img = await getImage(name);
    if (!img) return null;
    return new Response(Buffer.from(img.b64, "base64"), {
      status: 200,
      headers: { "Content-Type": img.type || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return null;
  }
}

// Bảng "Giá siêu thị" (~400KB) chỉ đọc: trả nguyên văn từ database, và trả "304 chưa đổi" khi máy đã có bản mới nhất
// -> hầu như không tốn tính toán. Chưa có dữ liệu / lỗi thì trả lại cho API cũ xử lý.
async function serveSieuthi(req) {
  try {
    const PATH = "sieuthi/cache.json";
    const etag = await peekDocEtagRaw(PATH);
    if (!etag) return null;
    const tag = `"${etag}"`;
    const headers = { ETag: tag, "x-hn-etag": etag, "Cache-Control": "private, no-cache" };
    const inm = (req.headers.get("if-none-match") || "").replace(/^W\//, "");
    if (inm === tag) return new Response(null, { status: 304, headers });
    const doc = await readDocText(PATH);
    if (!doc) return null;
    return new Response(doc.text, { status: 200, headers: { ...headers, ETag: `"${doc.etag}"`, "x-hn-etag": doc.etag, "Content-Type": "application/json; charset=utf-8" } });
  } catch {
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const role = roleForToken(req.cookies.get(AUTH_COOKIE_NAME)?.value);
  if (!role) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (ADMIN_ONLY_PAGES.has(pathname) && role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/api/img/") && req.method === "GET" && !process.env.HANAICHI_MEMORY_BLOB) {
    const img = await serveImage(req);
    if (img) return img;
  }

  if (pathname === "/api/sieuthi" && req.method === "GET" && !process.env.HANAICHI_MEMORY_BLOB) {
    const r = await serveSieuthi(req);
    if (r) return r;
  }

  if (pathname === "/api/sheet-raw" && req.method === "GET") {
    const pass = await passThroughSheet(req, role);
    if (pass) return pass;
  }

  if (pathname.startsWith("/api/") && !READ_METHODS.has(req.method)) {
    // Ngoại lệ: Khách được gửi PATCH lên /api/pricing để lưu mã vào lịch sử báo
    // giá — lib/docApi.js + pages/api/pricing.js kiểm tra tiếp là chỉ THÊM mới.
    const guestMayAdd = role === "guest" && req.method === "PATCH" && pathname === "/api/pricing";
    if (role !== "admin" && !guestMayAdd) return forbidden("Chế độ Khách chỉ xem, không sửa được");
  }

  const headers = new Headers(req.headers);
  headers.set("x-hn-role", role);
  const res = NextResponse.next({ request: { headers } });
  if (req.cookies.get(ROLE_COOKIE_NAME)?.value !== role) {
    res.cookies.set(ROLE_COOKIE_NAME, role, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 180 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
