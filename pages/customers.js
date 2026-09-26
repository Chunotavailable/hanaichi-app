// pages/customers.js — Khách hàng
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const THEME = {
  bg: "#0f1117",
  surface: "#1b1e29",
  text: "#f1f2f7",
  subtext: "#9aa1b8",
  line: "#2b2f40",
  primary: "#ff9dc0",
  brand: "#ff85ae",
  chipBg: "#242837",
  chipLine: "#363b52",
  glow: "0 10px 30px rgba(0, 0, 0, 0.5)",
};

const card = { background: THEME.surface, border: `1px solid ${THEME.line}`, borderRadius: 16, boxShadow: THEME.glow };
const btn = { background: THEME.primary, color: "#3a0f22", border: "none", borderRadius: 12, padding: "10px 14px", fontWeight: 700, cursor: "pointer", fontSize: 15 };
const btnSub = { background: THEME.chipBg, color: THEME.brand, border: `1px solid ${THEME.chipLine}`, borderRadius: 12, padding: "6px 12px", fontWeight: 600, cursor: "pointer", fontSize: 14 };
const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${THEME.line}`, fontSize: 16, outline: "none", background: THEME.bg, color: THEME.text };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_DATA = { customers: [] };

export default function CustomersPage() {
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
  }

  function delCustomer(id) {
    persist({ customers: data.customers.filter((c) => c.id !== id) });
  }

  const qLower = q.toLowerCase();
  const list = data.customers.filter((c) => !qLower || (c.name + c.contact + c.order + c.note).toLowerCase().includes(qLower));

  if (!loaded) {
    return (
      <main style={{ minHeight: "100vh", background: THEME.bg, display: "grid", placeItems: "center", color: THEME.subtext }}>
        Đang tải...
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <header style={{ background: `linear-gradient(135deg, #241a22, ${THEME.bg})`, borderBottom: `1px solid ${THEME.line}` }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: THEME.text, margin: 0 }}>👥 Khách hàng</h1>
          <Link href="/" style={{ ...btnSub, textDecoration: "none" }}>🏠 Trang chủ</Link>
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
              <div key={cu.id} style={{ ...card, padding: 14, display: "flex", justifyContent: "space-between", gap: 10 }}>
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
