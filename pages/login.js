// pages/login.js — Màn hình nhập mật khẩu để vào web. Mật khẩu nào thì vào
// đúng chế độ đó (Quản lý / Khách) — xem lib/authToken.js.
import { useState } from "react";
import { useRouter } from "next/router";
import { LockKeyhole, ArrowRight } from "lucide-react";
import { useTheme, makeStyles } from "../lib/theme";
import { BrandMark } from "../lib/nav";

export default function LoginPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, inp } = makeStyles(THEME);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || "Sai mật khẩu, thử lại giúp em ạ");
        setBusy(false);
        return;
      }
      const next = typeof router.query.next === "string" ? router.query.next : "/";
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch {
      setError("Không kết nối được, thử lại giúp em ạ");
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <BrandMark size={22} />
        </div>
        <form onSubmit={submit} className="hnPop" style={{ ...card, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: THEME.chipBg, color: THEME.brand, display: "grid", placeItems: "center" }}>
              <LockKeyhole size={17} />
            </span>
            <div style={{ fontWeight: 700, fontSize: 17, color: THEME.text }}>Đăng nhập</div>
          </div>
          <div style={{ fontSize: 13.5, color: THEME.subtext, margin: "8px 0 16px", lineHeight: 1.5 }}>
            Nhập mật khẩu được cấp — web tự vào đúng chế độ <b style={{ color: THEME.text, fontWeight: 600 }}>Quản lý</b> hoặc{" "}
            <b style={{ color: THEME.text, fontWeight: 600 }}>Khách</b>.
          </div>
          <input
            autoFocus
            type="password"
            autoComplete="current-password"
            style={inp}
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={{ color: THEME.danger, fontSize: 13.5, marginTop: 10, fontWeight: 500 }}>{error}</div>}
          <button type="submit" style={{ ...btn, width: "100%", marginTop: 14, padding: "11px 16px" }} disabled={busy || !password.trim()}>
            {busy ? "Đang kiểm tra..." : "Vào web"} {!busy && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </main>
  );
}
