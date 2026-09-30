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

export function middleware(req) {
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
