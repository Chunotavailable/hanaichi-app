// pages/rewrite.js — Sửa bài theo khung có sẵn
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme, makeStyles, ThemeToggle, Loading } from "../lib/theme";
import { playTick, playSuccess, playDelete, playClick } from "../lib/sound";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}
function removeNha(s) {
  return (s || "")
    .replace(/(^|[^\p{L}])nha(?![\p{L}])/giu, "$1")
    .replace(/[ \t]+([,.!?…])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
function localFill(tpl, raw) {
  const m = tpl.body.match(/\{\{[^}]*\}\}|\[[^\]]*\]/);
  const out = m ? tpl.body.replace(m[0], raw) : tpl.body + "\n\n" + raw;
  return removeNha(out.replace(/\{\{[^}]*\}\}|\[[^\]]*\]/g, "").replace(/\n{3,}/g, "\n\n"));
}
function buildRewritePrompt(tpl, raw, note) {
  return `Em là trợ lý biên tập bài đăng Facebook cho một người bán giày Nhật. Hãy viết lại BÀI THÔ bên dưới thành một bài hoàn chỉnh theo đúng KHUNG MẪU đã chọn.

QUY TẮC GIỌNG VĂN (bắt buộc):
- Xưng "em", gọi người đọc là "các bác".
- Tuyệt đối KHÔNG dùng từ "nha". Ưu tiên kết câu bằng "ạ" cho lịch sự.
- Giọng nhẹ nhàng, tự nhiên như chia sẻ với người quen; KHÔNG lộ ý bán hàng: không hô hào mua, không "inbox đặt ngay", "chốt đơn", "số lượng có hạn", không nhồi giá/khuyến mãi. Nếu bài thô có giá hoặc size thì chỉ lồng khéo, tự nhiên.
- Giữ nguyên thông tin thật trong bài thô (tên mẫu, màu, size, chất liệu...), không bịa thêm thông số.
- Sửa lỗi chính tả, câu chữ lủng củng, tối ưu cho dễ đọc trên Facebook (đoạn ngắn, xuống dòng hợp lý, vài emoji nhẹ như 🌸 ✨ 🤍).

QUY TẮC KHUNG:
- Giữ đúng cấu trúc, thứ tự đoạn, độ dài tương đương và phong cách emoji của khung.
- Luôn giữ nguyên hoàn toàn câu kết (câu cuối cùng) của khung mẫu, không viết lại hay thay đổi câu này dù nội dung phía trên có khác đi.
- Phần trong [ ] hoặc {{ }} là chỉ dẫn cần viết ra nội dung thật; KHÔNG chép nguyên dấu ngoặc hay chỉ dẫn vào bài.

Chỉ trả về nội dung bài viết hoàn chỉnh, không giải thích, không tiêu đề phụ kiểu "Bài viết:".

=== KHUNG MẪU: ${tpl.name} ===
${tpl.body}

=== BÀI THÔ / Ý TƯỞNG ===
${raw}${note ? `

=== LƯU Ý THÊM CỦA NGƯỜI VIẾT (ưu tiên làm theo, nhưng vẫn giữ đúng quy tắc giọng văn ở trên) ===
${note}` : ""}`;
}

const NOTE_CHIPS = ["Thêm dòng giới thiệu sản phẩm", "Viết ngắn gọn hơn", "Thêm chút cảm xúc"];
const DEFAULT_CONTENT = { templates: [], tplSel: "", icons: [] };

