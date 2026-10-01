// pages/closet.js
// Trang riêng "Hàng Closet sẵn" — tra cứu nhanh hàng có sẵn (giày Wilson/
// Onitsuka/Nike/Asics, quần áo, túi/balo/phụ kiện...) theo mã, size, tên...
// Dùng chung nguồn dữ liệu với "Giá gồm cân" (api/gomcan, field "closet").
import { useEffect, useRef, useState } from "react";
import { useTheme, makeStyles, Loading, LoadError, ConfirmDialog } from "../lib/theme";
import { PageHeader } from "../lib/nav";
import { goLogin, uid, norm, resizeImageFile, uploadGomcanImage, deleteGomcanImage, importGomcanImageFromUrl, showToast, ViewModeToggle, gridColumnsFor, SmartImage } from "../lib/gomcanHelpers";
import { createSyncer, loadDoc } from "../lib/syncer";
import { usePerm } from "../lib/perm";
import { Highlight, searchTokens, HL_COLOR } from "../lib/Highlight";
import { FilterChip, SearchInput, EmptyState, GroupTitle, ImagePlaceholder, UndoToast } from "../lib/ui";
import {
  ShoppingBag,
  ImageDown,
  ArrowUpNarrowWide,
  Flame,
  BadgePercent,
  Pencil,
  Plus,
  Minus,
  FolderPlus,
  SearchX,
  ChevronRight,
  X,
  Camera,
  Trash2,
  Copy,
  Check,
  MessageSquareQuote,
  ScanSearch,
} from "lucide-react";

// Lấy phần trong ngoặc của mã biến thể để hiện gọn khi cần (VD "WRS...-235
// (EU 38)" -> "EU 38").
function variantShortLabel(v) {
  const m = (v.label || "").match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  const label = (v.label || "").trim();
  return label.length > 22 ? label.slice(0, 20) + "…" : label || "?";
}
// Giá trị số của size EU để sắp xếp — hiểu cả size lẻ dạng phân số
// (VD "EU 37 1/3" = 37.33, "EU36 2/3" = 36.67), không parse được thì xếp cuối.
function variantSizeSortValue(v) {
  const label = v.label || "";
  const m = label.match(/EU\s*([0-9]+)(?:\s*([0-9]+)\s*\/\s*([0-9]+))?/i);
  if (m) {
    const base = Number(m[1]) || 0;
    const frac = m[2] && m[3] ? Number(m[2]) / Number(m[3]) : 0;
    return base + frac;
  }
  return Infinity;
}
// Luôn hiện các biến thể theo đúng thứ tự size tăng dần, bất kể thứ tự thêm
// vào trước sau (VD thêm size 36 2/3 sau cùng vẫn tự nhảy lên trước size 37).
function sortedClosetVariants(variants) {
  return [...(variants || [])].sort((a, b) => variantSizeSortValue(a) - variantSizeSortValue(b));
}
// Tìm phần mã DÙNG CHUNG cho mọi biến thể của 1 sản phẩm (VD các mã
// "WRS00964001-235", "WRS00964001-24"... đều chung tiền tố "WRS00964001") —
// để hiện mã đó ra 1 lần duy nhất, còn từng biến thể chỉ hiện phần size
// riêng, khỏi lặp lại mã dài dòng dài trên từng thẻ size.
function commonCodePrefix(variants) {
  const labels = (variants || []).map((v) => (v.label || "").trim()).filter(Boolean);
  if (labels.length < 2) return "";
  let prefix = labels[0];
  for (let i = 1; i < labels.length && prefix; i++) {
    const b = labels[i];
    let j = 0;
    while (j < prefix.length && j < b.length && prefix[j] === b[j]) j++;
    prefix = prefix.slice(0, j);
  }
  // Cắt về đúng ranh giới sạch (trước dấu "-", "/" hoặc khoảng trắng gần nhất)
  // để không cắt đứt giữa chừng 1 từ/số.
  const m = prefix.match(/^(.*)[-/\s]/);
  const cleaned = m ? m[1] : "";
  return cleaned.length >= 3 ? cleaned : "";
}
// Đoán ra mã sản phẩm để ghép vào từ khóa tìm ảnh: ưu tiên mã dùng chung
// giữa các biến thể, không có thì lấy phần trước dấu "(" của biến thể đầu.
function productCodeGuess(p) {
  const variants = p.variants || [];
  const shared = commonCodePrefix(variants);
  if (shared) return shared;
  const first = (variants[0] && variants[0].label) || "";
  const m = first.match(/^(.*?)\s*\(/);
  return (m ? m[1] : first).trim();
}
// Phần "size" riêng của 1 biến thể sau khi đã bỏ mã dùng chung — ưu tiên lấy
// phần chữ trong ngoặc (dễ đọc hơn, VD "EU 38") nếu có.
function sizePartFor(label, code) {
  const raw = (label || "").trim();
  let rest = code ? raw.slice(code.length) : raw;
  rest = rest.replace(/^[-/\s]+/, "").trim();
  const m = rest.match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  return rest || raw || "?";
}
function fmtClosetPrice(price) {
  const n = Number(price) || 0;
  return n.toLocaleString("vi-VN") + "k";
}
// ===== Nhập ảnh hàng loạt: khớp 1 dòng "mã: link ảnh" người dùng dán vào với
// đúng sản phẩm trong danh sách, dựa trên mã sản phẩm xuất hiện trong tên
// hoặc trong mã các biến thể (không cần khớp chính xác dấu cách/gạch ngang).
function normCode(s) {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function matchClosetProductsByCode(list, code) {
  // Cho phép dán thẳng đúng id nội bộ của sản phẩm (chính xác tuyệt đối,
  // dùng khi đã biết chắc sản phẩm nào — ví dụ do tự tra cứu sẵn) — ưu tiên
  // kiểm tra trước, không thì mới khớp mờ theo mã xuất hiện trong tên/biến thể.
  const byId = list.find((p) => p.id === (code || "").trim());
  if (byId) return [byId];
  const nc = normCode(code);
  if (nc.length < 4) return [];
  return list.filter((p) => {
    const hay = normCode(p.name + " " + (p.variants || []).map((v) => v.label).join(" "));
    return hay.includes(nc);
  });
}
// Tách 1 khối text nhiều dòng thành từng dòng {code, url} — link ảnh là phần
// bắt đầu bằng http(s), phần còn lại trước đó là mã sản phẩm.
function parseBulkImageLines(text) {
  return (text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/(https?:\/\/\S+)/i);
      if (!m) return { raw: line, code: line, url: "" };
      const url = m[1];
      // Chỉ bỏ dấu phân cách cuối (": ", "|", ",") — KHÔNG bỏ dấu "-" vì
      // nhiều id sản phẩm/mã thật sự kết thúc bằng dấu gạch ngang.
      const code = line
        .slice(0, m.index)
        .replace(/\s+$/, "")
        .replace(/[:|,]+$/, "")
        .replace(/\s+$/, "")
        .trim();
      return { raw: line, code, url };
    });
}
// Sản phẩm xả kho: tên có chữ "xả kho" HOẶC được tự tay tích chọn (p.xaKho)
// — hiện nhãn XẢ KHO + giá tô đỏ ở ngoài, và không được áp chương trình
// giảm giá chung. Nhận vào cả product object hoặc chuỗi tên (giữ tương thích
// với các chỗ gọi cũ isXaKho(p)).
function isXaKho(p) {
  if (p && typeof p === "object") {
    return !!p.xaKho || norm(p.name || "").includes("xa kho");
  }
  return norm(p || "").includes("xa kho");
}
const XA_KHO_COLOR = "#c0262d";
// Thời lượng 1 nhịp nháy của nhãn "XẢ KHO" (ms) — PHẢI khớp với thời lượng
// khai báo ở keyframes hnXaKhoPulse trong pages/_app.js.
const XA_KHO_BLINK_MS = 1300;
// Đồng bộ nhịp nháy giữa mọi thẻ trên trang: tính animation-delay ÂM dựa
// theo giờ hệ thống (thay vì để mặc định bắt đầu từ lúc mỗi thẻ được render)
// — nhờ vậy dù các thẻ hiện ra không cùng lúc (cuộn trang, lọc, mở modal...)
// thì nhãn vẫn luôn nháy cùng 1 nhịp với nhau, không bị lệch pha trông rối mắt.
function xaKhoBlinkDelay() {
  return `-${Date.now() % XA_KHO_BLINK_MS}ms`;
}
// Giao diện nhãn "XẢ KHO" nổi bật hơn: nền gradient đỏ cam, viền sáng, icon
// lửa, có 3 cỡ dùng cho: thẻ dạng danh sách (sm), thẻ lưới (md), modal chi
// tiết (lg).
const XA_KHO_BADGE_SIZES = {
  sm: { fontSize: 8.5, padding: "1px 6px", top: 4, left: 4, radius: 6 },
  md: { fontSize: 10.5, padding: "2px 10px", top: 6, left: 6, radius: 8 },
  lg: { fontSize: 12.5, padding: "3px 12px", top: 10, left: 10, radius: 9 },
};
function xaKhoBadgeStyle(size) {
  const s = XA_KHO_BADGE_SIZES[size] || XA_KHO_BADGE_SIZES.md;
  return {
    position: "absolute",
    top: s.top,
    left: s.left,
    background: "linear-gradient(135deg, #e04848, #c0262d 55%, #a11d24)",
    color: "#fff",
    fontSize: s.fontSize,
    fontWeight: 700,
    padding: s.padding,
    borderRadius: s.radius,
    letterSpacing: 0.4,
    border: "1px solid rgba(255,255,255,0.6)",
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    animationDelay: xaKhoBlinkDelay(),
  };
}

