// lib/DysonGuide.js
// Mục nhỏ "Dyson — so sánh các dòng" trong Giá gồm cân (tab Gia dụng). Nội dung lấy từ tab
// "SO SÁNH CÁC DÒNG HÚT BỤI DYSON" trong file gốc của sếp, gập sẵn cho gọn, bấm vào mới mở.
// Mỗi bài có nút Chép để gửi nguyên văn cho khách.
import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check, Sparkles } from "lucide-react";

const GUIDES = [
  {
    id: "v12",
    title: "So sánh các dòng V12",
    hint: "Origin · Slim Fluffy · Submarine · Absolute",
    pick: "Slim Fluffy là dòng đáng tiền và tối ưu nhất, nên mua nhất.",
    rows: [
      ["V12 Origin", "Có đầu hút ướt + 4 đầu hút khô. Bản rút gọn: không đèn laser, không cảm biến tự tăng/giảm lực hút, không màn hình."],
      ["V12 Slim Fluffy", "4 đầu hút khô + đèn laser. Bản được yêu thích nhất (doanh số cao nhất ở Nhật), không hút ướt nên rẻ hơn."],
      ["V12 Slim Submarine", "4 đầu hút khô + đầu hút ướt + đèn laser (giống Origin nhưng có laser). Đầu ướt không tự giặt, chỉ hợp vết bẩn nhỏ."],
      ["V12 Slim Absolute", "5 đầu hút khô, thêm Motorbar to cho thảm dày, nhà nuôi nhiều thú cưng. Nhà mình ít cần, giá bị đội lên."],
    ],
    points: [
      "Giá tăng dần theo thứ tự Origin → Slim Fluffy → Submarine → Absolute.",
      "3 dòng Slim đều có: đèn laser soi bụi mịn, cảm biến tự tăng lực hút, màn hình LCD hiện loại bụi và biểu đồ hạt bụi, lọc HEPA (giữ 99.9% hạt tới 0.1 micro), động cơ 125.000 vòng/phút, 11 lốc xoáy.",
      "Đầu hút sofa giường đệm hút rất sạch và không bị quấn tóc.",
      "Slim Fluffy vẫn có Motorbar mini, hút giường đệm, sofa, thảm đều tốt.",
    ],
  },
  {
    id: "v10v12",
    title: "V10 Fluffy với V12 Slim Fluffy",
    hint: "V10 là đời trước của V12",
    pick: "V10 đủ tính năng cơ bản, giá hợp lý (đáng chọn hơn Pana, Iris, Hitachi cùng tầm giá). Thích công nghệ hiện đại hơn thì chọn V12.",
    rows: [
      ["V10 Fluffy", "Đủ đầu hút sàn, khe kẽ, giường đệm, ô tô. Lực hút ngang V12. Chỉ hút khô."],
      ["V12 Slim Fluffy", "Gọn nhẹ hơn V10, pin nhỉnh hơn (khoảng 60 phút chế độ eco). Chỉ hút khô."],
    ],
    points: [
      "V12 thêm: động cơ Hyperdymium mới, màn hình LCD chỉ số bụi, đầu hút xoay linh hoạt, lọc HEPA, laser + cảm biến Piezo tự chỉnh công suất.",
      "Đèn laser khi hút nhìn rõ bụi mịn; đầu hút giường đệm sofa không quấn tóc.",
    ],
  },
  {
    id: "washg1",
    title: "WashG1 (lau ướt) với V10 / V12",
    hint: "Máy lau sàn khác máy hút bụi",
    pick: "Lau sàn hằng ngày, nhà có trẻ nhỏ/thú cưng → WashG1. Hút khô toàn diện, tối ưu chi phí → V10. Gọn nhẹ, công nghệ hiện đại → V12.",
    rows: [
      ["WashG1", "Chuyên lau ướt và khô bằng nước sạch, con lăn kép quay ngược chiều, tách rác khô và nước bẩn riêng. Xử lý tốt vết lỏng, đồ ăn rơi vãi, bùn đất trên sàn cứng (gạch, gỗ, vinyl). Không dùng cho thảm, rèm, sofa."],
      ["V10 / V12 Slim Fluffy", "Máy hút bụi không dây đa năng, chỉ hút khô."],
    ],
    points: [],
  },
];

function guideText(g) {
  const lines = [g.title, ""];
  g.rows.forEach(([k, v]) => lines.push(`👌 ${k}: ${v}`));
  if (g.points.length) {
    lines.push("");
    g.points.forEach((x) => lines.push(`- ${x}`));
  }
  lines.push("", `Nên chọn loại nào? ${g.pick}`);
  return lines.join("\n");
}

function Guide({ g, T }) {
  const { THEME, btnSub } = T;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(guideText(g)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div style={{ border: `1px solid ${THEME.line}`, borderRadius: 12, background: THEME.surface, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer" }}
      >
        {open ? <ChevronDown size={17} color={THEME.muted} /> : <ChevronRight size={17} color={THEME.muted} />}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: THEME.text }}>{g.title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: THEME.subtext }}>{g.hint}</span>
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {g.rows.map(([k, v]) => (
            <div key={k} style={{ background: THEME.surfaceAlt, borderRadius: 10, padding: "8px 10px", fontSize: 13.5, lineHeight: 1.45 }}>
              <div style={{ fontWeight: 700, color: THEME.brand, marginBottom: 2 }}>{k}</div>
              <div style={{ color: THEME.text }}>{v}</div>
            </div>
          ))}
          {g.points.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.5, color: THEME.text }}>
              {g.points.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 10, padding: "8px 10px", fontSize: 13.5, lineHeight: 1.45 }}>
            <Sparkles size={16} color={THEME.brand} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <b>Nên chọn: </b>
              {g.pick}
            </span>
          </div>
          <button style={{ ...btnSub, alignSelf: "flex-start", padding: "6px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text }} onClick={copy}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép để gửi khách"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DysonGuide({ T }) {
  const { THEME } = T;
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ all: "unset", boxSizing: "border-box", width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", border: `1px solid ${THEME.line}`, borderRadius: 12, background: THEME.surfaceAlt }}
      >
        <Sparkles size={17} color={THEME.brand} />
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: THEME.text }}>
          Dyson · so sánh các dòng <span style={{ fontWeight: 500, color: THEME.subtext, fontSize: 12.5 }}>({GUIDES.length} bài của sếp)</span>
        </span>
        {open ? <ChevronDown size={18} color={THEME.muted} /> : <ChevronRight size={18} color={THEME.muted} />}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {GUIDES.map((g) => (
            <Guide key={g.id} g={g} T={T} />
          ))}
        </div>
      )}
    </div>
  );
}