export default function RewritePage() {
  const { theme: THEME, mode, toggleTheme } = useTheme();
  const { card, btn, btnSub, inp } = makeStyles(THEME);
  const chipSmall = { ...btnSub, fontSize: 13, padding: "3px 10px" };
  const textarea = { ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 };
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [loaded, setLoaded] = useState(false);
  const [tplEdit, setTplEdit] = useState(null); // id đang sửa, hoặc null = tạo mới
  const [tName, setTName] = useState("");
  const [tBody, setTBody] = useState("");
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState("");
  const [output, setOutput] = useState("");
  const [msg, setMsg] = useState("");
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

  const selectedTpl = content.templates.find((t) => t.id === content.tplSel) || null;

  function selTpl(id) {
    persistContent({ ...content, tplSel: id });
    playClick();
  }
  function startEditTpl(id) {
    const t = content.templates.find((x) => x.id === id);
    setTplEdit(id);
    setTName(t ? t.name : "");
    setTBody(t ? t.body : "");
  }
  function cancelTplEdit() {
    setTplEdit(null);
    setTName("");
    setTBody("");
  }
  function delTpl(id) {
    const templates = content.templates.filter((t) => t.id !== id);
    let tplSel = content.tplSel;
    if (tplSel === id) tplSel = (templates[0] || {}).id || "";
    persistContent({ ...content, templates, tplSel });
    if (tplEdit === id) cancelTplEdit();
    playDelete();
  }
  function saveTpl() {
    const name = tName.trim();
    const body = tBody.trim();
    if (!name || !body) {
      alert("Bác điền tên và nội dung khung giúp em ạ");
      return;
    }
    let templates, tplSel;
    if (tplEdit) {
      templates = content.templates.map((t) => (t.id === tplEdit ? { ...t, name, body } : t));
      tplSel = content.tplSel;
    } else {
      const t = { id: uid(), name, body };
      templates = [...content.templates, t];
      tplSel = t.id;
    }
    persistContent({ ...content, templates, tplSel });
    cancelTplEdit();
    playTick();
  }

  function appendNoteChip(t) {
    setNote((prev) => (prev && !prev.includes(t) ? prev.trim() + "; " + t : prev.includes(t) ? prev : t));
  }

  async function doRewrite() {
    if (!selectedTpl) {
      setMsg("Bác chọn một khung mẫu ở trên trước giúp em ạ");
      return;
    }
    const rawV = raw.trim();
    if (!rawV) {
      setMsg("Bác dán ý tưởng hoặc bài thô vào ô trên giúp em ạ");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildRewritePrompt(selectedTpl, rawV, note.trim()) }),
      });
      const d = await r.json();
      if (d && d.code === "no_key") {
        setOutput(localFill(selectedTpl, rawV));
        setMsg(
          "Chưa cấu hình ANTHROPIC_API_KEY trên Vercel nên em mới chỉ ghép ý vào khung" +
            (note.trim() ? " (chưa áp dụng được lưu ý thêm)" : "") +
            ". Thêm API key vào Vercel để được viết lại hoàn chỉnh ạ."
        );
      } else if (d && d.text) {
        setOutput(removeNha(d.text));
        setMsg("✓ Xong rồi ạ, bác chỉnh thêm trong khung bên dưới nếu muốn.");
        playSuccess();
      } else {
        setOutput(localFill(selectedTpl, rawV));
        setMsg("Có chút trục trặc khi viết lại (" + (d && d.error ? d.error : "lỗi") + "), bác thử bấm lại giúp em ạ.");
      }
    } catch (e) {
      setOutput(localFill(selectedTpl, rawV));
      setMsg("Có chút trục trặc khi viết lại, bác thử bấm lại giúp em ạ.");
    }
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
    const rawV = newIcon.trim();
    if (!rawV) return;
    let segs;
    try {
      segs = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(rawV)].map((x) => x.segment);
    } catch (e) {
      segs = Array.from(rawV);
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
      playTick();
    }
  }
  function delIcon(i) {
    const icons = content.icons.slice();
    icons.splice(i, 1);
    persistContent({ ...content, icons });
    playClick();
  }
  function copyOutput() {
    if (!output) return;
    playClick();
    navigator.clipboard.writeText(output).catch(() => {});
  }

  if (!loaded) {
    return <Loading />;
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <header style={{ background: `linear-gradient(135deg, ${THEME.brand}18, ${THEME.bg})`, borderBottom: `1px solid ${THEME.line}` }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: THEME.text, margin: 0, fontFamily: THEME.headingFont }}>📝 Sửa bài theo khung</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" style={{ ...btnSub, textDecoration: "none" }}>🏠 Trang chủ</Link>
            <Link href="/fbcontent" style={{ ...btnSub, textDecoration: "none" }}>✍️ Viết bài FB</Link>
            <Link href="/todo" style={{ ...btnSub, textDecoration: "none" }}>✅ Việc cần làm</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px" }}>
        <p style={{ fontSize: 14, color: THEME.subtext, marginTop: 0 }}>
          Lưu sẵn các khung bài hay dùng, gửi ý tưởng thô vào là bài được viết lại đúng khung, đúng giọng em – các bác.
        </p>

        {/* Khung bài mẫu */}
        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📌 Khung bài mẫu của em</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {content.templates.length === 0 && (
              <div style={{ color: THEME.subtext, fontSize: 16 }}>Chưa có khung nào, tạo khung đầu tiên ở bên dưới nhé</div>
            )}
            {content.templates.map((t) => (
              <div
                key={t.id}
                className="hnCard"
                style={{
                  border: `1px solid ${t.id === content.tplSel ? THEME.brand : THEME.line}`,
                  borderRadius: 12,
                  padding: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: t.id === content.tplSel ? THEME.chipBg : "transparent",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => selTpl(t.id)}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    {t.id === content.tplSel ? "🌸 " : ""}
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: THEME.subtext,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {t.body}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button style={btnSub} onClick={() => startEditTpl(t.id)}>
                    Sửa
                  </button>
                  <button style={btnSub} onClick={() => delTpl(t.id)}>
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px dashed ${THEME.chipLine}`, paddingTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{tplEdit ? "✏️ Đang sửa khung" : "➕ Tạo khung mới"}</div>
            <input
              style={inp}
              placeholder="Tên khung (VD: Khoe giày mới, Kể chuyện hằng ngày...)"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
            />
            <textarea
              rows={7}
              style={{ ...textarea, marginBottom: 0 }}
              placeholder="Dán cấu trúc khung: các đoạn, thứ tự, emoji... Chỗ cần viết đặt trong [ ] cho rõ"
              value={tBody}
              onChange={(e) => setTBody(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button style={btn} onClick={saveTpl}>
                {tplEdit ? "💾 Cập nhật khung" : "💾 Lưu khung"}
              </button>
              {tplEdit && (
                <button style={btnSub} onClick={cancelTplEdit}>
                  Hủy
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bài thô / ý tưởng */}
        <div style={{ ...card, padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>📝 Bài thô / ý tưởng</div>
          <div style={{ fontSize: 14, color: THEME.subtext, marginBottom: 8 }}>
            Khung đang chọn: <b style={{ color: THEME.brand }}>{selectedTpl ? selectedTpl.name : "chưa chọn"}</b>
          </div>
          <textarea
            rows={6}
            style={textarea}
            placeholder="Gõ hoặc dán ý tưởng, bài viết nháp, vài gạch đầu dòng... (không cần đúng giọng văn)"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div style={{ fontWeight: 700, marginTop: 10, marginBottom: 4 }}>
            📎 Lưu ý thêm khi viết <span style={{ fontSize: 14, color: THEME.subtext, fontWeight: 400 }}>(tuỳ chọn)</span>
          </div>
          <textarea
            rows={2}
            style={textarea}
            placeholder="VD: giữ nguyên câu kết, thêm dòng giới thiệu sản phẩm, viết ngắn gọn hơn..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {NOTE_CHIPS.map((t) => (
              <span key={t} style={chipSmall} onClick={() => appendNoteChip(t)}>
                ＋ {t}
              </span>
            ))}
          </div>
          <button style={{ ...btn, marginTop: 12 }} onClick={doRewrite} disabled={busy}>
            {busy ? "⏳ Đang viết lại..." : "✨ Sửa & viết lại theo khung"}
          </button>
          {msg && <div style={{ fontSize: 14, color: THEME.subtext, marginTop: 8 }}>{msg}</div>}
        </div>

        {/* Icon panel */}
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

        {/* Bài hoàn chỉnh */}
        <div style={{ ...card, padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.subtext, marginBottom: 8 }}>Bài hoàn chỉnh</div>
          <textarea
            ref={outRef}
            rows={12}
            style={textarea}
            placeholder="Bài đã viết lại sẽ hiện ở đây..."
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
