// lib/theme.js
// Hệ thống theme dùng chung cho toàn app: theme sáng (mặc định) + theme tối,
// có nút bật/tắt, nhớ lựa chọn của người dùng qua localStorage (chỉ là sở thích
// hiển thị trên máy đó, không phải dữ liệu công việc nên không cần lưu lên Blob).
import { createContext, useContext, useEffect, useState } from "react";
import { playClick } from "./sound";

export const LIGHT = {
  mode: "light",
  bg: "#faf6ec",
  surface: "#ffffff",
  text: "#2b2a24",
  subtext: "#8a8371",
  line: "#e7e0cd",
  primary: "#bcdcef",
  primary600: "#8fc3e0",
  brand: "#d97757",
  chipBg: "#f2ede0",
  chipLine: "#e4dcc8",
  glow: "0 10px 28px rgba(60, 50, 30, 0.08)",
  btnText: "#20323e",
  headingFont: '"Playfair Display", Georgia, serif',
};

export const DARK = {
  mode: "dark",
  bg: "#0f1117",
  surface: "#1b1e29",
  text: "#f1f2f7",
  subtext: "#9aa1b8",
  line: "#2b2f40",
  primary: "#ff9dc0",
  primary600: "#ff7fae",
  brand: "#ff85ae",
  chipBg: "#242837",
  chipLine: "#363b52",
  glow: "0 10px 30px rgba(0, 0, 0, 0.5)",
  btnText: "#3a0f22",
  headingFont: '"Playfair Display", Georgia, serif',
};

export const ThemeContext = createContext({
  theme: LIGHT,
  mode: "light",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "hanaichi_theme_mode";

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") setMode(saved);
    } catch (e) {
      /* ignore */
    }
    setReady(true);
  }, []);

  function toggleTheme() {
    setMode((m) => {
      const next = m === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch (e) {
        /* ignore */
      }
      return next;
    });
  }

  const theme = mode === "dark" ? DARK : LIGHT;

  // Tránh nháy sai theme trước khi đọc xong localStorage lần đầu
  if (!ready) {
    return <div style={{ minHeight: "100vh", background: LIGHT.bg }} />;
  }

  return <ThemeContext.Provider value={{ theme, mode, toggleTheme }}>{children}</ThemeContext.Provider>;
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

/* ================== Nút bật/tắt theme ================== */
export function ThemeToggle({ style }) {
  const { mode, toggleTheme, theme } = useTheme();
  const [spin, setSpin] = useState(0);
  return (
    <button
      onClick={() => {
        playClick();
        setSpin((s) => s + 1);
        toggleTheme();
      }}
      title={mode === "light" ? "Chuyển sang theme tối" : "Chuyển sang theme sáng"}
      style={{
        background: theme.chipBg,
        color: theme.brand,
        border: `1px solid ${theme.chipLine}`,
        borderRadius: 999,
        width: 40,
        height: 40,
        fontSize: 18,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <span key={spin} style={{ display: "inline-block", animation: spin ? "hnSpinOnce 0.35s ease" : "none" }}>
        {mode === "light" ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
