// lib/nav.js — Thanh điều hướng dùng chung: hiện đủ mọi tính năng của app trên mọi trang.
import Link from "next/link";
import { useTheme, makeStyles } from "./theme";

export const NAV_ITEMS = [
  { href: "/", icon: "🏠", label: "Trang chủ" },
  { href: "/pricing", icon: "💰", label: "Tính giá" },
  { href: "/closet", icon: "👜", label: "Hàng Closet sẵn" },
  { href: "/gomcan", icon: "🧮", label: "Giá gồm cân" },
  { href: "/thietbi", icon: "🛁", label: "Thiết bị bếp & vệ sinh" },
  { href: "/backup", icon: "💾", label: "Sao lưu dữ liệu" },
];

function logout() {
  fetch("/api/logout", { method: "POST" }).finally(() => {
    window.location.href = "/login";
  });
}

export function PageHeader({ icon, title, current, maxWidth = 800 }) {
  const { theme: THEME } = useTheme();
  const { btnSub } = makeStyles(THEME);
  const items = NAV_ITEMS.filter((n) => n.href !== current);
  return (
    <header style={{ background: `linear-gradient(135deg, ${THEME.brand}18, ${THEME.bg})`, borderBottom: `1px solid ${THEME.line}` }}>
      <div style={{ maxWidth, margin: "0 auto", padding: "14px 18px 12px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: THEME.text, margin: "0 0 10px", fontFamily: THEME.headingFont }}>
          {icon} {title}
        </h1>
        {/* Menu 1 hàng ngang, vuốt sang được trên điện thoại — thay vì xuống
            2-3 hàng như trước làm đầu trang dài và rối. */}
        <nav className="hnNavScroll" style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", margin: "0 -18px", padding: "0 18px 2px" }}>
          {items.map((n) => (
            <Link key={n.href} href={n.href} style={{ ...btnSub, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
              {n.icon} {n.label}
            </Link>
          ))}
          <button
            title="Đăng xuất"
            onClick={logout}
            style={{ ...btnSub, background: "transparent", border: "none", color: THEME.subtext, whiteSpace: "nowrap", flexShrink: 0, marginLeft: "auto" }}
          >
            🚪 Đăng xuất
          </button>
        </nav>
      </div>
    </header>
  );
}
