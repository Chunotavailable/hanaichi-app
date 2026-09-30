// pages/backup.js
// Trang "Sao lưu dữ liệu": gộp dữ liệu của mọi mục (Giá gồm cân, Hàng Closet
// sẵn, Báo giá nhanh, Việc cần làm, Khách hàng) thành 1 file tải về máy, và
// cho phép chọn lại file đó để khôi phục khi chẳng may dữ liệu bị mất/lỗi.
// Lưu ý: các mục này lưu ở 4 nơi (blob) riêng trên server — trang này chỉ
// gộp/tách lại cho tiện, không đổi cách lưu hiện có.
import { useState } from "react";
import { useTheme, makeStyles, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { Download, Upload, FolderOpen, AlertTriangle, CheckCircle2 } from "lucide-react";

const SECTIONS = [
  { key: "gomcan", url: "/api/gomcan", label: "Giá gồm cân + Hàng Closet sẵn" },
  { key: "thietbi", url: "/api/thietbi", label: "Thiết bị bếp & vệ sinh" },
  { key: "customers", url: "/api/customers", label: "Khách hàng" },
  { key: "todo", url: "/api/todo", label: "Việc cần làm" },
  { key: "pricing", url: "/api/pricing", label: "Báo giá nhanh" },
];

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
      for (const s of SECTIONS) {
        const r = await fetch(s.url);
        if (!r.ok) throw new Error(s.key);
        data[s.key] = await r.json();
      }
      const payload = { app: "hanaichi", exportedAt: new Date().toISOString(), data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hanaichi-sao-luu-${fmtDateStamp(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: "✅ Đã tải file sao lưu về máy. Nhớ lưu file này vào Zalo/Drive/email cho chắc." });
    } catch (e) {
      setMsg({ ok: false, text: "❌ Không tải được sao lưu, thử lại sau." });
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
      for (const s of SECTIONS) {
        const body = pendingRestore.data[s.key];
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
      setMsg({ ok: false, text: "❌ Khôi phục bị lỗi giữa chừng — thử lại, hoặc kiểm tra lại từng mục." });
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
                Gộp toàn bộ dữ liệu hiện tại (Giá gồm cân, Hàng Closet sẵn — cả ảnh lẫn giá đã sửa, Thiết bị bếp & vệ sinh, Tính giá...) thành 1 file.
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
