// lib/perm.js — Giao diện biết đang ở chế độ nào để ẩn/hiện nút.
// CHỈ để hiển thị cho gọn: quyền thật luôn được server kiểm tra lại
// (middleware.js + lib/docApi.js), sửa cookie này cũng không làm được gì hơn.
import { createContext, useContext, useEffect, useState } from "react";

export const ROLE_LABELS = { admin: "Quản lý", staff: "Nhân viên", guest: "Khách" };

export function readRoleCookie() {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)hn_role=(admin|staff|guest)/);
  return m ? m[1] : null;
}

export function permFor(role) {
  return {
    role,
    label: ROLE_LABELS[role] || "",
    canEdit: role === "admin" || role === "staff", // thêm/sửa
    canDelete: role === "admin", // xoá
    isAdmin: role === "admin", // sao lưu, khôi phục...
  };
}

const PermContext = createContext(permFor(null));

export function PermProvider({ children }) {
  // Chưa đọc được cookie (lúc render trên server) thì coi như chỉ xem —
  // tránh nháy hiện nút sửa rồi mới ẩn.
  const [role, setRole] = useState(null);
  useEffect(() => {
    setRole(readRoleCookie());
  }, []);
  return <PermContext.Provider value={permFor(role)}>{children}</PermContext.Provider>;
}

export function usePerm() {
  return useContext(PermContext);
}
