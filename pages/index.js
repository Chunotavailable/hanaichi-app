// pages/index.js — Trang chủ: chỉ hiện 1 câu quote động lực, đổi mỗi lần mở lại
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme, makeStyles } from "../lib/theme";
import { NAV_ITEMS } from "../lib/nav";
import { playClick } from "../lib/sound";

const QUOTES = [
  "Không có con đường nào dẫn đến thành công mà không đi qua sự kiên trì.",
  "Mỗi ngày cố gắng thêm một chút, một năm sau nhìn lại sẽ thấy khác biệt rất nhiều.",
  "Việc khó không phải để làm nản lòng, mà để phân biệt ai thật sự muốn đi tới cùng.",
  "Thành công không đến từ một ngày rực rỡ, mà từ rất nhiều ngày bình thường làm việc chăm chỉ.",
  "Đừng sợ đi chậm, chỉ sợ đứng yên.",
  "Cách tốt nhất để dự đoán tương lai là tự tay tạo ra nó.",
  "Ai cũng có ngày mệt mỏi, quan trọng là vẫn bước tiếp vào ngày hôm sau.",
  "Kỷ luật là cây cầu nối giữa mục tiêu và thành quả.",
  "Làm việc chăm chỉ trong im lặng, để thành quả tự cất tiếng nói thay mình.",
  "Không ai giỏi ngay từ đầu, chỉ có ai chịu luyện tập đủ lâu.",
  "Hôm nay khó khăn, ngày mai khó khăn hơn, nhưng ngày kia sẽ rất tươi đẹp.",
  "Bình tĩnh mà sống, chăm chỉ mà làm, rồi mọi thứ sẽ đến đúng lúc của nó.",
  "Đừng so sánh hành trình của mình với người khác, ai cũng có tốc độ riêng.",
  "Cứ gieo hạt tử tế, đến lúc gặt sẽ không thiệt bao giờ.",
  "Người thành công không phải người chưa từng vấp ngã, mà là người luôn đứng dậy.",
  "Một chút cố gắng mỗi ngày, cộng dồn lại sẽ thành một sự thay đổi lớn.",
  "Việc hôm nay chớ để ngày mai, vì ngày mai còn có việc của ngày mai.",
  "Sự bền bỉ âm thầm luôn đáng giá hơn những lời hứa hẹn ồn ào.",
  "Cứ làm tốt phần việc của mình, kết quả tự khắc sẽ theo sau.",
  "Thay vì lo lắng về những gì chưa làm được, hãy bắt tay vào làm điều có thể làm ngay bây giờ.",
];

export default function Home() {
  const { theme: THEME } = useTheme();
  const { btnSub } = makeStyles(THEME);
  const [quote, setQuote] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Chọn quote ngẫu nhiên sau khi mount ở client — tránh lệch giữa server/client (hydration).
  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: THEME.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 28px",
        position: "relative",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 18 }}>🌸</div>
      <p
        key={quote}
        className="hnCard"
        style={{
          maxWidth: 620,
          minHeight: 78,
          textAlign: "center",
          fontFamily: THEME.headingFont,
          fontStyle: "italic",
          fontSize: 26,
          lineHeight: 1.5,
          color: THEME.text,
          margin: 0,
        }}
      >
        {quote ? `“${quote}”` : ""}
      </p>
      <div style={{ marginTop: 22, fontSize: 14, color: THEME.subtext, letterSpacing: 1 }}>HANAICHI</div>

      <div style={{ position: "fixed", left: 18, bottom: 18, zIndex: 50 }}>
        {menuOpen && (
          <div
            className="hnCard"
            style={{
              marginBottom: 10,
              background: THEME.surface,
              border: `1px solid ${THEME.line}`,
              borderRadius: 16,
              boxShadow: THEME.glow,
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              width: 210,
            }}
          >
            {NAV_ITEMS.filter((n) => n.href !== "/").map((n) => (
              <Link key={n.href} href={n.href} style={{ ...btnSub, textDecoration: "none", textAlign: "left" }} onClick={playClick}>
                {n.icon} {n.label}
              </Link>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            playClick();
            setMenuOpen((v) => !v);
          }}
          title="Chức năng"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: THEME.brand,
            color: "#fff",
            border: "none",
            fontSize: 20,
            cursor: "pointer",
            boxShadow: THEME.glow,
            display: "grid",
            placeItems: "center",
          }}
        >
          ☰
        </button>
      </div>
    </main>
  );
}
