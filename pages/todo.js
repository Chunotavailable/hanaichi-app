// pages/todo.js
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading } from "../lib/theme";
import { PageHeader } from "../lib/nav";

/* ================== Theme (đồng bộ với trang chính) ================== */

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_DATA = { todos: [], dailyTasks: [], todoDate: "" };

export default function TodoPage() {
  const { theme: THEME, mode, toggleTheme } = useTheme();
  const { card, btn, btnSub, iconBtn, inp } = makeStyles(THEME);
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [dailyText, setDailyText] = useState("");
  const [dailyOpen, setDailyOpen] = useState(false);
  const saveTimer = useRef(null);
  const dragId = useRef(null);

  useEffect(() => {
    fetch("/api/todo")
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
      fetch("/api/todo", {
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

  function addTodo() {
    const v = text.trim();
    if (!v) return;
    persist({ ...data, todos: [{ id: uid(), text: v, done: false, daily: false }, ...data.todos] });
    setText("");
  }

  function addDailyTask() {
    const v = dailyText.trim();
    if (!v) return;
    const dt = { id: uid(), text: v };
    persist({
      ...data,
      dailyTasks: [...data.dailyTasks, dt],
      todos: [{ id: uid(), text: v, done: false, daily: true, templateId: dt.id }, ...data.todos],
    });
    setDailyText("");
  }

  function delDailyTask(id) {
    persist({
      ...data,
      dailyTasks: data.dailyTasks.filter((d) => d.id !== id),
      todos: data.todos.filter((t) => t.templateId !== id),
    });
  }

  function toggleTodo(id) {
    persist({ ...data, todos: data.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  }

  function delTodo(id) {
    persist({ ...data, todos: data.todos.filter((t) => t.id !== id) });
  }

  function clearDone() {
    persist({ ...data, todos: data.todos.filter((t) => !t.done) });
  }

  function moveTodo(id, dir) {
    const i = data.todos.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= data.todos.length) return;
    const next = data.todos.slice();
    [next[i], next[j]] = [next[j], next[i]];
    persist({ ...data, todos: next });
  }

  function onDragStart(id) {
    dragId.current = id;
  }
  function onDrop(targetId) {
    const from = data.todos.findIndex((t) => t.id === dragId.current);
    const to = data.todos.findIndex((t) => t.id === targetId);
    dragId.current = null;
    if (from < 0 || to < 0 || from === to) return;
    const next = data.todos.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    persist({ ...data, todos: next });
  }

  const total = data.todos.length;
  const done = data.todos.filter((t) => t.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  if (!loaded) {
    return <Loading />;
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader icon="✅" title="Việc cần làm" current="/todo" maxWidth={700} />

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px" }}>
        {/* Thêm việc mới */}
        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inp, flex: 1, minWidth: 0 }}
              placeholder="Thêm việc mới..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
            />
            <button style={{ ...btn, flexShrink: 0 }} onClick={addTodo}>
              ＋ Thêm
            </button>
          </div>

          <div
            style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: THEME.brand, cursor: "pointer" }}
            onClick={() => setDailyOpen((v) => !v)}
          >
            ⚙️ {dailyOpen ? "Đóng" : "Thiết lập"} việc cố định hàng ngày ({data.dailyTasks.length})
          </div>

          {dailyOpen && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${THEME.line}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.dailyTasks.length === 0 && (
                <div style={{ color: THEME.subtext, fontSize: 14 }}>Chưa có việc cố định nào.</div>
              )}
              {data.dailyTasks.map((dt) => (
                <div key={dt.id} className="hnCard" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 16, color: THEME.text }}>🔁 {dt.text}</span>
                  <button style={iconBtn} onClick={() => delDailyTask(dt.id)} aria-label="Xoá việc cố định">
                    ✕
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input
                  style={{ ...inp, flex: 1, minWidth: 0 }}
                  placeholder="Thêm việc cố định mới..."
                  value={dailyText}
                  onChange={(e) => setDailyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addDailyTask();
                  }}
                />
                <button style={{ ...btn, flexShrink: 0 }} onClick={addDailyTask}>
                  ＋ Thêm
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Thanh tiến độ */}
        {total > 0 && (
          <div style={{ ...card, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 8, borderRadius: 999, background: THEME.chipBg, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: THEME.brand, transition: "width .2s" }} />
            </div>
            <span style={{ fontSize: 13, color: THEME.subtext, fontWeight: 600, whiteSpace: "nowrap" }}>
              {done}/{total} xong
            </span>
            {done > 0 && (
              <button style={btnSub} onClick={clearDone}>
                Xoá việc đã xong
              </button>
            )}
          </div>
        )}

        {/* Danh sách việc */}
        {total === 0 ? (
          <div style={{ ...card, padding: 16, color: THEME.subtext, fontSize: 16, textAlign: "center" }}>
            Chưa có việc nào. Thêm việc mới ở trên nhé.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.todos.map((t, i) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => onDragStart(t.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(t.id)}
                className="hnCard hnDone"
                style={{
                  ...card,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: t.done ? THEME.chipBg : THEME.surface,
                  cursor: "grab",
                  opacity: t.done ? 0.75 : 1,
                }}
              >
                <input type="checkbox" checked={!!t.done} onChange={() => toggleTodo(t.id)} style={{ width: 18, height: 18, cursor: "pointer", flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    wordBreak: "break-word",
                    fontSize: 16,
                    color: t.done ? THEME.subtext : THEME.text,
                    textDecoration: t.done ? "line-through" : "none",
                  }}
                >
                  {t.daily ? "🔁 " : ""}
                  {t.text}
                </span>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }}
                    disabled={i === 0}
                    onClick={() => moveTodo(t.id, -1)}
                    aria-label="Lên"
                  >
                    ▲
                  </button>
                  <button
                    style={{ ...iconBtn, opacity: i === total - 1 ? 0.3 : 1 }}
                    disabled={i === total - 1}
                    onClick={() => moveTodo(t.id, 1)}
                    aria-label="Xuống"
                  >
                    ▼
                  </button>
                  <button style={iconBtn} onClick={() => delTodo(t.id)} aria-label="Xoá">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
