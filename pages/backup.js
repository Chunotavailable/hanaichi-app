// pages/backup.js
// Trang "Sao lưu dữ liệu": gộp dữ liệu của mọi mục (Giá gồm cân, Hàng Closet
// sẵn, Báo giá nhanh, Việc cần làm, Khách hàng) thành 1 file tải về máy, và
// cho phép chọn lại file đó để khôi phục khi chẳng may dữ liệu bị mất/lỗi.
// Lưu ý: các mục này lưu ở 4 nơi (blob) riêng trên server — trang này chỉ
// gộp/tách lại cho tiện, không đổi cách lưu hiện có.
import { useState } from "react";
import { useTheme, makeStyles, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { uploadGomcanImage } from "../lib/gomcanHelpers";
import { Download, Upload, FolderOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

const SECTIONS = [
  { key: "gomcan", url: "/api/gomcan", label: "Giá gồm cân + Hàng Closet sẵn" },
  { key: "thietbi", url: "/api/thietbi", label: "Thiết bị bếp & vệ sinh" },
  { key: "replies", url: "/api/replies", label: "Tra cứu nhanh" },
  // Hai mục cũ không còn trên menu nhưng vẫn lưu kèm phòng khi còn dữ liệu.
  { key: "customers", url: "/api/customers", label: "Khách hàng (cũ)" },
  { key: "todo", url: "/api/todo", label: "Việc cần làm (cũ)" },
  { key: "pricing", url: "/api/pricing", label: "Báo giá nhanh" },
];

function findImageUrls(obj) {
  const m = JSON.stringify(obj).match(/(?:https?:\/\/|\/api\/img\/)[^"\s\\]+?\.(?:png|jpe?g|webp|gif|avif)(?:\?[^"\s\\]*)?/gi) || [];
  return Array.from(new Set(m));
}
// Máy chủ miễn phí đôi khi từ chối vài ảnh khi bị hỏi dồn -> thử lại vài lần, chậm dần, rồi mới tính là lỗi.
async function retry(fn, times = 5) {
  let err;
  for (let i = 0; i < times; i++) {
    try { return await fn(); } catch (e) { err = e; await new Promise((r) => setTimeout(r, 400 * (i + 1) * (i + 1))); }
  }
  throw err;
}
// Thu nhỏ ảnh nặng (máy chủ miễn phí khó phục vụ ảnh to). Giữ nguyên loại ảnh (đuôi .jpg/.png/.webp) để đường dẫn không đổi.
function shrinkDataUrl(du, maxSide = 1000) {
  return new Promise((ok) => {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,/.exec(du);
    if (!m || du.length < 260 * 1024 * 1.34) return ok(du);
    const im = new Image();
    im.onload = () => {
      try {
        const k = Math.min(1, maxSide / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const g = c.getContext("2d");
        if (m[1] === "image/jpeg") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
        g.drawImage(im, 0, 0, c.width, c.height);
        const out = c.toDataURL(m[1], 0.82);
        ok(out.startsWith("data:" + m[1]) && out.length < du.length ? out : du);
      } catch { ok(du); }
    };
    im.onerror = () => ok(du);
    im.src = du;
  });
}
function blobToDataUrl(blob) {
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = no;
    fr.readAsDataURL(blob);
  });
}

function fmtDateStamp(d) {
  return d.toISOString().slice(0, 10);
}