// Giới tính suy ra từ tên/danh mục: mã nào không có chữ "nam"/"nữ" thì coi
// như dùng được cho cả 2 giới (luôn hiện ra dù đang lọc Nam hay Nữ).
function genderOf(p) {
  const tokens = norm((p.name || "") + " " + (p.category || "")).split(" ").filter(Boolean);
  const hasNam = tokens.includes("nam");
  const hasNu = tokens.includes("nu");
  if (hasNam && !hasNu) return "nam";
  if (hasNu && !hasNam) return "nu";
  return "both";
}
// Lấy các số size EU có trong mã/size của 1 sản phẩm — không cần khớp chính
// xác dấu cách (VD "EU 38", "EU38", "EU 38 2/3" đều nhận ra số "38").
function euSizesOf(p) {
  const sizes = new Set();
  (p.variants || []).forEach((v) => {
    const m = (v.label || "").match(/EU\s*([0-9]+)/i);
    if (m) sizes.add(m[1]);
  });
  return sizes;
}
// Thứ tự hiển thị chuẩn cho size chữ (quần áo) — dùng để sắp chip lọc và so sánh.
const LETTER_SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
// Lấy các size dạng chữ (S/M/L/XL/2XL...) có trong mã của 1 sản phẩm — mã
// quần áo thường có dạng "IW5977-S", "684188-51-XL" (chữ size ở cuối, sau
// dấu gạch ngang cuối cùng), không nằm trong ngoặc như size EU giày.
function letterSizesOf(p) {
  const sizes = new Set();
  (p.variants || []).forEach((v) => {
    const label = (v.label || "").trim();
    const m = label.match(/-(\d?XL|XXL|XS|S|M|L)\s*(?:\([^)]*\))?$/i);
    if (m) {
      let s = m[1].toUpperCase();
      if (s === "XXL") s = "2XL";
      sizes.add(s);
    }
  });
  return sizes;
}
function minPriceOf(p) {
  const prices = (p.variants || []).map((v) => Number(v.price) || 0).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : Infinity;
}
// Tách 1 mã hiển thị (VD "WRS00964001-235 (EU 38)") thành 2 phần riêng để
// sửa cho dễ: "Mã" (WRS00964001-235) và "Size" (EU 38) — dùng khi mở form
// sửa 1 mã cụ thể. Mã nào không có ngoặc thì size để trống, mã là cả chuỗi.
function splitLabelForEdit(label) {
  const raw = (label || "").trim();
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { code: m[1].trim(), size: m[2].trim() };
  // Không có ngoặc (mã quần áo kiểu "IW5977-S"): thử tách phần size chữ
  // (S/M/L/XL/2XL...) ở cuối, tránh hiện dính liền cả mã lẫn size làm 1 cục.
  const lm = raw.match(/^(.*)-(\d?XL|XXL|XS|S|M|L)$/i);
  if (lm) {
    let size = lm[2].toUpperCase();
    if (size === "XXL") size = "2XL";
    return { code: lm[1].trim(), size };
  }
  return { code: raw, size: "" };
}
// Ghép lại "Mã" + "Size" thành 1 chuỗi label để lưu và hiển thị/tìm kiếm
// như trước (VD "WRS00964001-235 (EU 38)").
function composeLabel(code, size) {
  const c = (code || "").trim();
  const s = (size || "").trim();
  if (!c) return s;
  return s ? `${c} (${s})` : c;
}
// Chương trình giảm giá áp dụng cho cả tab Closet: bật lên thì mọi sản phẩm
// có giá từ "threshold" trở lên được giảm "percent"% khi hiển thị ra ngoài.
const DEFAULT_DISCOUNT = { enabled: false, threshold: 500, percent: 5 };
function applyDiscount(price, discount) {
  const d = discount || DEFAULT_DISCOUNT;
  if (!d.enabled) return price;
  const threshold = Number(d.threshold) || 0;
  const percent = Number(d.percent) || 0;
  if (threshold > 0 && percent > 0 && price >= threshold) {
    const raw = price * (1 - percent / 100);
    // Giá đơn vị "k" = nghìn đồng, nên bội số 5.000đ chính là bội số của 5 ở đây.
    return Math.ceil(raw / 5) * 5;
  }
  return price;
}
// Dòng giá hiện ra ngoài thẻ sản phẩm: nếu các mã/size có cùng 1 giá thì
// hiện 1 số, khác giá thì hiện khoảng giá "thấp nhất - cao nhất". Khi có
// chương trình giảm giá đang bật và áp dụng được, trả thêm dòng giá gốc để
// hiện gạch ngang bên cạnh giá đã giảm.
function priceRangeLine(variants, discount) {
  const prices = (variants || []).map((v) => Number(v.price) || 0).filter((n) => n > 0);
  if (!prices.length) return { text: "------", originalText: null };
  const discounted = prices.map((p) => applyDiscount(p, discount));
  const min = Math.min(...discounted);
  const max = Math.max(...discounted);
  const text = min === max ? fmtClosetPrice(min) : `${fmtClosetPrice(min)} - ${fmtClosetPrice(max)}`;
  const hasDiscount = discounted.some((d, i) => d !== prices[i]);
  if (!hasDiscount) return { text, originalText: null };
  const omin = Math.min(...prices);
  const omax = Math.max(...prices);
  const originalText = omin === omax ? fmtClosetPrice(omin) : `${fmtClosetPrice(omin)} - ${fmtClosetPrice(omax)}`;
  return { text, originalText };
}
// Câu báo giá nhanh cho từng sản phẩm, theo đúng mẫu chủ shop dùng để trả lời khách.
function buildClosetQuote(p, discount) {
  const priceLine = priceRangeLine(p.variants || [], discount);
  if (priceLine.text === "------") return "";
  const name = (p.name || "").replace(/\n/g, " ").trim();
  // Sản phẩm đang được giảm giá thì câu báo giá nói rõ luôn cho khách biết.
  if (priceLine.originalText) {
    return `Dạ ${name} bên em có sẵn đang được giảm giá còn ${priceLine.text} ạ`;
  }
  return `Dạ ${name} bên em có sẵn giá ${priceLine.text} ạ`;
}

