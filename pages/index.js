// pages/index.js — Trang chủ / Menu chính
import Link from "next/link";
import { useTheme, ThemeToggle } from "../lib/theme";

const MENU = [
  { href: "/gomcan", icon: "🧮", title: "Giá gồm cân", desc: "Bảng giá Oni, Uni + GU, Gia dụng + TPCN" },
  { href: "/todo", icon: "✅", title: "Việc cần làm", desc: "Việc lẻ + việc cố định hàng ngày" },
  { href: "/fbcontent", icon: "✍️", title: "Viết bài FB", desc: "Tạo nhanh bài đăng hội nhóm / trang cá nhân" },
  { href: "/rewrite", icon: "📝", title: "Sửa bài theo khung", desc: "Ghép ý thô vào khung bài mẫu, viết lại bằng AI" },
  { href: "/customers", icon: "👥", title: "Khách hàng", desc: "Lưu thông tin và tra cứu khách hàng" },
  { href: "/news", icon: "📰", title: "Tin tức đồ Nhật", desc: "Lưu tin, gợi ý content bằng AI" },
  { href: "/warehouse", icon: "📦", title: "Kho sản phẩm", desc: "Gộp tìm kiếm toàn bộ sản phẩm, backup dữ liệu" },
];

export default function Home() {
  const { theme: THEME } = useTheme();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: THEME.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 20px",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <ThemeToggle />
      </div>

      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌸</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, color: THEME.text, margin: 0, fontFamily: THEME.headingFont }}>Hanaichi</h1>
        <p style={{ fontSize: 17, color: THEME.subtext, marginTop: 8 }}>Chọn mục bạn muốn làm</p>
      </div>

      <div className="menuGrid" style={{ width: "100%", maxWidth: 620 }}>
        {MENU.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="menuCard"
            style={{
              textDecoration: "none",
              background: THEME.surface,
              border: `1px solid ${THEME.line}`,
              borderRadius: 20,
              boxShadow: THEME.glow,
              padding: "28px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 44 }}>{m.icon}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: THEME.text }}>{m.title}</div>
            <div style={{ fontSize: 14, color: THEME.subtext, lineHeight: 1.4 }}>{m.desc}</div>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .menuGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        .menuCard {
          transition: transform 0.15s, border-color 0.15s;
        }
        .menuCard:active {
          transform: scale(0.97);
        }
        @media (max-width: 420px) {
          .menuGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
