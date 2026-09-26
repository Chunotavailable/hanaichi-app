// lib/nav.js — Thanh điều hướng dùng chung: hiện đủ mọi tính năng của app trên mọi trang.
import Link from "next/link";
import { useTheme, makeStyles } from "./theme";

export const NAV_ITEMS = [
  { href: "/", icon: "🏠", label: "Trang chủ" },
  { href: "/gomcan", icon: "🧮", label: "Giá gồm cân" },
  { href: "/closet", icon: "👜", label: "Hàng Closet sẵn" },
  { href: "/pricing", icon: "💰", label: "Báo giá nhanh" },
  { href: "/todo", icon: "✅", label: "Việc cần làm" },
  { href: "/customers", icon: "👥", label: "Khách hàng" },
];

export function PageHeader({ icon, title, current, maxWidth = 800 }) {
  const { theme: THEME } = useTheme();
  const { btnSub } = makeStyles(THEME);
  const items = NAV_ITEMS.filter((n) => n.href !== current);
  return (
    <header style={{ background: `linear-gradient(135deg, ${THEME.brand}18, ${THEME.bg})`, borderBottom: `1px solid ${THEME.line}` }}>
      <div style={{ maxWidth, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, margin: 0, fontFamily: THEME.headingFont }}>
          {icon} {title}
        </h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.map((n) => (
            <Link key={n.href} href={n.href} style={{ ...btnSub, textDecoration: "none" }}>
              {n.icon} {n.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
