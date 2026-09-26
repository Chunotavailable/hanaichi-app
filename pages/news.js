// pages/news.js — Tin tức đồ Nhật
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { playTick, playDelete, playSuccess, playClick } from "../lib/sound";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function buildNewsIdeaPrompt(n) {
  return `Bạn là trợ lý content cho một shop bán giày Nhật (Onitsuka Tiger, Asics, Wilson...) trên Facebook.
Dựa trên tin tức xu hướng sau:
Tiêu đề: ${n.title}
Nội dung: ${n.note || "(không có mô tả thêm)"}

Hãy đưa ra đúng 3 ý tưởng bài đăng Facebook khác nhau, mỗi ý tưởng 1-2 câu ngắn gọn (tiếng Việt), gợi ý góc viết đa dạng (VD: chia sẻ xu hướng, gợi ý phối đồ, kể chuyện cá nhân...) liên hệ tới sản phẩm shop đang bán. Đánh số 1. 2. 3. Không viết bài hoàn chỉnh, chỉ nêu ý tưởng/góc viết.`;
}
const UPDATE_PROMPT =
  "Cập nhật tin tức đồ Nhật mới nhất cho tôi (ưu tiên giày Onitsuka Tiger/sneaker, kèm thêm các mặt hàng Nhật đang hot khác), nhớ kèm nguồn.";

const DEFAULT_DATA = { newsItems: [] };

export default function NewsPage() {
  const { theme: THEME, mode, toggleTheme } = useTheme();
  const { card, btn, btnSub, inp } = makeStyles(THEME);
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ title: "", note: "", source: "", url: "", date: "" });
  const [ideas, setIdeas] = useState({}); // { [newsId]: { busy, text } }
  const saveTimer = useRef(null);

  useEffect(() => {
    fetch("/api/news")
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
      fetch("/api/news", {
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

  function addNews() {
    const title = form.title.trim();
    if (!title) return;
    persist({
      newsItems: [
        { id: uid(), title, note: form.note.trim(), source: form.source.trim(), url: form.url.trim(), date: form.date.trim() },
        ...data.newsItems,
      ],
    });
    setForm({ title: "", note: "", source: "", url: "", date: "" });
    playTick();
  }

  function delNews(id) {
    persist({ newsItems: data.newsItems.filter((n) => n.id !== id) });
    playDelete();
  }

  function copyUpdatePrompt() {
    playClick();
    navigator.clipboard
      .writeText(UPDATE_PROMPT)
      .then(() => alert("✓ Đã copy — dán câu này vào khung chat với Claude để nhờ cập nhật tin mới, rồi thêm tin vào form bên dưới nhé."))
      .catch(() => {});
  }

  async function genIdeas(n) {
    setIdeas((s) => ({ ...s, [n.id]: { busy: true, text: s[n.id]?.text || "" } }));
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildNewsIdeaPrompt(n) }),
      });
      const d = await r.json();
      if (d && d.code === "no_key") {
        setIdeas((s) => ({ ...s, [n.id]: { busy: false, text: "", noKey: true } }));
      } else if (d && d.text) {
        setIdeas((s) => ({ ...s, [n.id]: { busy: false, text: d.text } }));
        playSuccess();
      } else {
        setIdeas((s) => ({ ...s, [n.id]: { busy: false, text: "", error: (d && d.error) || "lỗi" } }));
      }
    } catch (e) {
      setIdeas((s) => ({ ...s, [n.id]: { busy: false, text: "", error: "lỗi kết nối" } }));
    }
  }

  if (!loaded) {
    return <Loading />;
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader icon="📰" title="Tin tức đồ Nhật" current="/news" maxWidth={800} />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 18px" }}>
        <p style={{ fontSize: 14, color: THEME.subtext, marginTop: 0 }}>
          Ưu tiên giày Onitsuka Tiger/sneaker, ngoài ra có cả các mặt hàng Nhật đang hot khác. Trang này chỉ lưu tin bạn tự thêm — muốn có tin mới, bấm nút dưới để copy câu hỏi, dán vào khung chat với Claude rồi chép kết quả vào đây.
        </p>
        <button style={{ ...btnSub, marginBottom: 16 }} onClick={copyUpdatePrompt}>
          🔄 Copy câu hỏi để nhờ Claude cập nhật tin
        </button>

        <div style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>➕ Thêm tin mới</div>
          <input style={inp} placeholder="Tiêu đề tin" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea
            style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
            rows={3}
            placeholder="Nội dung / mô tả ngắn"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input style={inp} placeholder="Nguồn (tên báo/trang)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            <input style={inp} placeholder="Ngày (VD: 25/09/2026)" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <input style={inp} placeholder="Link nguồn (không bắt buộc)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <button style={btn} onClick={addNews}>
            + Thêm tin
          </button>
        </div>

        {data.newsItems.length === 0 ? (
          <div style={{ ...card, padding: 16, color: THEME.subtext, fontSize: 15, textAlign: "center" }}>Chưa có tin nào</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.newsItems.map((n) => {
              const idea = ideas[n.id] || {};
              return (
                <div key={n.id} className="hnCard" style={{ ...card, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: THEME.text, flex: 1, minWidth: 0 }}>{n.title}</div>
                    <button style={btnSub} onClick={() => delNews(n.id)}>
                      🗑
                    </button>
                  </div>
                  {n.note && <div style={{ fontSize: 15, color: THEME.text, marginTop: 6 }}>{n.note}</div>}
                  <div style={{ fontSize: 13, color: THEME.subtext, marginTop: 8 }}>
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: THEME.brand }}>
                        Nguồn: {n.source || n.url}
                      </a>
                    ) : n.source ? (
                      `Nguồn: ${n.source}`
                    ) : null}
                    {n.date ? ` • ${n.date}` : ""}
                  </div>
                  <button style={{ ...btnSub, marginTop: 10 }} onClick={() => genIdeas(n)} disabled={idea.busy}>
                    {idea.busy ? "⏳ Đang nghĩ ý tưởng..." : "💡 Gợi ý content từ tin này"}
                  </button>
                  {idea.text && (
                    <div style={{ marginTop: 10, background: THEME.chipBg, border: `1px solid ${THEME.chipLine}`, borderRadius: 10, padding: 12, fontSize: 14, whiteSpace: "pre-line", color: THEME.text }}>
                      {idea.text}
                    </div>
                  )}
                  {idea.noKey && (
                    <div style={{ marginTop: 8, fontSize: 13, color: THEME.subtext }}>
                      Chưa cấu hình ANTHROPIC_API_KEY trên Vercel nên chưa gợi ý được. Bạn có thể nhờ Claude ngay trong khung chat gợi ý ý tưởng từ tin này giúp cũng được ạ.
                    </div>
                  )}
                  {idea.error && <div style={{ marginTop: 8, fontSize: 13, color: THEME.subtext }}>Có chút trục trặc ({idea.error}), thử bấm lại giúp em ạ.</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
