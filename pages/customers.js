// pages/customers.js — Khách hàng
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme, makeStyles, ThemeToggle, Loading } from "../lib/theme";
import { playTick, playDelete } from "../lib/sound";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_DATA = { customers: [] };

export default function CustomersPage() {
  const { theme: THEME, mode, toggleTheme } = useTheme();
  const { card, btn, btnSub, inp } = makeStyles(THEME);
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", order: "", note: "" });
  const [q, setQ] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        setData({ ...DEFAULT_DATA, ...d });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function persist(next) {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
        .then((r) => {
          if (!r.ok) throw new Error("save failed");
        })
        .catch(() => {
          alert("⚠️ KHÔNG lưu được thay đổi vừa rồi! Kiểm tra lại kết nối mạng hoặc dung lượng Blob Storage trên Vercel, rồi thử lại giúp em ạ.");
        });
    }, 250);
  }

  function addCustomer() {
    const name = form.name.trim();
    if (!name) return;
    persist({ customers: [{ id: uid(), name, contact: form.contact, order: form.order, note: form.note }, ...data.customers] });
    setForm({ name: "", contact: "", order: "", note: "" });
    playTick();
  }

  function delCustomer(id) {
    persist({ customers: data.customers.filter((c) => c.id !== id) });
    playDelete();
  }

  const qLower = q.toLowerCase();
  const list = data.customers.filter((c) => !qLower || (c.name + c.contact + c.order + c.note).toLowerCase().includes(qLower));

  if (!loaded) {
    return <Loading />;
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <header style={{ background: `linear-gradient(135deg, ${THEME.brand}18, ${THEME.bg})`, borderBottom: `1px solid ${THEME.line}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, margin: 0, fontFamily: THEME.headingFont }}>👥 Khách hàng</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/" style={{ ...btnSub, textDecoration: "none" }}>🏠 Trang chủ</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 18px" }}>
        <div style={{ ...card, padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input style={inp} placeholder="Tên khách" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={inp} placeholder="SĐT / Zalo / FB" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <input style={inp} placeholder="Mã đơn hàng" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
          <input style={inp} placeholder="Ghi chú" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button style={{ ...btn, gridColumn: "1 / -1" }} onClick={addCustomer}>
            + Thêm khách hàng
          </button>
        </div>

        <input style={{ ...inp, marginBottom: 14 }} placeholder="🔍 Tìm khách..." value={q} onChange={(e) => setQ(e.target.value)} />

        {list.length === 0 ? (
          <div style={{ ...card, padding: 16, color: THEME.subtext, fontSize: 15, textAlign: "center" }}>Chưa có khách hàng nào</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((cu) => (
              <div key={cu.id} className="hnCard" style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: THEME.text }}>{cu.name}</div>
                  {cu.contact && <div style={{ fontSize: 14, color: THEME.subtext, marginTop: 2 }}>📞 {cu.contact}</div>}
                  {cu.order && <div style={{ fontSize: 14, color: THEME.subtext, marginTop: 2 }}>🧾 {cu.order}</div>}
                  {cu.note && <div style={{ fontSize: 14, color: THEME.subtext, marginTop: 2 }}>{cu.note}</div>}
                </div>
                <button style={{ ...btnSub, alignSelf: "flex-start", flexShrink: 0 }} onClick={() => delCustomer(cu.id)}>
                  Xóa
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
