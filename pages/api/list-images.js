// pages/api/list-images.js
import fs from "fs";
import path from "path";

const EXTS = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const MAX = 20;

export default function handler(req, res) {
  try {
    const code = String(req.query.code || "").trim();
    if (!code) return res.status(200).json({ images: [] });

    const folder = path.join(process.cwd(), "public", "imgs", code);
    let files = [];
    try {
      files = fs
        .readdirSync(folder, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((name) => EXTS.has(path.extname(name).toLowerCase()));
    } catch {
      return res.status(200).json({ images: [] }); // không có thư mục
    }

    // Ưu tiên các file bắt đầu bằng "cover" (cover.* hoặc cover-something.*)
    const covers = files.filter(
      (n) => /^cover(\.|-|_)/i.test(n) || /^cover\./i.test(n)
    );
    const others = files.filter(
      (n) => !(/^cover(\.|-|_)/i.test(n) || /^cover\./i.test(n))
    );

    // Sắp xếp chữ cái để ổn định (không yêu cầu 1,2,3)
    covers.sort((a, b) => a.localeCompare(b));
    others.sort((a, b) => a.localeCompare(b));

    const ordered = [...covers, ...others].slice(0, MAX);
    const urls = ordered.map(
      (n) => `/imgs/${encodeURIComponent(code)}/${encodeURIComponent(n)}`
    );

    return res.status(200).json({ images: urls });
  } catch (e) {
    return res.status(200).json({ images: [] });
  }
}
