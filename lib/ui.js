// lib/ui.js — Các thành phần giao diện dùng chung để mọi trang đồng bộ.
import { useEffect, useState } from "react";
import { Search, X, Undo2 } from "lucide-react";

// Nút lọc dạng viên thuốc: bật = nền đỏ mận chữ trắng, tắt = nền trắng viền mảnh.
export function FilterChip({ active, onClick, children, tone = "brand", small, T, title }) {
  const { THEME } = T;
  const activeBg = tone === "danger" ? THEME.danger : THEME.brand;
  return (
    <button
      onClick={onClick}
      aria-pressed={!!active}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        whiteSpace: "nowrap",
        flexShrink: 0,
        borderRadius: 999,
        padding: small ? "4px 11px" : "6px 13px",
        fontSize: small ? 13 : 13.5,
        fontWeight: 600,
        cursor: "pointer",
        lineHeight: 1.3,
        background: active ? activeBg : THEME.surface,
        color: active ? "#fff" : THEME.text,
        border: `1px solid ${active ? activeBg : THEME.line}`,
      }}
    >
      {children}
    </button>
  );
}

// Ô tìm kiếm có biểu tượng kính lúp và nút xoá nhanh.
export function SearchInput({ value, onChange, placeholder, T, style }) {
  const { THEME, inp } = T;
  return (
    <div style={{ position: "relative", ...style }}>
      <Search size={17} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: THEME.muted, pointerEvents: "none" }} />
      <input
        style={{ ...inp, paddingLeft: 38, paddingRight: value ? 36 : 12 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type="search"
        enterKeyHint="search"
      />
      {value && (
        <button
          aria-label="Xoá tìm kiếm"
          onClick={() => onChange("")}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 28, height: 28, border: "none", background: "transparent", color: THEME.muted, cursor: "pointer", display: "grid", placeItems: "center", borderRadius: 8 }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, T }) {
  const { THEME } = T;
  return (
    <div style={{ textAlign: "center", padding: "36px 16px", color: THEME.subtext }}>
      {Icon && (
        <div style={{ width: 48, height: 48, borderRadius: 14, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, display: "grid", placeItems: "center", margin: "0 auto 10px", color: THEME.muted }}>
          <Icon size={22} />
        </div>
      )}
      <div style={{ fontWeight: 600, color: THEME.text, fontSize: 15 }}>{title}</div>
      {hint && <div style={{ fontSize: 13.5, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

// Tiêu đề 1 nhóm (danh mục) kèm số lượng.
export function GroupTitle({ children, count, T, right }) {
  const { THEME } = T;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "0 0 10px" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: THEME.text, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {children}
        {count != null && (
          <span style={{ fontSize: 12, fontWeight: 600, color: THEME.subtext, background: THEME.surface, border: `1px solid ${THEME.line}`, borderRadius: 999, padding: "1px 8px" }}>{count}</span>
        )}
      </h2>
      {right}
    </div>
  );
}

// Ảnh giữ chỗ khi sản phẩm chưa có ảnh: nền nhạt + biểu tượng mờ.
export function ImagePlaceholder({ icon: Icon, size = 30, T }) {
  const { THEME } = T;
  return (
    <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: THEME.surfaceAlt, color: THEME.muted }}>
      {Icon && <Icon size={size} strokeWidth={1.5} />}
    </div>
  );
}

// Thanh thông báo "Đã xoá..." nổi ở đáy màn hình kèm nút Hoàn tác, tự đếm
// ngược 10s (đồng bộ với thời gian cho phép hoàn tác ở trang gọi).
export function UndoToast({ message, onUndo }) {
  const [secondsLeft, setSecondsLeft] = useState(10);
  useEffect(() => {
    setSecondsLeft(10);
    const iv = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [message]);
  return (
    <div
      className="hnPop"
      role="status"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        zIndex: 200,
        background: "#2c1a1e",
        color: "#fff",
        borderRadius: 12,
        padding: "8px 8px 8px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        maxWidth: "calc(100vw - 32px)",
      }}
    >
      <span style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message}</span>
      <button
        onClick={onUndo}
        style={{ flexShrink: 0, background: "#fff", color: "#2c1a1e", border: "none", borderRadius: 8, padding: "7px 12px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <Undo2 size={15} /> Hoàn tác ({secondsLeft}s)
      </button>
    </div>
  );
}
