// pages/fbcontent.js — Viết bài FB
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme, makeStyles, ThemeToggle } from "../lib/theme";

function removeNha(s) {
  return (s || "")
    .replace(/(^|[^\p{L}])nha(?![\p{L}])/giu, "$1")
    .replace(/[ \t]+([,.!?…])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
function buildFeatureNotePrompt(name) {
  return `Bạn là trợ lý bán hàng online cho một shop giày. Tên sản phẩm: "${name}".
Hãy đưa ra đúng 1 cụm ngắn (dưới 15 từ, tiếng Việt) nêu đặc điểm nổi bật hoặc lý do đáng mua của mẫu giày này, dựa trên đặc điểm phổ biến của dòng sản phẩm/thương hiệu đó nếu tên gợi ý được (VD: êm chân, nhẹ, bám sân tốt, form đẹp...).
Chỉ trả về đúng cụm đó, không giải thích, không để trong dấu ngoặc kép, không chấm câu ở cuối.`;
}
function genGroupPost(name, price, sizes) {
  return removeNha(`🌟 ${name} 🌟
Giá: ${price}
Size có sẵn: ${sizes}
Các bác ai ưng mẫu này thì inbox em để em giữ hàng giúp mình nha ạ, số lượng có hạn thôi ạ 🤍`);
}
function genPersonalPost(name, price, sizes, note) {
  return removeNha(`Hôm nay em muốn khoe với các bác một đôi mà em khá ưng ý: ${name} 👟

Đôi này form dáng dễ đi, phối được với nhiều kiểu trang phục khác nhau, từ quần jean, quần jogger cho tới đồ thể thao đều hợp cả. ${note ? "Điểm đặc biệt là " + note + ". " : ""}Chất liệu và đường may em thấy khá chắc chắn, đi êm chân, hợp để đi làm, đi chơi hay đi học hàng ngày.

Giá đôi này bên em để: ${price}
Size hiện có: ${sizes}

Bác nào thích phong cách nhẹ nhàng, dễ phối đồ mà vẫn nổi bật một chút thì đôi này khá đáng cân nhắc đó ạ. Các bác cần tư vấn thêm về size hay cách phối đồ cứ để lại bình luận hoặc inbox, em rep liền ạ 🤍`);
}

const DEFAULT_CONTENT = { templates: [], tplSel: "", icons: [] };

export default function FbContentPage() {
  const { theme: THEME, mode: themeMode, toggleTheme } = useTheme();
  const { card, btn, btnSub, inp } = makeStyles(THEME);
  const btnSubOn = { ...btnSub, background: THEME.brand, color: "#fff", borderColor: THEME.brand };
  const textarea = { ...inp, marginBottom: 0, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [loaded, setLoaded] = useState(false);
  const [fbMode, setFbMode] = useState("group");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sizes, setSizes] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [iconEdit, setIconEdit] = useState(false);
  const [newIcon, setNewIcon] = useState("");
  const saveTimer = useRef(null);
  const outRef = useRef(null);

  useEffect(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then((d) => {
        setContent({ ...DEFAULT_CONTENT, ...d });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function persistContent(next) {
    setContent(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/content", {
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

  async function genPost() {
    if (fbMode === "group") {
      setOutput(genGroupPost(name, price, sizes));
      return;
    }
    setBusy(true);
    let note = "";
    try {
      if (name.trim()) {
        const r = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: buildFeatureNotePrompt(name) }),
        });
        const d = await r.json();
        if (d && d.text) note = d.text.trim().replace(/^["'“”]+|["'“”]+$/g, "");
      }
    } catch (e) {
      note = "";
    }
    setOutput(genPersonalPost(name, price, sizes, note));
    setBusy(false);
  }

  function insertIcon(ic) {
    const ta = outRef.current;
    if (!ta) {
      setOutput((o) => o + ic);
      return;
    }
    const start = ta.selectionStart ?? output.length;
    const end = ta.selectionEnd ?? output.length;
    const next = output.slice(0, start) + ic + output.slice(end);
    setOutput(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + ic.length;
    });
  }

  function addIcons() {
    const raw = newIcon.trim();
    if (!raw) return;
    let segs;
    try {
      segs = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(raw)].map((x) => x.segment);
    } catch (e) {
      segs = Array.from(raw);
    }
    const icons = content.icons.slice();
    let added = 0;
    segs.forEach((g) => {
      g = g.trim();
      if (!g || /^[\p{L}\p{N}\p{P}\s]+$/u.test(g)) return;
      if (icons.includes(g)) return;
      icons.push(g);
      added++;
    });
    if (added) {
      persistContent({ ...content, icons });
      setNewIcon("");
    }
  }

  function delIcon(i) {
    const icons = content.icons.slice();
    icons.splice(i, 1);
    persistContent({ ...content, icons });
  }

  function copyOutput() {
    if (!output) return;
    navigator.clipboard.writeText(output).catch(() => {});
  }

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
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, margin: 0, fontFamily: THEME.headingFont }}>✍️ Viết bài FB</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" style={{ ...btnSub, textDecoration: "none" }}>🏠 Trang chủ</Link>
            <Link href="/rewrite" style={{ ...btnSub, textDecoration: "none" }}>📝 Sửa bài theo khung</Link>
            <Link href="/todo" style={{ ...btnSub, textDecoration: "none" }}>✅ Việc cần làm</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={fbMode === "group" ? btnSubOn : btnSub} onClick={() => setFbMode("group")}>
            Bài đăng hội nhóm
          </button>
          <button style={fbMode === "personal" ? btnSubOn : btnSub} onClick={() => setFbMode("personal")}>
            Bài đăng trang cá nhân
          </button>
        </div>

        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <input style={inp} placeholder="Tên / Mẫu giày" value={name} onChange={(e) => setName(e.target.value)} />
          <input style={inp} placeholder="Giá" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input style={{ ...inp, marginBottom: 10 }} placeholder="Size có sẵn" value={sizes} onChange={(e) => setSizes(e.target.value)} />
          <button style={btn} onClick={genPost} disabled={busy}>
            {busy ? "⏳ Đang tạo bài..." : "Tạo bài viết"}
          </button>
          {fbMode === "personal" && (
            <div style={{ fontSize: 13, color: THEME.subtext, marginTop: 6 }}>
              Bài trang cá nhân sẽ được AI thêm 1 câu điểm nổi bật nếu đã cấu hình ANTHROPIC_API_KEY trên Vercel, nếu chưa thì bài vẫn tạo bình thường (không có câu đó).
            </div>
          )}
        </div>

        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.subtext, marginBottom: 8 }}>Icon cute — bấm để chèn vào bài, bấm ⧉ để copy riêng</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {content.icons.map((ic, i) => (
              <div key={i} style={{ ...btnSub, display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", cursor: "default" }}>
                <span style={{ cursor: "pointer", fontSize: 20 }} onClick={() => insertIcon(ic)}>
                  {ic}
                </span>
                {iconEdit ? (
                  <span style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }} onClick={() => delIcon(i)} title="Xóa icon">
                    ✕
                  </span>
                ) : (
                  <span
                    style={{ cursor: "pointer", fontSize: 12, opacity: 0.6 }}
                    title="Copy riêng"
                    onClick={() => navigator.clipboard.writeText(ic).catch(() => {})}
                  >
                    ⧉
                  </span>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: THEME.brand, cursor: "pointer" }} onClick={() => setIconEdit((v) => !v)}>
            {iconEdit ? "✓ Xong" : "✏️ Sửa danh sách icon"}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input
              style={{ ...inp, flex: 1, minWidth: 0, marginBottom: 0 }}
              placeholder="Dán hoặc nhập icon mới (VD: 🍑 💐 🧡)"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addIcons();
              }}
            />
            <button style={{ ...btn, flexShrink: 0 }} onClick={addIcons}>
              ＋ Thêm icon
            </button>
          </div>
        </div>

        <div style={{ ...card, padding: 14 }}>
          <textarea
            ref={outRef}
            rows={10}
            style={textarea}
            placeholder="Bài viết sẽ hiện ở đây..."
            value={output}
            onChange={(e) => setOutput(e.target.value)}
          />
          <button style={{ ...btnSub, marginTop: 8 }} onClick={copyOutput}>
            📋 Copy bài viết
          </button>
        </div>
      </div>
    </main>
  );
}
