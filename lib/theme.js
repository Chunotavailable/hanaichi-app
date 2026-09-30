// lib/theme.js
// Hệ thống theme dùng chung cho toàn app — 1 theme sáng, tông đỏ mận / hồng
// nhạt / be. Bản tinh chỉnh: màu thương hiệu đậm & sang hơn, nền thẻ trắng
// sạch, chữ phụ đậm hơn để dễ đọc (đạt độ tương phản chuẩn), bóng đổ nhẹ.
import { createContext, useContext } from "react";
import { AlertTriangle, WifiOff, RotateCw } from "lucide-react";

export const LIGHT = {
  mode: "light",
  bg: "#f7f2ee", // nền trang: be ấm trung tính
  surface: "#ffffff", // nền thẻ
  surfaceAlt: "#fbf7f4", // nền khối phụ bên trong thẻ
  text: "#2c1a1e", // chữ chính
  subtext: "#7a5c61", // chữ phụ (tương phản ≥ 4.5:1 trên nền trắng)
  muted: "#a8929a", // gợi ý / placeholder
  line: "#ebdfdb", // viền
  primary: "#e9c2c8", // hồng phấn (trang trí, cánh hoa)
  primary600: "#dea2ac",
  brand: "#9e2a3b", // đỏ mận thương hiệu
  brandHover: "#85202f",
  chipBg: "#f8ecee", // nền nhạt tông thương hiệu
  chipLine: "#eed3d8",
  success: "#1d7a4c",
  successBg: "#e9f6ef",
  successLine: "#c8e8d6",
  danger: "#c0262d",
  dangerBg: "#fdeeee",
  glow: "0 1px 2px rgba(44, 26, 30, 0.04), 0 6px 20px rgba(44, 26, 30, 0.05)",
  btnText: "#ffffff",
  headingFont: '"Playfair Display", Georgia, serif',
  bodyFont: '"Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
    card: { background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 14, boxShadow: theme.glow },
    // Nút chính: nền đỏ mận đặc, chữ trắng — rõ ràng là hành động chính.
    btn: {
      background: theme.brand,
      color: theme.btnText,
      border: `1px solid ${theme.brand}`,
      borderRadius: 10,
      padding: "9px 16px",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: 14.5,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      lineHeight: 1.2,
    },
    // Nút phụ: nền trắng, viền mảnh.
    btnSub: {
      background: theme.surface,
      color: theme.text,
      border: `1px solid ${theme.line}`,
      borderRadius: 10,
      padding: "7px 12px",
      fontWeight: 600,
      cursor: "pointer",
      fontSize: 14,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      lineHeight: 1.2,
    },
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 9,
      background: theme.surface,
      color: theme.subtext,
      border: `1px solid ${theme.line}`,
      cursor: "pointer",
      fontSize: 14,
      display: "grid",
      placeItems: "center",
      padding: 0,
      flexShrink: 0,
    },
    inp: { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.line}`, fontSize: 16, outline: "none", background: theme.surface, color: theme.text },
    chip: { display: "inline-flex", alignItems: "center", gap: 4, background: theme.chipBg, border: `1px solid ${theme.chipLine}`, color: theme.brand, borderRadius: 999, padding: "2px 10px", fontSize: 12.5, fontWeight: 600 },
    thumb: { width: 150, height: 150, minWidth: 150, borderRadius: 12, background: theme.surfaceAlt, border: `1px solid ${theme.line}`, display: "grid", placeItems: "center", overflow: "hidden", fontSize: 40, color: theme.muted },
  };
}

/* ================== Popup cảnh báo (xác nhận trước khi xoá...) ================== */
export function ConfirmDialog({ open, message, onCancel, onConfirm, confirmLabel = "Xoá", cancelLabel = "Huỷ" }) {
  const { theme: THEME } = useTheme();
  const { btn, btnSub } = makeStyles(THEME);
  if (!open) return null;
  return (
    <div
      onClick={onCancel}
      className="hnFade"
      style={{ position: "fixed", inset: 0, background: "rgba(44,26,30,0.42)", zIndex: 200, display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="hnPop"
        style={{
          background: THEME.surface,
          border: `1px solid ${THEME.line}`,
          borderRadius: 16,
          boxShadow: "0 20px 50px rgba(44,26,30,0.22)",
          padding: 22,
          maxWidth: 360,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: THEME.dangerBg, color: THEME.danger, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <AlertTriangle size={20} />
          </div>
          <div style={{ color: THEME.text, fontWeight: 600, fontSize: 15, lineHeight: 1.5, paddingTop: 2 }}>{message}</div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onCancel} style={btnSub}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{ ...btn, background: THEME.danger, borderColor: THEME.danger }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================== Màn hình báo lỗi tải dữ liệu — có nút Thử lại ================== */
export function LoadError({ onRetry }) {
  const { theme: THEME } = useTheme();
  const { btn } = makeStyles(THEME);
  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 320 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: THEME.chipBg, color: THEME.brand, display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
          <WifiOff size={26} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 17, color: THEME.text, marginBottom: 6 }}>Không tải được dữ liệu</div>
        <div style={{ fontSize: 14, color: THEME.subtext, lineHeight: 1.5, marginBottom: 18 }}>
          Có thể mạng đang chập chờn. Kiểm tra lại kết nối rồi bấm thử lại nhé.
        </div>
        <button onClick={onRetry} style={btn}>
          <RotateCw size={16} /> Thử lại
        </button>
      </div>
    </main>
  );
}

/* ================== Màn hình đang tải — vòng tròn xoay ================== */
export function Loading({ label }) {
  const { theme: THEME } = useTheme();
  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, display: "grid", placeItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `3px solid ${THEME.line}`,
            borderTopColor: THEME.brand,
            animation: "hnSpin 0.8s linear infinite",
          }}
        />
        <div style={{ color: THEME.subtext, fontSize: 14.5 }}>{label || "Đang tải..."}</div>
      </div>
    </main>
  );
}
