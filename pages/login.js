// pages/login.js — Màn hình nhập mật khẩu để vào web.
import { useState } from "react";
import { useRouter } from "next/router";
import { useTheme, makeStyles } from "../lib/theme";

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
      <form onSubmit={submit} style={{ ...card, padding: 28, width: "100%", maxWidth: 340, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🌸</div>
        <div style={{ fontWeight: 800, fontSize: 20, color: THEME.text, marginBottom: 4, fontFamily: THEME.headingFont }}>Hanaichi</div>
        <div style={{ fontSize: 13.5, color: THEME.subtext, marginBottom: 18 }}>Nhập mật khẩu để vào web</div>
        <input
          autoFocus
          type="password"
          style={{ ...inp, textAlign: "center", fontSize: 18, letterSpacing: 2 }}
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div style={{ color: "#dc2626", fontSize: 13.5, marginTop: 10, fontWeight: 600 }}>{error}</div>}
        <button type="submit" style={{ ...btn, width: "100%", marginTop: 16 }} disabled={busy || !password.trim()}>
          {busy ? "Đang kiểm tra..." : "Vào web"}
        </button>
      </form>
    </main>
  );
}
