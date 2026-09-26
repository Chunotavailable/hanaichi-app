// lib/theme.js
// Hệ thống theme dùng chung cho toàn app — chỉ còn 1 theme sáng, tông đỏ mận /
// hồng nhạt / be, cổ điển nữ tính.
import { createContext, useContext } from "react";

export const LIGHT = {
  mode: "light",
  bg: "#fbf1e8",
  surface: "#fffaf5",
  text: "#4a2429",
  subtext: "#a97a80",
  line: "#f1dad9",
  primary: "#eab8bf",
  primary600: "#dea2ac",
  brand: "#b23a48",
  chipBg: "#fbe6e6",
  chipLine: "#f3caca",
  glow: "0 10px 28px rgba(178, 58, 72, 0.10)",
  btnText: "#5c1620",
  headingFont: '"Playfair Display", Georgia, serif',
};

export const ThemeContext = createContext({ theme: LIGHT, mode: "light" });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  return <ThemeContext.Provider value={{ theme: LIGHT, mode: "light" }}>{children}</ThemeContext.Provider>;
}

/* ================== Bộ style dùng chung, tính theo theme hiện tại ================== */
export function makeStyles(theme) {
  return {
    card: { background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 18, boxShadow: theme.glow },
    btn: { background: theme.primary, color: theme.btnText, border: "none", borderRadius: 12, padding: "10px 16px", fontWeight: 700, cursor: "pointer", fontSize: 15 },
    btnSub: { background: theme.chipBg, color: theme.brand, border: `1px solid ${theme.chipLine}`, borderRadius: 12, padding: "6px 12px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    iconBtn: { width: 30, height: 30, borderRadius: 999, background: theme.chipBg, color: theme.brand, border: `1px solid ${theme.chipLine}`, cursor: "pointer", fontSize: 14, display: "grid", placeItems: "center" },
    inp: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.line}`, fontSize: 16, outline: "none", background: theme.bg, color: theme.text },
    chip: { display: "inline-block", background: theme.chipBg, border: `1px solid ${theme.chipLine}`, color: theme.brand, borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 600 },
    thumb: { width: 150, height: 150, minWidth: 150, borderRadius: 16, background: theme.chipBg, border: `1px solid ${theme.line}`, display: "grid", placeItems: "center", overflow: "hidden", fontSize: 40 },
  };
}

/* ================== Màn hình đang tải — vòng tròn xoay ================== */
export function Loading({ label }) {
  const { theme: THEME } = useTheme();
  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, display: "grid", placeItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            border: `3px solid ${THEME.chipLine}`,
            borderTopColor: THEME.brand,
            animation: "hnSpin 0.8s linear infinite",
          }}
        />
        <div style={{ color: THEME.subtext, fontSize: 15, letterSpacing: 0.3 }}>{label || "Đang tải"}</div>
      </div>
    </main>
  );
}
