// middleware.js
// Chặn TOÀN BỘ trang và API của app phía sau 1 mật khẩu chung — trước đây
// web không có lớp bảo vệ nào, ai có link cũng gọi thẳng được các API lưu/xoá
// dữ liệu mà không cần đăng nhập. Middleware này chạy trước mọi request, nếu
// chưa có cookie đăng nhập hợp lệ thì:
//   - Vào 1 trang thường (VD /closet) -> chuyển hướng sang /login.
//   - Gọi thẳng 1 API (VD /api/gomcan) -> trả lỗi 401, KHÔNG cho đọc/ghi.
import { NextResponse } from "next/server";
import { hashPassword, getAppPassword, AUTH_COOKIE_NAME } from "./lib/authToken";

// Những đường dẫn không cần đăng nhập vẫn phải vào được (trang đăng nhập,
// API kiểm tra mật khẩu, file tĩnh Next.js tự phục vụ).
function isPublicPath(pathname) {
  if (pathname === "/login" || pathname === "/api/login") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.png" || pathname === "/favicon.ico") return true;
  return false;
}

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const expected = hashPassword(getAppPassword());
  const cookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (cookie === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
