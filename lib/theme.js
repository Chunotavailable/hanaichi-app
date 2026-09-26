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

/* ================== Màn hình đang tải — cô bé chạy giữa cánh đồng cỏ ================== */
export function Loading({ label }) {
  const { theme: THEME } = useTheme();
  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, display: "grid", placeItems: "center", overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <svg viewBox="0 0 320 170" width="280" height="149" style={{ overflow: "visible" }}>
          <circle cx="270" cy="34" r="18" fill="#f6d9a0" opacity="0.9" />
          <path d="M0,150 Q80,120 160,140 T320,135 V170 H0 Z" fill="#d9e6c3" />
          <path d="M0,158 Q90,138 170,152 T320,150 V170 H0 Z" fill="#c3d6ac" />
          {Array.from({ length: 11 }).map((_, i) => (
            <path
              key={i}
              d={`M${10 + i * 30},166 q3,-14 6,0`}
              stroke="#94ab78"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              className="hnBlade"
              style={{ animationDelay: `${(i % 5) * 0.15}s` }}
            />
          ))}
          <g transform="translate(160,143)">
            <g className="hnRunner">
              <g className="hnBob">
                <ellipse cx="0" cy="-49" rx="9" ry="9" fill="#3a2b28" />
                <ellipse cx="-9" cy="-53" rx="4" ry="6" fill="#3a2b28" />
                <ellipse cx="9" cy="-53" rx="4" ry="6" fill="#3a2b28" />
                <path d="M-9,-43 Q0,-25 9,-43 L11,-15 Q0,-9 -11,-15 Z" fill={THEME.brand} />
                <rect x="-13" y="-39" width="9" height="4" rx="2" fill={THEME.brand} className="hnArmBack" />
                <rect x="4" y="-39" width="9" height="4" rx="2" fill={THEME.brand} className="hnArmFront" />
                <rect x="-8" y="-17" width="6" height="17" rx="3" fill="#3a2b28" className="hnLegBack" />
                <rect x="2" y="-17" width="6" height="17" rx="3" fill="#3a2b28" className="hnLegFront" />
              </g>
            </g>
          </g>
        </svg>
        <div style={{ color: THEME.subtext, fontSize: 15, letterSpacing: 0.3, marginTop: 4 }}>{label || "Đang tải"}</div>
      </div>
      <style jsx>{`
        .hnRunner {
          animation: hnDash 2.6s ease-in-out infinite alternate;
        }
        .hnBob {
          animation: hnRunBob 0.42s ease-in-out infinite;
          transform-origin: 0 0;
        }
        .hnArmBack,
        .hnLegBack {
          transform-origin: 0 -17px;
          animation: hnSwingBack 0.42s ease-in-out infinite;
        }
        .hnArmFront,
        .hnLegFront {
          transform-origin: 6px -17px;
          animation: hnSwingFront 0.42s ease-in-out infinite;
        }
        .hnBlade {
          transform-origin: bottom center;
          animation: hnSway 2.2s ease-in-out infinite;
        }
        @keyframes hnDash {
          from {
            transform: translateX(-110px);
          }
          to {
            transform: translateX(110px);
          }
        }
        @keyframes hnRunBob {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes hnSwingBack {
          0%,
          100% {
            transform: rotate(35deg);
          }
          50% {
            transform: rotate(-35deg);
          }
        }
        @keyframes hnSwingFront {
          0%,
          100% {
            transform: rotate(-35deg);
          }
          50% {
            transform: rotate(35deg);
          }
        }
        @keyframes hnSway {
          0%,
          100% {
            transform: rotate(-4deg);
          }
          50% {
            transform: rotate(4deg);
          }
        }
      `}</style>
    </main>
  );
}