export default function ClosetPage() {
  const { theme: THEME } = useTheme();
  const { card, btn, btnSub, iconBtn, inp, chip, thumb } = makeStyles(THEME);
  const T = { THEME, card, btn, btnSub, iconBtn, inp, chip, thumb };
  const perm = usePerm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Hoàn tác xoá trong 10s: xoá thì lưu ngay như mọi thay đổi khác; bấm
  // "Hoàn tác" thì chèn lại đúng món vừa xoá vào vị trí cũ (dựa trên dữ liệu
  // HIỆN TẠI — không quay về bản chụp cũ, để không làm mất những gì vừa sửa
  // thêm trong 10s đó). Riêng việc xoá ẢNH trên server là không lấy lại
  // được nên mới phải chờ hết 10s không hoàn tác mới làm (onCommit).
  const undoRef = useRef(null); // { restore, timer, onCommit }
  const [undoInfo, setUndoInfo] = useState(null); // { message } — chỉ để hiện thanh thông báo
  const [loadFailed, setLoadFailed] = useState(false);
  const dataRef = useRef(null);
  const lastEtagRef = useRef("");
  dataRef.current = data;
  // Chỉ gửi phần thay đổi lên server khi lưu — xem lib/syncer.js.
  const syncerRef = useRef(null);
  if (!syncerRef.current) syncerRef.current = createSyncer("/api/gomcan", { onServerData: setData });

  function loadData() {
    setLoading(true);
    setLoadFailed(false);
    loadDoc("/api/gomcan")
      .then(({ data: d, etag }) => {
        syncerRef.current.init(d, etag);
        setData(d);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }
  // Đối chiếu với file Google Sheet Closet của công ty (số lượng, thêm/bớt mã).
  const [showLog, setShowLog] = useState(false);
  const [logTab, setLogTab] = useState("log");
  const [sheetSync, setSheetSync] = useState({ busy: false, at: null, error: "", summary: null, pending: [] });
  async function syncSheet(force, action) {
    setSheetSync((s) => ({ ...s, busy: true, error: "" }));
    try {
      const r = await fetch(`/api/closet-sync${force ? "?force=1" : ""}`, action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action), cache: "no-store" } : { cache: "no-store" });
      if (r.status === 401) return goLogin();
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Không đọc được file Google Sheet");
      if (j.changed && !syncerRef.current.hasPending()) {
        const fr = await fetch("/api/gomcan", { cache: "no-store" }); // không dùng bản tải trước (cũ)
        if (fr.ok) {
          const d = await fr.json();
          syncerRef.current.init(d, fr.headers.get("x-hn-etag") || "");
          setData(d);
        }
      }
      setSheetSync((s) => ({ busy: false, at: j.at || new Date().toISOString(), error: "", summary: j.changed ? j.summary : s.summary, pending: j.pending || [] }));
      // Bấm "Cập nhật ngay" thì tải lại trang; duyệt/bỏ qua thì giữ nguyên trang.
      if (force && !action) {
        try { syncerRef.current.flushNow(); } catch {}
        setTimeout(() => window.location.reload(), 500);
      }
      return true;
    } catch (e) {
      setSheetSync((s) => ({ ...s, busy: false, error: (e && e.message) || "Không cập nhật được từ file gốc" }));
      return false;
    }
  }
  // Duyệt / Bỏ qua: mục biến mất ngay, gửi lên máy chủ ở phía sau (xếp hàng), không khoá nút.
  const actChain = useRef(Promise.resolve());
  const actCount = useRef(0);
  function actPending(approve, reject) {
    const done = new Set([...approve, ...reject].map((x) => x.k + x.key));
    setSheetSync((s) => ({ ...s, pending: s.pending.filter((x) => !done.has(x.k + x.key)) }));
    actCount.current++;
    actChain.current = actChain.current.then(async () => {
      try {
        const r = await fetch("/api/closet-sync?force=1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve, reject }), cache: "no-store" });
        if (r.status === 401) return goLogin();
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Không lưu được thao tác");
        if (j.changed && !syncerRef.current.hasPending()) {
          const fr = await fetch("/api/gomcan", { cache: "no-store" });
          if (fr.ok) {
            const d = await fr.json();
            syncerRef.current.init(d, fr.headers.get("x-hn-etag") || "");
            setData(d);
          }
        }
        if (actCount.current === 1) setSheetSync((s) => ({ ...s, error: "", at: j.at || s.at, pending: j.pending || [] }));
      } catch (e) {
        setSheetSync((s) => ({ ...s, error: (e && e.message) || "Không lưu được thao tác, thử lại" }));
        syncSheet(false);
      } finally {
        actCount.current--;
      }
    });
  }
  useEffect(() => {
    loadData();
    syncSheet(false);
    const detach = syncerRef.current.attachLifecycle();
    return () => {
      // Rời trang khi còn 1 lượt xoá chờ hoàn tác -> làm nốt phần xoá ảnh.
      if (undoRef.current) {
        clearTimeout(undoRef.current.timer);
        undoRef.current.onCommit();
        undoRef.current = null;
      }
      detach();
    };
  }, []);

  // Khách chỉ xem: tự lấy lại dữ liệu mới định kỳ (và khi quay lại tab) để thấy ngay
  // khi Quản lý bật/tắt giảm giá hoặc sửa số liệu, khỏi phải tải lại trang.
  useEffect(() => {
    if (perm.role !== "guest") return;
    let stop = false;
    async function refresh() {
      if (stop || document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/gomcan", { cache: "no-store" });
        if (!r.ok || stop) return;
        const d = await r.json();
        const et = r.headers.get("x-hn-etag") || "";
        if (et && et === lastEtagRef.current) return;
        lastEtagRef.current = et;
        setData(d);
      } catch {}
    }
    const t = setInterval(refresh, 180000); // 3 phút (mỗi lần hỏi tốn 1 "Advanced Request" của Vercel Blob; quay lại tab thì cập nhật ngay)
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [perm.role]);

  function persist(next) {
    setData(next);
    syncerRef.current.schedule(next);
  }

  function scheduleUndoableDelete({ message, nextData, restore, onCommit = () => {} }) {
    // Đang có 1 lượt xoá khác chưa hết 10s thì chốt luôn lượt đó.
    if (undoRef.current) {
      clearTimeout(undoRef.current.timer);
      undoRef.current.onCommit();
      undoRef.current = null;
    }
    persist(nextData);
    const timer = setTimeout(() => {
      onCommit();
      undoRef.current = null;
      setUndoInfo(null);
    }, 10000);
    undoRef.current = { restore, timer, onCommit };
    setUndoInfo({ message });
  }

  function undoDelete() {
    if (!undoRef.current) return;
    clearTimeout(undoRef.current.timer);
    const { restore } = undoRef.current;
    undoRef.current = null;
    setUndoInfo(null);
    persist(restore(dataRef.current));
  }

  if (loadFailed && !loading) {
    return <LoadError onRetry={loadData} />;
  }
  if (loading || !data) {
    return <Loading />;
  }

  function addClosetProduct(product) {
    const next = { ...data, closet: [...(data.closet || []), { id: uid(), image: "", variants: [], ...product }] };
    persist(next);
  }
  function saveClosetProduct(id, patch) {
    const next = { ...data, closet: data.closet.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    persist(next);
  }
  // Dùng cho Nhập ảnh hàng loạt: áp TẤT CẢ ảnh đã tải được vào 1 lần lưu duy
  // nhất, thay vì gọi saveClosetProduct từng cái một trong vòng lặp — vì gọi
  // nhiều lần liên tiếp như vậy đều dựa trên cùng 1 bản "data" cũ tại thời
  // điểm bắt đầu (React chưa kịp render lại giữa các lần gọi), nên lần sau
  // sẽ ghi đè mất kết quả của lần trước, cuối cùng chỉ còn đúng 1 ảnh được lưu.
  function bulkSaveClosetImages(updates) {
    const byId = new Map(updates.map((u) => [u.id, u.image]));
    // Dùng dataRef (dữ liệu hiện tại) vì hàm này chạy sau cả 1 vòng tải ảnh
    // dài — "data" lúc bắt đầu vòng lặp có thể đã cũ.
    const cur = dataRef.current;
    const next = {
      ...cur,
      closet: cur.closet.map((p) => (byId.has(p.id) ? { ...p, image: byId.get(p.id) } : p)),
    };
    persist(next);
  }
  function delClosetProduct(id) {
    const index = data.closet.findIndex((p) => p.id === id);
    const product = data.closet[index];
    if (!product) return;
    // Ghi nhớ lại id đã xoá: nếu đây là 1 mã có sẵn trong dữ liệu mẫu gốc
    // (seed), server sẽ tự "bổ sung lại mã còn thiếu" mỗi khi tải trang —
    // không ghi nhớ thì mã vừa xoá sẽ tự hiện lại ngay sau khi tải lại trang.
    const deletedIds = Array.from(new Set([...(data.closetDeletedIds || []), id]));
    const next = { ...data, closet: data.closet.filter((p) => p.id !== id), closetDeletedIds: deletedIds };
    scheduleUndoableDelete({
      message: `Đã xoá "${product.name.split("\n")[0]}"`,
      nextData: next,
      restore: (cur) => {
        const list = cur.closet.filter((p) => p.id !== id);
        list.splice(Math.min(index, list.length), 0, product);
        return { ...cur, closet: list, closetDeletedIds: (cur.closetDeletedIds || []).filter((x) => x !== id) };
      },
      // Chỉ thật sự xoá ảnh trên server sau 10s không hoàn tác — hoàn tác thì
      // ảnh vẫn còn nguyên, khỏi phải tải/nhập lại.
      onCommit: () => deleteGomcanImage(id),
    });
  }
  function addClosetVariant(productId, variant) {
    const next = {
      ...data,
      closet: data.closet.map((p) =>
        p.id === productId ? { ...p, variants: [...p.variants, { id: uid(), qty: 0, sold: 0, remaining: 0, ...variant }] } : p
      ),
    };
    persist(next);
  }
  function saveClosetVariant(productId, variantId, patch) {
    const next = {
      ...data,
      closet: data.closet.map((p) =>
        p.id === productId ? { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, ...patch } : v)) } : p
      ),
    };
    persist(next);
  }
  function delClosetVariant(productId, variantId) {
    const product = data.closet.find((p) => p.id === productId);
    const vIndex = product ? product.variants.findIndex((v) => v.id === variantId) : -1;
    const variant = vIndex >= 0 ? product.variants[vIndex] : null;
    if (!variant) return;
    // Ghi nhớ lại "productId:variantId" đã xoá, cùng lý do như delClosetProduct
    // ở trên — tránh size/mã đã xoá của sản phẩm mẫu gốc tự hiện lại.
    const key = `${productId}:${variantId}`;
    const deletedVariantIds = Array.from(new Set([...(data.closetDeletedVariantIds || []), key]));
    const next = {
      ...data,
      closet: data.closet.map((p) => (p.id === productId ? { ...p, variants: p.variants.filter((v) => v.id !== variantId) } : p)),
      closetDeletedVariantIds: deletedVariantIds,
    };
    scheduleUndoableDelete({
      message: `Đã xoá mã "${variant.label || ""}"`,
      nextData: next,
      restore: (cur) => ({
        ...cur,
        closet: cur.closet.map((p) => {
          if (p.id !== productId) return p;
          const vs = p.variants.filter((v) => v.id !== variantId);
          vs.splice(Math.min(vIndex, vs.length), 0, variant);
          return { ...p, variants: vs };
        }),
        closetDeletedVariantIds: (cur.closetDeletedVariantIds || []).filter((x) => x !== key),
      }),
    });
  }
  // Sửa giá chung cho cả sản phẩm: áp 1 giá mới cho TẤT CẢ biến thể (size/màu)
  // của đúng 1 sản phẩm, trong 1 lần lưu duy nhất — tiện khi mọi size đều
  // cùng 1 giá, khỏi phải sửa từng dòng giá lẻ tẻ.
  function setAllClosetVariantPrices(productId, price) {
    const next = {
      ...data,
      closet: data.closet.map((p) =>
        p.id === productId ? { ...p, variants: p.variants.map((v) => ({ ...v, price })) } : p
      ),
    };
    persist(next);
  }
  function bumpClosetVariant(productId, variantId, delta) {
    const p = data.closet.find((x) => x.id === productId);
    const v = p && p.variants.find((x) => x.id === variantId);
    if (!v) return;
    const nextRemaining = Math.max(0, (Number(v.remaining) || 0) + delta);
    saveClosetVariant(productId, variantId, { remaining: nextRemaining });
  }
  function saveClosetDiscount(patch) {
    const next = { ...data, closetDiscount: { ...(data.closetDiscount || DEFAULT_DISCOUNT), ...patch } };
    persist(next);
  }

  return (
    <main style={{ minHeight: "100vh", background: THEME.bg, paddingBottom: 60 }}>
      <PageHeader icon="👜" title="Hàng Closet sẵn" current="/closet" maxWidth={900} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12.5, marginBottom: 10, color: sheetSync.error ? THEME.danger : THEME.muted }}>
          <span>
            {sheetSync.error
              ? `⚠️ ${sheetSync.error} — đang dùng số liệu lần trước`
              : sheetSync.busy
              ? "Đang đối chiếu với file gốc của công ty..."
              : sheetSync.at
              ? `Tự cập nhật mỗi ngày 1 lần từ file gốc · ${new Date(sheetSync.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}${sheetSync.summary ? ` · đã cập nhật số lượng ${sheetSync.summary.updated} mã` : ""}`
              : ""}
          </span>
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button style={{ ...T.btnSub, padding: "4px 10px", fontSize: 12.5, ...(sheetSync.pending.length > 0 ? { borderColor: THEME.brand, color: THEME.brand, fontWeight: 700 } : {}) }} onClick={() => { setLogTab("log"); setShowLog(true); }}>
              Lịch sử thay đổi{sheetSync.pending.length > 0 ? ` · ${sheetSync.pending.length} chờ duyệt` : ""}
            </button>
            <button style={{ ...T.btnSub, padding: "4px 10px", fontSize: 12.5 }} disabled={sheetSync.busy} onClick={() => syncSheet(true)}>
              {sheetSync.busy ? "Đang cập nhật..." : "Cập nhật ngay"}
            </button>
          </span>
        </div>
        {perm.canEdit && sheetSync.pending.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", background: "#fff3d6", border: "1px solid #f0d28a", color: "#6b4a00", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
            <span>⚠️ File công ty có {sheetSync.pending.length} thay đổi (mã mới/xoá mã/đổi giá) đang chờ bạn duyệt</span>
            <button style={{ ...T.btn, padding: "6px 12px", fontSize: 13 }} onClick={() => { setLogTab("pending"); setShowLog(true); }}>Xem & duyệt</button>
          </div>
        )}
        <ClosetSection
          data={data}
          addClosetProduct={addClosetProduct}
          saveClosetProduct={saveClosetProduct}
          bulkSaveClosetImages={bulkSaveClosetImages}
          delClosetProduct={delClosetProduct}
          addClosetVariant={addClosetVariant}
          saveClosetVariant={saveClosetVariant}
          setAllClosetVariantPrices={setAllClosetVariantPrices}
          delClosetVariant={delClosetVariant}
          bumpClosetVariant={bumpClosetVariant}
          discount={data.closetDiscount || DEFAULT_DISCOUNT}
          saveClosetDiscount={saveClosetDiscount}
          T={T}
        />
      </div>
      {showLog && <ChangeLogModal onClose={() => setShowLog(false)} lastAt={sheetSync.at} pending={sheetSync.pending} canEdit={perm.canEdit} busy={false} initialTab={logTab} act={actPending} T={T} />}
      {undoInfo && <UndoToast message={undoInfo.message} onUndo={undoDelete} />}
    </main>
  );
}

