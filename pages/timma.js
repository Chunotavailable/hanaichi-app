// pages/timma.js — Tab riêng "Tìm mã từ ảnh" (đứng sau tab Tính giá).
// Toàn bộ chạy trên trình duyệt, không gọi máy chủ nên không tốn giới hạn Cloudflare.
import { useTheme, makeStyles } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import CodeFinder from "../lib/CodeFinder";
import { Search } from "lucide-react";

export default function TimMaPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, inp } = makeStyles(THEME);
  const cardTitle = (Icon, text, sub) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: THEME.chipBg, color: THEME.brand, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon size={17} />
      </span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15.5, color: THEME.text }}>{text}</div>
        {sub && <div style={{ fontSize: 12.5, color: THEME.subtext }}>{sub}</div>}
      </div>
    </div>
  );
  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Tìm mã từ ảnh" current="/timma" maxWidth={900} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        <CodeFinder T={{ THEME, card, btn, btnSub, inp }} cardTitle={cardTitle} />
      </div>
    </main>
  );
}
