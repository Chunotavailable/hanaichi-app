// pages/api/todo.js
// Lưu/đọc dữ liệu "Việc cần làm" bằng Vercel Blob, cùng cơ chế với gomcan.js.
// Việc cố định hàng ngày (dailyTasks) sẽ tự "rollover" mỗi ngày mới: dọn việc lặp
// của hôm qua + việc lẻ đã xong, rồi thêm lại đúng danh sách việc cố định cho ngày hôm nay.
import { put, head } from "@vercel/blob";

const DATA_PATHNAME = "todo/data.json";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function seedDailyTasks() {
  return [
    { id: uid(), text: "Clear tin nhắn" },
    { id: uid(), text: "Cmt FB Quỳnh Anh" },
    { id: uid(), text: "Đăng bài nhóm Zalo" },
    { id: uid(), text: "Dọn Tiktok và các page phụ (insta, săn sale 2 page) 10h40-14h20" },
    { id: uid(), text: "Đăng bài lên trang cá nhân fb Quỳnh Anh 16h" },
    { id: uid(), text: "Đăng 2 bài Oni lên hội nhóm fb Quỳnh Anh" },
  ];
}

function todayStr() {
  // Giờ Việt Nam (UTC+7), để việc "sang ngày mới" đúng theo giờ VN dù server chạy ở múi giờ khác.
  const n = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return n.getUTCFullYear() + "-" + String(n.getUTCMonth() + 1).padStart(2, "0") + "-" + String(n.getUTCDate()).padStart(2, "0");
}

function defaultData() {
  return { todos: [], dailyTasks: seedDailyTasks(), todoDate: "" };
}

// Dọn việc lặp cũ + việc lẻ đã xong hôm qua, rồi chèn lại đúng danh sách việc cố định cho hôm nay.
function rolloverDaily(st) {
  const t = todayStr();
  if (st.todoDate === t) return st;
  st.todoDate = t;
  st.todos = (st.todos || []).filter((x) => !x.daily && !x.done);
  const fresh = st.dailyTasks.map((dt) => ({ id: uid(), text: dt.text, done: false, daily: true, templateId: dt.id }));
  st.todos = [...fresh, ...st.todos];
  return st;
}

async function readRaw() {
  try {
    const meta = await head(DATA_PATHNAME);
    const r = await fetch(meta.url, { cache: "no-store" });
    if (!r.ok) return defaultData();
    const data = await r.json();
    const base = defaultData();
    return {
      ...base,
      ...data,
      dailyTasks: Array.isArray(data.dailyTasks) && data.dailyTasks.length ? data.dailyTasks : base.dailyTasks,
      todos: Array.isArray(data.todos) ? data.todos : [],
    };
  } catch (e) {
    return defaultData();
  }
}

async function writeRaw(data) {
  await put(DATA_PATHNAME, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const raw = await readRaw();
    const before = raw.todoDate;
    const rolled = rolloverDaily(raw);
    if (rolled.todoDate !== before) {
      try {
        await writeRaw(rolled);
      } catch (e) {
        // Không chặn việc trả dữ liệu về cho người dùng chỉ vì lưu-lại-sau-rollover lỗi.
      }
    }
    return res.status(200).json(rolled);
  }
  if (req.method === "POST" || req.method === "PUT") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || typeof body !== "object") {
        return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
      }
      await writeRaw(body);
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Không lưu được" });
    }
  }
  res.setHeader("Allow", ["GET", "POST", "PUT"]);
  return res.status(405).json({ error: "Method not allowed" });
}