export default function BackupPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub } = makeStyles(THEME);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok: bool, text }
  const [pendingRestore, setPendingRestore] = useState(null); // payload đã đọc từ file, chờ xác nhận

  async function downloadBackup() {
    setBusy(true);
    setMsg(null);
    try {
      const data = {};
      // Chờ 1 nhịp để những chỗ vừa sửa xong kịp lưu lên máy chủ trước khi lấy bản sao lưu.
      await new Promise((ok) => setTimeout(ok, 1500));
      for (const s of SECTIONS) {
        // no-store: luôn lấy bản MỚI NHẤT trên máy chủ, không dùng bản nhớ tạm.
        const r = await fetch(s.url, { cache: "no-store" });
        if (!r.ok) throw new Error(s.key);
        data[s.key] = await r.json();
      }
      // Bản chụp bảng giá siêu thị (chỉ để lưu tham khảo, khôi phục không cần vì tự lấy lại từ Google Sheet).
      try {
        const rs = await fetch("/api/sieuthi", { cache: "no-store" });
        if (rs.ok) data.sieuthi = await rs.json();
      } catch {}
      // Nhúng LUÔN nội dung các ảnh vào file để mất web/kho ảnh vẫn khôi phục được.
      const urls = findImageUrls(data);
      const images = {};
      const failed = [];
      setMsg({ ok: true, text: `Đang lưu ${urls.length} ảnh vào file sao lưu...` });
      for (let i = 0; i < urls.length; i += 2) {
        setMsg({ ok: true, text: `Đang lưu ảnh ${Math.min(i + 2, urls.length)}/${urls.length} vào file sao lưu...` });
        await Promise.all(
          urls.slice(i, i + 2).map(async (u) => {
            try {
              images[u] = await retry(async () => {
                const r = await fetch(u, { cache: "no-store" });
                if (!r.ok) { if (r.status === 404) { const e = new Error("404"); e.final = true; } throw new Error("x" + r.status); }
                return blobToDataUrl(await r.blob());
              }, /^\/api\/img\//.test(u) ? 5 : 2);
            } catch {
              failed.push(u);
            }
          })
        );
      }
      const imageUrls = urls;
      const payload = { app: "hanaichi", version: 2, exportedAt: new Date().toISOString(), data, images, imageUrls };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hanaichi-sao-luu-${fmtDateStamp(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: failed.length ? `⚠️ Đã sao lưu 6 mục và ${Object.keys(images).length}/${urls.length} ảnh. ${failed.length} ảnh không tải được (link ngoài hoặc đã bị xoá): ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "..." : ""}` : `✅ Đã sao lưu đầy đủ: 6 mục (Giá gồm cân, Closet, Thiết bị, Tra cứu nhanh, Báo giá nhanh, Giá siêu thị) + ${Object.keys(images).length} ảnh nằm ngay trong file. Nhớ cất file này vào Zalo/Drive/email cho chắc.` });
    } catch (e) {
      setMsg({ ok: false, text: "❌ Không tải được sao lưu, thử lại sau." });
    } finally {
      setBusy(false);
    }
  }

  // Chỉ nạp lại những ảnh đang bị thiếu/lỗi trên web từ file sao lưu — KHÔNG đổi dữ liệu, KHÔNG đổi đường dẫn ảnh.
  async function onRepairFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setMsg({ ok: true, text: "Đang đọc file sao lưu..." });
    try {
      const parsed = JSON.parse(await file.text());
      const imgs = parsed.images || {};
      // Ghép ảnh trong file với ảnh hiện tại của CÙNG sản phẩm (cùng mã id), vì tên ảnh đã đổi sau khi chuyển web.
      const pairs = [];
      const isImg = (v) => typeof v === "string" && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(v);
      const walk = (bk, cu) => {
        if (Array.isArray(bk) && Array.isArray(cu)) {
          const byId = new Map(cu.filter((x) => x && typeof x === "object" && x.id != null).map((x) => [x.id, x]));
          bk.forEach((x, i) => {
            const y = x && typeof x === "object" && x.id != null ? byId.get(x.id) : cu[i];
            if (y !== undefined) walk(x, y);
          });
        } else if (bk && cu && typeof bk === "object" && typeof cu === "object") {
          for (const k of Object.keys(bk)) if (k in cu) walk(bk[k], cu[k]);
        } else if (isImg(bk) && isImg(cu) && cu.startsWith("/api/img/") && imgs[bk]) pairs.push([bk, cu]);
      };
      for (const sec of SECTIONS) {
        const bk = (parsed.data || {})[sec.key];
        if (bk === undefined) continue;
        try {
          const r = await fetch(sec.url, { cache: "no-store" });
          if (r.ok) walk(bk, await r.json());
        } catch {}
      }
      if (!pairs.length) throw new Error("none");
      let fixed = 0, ok = 0, bad = 0, i = 0;
      for (const [bu, u] of pairs) {
        i++;
        setMsg({ ok: true, text: `Đang kiểm tra ảnh ${i}/${pairs.length} (đã sửa ${fixed})...` });
        let alive = false;
        try { alive = (await retry(async () => { const r = await fetch(u.split("?")[0], { cache: "no-store" }); if (!r.ok) throw new Error("x"); return r; }, 2)).ok; } catch {}
        if (alive) { ok++; continue; }
        const name = decodeURIComponent(u.split("?")[0].slice("/api/img/".length));
        const id = name.replace(/\.(jpg|jpeg|png|webp|gif|avif)$/i, "");
        try {
          const small = await shrinkDataUrl(imgs[bu], 900);
          const nu = await retry(() => uploadGomcanImage(id, small));
          if (nu.split("?")[0] !== u.split("?")[0]) throw new Error("name");
          fixed++;
        } catch { bad++; }
      }
      setMsg({ ok: bad === 0, text: `${bad ? "⚠️" : "✅"} Đã nạp lại ${fixed} ảnh bị thiếu; ${ok} ảnh vẫn tốt${bad ? `; ${bad} ảnh chưa nạp được — bấm chạy lại lần nữa` : ""}. Tải lại trang Closet / Giá gồm cân để xem.` });
    } catch {
      setMsg({ ok: false, text: "❌ Không đọc được file sao lưu này." });
    } finally {
      setBusy(false);
    }
  }

  function onPickFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed.data !== "object") {
          setMsg({ ok: false, text: "❌ File này không đúng định dạng file sao lưu của app." });
          return;
        }
        setPendingRestore(parsed);
      } catch {
        setMsg({ ok: false, text: "❌ File này không đúng định dạng file sao lưu của app." });
      }
    };
    reader.readAsText(file);
  }

  async function doRestore() {
    if (!pendingRestore) return;
    setBusy(true);
    setMsg(null);
    try {
      // Ảnh nhúng trong file: ảnh nào không còn trên kho thì tải lên lại và đổi đường dẫn trong dữ liệu.
      let text = JSON.stringify(pendingRestore.data);
      const imgs = pendingRestore.images || {};
      let n = 0;
      const entries = Object.entries(imgs);
      const stamp = Date.now().toString(36);
      // Ảnh ở nơi khác (kho cũ) -> tải lên lại vào kho của web này. Ảnh đã nằm sẵn ở web này thì giữ nguyên.
      const todo = [];
      for (const [u, du] of entries) {
        let own = false;
        try {
          const abs = new URL(u, window.location.origin);
          own = abs.origin === window.location.origin;
        } catch {}
        if (own) {
          let alive = false;
          try {
            alive = (await fetch(u, { method: "HEAD" })).ok;
          } catch {}
          if (alive) continue;
        }
        todo.push([u, du, ++n]);
      }
      const failedUp = [];
      for (let i = 0; i < todo.length; i += 2) {
        setMsg({ ok: true, text: `Đang khôi phục ảnh ${Math.min(i + 2, todo.length)}/${todo.length}...` });
        await Promise.all(
          todo.slice(i, i + 2).map(async ([u, du, k]) => {
            try {
              const small = await shrinkDataUrl(du);
              const nu = await retry(() => uploadGomcanImage(`restore-${stamp}-${k}`, small));
              text = text.split(JSON.stringify(u).slice(1, -1)).join(JSON.stringify(nu).slice(1, -1));
            } catch {
              failedUp.push(u);
            }
          })
        );
      }
      if (failedUp.length) throw new Error("images:" + failedUp.length);
      const restored = JSON.parse(text);
      for (const s of SECTIONS) {
        const body = restored[s.key];
        if (!body || typeof body !== "object") continue;
        const r = await fetch(s.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(s.key);
      }
      setMsg({ ok: true, text: "✅ Đã khôi phục xong. Tải lại trang (F5) để thấy dữ liệu mới." });
    } catch (e) {
      setMsg({ ok: false, text: String(e && e.message || "").startsWith("images:") ? `❌ Có ${String(e.message).slice(7)} ảnh không tải lên lại được nên CHƯA khôi phục dữ liệu — thử khôi phục lại lần nữa.` : "❌ Khôi phục bị lỗi giữa chừng — thử lại, hoặc kiểm tra lại từng mục." });
    } finally {
      setPendingRestore(null);
      setBusy(false);
    }
  }

  const iconBox = (Icon, bg, fg) => (
    <span style={{ width: 38, height: 38, borderRadius: 11, background: bg, color: fg, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon size={19} />
    </span>
  );

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader title="Sao lưu dữ liệu" current="/backup" maxWidth={700} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <section style={{ ...card, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {iconBox(Download, THEME.chipBg, THEME.brand)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Tải file sao lưu về máy</div>
              <div style={{ fontSize: 14, color: THEME.subtext, lineHeight: 1.6 }}>
                Gộp toàn bộ dữ liệu hiện tại (Giá gồm cân, Hàng Closet sẵn — cả ảnh lẫn giá đã sửa, Thiết bị bếp & vệ sinh, Tra cứu nhanh, Tính giá...) thành 1 file.
                Nên tải định kỳ, nhất là sau khi vừa thêm/sửa nhiều, rồi gửi file vào Zalo/Drive/email cho chắc.
              </div>
              <button style={{ ...btn, marginTop: 14 }} disabled={busy} onClick={downloadBackup}>
                <Download size={16} /> {busy ? "Đang tải..." : "Tải file sao lưu"}
              </button>
            </div>
          </div>
        </section>

        <section style={{ ...card, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {iconBox(Upload, THEME.surfaceAlt, THEME.subtext)}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Khôi phục từ file sao lưu</div>
              <div style={{ fontSize: 14, color: THEME.subtext, lineHeight: 1.6 }}>
                Chỉ dùng khi chẳng may dữ liệu bị mất/lỗi — chọn lại đúng file đã tải ở trên.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start", background: THEME.dangerBg, color: THEME.danger, borderRadius: 10, padding: "8px 10px", fontSize: 13.5, fontWeight: 500 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> Việc này sẽ ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu trong file, không thể hoàn tác.
              </div>
              <label style={{ ...btnSub, marginTop: 14, cursor: "pointer" }}>
                <FolderOpen size={16} /> Chọn file sao lưu...
                <input type="file" accept="application/json" onChange={onPickFile} style={{ display: "none" }} />
              </label>
            </div>
          </div>
        </section>

        <section style={{ ...card, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Nạp lại ảnh bị trống</div>
          <div style={{ fontSize: 14, color: THEME.subtext, lineHeight: 1.6 }}>
            Nếu có sản phẩm hiện khung trống thay vì ảnh: chọn lại file sao lưu, web chỉ nạp lại những ảnh đang lỗi. Không đổi dữ liệu nào khác.
          </div>
          <label style={{ ...btnSub, marginTop: 12, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            <FolderOpen size={16} /> Chọn file sao lưu để nạp lại ảnh...
            <input type="file" accept="application/json" disabled={busy} onChange={onRepairFile} style={{ display: "none" }} />
          </label>
        </section>

        {msg && (
          <div
            role="status"
            style={{
              ...card,
              padding: "12px 14px",
              fontSize: 14,
              color: msg.ok ? THEME.success : THEME.danger,
              background: msg.ok ? THEME.successBg : THEME.dangerBg,
              fontWeight: 500,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {msg.ok ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />} {msg.text.replace(/^[✅❌]\s*/, "")}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingRestore}
        message={`Khôi phục dữ liệu từ file sao lưu tạo lúc ${
          pendingRestore && pendingRestore.exportedAt ? new Date(pendingRestore.exportedAt).toLocaleString("vi-VN") : "không rõ"
        }? Toàn bộ dữ liệu hiện tại (mọi mục) sẽ bị THAY THẾ, không thể hoàn tác.`}
        confirmLabel="Khôi phục"
        onCancel={() => setPendingRestore(null)}
        onConfirm={doRestore}
      />
    </main>
  );
}