// Lịch sử các lần Closet tự cập nhật từ file Google Sheet: mỗi lần có thay đổi
// thì ghi lại từng mã đổi gì (còn lại/SL/đã bán/giá), mã mới, mã không còn.
const FIELD_LABEL = { remaining: "Còn lại", qty: "SL", sold: "Đã bán", price: "Giá lẻ" };
function ChangeLogModal({ onClose, lastAt, pending = [], canEdit, busy, initialTab, act, T }) {
  const { THEME, card, btn, btnSub } = T;
  const [tab, setTab] = useState(initialTab === "pending" ? "pending" : "log");
  const [log, setLog] = useState(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(0);
  useEffect(() => {
    fetch("/api/closet-changes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setLog)
      .catch(() => setErr(true));
  }, []);
  const fmt = (iso) => new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const line = (it) => {
    if (it.k === "upd") return Object.entries(it.f).map(([k, [a, b]]) => `${FIELD_LABEL[k] || k}: ${a} → ${b}`).join(" · ");
    if (it.k === "add") return `Mã mới · còn ${it.to}`;
    if (it.k === "new") return `Sản phẩm mới · còn ${it.to}`;
    if (it.k === "gone") return `Không còn trong sheet (trước đó còn ${it.was})`;
    if (it.k === "back") return `Có lại trong sheet · còn ${it.to}`;
    return "";
  };
  const color = (it) => (it.k === "gone" ? THEME.danger : it.k === "add" || it.k === "new" || it.k === "back" ? THEME.success : THEME.text);
  const ref = (x) => ({ k: x.k, key: x.key, to: x.to });
  return (
    <div className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(40,20,25,0.45)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }} onClick={onClose}>
      <div role="dialog" className="hnPop" onClick={(e) => e.stopPropagation()} style={{ ...card, width: "100%", maxWidth: 640, maxHeight: "86vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${THEME.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Thay đổi từ file công ty</div>
            {lastAt && <div style={{ fontSize: 12.5, color: THEME.muted }}>Lần kiểm tra gần nhất: {fmt(lastAt)}</div>}
          </div>
          <button style={btnSub} onClick={onClose}>Đóng</button>
        </div>
        <div style={{ display: "flex", gap: 6, padding: "8px 16px 0" }}>
          {[["pending", `Chờ duyệt (${pending.length})`], ["log", "Đã cập nhật"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ all: "unset", cursor: "pointer", padding: "6px 12px", borderRadius: 999, fontSize: 13.5, fontWeight: 700, background: tab === k ? THEME.brand : THEME.chipBg, color: tab === k ? "#fff" : THEME.text }}>
              {label}
            </button>
          ))}
        </div>
        {tab === "pending" && (
          <div style={{ overflowY: "auto", padding: "8px 16px 16px" }}>
            {!pending.length && <div style={{ color: THEME.muted, padding: 12 }}>Không có thay đổi nào chờ duyệt. Số lượng của các mã đang có thì tự cập nhật.</div>}
            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: THEME.subtext, padding: "4px 0 8px", lineHeight: 1.5 }}>
                  Mã mới, mã bị xoá và giá lẻ thay đổi trong file công ty chỉ vào app sau khi bạn duyệt.
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <button style={{ ...btn, padding: "6px 12px", fontSize: 13 }} disabled={busy} onClick={() => act(pending.map(ref), [])}>Duyệt tất cả ({pending.length})</button>
                    <button style={{ ...btnSub, padding: "6px 12px", fontSize: 13 }} disabled={busy} onClick={() => act([], pending.map(ref))}>Bỏ qua tất cả</button>
                  </div>
                )}
                {pending.map((x) => {
                  const kind = x.k === "price" ? [x.xa ? "Giá xả" : "Giá lẻ đổi", "#b26a00"] : x.k === "gone" ? ["Không còn trong file", THEME.danger] : x.k === "new" ? ["Sản phẩm mới", THEME.success] : ["Mã mới", THEME.success];
                  return (
                    <div key={x.k + x.key} style={{ padding: "8px 0", borderTop: `1px solid ${THEME.line}`, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.45 }}>
                        <div style={{ color: THEME.subtext }}>{x.p}</div>
                        <div>
                          <b>{x.l}</b> — <span style={{ color: kind[1], fontWeight: 700 }}>{kind[0]}</span>
                          {x.k === "price" ? `: ${x.from}k → ${x.to}k` : x.k === "gone" ? ` (đang còn ${x.was})` : ` · còn ${x.to}${x.price ? ` · giá ${x.price}k` : ""}`}
                        </div>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button style={{ ...btn, padding: "5px 10px", fontSize: 12.5 }} disabled={busy} onClick={() => act([ref(x)], [])}>Duyệt</button>
                          <button style={{ ...btnSub, padding: "5px 10px", fontSize: 12.5 }} disabled={busy} onClick={() => act([], [ref(x)])}>Bỏ qua</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
        <div style={{ overflowY: "auto", padding: "8px 16px 16px", display: tab === "log" ? "block" : "none" }}>
          {err && <div style={{ color: THEME.danger, padding: 12 }}>Không tải được lịch sử.</div>}
          {!log && !err && <div style={{ color: THEME.muted, padding: 12 }}>Đang tải...</div>}
          {log && !(log.entries || []).length && <div style={{ color: THEME.muted, padding: 12 }}>Chưa có lần thay đổi nào được ghi. Khi công ty sửa file, các thay đổi sẽ hiện ở đây.</div>}
          {log && (log.entries || []).map((e, i) => {
            const s = e.summary || {};
            const isOpen = open === i;
            return (
              <div key={e.at} style={{ borderBottom: `1px solid ${THEME.line}`, padding: "10px 0" }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(e.at)} {e.approved ? "· đã duyệt " : ""}{isOpen ? "▾" : "▸"}</div>
                  <div style={{ fontSize: 13, color: THEME.subtext, marginTop: 2 }}>
                    Đổi {s.updated || 0} mã · thêm {s.added || 0} mã{s.newProducts ? ` (${s.newProducts} sản phẩm mới)` : ""} · không còn {s.gone || 0}{s.back ? ` · có lại ${s.back}` : ""}
                  </div>
                </button>
                {isOpen && (
                  <div style={{ marginTop: 8 }}>
                    {(e.items || []).map((it, j) => (
                      <div key={j} style={{ padding: "6px 0", borderTop: j ? `1px dashed ${THEME.line}` : "none", fontSize: 13, lineHeight: 1.45 }}>
                        <div style={{ color: THEME.subtext }}>{it.p}</div>
                        <div><b>{it.l}</b> — <span style={{ color: color(it), fontWeight: 600 }}>{line(it)}</span></div>
                      </div>
                    ))}
                    {e.more > 0 && <div style={{ color: THEME.muted, fontSize: 12.5, paddingTop: 6 }}>… và {e.more} thay đổi nữa</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Modal nhập ảnh hàng loạt: dán 1 danh sách nhiều dòng "mã: link ảnh", app tự
// khớp từng dòng với đúng sản phẩm rồi nhập ảnh cho tất cả cùng 1 lúc, thay vì
// phải mở từng sản phẩm ra làm tay 200 lần.
function BulkImportModal({ list, bulkSaveClosetImages, onClose, T }) {
  const { THEME, card, inp, btn, btnSub } = T;
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [rows, setRows] = useState(null); // null = chưa xem trước
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  function preview() {
    const parsed = parseBulkImageLines(text).map((r) => {
      if (!r.url) return { ...r, status: "no-link", matches: [] };
      const matches = matchClosetProductsByCode(list, r.code);
      if (!matches.length) return { ...r, status: "not-found", matches: [] };
      if (matches.length > 1) return { ...r, status: "ambiguous", matches };
      const p = matches[0];
      if (p.image && !overwrite) return { ...r, status: "skip-has-image", matches };
      return { ...r, status: "ok", matches };
    });
    setRows(parsed);
  }

  async function runImport() {
    setRunning(true);
    let n = 0;
    const next = [...rows];
    // Tải từng ảnh về tuần tự, nhưng KHÔNG lưu ngay từng cái một — gọi lưu
    // riêng lẻ nhiều lần liên tiếp trong 1 vòng lặp sẽ bị ghi đè lẫn nhau vì
    // đều dựa trên cùng 1 bản dữ liệu cũ. Gom hết ảnh tải thành công lại rồi
    // lưu 1 lần duy nhất ở cuối.
    const collected = [];
    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (row.status !== "ok") continue;
      try {
        const url = await importGomcanImageFromUrl(row.matches[0].id, row.url);
        collected.push({ id: row.matches[0].id, image: url });
        next[i] = { ...row, status: "imported" };
      } catch (err) {
        next[i] = { ...row, status: "failed", error: (err && err.message) || "" };
      }
      n++;
      setDoneCount(n);
      setRows([...next]);
    }
    if (collected.length) bulkSaveClosetImages(collected);
    setRunning(false);
  }

  // [chữ hiển thị, màu] cho từng trạng thái.
  const STATUS_LABEL = {
    ok: ["Sẵn sàng nhập", THEME.success],
    imported: ["Đã nhập", THEME.success],
    failed: ["Lỗi khi tải ảnh", THEME.danger],
    "not-found": ["Không tìm thấy sản phẩm khớp mã", THEME.danger],
    ambiguous: ["Khớp nhiều sản phẩm — bỏ qua", "#a15c00"],
    "skip-has-image": ['Đã có ảnh — bỏ qua (tích "Ghi đè" để thay)', THEME.subtext],
    "no-link": ["Không thấy link ảnh trong dòng này", THEME.danger],
  };

  const okCount = rows ? rows.filter((r) => r.status === "ok").length : 0;

  return (
    <div onClick={onClose} className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(44,26,30,0.45)", zIndex: 90, display: "grid", placeItems: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="hnPop" style={{ ...card, width: "100%", maxWidth: 640, maxHeight: "88vh", overflowY: "auto", padding: 20, boxShadow: "0 24px 60px rgba(44,26,30,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <ImageDown size={19} color={THEME.brand} /> Nhập ảnh hàng loạt
          </h3>
          <button onClick={onClose} aria-label="Đóng" style={T.iconBtn}>
            <X size={17} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: THEME.subtext, marginBottom: 8 }}>
          Mỗi dòng 1 sản phẩm, theo dạng <b>mã sản phẩm: link ảnh</b>, ví dụ:
          <div style={{ background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 8, padding: 8, marginTop: 6, fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>
            1044A081-250: https://.../anh1.jpg{"\n"}IR7843: https://.../anh2.jpg
          </div>
          App sẽ tự tìm sản phẩm có mã đó rồi lấy ảnh về, không cần đúng tuyệt đối dấu cách/gạch ngang.
        </div>
        <textarea
          style={{ ...inp, width: "100%", minHeight: 140, fontFamily: "monospace", fontSize: 12.5 }}
          placeholder={"Dán danh sách mã + link ảnh vào đây, mỗi dòng 1 sản phẩm..."}
          value={text}
          onChange={(e) => { setText(e.target.value); setRows(null); }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setRows(null); }} />
          Ghi đè cả những sản phẩm đã có ảnh (mặc định chỉ nhập cho sản phẩm còn thiếu ảnh)
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={btnSub} onClick={preview} disabled={!text.trim() || running}>
            <ScanSearch size={16} /> Xem trước
          </button>
          <button style={btn} onClick={runImport} disabled={!rows || !okCount || running}>
            <ImageDown size={16} /> {running ? `Đang nhập… (${doneCount}/${okCount})` : `Nhập ${okCount || ""} ảnh`}
          </button>
        </div>

        {rows && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "6px 10px", background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 8, alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.matches && r.matches[0] ? r.matches[0].name : r.code || r.raw}
                </span>
                <span style={{ flexShrink: 0, color: (STATUS_LABEL[r.status] || [])[1] || THEME.subtext, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: "currentColor" }} />
                  {(STATUS_LABEL[r.status] || [r.status])[0]}
                  {r.status === "failed" && r.error ? ` (${r.error})` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClosetSection({ data, addClosetProduct, saveClosetProduct, bulkSaveClosetImages, delClosetProduct, addClosetVariant, saveClosetVariant, setAllClosetVariantPrices, delClosetVariant, bumpClosetVariant, discount, saveClosetDiscount, T }) {
  const { THEME, card, btn, btnSub, inp, iconBtn } = T;
  const list = data.closet || [];
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState(null);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [addingCategory, setAddingCategory] = useState(null); // category đang thêm sản phẩm mới
  const [viewMode, setViewMode] = useState("small");
  const [activeCat, setActiveCat] = useState(null); // null = xem tất cả danh mục
  const [editingDiscount, setEditingDiscount] = useState(false);
  const [genderFilter, setGenderFilter] = useState(null); // null | "nam" | "nu"
  const [sizeFilter, setSizeFilter] = useState([]); // các số size EU đang chọn — chọn được nhiều size cùng lúc
  const [sortPriceAsc, setSortPriceAsc] = useState(false);
  const [xaKhoFilter, setXaKhoFilter] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const tokens = norm(q).split(" ").filter(Boolean);
  const searched = !tokens.length
    ? list
    : list.filter((p) => {
        const h = norm(p.name + " " + p.category + " " + (p.variants || []).map((v) => v.label).join(" "));
        return tokens.every((t) => h.includes(t));
      });

  // 3 bộ lọc dưới đây có thể bật cùng lúc 1, 2 hay cả 3 cái — mỗi cái thu hẹp
  // thêm trên kết quả của cái trước.
  const genderFiltered = !genderFilter
    ? searched
    : searched.filter((p) => {
        const g = genderOf(p);
        return g === genderFilter || g === "both";
      });

  // Gộp cả size số EU (giày) lẫn size chữ S/M/L... (quần áo) vào chung 1 bộ lọc
  // — số xếp tăng dần trước, chữ xếp theo thứ tự XS→5XL sau.
  const availableEuSizes = Array.from(new Set(genderFiltered.flatMap((p) => Array.from(euSizesOf(p))))).sort(
    (a, b) => Number(a) - Number(b)
  );
  const availableLetterSizes = Array.from(new Set(genderFiltered.flatMap((p) => Array.from(letterSizesOf(p))))).sort(
    (a, b) => LETTER_SIZE_ORDER.indexOf(a) - LETTER_SIZE_ORDER.indexOf(b)
  );
  const availableSizes = [...availableEuSizes, ...availableLetterSizes];
  // Nếu đổi bộ lọc giới tính khiến 1 size đang chọn không còn xuất hiện nữa
  // thì tự bỏ qua size đó thay vì lọc ra danh sách rỗng mãi.
  const effectiveSizeFilter = sizeFilter.filter((s) => availableSizes.includes(s));
  const sizeFiltered = !effectiveSizeFilter.length
    ? genderFiltered
    : genderFiltered.filter((p) => {
        const sizes = new Set([...euSizesOf(p), ...letterSizesOf(p)]);
        return effectiveSizeFilter.some((s) => sizes.has(s));
      });

  const xaKhoFilteredList = xaKhoFilter ? sizeFiltered.filter((p) => isXaKho(p)) : sizeFiltered;

  const filtered = sortPriceAsc ? [...xaKhoFilteredList].sort((a, b) => minPriceOf(a) - minPriceOf(b)) : xaKhoFilteredList;

  const categories = [];
  const seen = new Set();
  filtered.forEach((p) => {
    if (!seen.has(p.category)) {
      seen.add(p.category);
      categories.push(p.category);
    }
  });

  // Bấm 1 danh mục thì chỉ hiện đúng danh mục đó (thay vì phải kéo xuống);
  // bấm lại lần nữa (hoặc bấm "Tất cả") thì quay về xem hết.
  const shownCategories = activeCat && categories.includes(activeCat) ? [activeCat] : categories;

  const viewingProduct = viewId ? list.find((p) => p.id === viewId) : null;
  const confirmDelProduct = confirmDelId ? list.find((p) => p.id === confirmDelId) : null;

  const perm = usePerm();
  const anyFilter = !!(q || genderFilter || effectiveSizeFilter.length || sortPriceAsc || xaKhoFilter);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Thanh công cụ: số mẫu + nhập ảnh hàng loạt + cách hiển thị */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: THEME.subtext }}>
          {anyFilter ? (
            <>
              <b style={{ color: THEME.text, fontWeight: 600 }}>{filtered.length}</b> / {list.length} mẫu khớp bộ lọc
            </>
          ) : (
            <>
              <b style={{ color: THEME.text, fontWeight: 600 }}>{list.length}</b> mẫu đang có
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ViewModeToggle mode={viewMode} setMode={setViewMode} T={T} />
        </div>
      </div>

      <div style={{ ...card, padding: 14, marginBottom: 14 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Tìm theo tên, mã, size, màu... (VD: 38, onitsuka, wilson)" T={T} />

        {/* Bộ lọc: Nam/Nữ, giá thấp-cao, xả kho, size — bật được 1, nhiều hay cả cùng lúc. */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          <FilterChip T={T} active={genderFilter === "nam"} onClick={() => setGenderFilter(genderFilter === "nam" ? null : "nam")}>
            Nam
          </FilterChip>
          <FilterChip T={T} active={genderFilter === "nu"} onClick={() => setGenderFilter(genderFilter === "nu" ? null : "nu")}>
            Nữ
          </FilterChip>
          <FilterChip T={T} active={sortPriceAsc} onClick={() => setSortPriceAsc((v) => !v)}>
            <ArrowUpNarrowWide size={15} /> Giá thấp → cao
          </FilterChip>
          <FilterChip T={T} tone="danger" active={xaKhoFilter} onClick={() => setXaKhoFilter((v) => !v)}>
            <Flame size={15} /> Xả kho
          </FilterChip>
          {anyFilter && (
            <button
              onClick={() => {
                setQ("");
                setGenderFilter(null);
                setSizeFilter([]);
                setSortPriceAsc(false);
                setXaKhoFilter(false);
              }}
              style={{ border: "none", background: "transparent", color: THEME.brand, fontWeight: 600, fontSize: 13.5, cursor: "pointer", padding: "6px 4px" }}
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        {availableSizes.length > 0 && (
          <div className="hnHScroll" style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: THEME.subtext, flexShrink: 0, marginRight: 2 }}>Size</span>
            {availableSizes.map((s) => {
              const active = effectiveSizeFilter.includes(s);
              return (
                <FilterChip key={s} T={T} small active={active} onClick={() => setSizeFilter(active ? sizeFilter.filter((x) => x !== s) : [...sizeFilter, s])}>
                  {s}
                </FilterChip>
              );
            })}
          </div>
        )}

        {/* Chương trình giảm giá áp dụng chung cho cả tab: tích vào là tự động
            giảm giá cho mọi sản phẩm từ mức giá đã đặt, bấm sửa để đổi % giảm
            hoặc mức giá áp dụng theo từng đợt khuyến mãi khác nhau. Khách chỉ
            thấy dòng này khi chương trình đang bật. */}
        {(perm.canEdit || discount.enabled) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 12,
              padding: "9px 12px",
              background: discount.enabled ? THEME.successBg : THEME.surfaceAlt,
              border: `1px solid ${discount.enabled ? THEME.successLine : THEME.line}`,
              borderRadius: 10,
              flexWrap: "wrap",
            }}
          >
            {perm.canEdit && (
              <input
                type="checkbox"
                aria-label="Bật chương trình giảm giá"
                checked={!!discount.enabled}
                onChange={(e) => saveClosetDiscount({ enabled: e.target.checked })}
                style={{ width: 18, height: 18, flexShrink: 0, accentColor: THEME.success, cursor: "pointer" }}
              />
            )}
            {editingDiscount && perm.canEdit ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1, fontSize: 13.5 }}>
                <span>Giảm</span>
                <input style={{ ...inp, width: 60, padding: "5px 8px" }} defaultValue={discount.percent} onBlur={(e) => saveClosetDiscount({ percent: Number(e.target.value) || 0 })} />
                <span>% cho sản phẩm từ</span>
                <input style={{ ...inp, width: 84, padding: "5px 8px" }} defaultValue={discount.threshold} onBlur={(e) => saveClosetDiscount({ threshold: Number(e.target.value) || 0 })} />
                <span>k trở lên</span>
                <button style={{ ...btnSub, padding: "5px 12px" }} onClick={() => setEditingDiscount(false)}>
                  Xong
                </button>
              </div>
            ) : (
              <>
                <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 13.5, color: discount.enabled ? THEME.success : THEME.subtext }}>
                  <BadgePercent size={16} />
                  {discount.enabled ? "Đang giảm" : "Giảm"} {discount.percent}% cho sản phẩm từ {fmtClosetPrice(discount.threshold)} trở lên
                  {!discount.enabled && <span style={{ fontWeight: 400 }}>(đang tắt)</span>}
                </span>
                {perm.canEdit && (
                  <button style={{ ...iconBtn, width: 30, height: 30 }} title="Sửa chương trình giảm giá" aria-label="Sửa chương trình giảm giá" onClick={() => setEditingDiscount(true)}>
                    <Pencil size={14} />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Thanh nhấn nhanh chọn danh mục — bấm vào là chỉ hiện đúng danh mục đó,
          khỏi phải kéo tay xuống mới xem được mục khác. Dính trên đầu khi cuộn. */}
      {categories.length > 1 && (
        <div
          className="hnHScroll"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: THEME.bg,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            maxWidth: "100%",
            padding: "8px 0 10px",
            marginBottom: 6,
          }}
        >
          <FilterChip T={T} active={!activeCat} onClick={() => setActiveCat(null)}>
            Tất cả
          </FilterChip>
          {categories.map((cat) => (
            <FilterChip key={cat} T={T} active={activeCat === cat} onClick={() => setActiveCat(activeCat === cat ? null : cat)}>
              {cat}
            </FilterChip>
          ))}
        </div>
      )}

      {filtered.length === 0 && <EmptyState icon={SearchX} title="Không tìm thấy mẫu nào khớp" hint="Thử bỏ bớt bộ lọc hoặc tìm bằng từ khác." T={T} />}

      {shownCategories.map((cat) => {
        const items = filtered.filter((p) => p.category === cat);
        return (
          <section key={cat} style={{ marginBottom: 26 }}>
            <GroupTitle T={T} count={items.length}>
              {cat}
            </GroupTitle>
            <div style={{ display: "grid", gridTemplateColumns: gridColumnsFor(viewMode), gap: 12, marginBottom: 10 }}>
              {items.map((p) => (
                <ClosetProductCard tokens={tokens} key={p.id} p={p} listMode={viewMode === "list"} onOpen={() => setViewId(p.id)} discount={discount} T={T} />
              ))}
            </div>
            {perm.canEdit && (
              <>
                <button style={{ ...btnSub, color: THEME.subtext }} onClick={() => setAddingCategory(addingCategory === cat ? null : cat)}>
                  {addingCategory === cat ? (
                    "Đóng"
                  ) : (
                    <>
                      <Plus size={15} /> Thêm mẫu vào “{cat}”
                    </>
                  )}
                </button>
                {addingCategory === cat && (
                  <ClosetAddProductForm
                    category={cat}
                    onAdd={(product) => {
                      addClosetProduct(product);
                      setAddingCategory(null);
                    }}
                    T={T}
                  />
                )}
              </>
            )}
          </section>
        );
      })}

      {perm.canEdit && (
        <div style={{ borderTop: `1px solid ${THEME.line}`, paddingTop: 16, marginTop: 4 }}>
          <button style={btnSub} onClick={() => setAddingCategory(addingCategory === "__new__" ? null : "__new__")}>
            {addingCategory === "__new__" ? (
              "Đóng"
            ) : (
              <>
                <FolderPlus size={16} /> Thêm mẫu vào danh mục mới
              </>
            )}
          </button>
          {addingCategory === "__new__" && (
            <ClosetAddProductForm
              category=""
              askCategory
              onAdd={(product) => {
                addClosetProduct(product);
                setAddingCategory(null);
              }}
              T={T}
            />
          )}
        </div>
      )}

      {viewingProduct && (
        <ClosetDetailModal
          p={viewingProduct}
          onClose={() => setViewId(null)}
          onDelete={() => setConfirmDelId(viewingProduct.id)}
          saveClosetProduct={saveClosetProduct}
          addClosetVariant={addClosetVariant}
          saveClosetVariant={saveClosetVariant}
          setAllClosetVariantPrices={setAllClosetVariantPrices}
          delClosetVariant={delClosetVariant}
          bumpClosetVariant={bumpClosetVariant}
          discount={discount}
          T={T}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelProduct}
        message={`Xoá mẫu "${confirmDelProduct ? confirmDelProduct.name.split("\n")[0] : ""}"? (có 10s để hoàn tác sau khi xoá)`}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={() => {
          delClosetProduct(confirmDelId);
          setConfirmDelId(null);
          setViewId(null);
        }}
      />
    </div>
  );
}

/* ---- Thẻ sản phẩm ở ngoài: ảnh (không hiện số lượng nữa) + tên + giá +
   các mã/size (chip). Ở chế độ danh sách thì gọn thành 1 dòng ngang. ---- */
function ClosetProductCard({ p, listMode, onOpen, discount, T, tokens = [] }) {
  const { THEME, card, chip } = T;
  const variants = p.variants || [];
  // Ở ngoài chỉ hiện các size CÒN HÀNG (màu xanh) — size hết hàng không hiện nữa.
  const inStock = sortedClosetVariants(variants).filter((v) => Number(v.remaining) > 0);
  const shown = inStock.slice(0, 6);
  const extra = inStock.length - shown.length;
  const xaKho = isXaKho(p);
  const priceLine = priceRangeLine(variants, xaKho ? null : discount);
  // Mã dùng chung hiện 1 lần duy nhất; mỗi biến thể chỉ còn hiện phần size.
  // commonCodePrefix cần từ 2 biến thể trở lên mới so sánh được — sản phẩm
  // chỉ còn đúng 1 size thì tách mã/size riêng theo dấu ngoặc của chính label
  // đó (splitLabelForEdit), tránh hiện dính liền cả mã lẫn size làm 1 cục.
  let code = commonCodePrefix(variants);
  let sizeChip;
  if (code) {
    sizeChip = (v) => sizePartFor(v.label, code);
  } else if (variants.length === 1) {
    const only = splitLabelForEdit(variants[0].label);
    code = only.code;
    sizeChip = () => only.size || variants[0].label;
  } else {
    sizeChip = (v) => v.label;
  }
  const inStockChipStyle = { ...chip, fontSize: 11, padding: "1px 7px", background: THEME.successBg, borderColor: THEME.successLine, color: THEME.success };
  const priceColor = xaKho ? XA_KHO_COLOR : THEME.brand;
  // Cả thẻ bấm được (kể cả bằng bàn phím) — không cần nút "Xem chi tiết" riêng.
  const clickProps = {
    onClick: onOpen,
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onOpen();
      }
    },
  };

  if (listMode) {
    return (
      <div className="hnCard hnRowItem hnClickable" {...clickProps} style={{ ...card, minWidth: 0, maxWidth: "100%", cursor: "pointer", display: "flex", gap: 12, padding: 10, alignItems: "center" }}>
        <div style={{ position: "relative", width: 60, height: 60, minWidth: 60, borderRadius: 10, overflow: "hidden", background: THEME.surfaceAlt }}>
          <SmartImage
            src={p.image}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }}
            fallback={<ImagePlaceholder icon={ShoppingBag} size={22} T={T} />}
          />
          {xaKho && (
            <div className="xaKhoBadge" style={xaKhoBadgeStyle("sm")}>
              XẢ KHO
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={p.name || ""} tokens={tokens} color={HL_COLOR} /></div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, minWidth: 0 }}>
            {priceLine.originalText && <span style={{ fontSize: 11, color: THEME.subtext, textDecoration: "line-through", flexShrink: 0 }}>{priceLine.originalText}</span>}
            <span style={{ fontWeight: 700, color: priceColor, fontSize: 14.5, flexShrink: 0 }}>{priceLine.text}</span>
            {code && <span style={{ fontSize: 12, color: THEME.subtext, flexShrink: 0 }}>Mã {code}</span>}
            <div style={{ display: "flex", gap: 4, overflow: "hidden", minWidth: 0 }}>
              {shown.length ? (
                shown.slice(0, 3).map((v) => (
                  <span key={v.id} style={{ ...inStockChipStyle, flexShrink: 0 }}>{sizeChip(v)}</span>
                ))
              ) : (
                <span style={{ fontSize: 12, color: THEME.subtext, flexShrink: 0 }}>Hết hàng</span>
              )}
            </div>
          </div>
        </div>
        <ChevronRight size={18} color={THEME.muted} />
      </div>
    );
  }

  return (
    <div className="hnCard hnListItem hnClickable" {...clickProps} style={{ ...card, minWidth: 0, overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", width: "100%", paddingTop: "100%", background: THEME.surfaceAlt, borderBottom: `1px solid ${THEME.line}` }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <SmartImage
            src={p.image}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }}
            fallback={<ImagePlaceholder icon={ShoppingBag} size={34} T={T} />}
          />
          {xaKho && (
            <div className="xaKhoBadge" style={xaKhoBadgeStyle("md")}>
              <Flame size={12} /> XẢ KHO
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "10px 11px 12px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.35, whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 36, color: THEME.text }}>
          {p.name}
        </div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: priceColor, fontSize: 16 }}>{priceLine.text}</span>
          {priceLine.originalText && <span style={{ fontSize: 12, color: THEME.muted, textDecoration: "line-through" }}>{priceLine.originalText}</span>}
        </div>
        {code && (
          <div style={{ fontSize: 12, color: THEME.subtext, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Mã {code}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {shown.length ? (
            shown.map((v) => (
              <span key={v.id} title={`Mã: ${v.label}`} style={inStockChipStyle}>
                {sizeChip(v)}
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12, color: THEME.subtext, fontWeight: 600 }}>Hết hàng</span>
          )}
          {extra > 0 && <span style={{ ...chip, fontSize: 11, padding: "1px 7px", background: THEME.surfaceAlt, borderColor: THEME.line, color: THEME.subtext }}>+{extra}</span>}
        </div>
      </div>
    </div>
  );
}

function ClosetAddProductForm({ category, askCategory, onAdd, T }) {
  const { THEME, inp, btn } = T;
  const [name, setName] = useState("");
  const [cat, setCat] = useState(category || "");
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");
  const [remaining, setRemaining] = useState("");

  function handleAdd() {
    if (!name.trim() || (askCategory && !cat.trim())) return;
    const variants = label.trim() ? [{ id: uid(), label: label.trim(), price: Number(price) || 0, qty: Number(remaining) || 0, sold: 0, remaining: Number(remaining) || 0 }] : [];
    onAdd({ id: uid(), name: name.trim(), category: cat.trim(), image: "", variants });
  }

  return (
    <div style={{ marginTop: 10, padding: 12, background: THEME.surface, border: `1px solid ${THEME.line}`, borderRadius: 12, maxWidth: 560 }}>
      <input style={{ ...inp, marginBottom: 8 }} placeholder="Tên sản phẩm" value={name} onChange={(e) => setName(e.target.value)} />
      {askCategory && <input style={{ ...inp, marginBottom: 8 }} placeholder="Tên danh mục mới (VD: Giày Nike)" value={cat} onChange={(e) => setCat(e.target.value)} />}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        <input style={inp} placeholder="Mã/Size đầu tiên" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input style={inp} inputMode="numeric" placeholder="Giá (k)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input style={inp} inputMode="numeric" placeholder="Còn lại" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
      </div>
      <button style={btn} onClick={handleAdd} disabled={!name.trim() || (askCategory && !cat.trim())}>
        <Plus size={16} /> Thêm sản phẩm
      </button>
    </div>
  );
}

function ClosetDetailModal({ p, onClose, onDelete, saveClosetProduct, addClosetVariant, saveClosetVariant, setAllClosetVariantPrices, delClosetVariant, bumpClosetVariant, discount, T }) {
  const { THEME, card, inp, btnSub, btn, iconBtn, chip } = T;
  const perm = usePerm();
  const [pendingImg, setPendingImg] = useState(null);
  const [editVariantId, setEditVariantId] = useState(null);
  const [nf, setNf] = useState({ code: "", size: "", color: "", price: "", remaining: "" });
  const [editName, setEditName] = useState(false);
  const [commonPrice, setCommonPrice] = useState("");
  const xaKho = isXaKho(p);
  const effectiveDiscount = xaKho ? null : discount;
  const quote = buildClosetQuote(p, effectiveDiscount);

  function applyCommonPrice() {
    const price = Number(commonPrice);
    if (!price || price <= 0) return;
    setAllClosetVariantPrices(p.id, price);
    setCommonPrice("");
  }

  async function onPickImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 1280, 0.85);
      setPendingImg(dataUrl);
      let url;
      try {
        url = await uploadGomcanImage(p.id, dataUrl);
      } catch {
        setPendingImg(null);
        showToast("⚠️ ẢNH CHƯA LƯU được (lỗi mạng?). Hãy chọn lại ảnh.", 9000);
        return;
      }
      saveClosetProduct(p.id, { image: url });
    } catch {
      alert("Không đọc được ảnh này (thường do ảnh chụp thẳng trên iPhone ở định dạng HEIC). Bạn thử lưu ảnh dạng JPG/PNG rồi chọn lại, hoặc chụp màn hình ảnh đó rồi dùng ảnh chụp màn hình nhé.");
    }
  }

  const [copied, setCopied] = useState(false);
  function copyQuote() {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(quote).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  const smallIcon = { ...iconBtn, width: 30, height: 30 };
  const sectionLabel = { fontSize: 12, fontWeight: 600, color: THEME.subtext, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 };

  return (
    <div onClick={onClose} className="hnFade" style={{ position: "fixed", inset: 0, background: "rgba(44,26,30,0.45)", zIndex: 80, display: "grid", placeItems: "center", padding: 16 }}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="hnPop"
        style={{ ...card, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", padding: 0, boxShadow: "0 24px 60px rgba(44,26,30,0.25)" }}
      >
        <div style={{ position: "relative", width: "100%", paddingTop: "66%", background: THEME.surfaceAlt, borderBottom: `1px solid ${THEME.line}` }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <SmartImage
              src={pendingImg || p.image}
              lazy={false}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#fff" }}
              fallback={<ImagePlaceholder icon={ShoppingBag} size={56} T={T} />}
            />
            {xaKho && (
              <div className="xaKhoBadge" style={xaKhoBadgeStyle("lg")}>
                <Flame size={14} /> XẢ KHO
              </div>
            )}
            <button
              onClick={onClose}
              aria-label="Đóng"
              style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: 10, border: "none", background: "rgba(255,250,245,0.92)", color: THEME.text, cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
            >
              <X size={18} />
            </button>
            {perm.canEdit && (
              <label
                style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(255,250,245,0.94)", color: THEME.text, fontWeight: 600, fontSize: 13, borderRadius: 999, padding: "6px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
              >
                <Camera size={15} /> {p.image ? "Đổi ảnh" : "Thêm ảnh"}
                <input type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            {editName && perm.canEdit ? (
              <input style={{ ...inp, flex: 1 }} defaultValue={p.name} onBlur={(e) => { saveClosetProduct(p.id, { name: e.target.value }); setEditName(false); }} autoFocus />
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.35, whiteSpace: "pre-line", overflowWrap: "break-word", color: THEME.text }}>{p.name}</h3>
                <div style={{ marginTop: 3, fontSize: 13, color: THEME.subtext }}>{p.category}</div>
              </div>
            )}
            {(perm.canEdit || perm.canDelete) && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {perm.canEdit && (
                  <button style={iconBtn} title="Sửa tên" aria-label="Sửa tên" onClick={() => setEditName(true)}>
                    <Pencil size={15} />
                  </button>
                )}
                {perm.canDelete && (
                  <button style={{ ...iconBtn, color: THEME.danger }} title="Xoá sản phẩm" aria-label="Xoá sản phẩm" onClick={onDelete}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            )}
          </div>

          {quote && (
            <div style={{ marginTop: 14, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 12, padding: "10px 12px", fontSize: 14, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
              <MessageSquareQuote size={17} color={THEME.brand} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, lineHeight: 1.45 }}>{quote}</span>
              <button style={{ ...btnSub, padding: "6px 10px", fontSize: 13, color: copied ? THEME.success : THEME.text }} title="Sao chép câu báo giá" onClick={copyQuote}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã chép" : "Chép"}
              </button>
            </div>
          )}

          {perm.canEdit && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: xaKho ? XA_KHO_COLOR : THEME.text, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={!!p.xaKho}
                  onChange={(e) => saveClosetProduct(p.id, { xaKho: e.target.checked })}
                  style={{ width: 17, height: 17, accentColor: XA_KHO_COLOR, cursor: "pointer" }}
                />
                <Flame size={15} /> Đánh dấu xả kho
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  style={{ ...inp, flex: 1, minWidth: 120 }}
                  inputMode="numeric"
                  placeholder="Giá chung cho mọi size (k)"
                  value={commonPrice}
                  onChange={(e) => setCommonPrice(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyCommonPrice(); }}
                />
                <button style={btnSub} disabled={!commonPrice} onClick={applyCommonPrice}>
                  Áp dụng cho tất cả size
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <div style={sectionLabel}>Mã / size ({(p.variants || []).length})</div>
            <div style={{ border: `1px solid ${THEME.line}`, borderRadius: 12, overflow: "hidden" }}>
              {sortedClosetVariants(p.variants).map((v, idx) => {
                const isEdit = editVariantId === v.id && perm.canEdit;
                const rowStyle = { padding: "10px 12px", borderTop: idx === 0 ? "none" : `1px solid ${THEME.line}` };
                if (isEdit) {
                  const parts = splitLabelForEdit(v.label);
                  return (
                    <div key={v.id} style={{ ...rowStyle, display: "flex", flexDirection: "column", gap: 8, background: THEME.surfaceAlt }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input style={{ ...inp, flex: 2, minWidth: 130 }} defaultValue={parts.code} placeholder="Mã" onBlur={(e) => saveClosetVariant(p.id, v.id, { label: composeLabel(e.target.value, parts.size) })} />
                        <input style={{ ...inp, flex: 1, minWidth: 90 }} defaultValue={parts.size} placeholder="Size" onBlur={(e) => saveClosetVariant(p.id, v.id, { label: composeLabel(parts.code, e.target.value) })} />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input style={{ ...inp, flex: 1, minWidth: 90 }} defaultValue={v.color || ""} placeholder="Màu (không bắt buộc)" onBlur={(e) => saveClosetVariant(p.id, v.id, { color: e.target.value })} />
                        <input style={{ ...inp, width: 90 }} inputMode="numeric" defaultValue={v.price} placeholder="Giá (k)" onBlur={(e) => saveClosetVariant(p.id, v.id, { price: Number(e.target.value) || 0 })} />
                        <input style={{ ...inp, width: 90 }} inputMode="numeric" defaultValue={v.remaining} placeholder="Còn lại" onBlur={(e) => saveClosetVariant(p.id, v.id, { remaining: Number(e.target.value) || 0 })} />
                      </div>
                      <button style={{ ...btn, alignSelf: "flex-start", padding: "7px 16px" }} onClick={() => setEditVariantId(null)}>
                        <Check size={15} /> Xong
                      </button>
                    </div>
                  );
                }
                const orig = Number(v.price) || 0;
                const disc = applyDiscount(orig, effectiveDiscount);
                return (
                  <div key={v.id} style={{ ...rowStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: THEME.text, overflowWrap: "anywhere" }}>
                        {v.label || "(không có mã)"}
                        {v.color ? <span style={{ ...chip, marginLeft: 6, fontSize: 11, padding: "1px 7px" }}>{v.color}</span> : null}
                      </div>
                      <div style={{ fontSize: 13, color: THEME.subtext, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {disc !== orig ? (
                          <>
                            <span style={{ textDecoration: "line-through", color: THEME.muted }}>{fmtClosetPrice(orig)}</span>
                            <span style={{ color: THEME.success, fontWeight: 600 }}>{fmtClosetPrice(disc)}</span>
                          </>
                        ) : (
                          <span style={{ color: THEME.text, fontWeight: 600 }}>{fmtClosetPrice(orig)}</span>
                        )}
                        <span style={{ color: THEME.line }}>•</span>
                        <span style={{ color: v.remaining > 0 ? THEME.success : THEME.danger, fontWeight: 600 }}>{v.remaining > 0 ? `Còn ${v.remaining}` : v.gone ? "Hết hàng · không còn trong sheet" : "Hết hàng"}</span>
                      </div>
                    </div>
                    {perm.canEdit && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button style={smallIcon} title="Sửa mã/size này" aria-label="Sửa mã/size" onClick={() => setEditVariantId(v.id)}>
                            <Pencil size={14} />
                          </button>
                          {perm.canDelete && (
                            <button style={{ ...smallIcon, color: THEME.danger }} title="Xoá mã/size này" aria-label="Xoá mã/size" onClick={() => delClosetVariant(p.id, v.id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!p.variants || p.variants.length === 0) && <div style={{ color: THEME.subtext, fontSize: 14, padding: 12 }}>Chưa có mã/size nào</div>}
            </div>
          </div>

          {perm.canEdit && (
            <div style={{ marginTop: 14, padding: 12, background: THEME.surfaceAlt, border: `1px solid ${THEME.line}`, borderRadius: 12 }}>
              <div style={{ ...sectionLabel, marginBottom: 8 }}>Thêm mã / size mới</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <input style={{ ...inp, flex: 2, minWidth: 130 }} placeholder="Mã" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} />
                <input style={{ ...inp, flex: 1, minWidth: 90 }} placeholder="Size" value={nf.size} onChange={(e) => setNf({ ...nf, size: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <input style={{ ...inp, flex: 1, minWidth: 90 }} placeholder="Màu (không bắt buộc)" value={nf.color} onChange={(e) => setNf({ ...nf, color: e.target.value })} />
                <input style={{ ...inp, width: 90 }} inputMode="numeric" placeholder="Giá (k)" value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} />
                <input style={{ ...inp, width: 90 }} inputMode="numeric" placeholder="Còn" value={nf.remaining} onChange={(e) => setNf({ ...nf, remaining: e.target.value })} />
              </div>
              <button
                style={{ ...btn, width: "100%" }}
                disabled={!composeLabel(nf.code, nf.size).trim()}
                onClick={() => {
                  const label = composeLabel(nf.code, nf.size);
                  if (!label.trim()) return;
                  addClosetVariant(p.id, {
                    label: label.trim(),
                    color: nf.color.trim(),
                    price: Number(nf.price) || 0,
                    qty: Number(nf.remaining) || 0,
                    sold: 0,
                    remaining: Number(nf.remaining) || 0,
                  });
                  setNf({ code: "", size: "", color: "", price: "", remaining: "" });
                }}
              >
                <Plus size={16} /> Thêm mã/size
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
