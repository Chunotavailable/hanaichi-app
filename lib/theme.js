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

/* ================== Màn hình đang tải — hoa Hanaichi xoay vòng ================== */
const PETAL_ANGLES = [0, 72, 144, 216, 288];

export function Loading({ label }) {
  const { theme: THEME } = useTheme();
  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, display: "grid", placeItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <svg viewBox="0 0 120 120" width="96" height="96">
          <g transform="translate(60,60)">
            <g className="hnFlowerSpin">
              {PETAL_ANGLES.map((angle) => (
                <path
                  key={angle}
                  d="M0,-2 C13,-10 13,-34 0,-44 C-13,-34 -13,-10 0,-2 Z"
                  fill={THEME.primary}
                  stroke={THEME.brand}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  transform={`rotate(${angle})`}
                />
              ))}
              <circle r="9" fill="#f6d9a0" stroke={THEME.brand} strokeWidth="1" />
              {PETAL_ANGLES.map((angle) => (
                <circle key={angle} r="1.6" fill={THEME.brand} transform={`rotate(${angle}) translate(0,-9)`} />
              ))}
            </g>
          </g>
        </svg>
        <div style={{ color: THEME.subtext, fontSize: 15, letterSpacing: 0.3 }}>{label || "Đang tải"}</div>
      </div>
      <style jsx>{`
        .hnFlowerSpin {
          transform-origin: 0 0;
          animation: hnFlowerSpin 2.4s linear infinite;
        }
        @keyframes hnFlowerSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}
