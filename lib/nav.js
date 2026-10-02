// lib/nav.js — Thanh điều hướng dùng chung cho mọi trang.
// Hàng trên: logo (về trang chủ), chế độ đang dùng, đăng xuất.
// Hàng dưới: các tab tính năng (tab đang mở được tô nổi), vuốt ngang được
// trên điện thoại. Bên dưới là tiêu đề trang.
import Link from "next/link";
import { useEffect } from "react";
import { prefetchTab } from "./prefetch";
import { Flower2, Calculator, ShoppingBag, Scale, ShowerHead, Store, ScanSearch, MessageSquareText, DatabaseBackup, LogOut, ShieldCheck, Eye } from "lucide-react";
import { useTheme, makeStyles } from "./theme";
import { usePerm } from "./perm";

export const NAV_ITEMS = [
  { href: "/pricing", Icon: Calculator, label: "Tính giá" },
  { href: "/timma", Icon: ScanSearch, label: "Tìm mã từ ảnh" },
  { href: "/sieuthi", Icon: Store, label: "Giá siêu thị" },
  { href: "/closet", Icon: ShoppingBag, label: "Hàng Closet sẵn" },
  { href: "/gomcan", Icon: Scale, label: "Giá gồm cân" },
  { href: "/thietbi", Icon: ShowerHead, label: "Thiết bị bếp & vệ sinh" },
  { href: "/tracuu", Icon: MessageSquareText, label: "Tra cứu nhanh" },
  { href: "/backup", Icon: DatabaseBackup, label: "Sao lưu dữ liệu", adminOnly: true },
];

export function visibleNavItems(perm) {
  return NAV_ITEMS.filter((n) => !n.adminOnly || perm.isAdmin);
}

export function logout() {
  fetch("/api/logout", { method: "POST" }).finally(() => {
    window.location.href = "/login";
  });
}

const ROLE_STYLE = {
  admin: { Icon: ShieldCheck, bg: "#f8ecee", fg: "#9e2a3b", line: "#eed3d8", text: "Quản lý" },
  guest: { Icon: Eye, bg: "#f2eeec", fg: "#6b5a5d", line: "#e3dad7", text: "Khách · chỉ xem" },
};

export function RoleBadge({ role }) {
  const s = ROLE_STYLE[role];
  if (!s) return null;
  const { Icon } = s;
  return (
    <span
      title="Chế độ đang dùng"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, color: s.fg, border: `1px solid ${s.line}`, borderRadius: 999, padding: "3px 10px", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}
    >
      <Icon size={14} /> {s.text}
    </span>
  );
}

export function BrandMark({ size = 19 }) {
  const { theme: THEME } = useTheme();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: THEME.text }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/favicon.png?v=2" alt="" width={size + 11} height={size + 11} style={{ borderRadius: 9, display: "block" }} />
      <span style={{ fontFamily: '"Fredoka", "Nunito", system-ui, sans-serif', fontWeight: 700, fontSize: size + 3, letterSpacing: 0.3 }}>Hanaichi</span>
    </span>
  );
}

export function PageHeader({ title, current, maxWidth = 800 }) {
  // Rảnh thì tải trước dữ liệu các tab khác để bấm sang là có ngay.
  useEffect(() => {
    const t = setTimeout(() => {
      ["/pricing", "/sieuthi", "/closet", "/thietbi", "/tracuu"].forEach((h) => {
        if (h !== current) prefetchTab(h);
      });
    }, 1200);
    return () => clearTimeout(t);
  }, [current]);

  const { theme: THEME } = useTheme();
  const { iconBtn } = makeStyles(THEME);
  const perm = usePerm();
  const items = visibleNavItems(perm);
  const currentItem = NAV_ITEMS.find((n) => n.href === current);
  const TitleIcon = currentItem ? currentItem.Icon : null;
  return (
    <>
      <header style={{ background: THEME.surface, borderBottom: `1px solid ${THEME.line}` }}>
        {/* Cùng 1 độ rộng ở mọi trang để các tab không "nhảy" khi chuyển trang. */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "10px 18px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 40 }}>
            <Link href="/" style={{ textDecoration: "none" }} aria-label="Về trang chủ">
              <BrandMark />
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RoleBadge role={perm.role} />
              <button title="Đăng xuất" aria-label="Đăng xuất" onClick={logout} style={iconBtn}>
                <LogOut size={16} />
              </button>
            </div>
          </div>
          <nav className="hnNavScroll hnTabs" style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {items.map((n) => {
              const active = n.href === current;
              const { Icon } = n;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onMouseEnter={() => prefetchTab(n.href)}
                  onTouchStart={() => prefetchTab(n.href)}
                  onFocus={() => prefetchTab(n.href)}
                  aria-current={active ? "page" : undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 11px 10px",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    color: active ? THEME.brand : THEME.subtext,
                    borderBottom: `2px solid ${active ? THEME.brand : "transparent"}`,
                    marginBottom: -1,
                  }}
                >
                  <Icon size={16} /> {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div style={{ maxWidth, margin: "0 auto", padding: "20px 18px 0" }}>
        <h1 style={{ fontSize: 25, fontWeight: 700, color: THEME.text, margin: 0, fontFamily: THEME.headingFont, display: "flex", alignItems: "center", gap: 10, lineHeight: 1.25 }}>
          {TitleIcon && (
            <span style={{ width: 36, height: 36, borderRadius: 10, background: THEME.chipBg, color: THEME.brand, display: "grid", placeItems: "center", flexShrink: 0 }}>
              <TitleIcon size={19} />
            </span>
          )}
          {title}
        </h1>
      </div>
    </>
  );
}
