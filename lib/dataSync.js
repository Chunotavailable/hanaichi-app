// lib/dataSync.js
// So sánh 2 phiên bản dữ liệu và chỉ lấy ra PHẦN THAY ĐỔI (patch), rồi áp
// patch đó lên dữ liệu đang có. Dùng chung cho cả trình duyệt (tính patch để
// gửi lên) lẫn server (áp patch vào dữ liệu mới nhất).
//
// Cách chia nhỏ: với mỗi mục cấp 1 trong dữ liệu (VD "closet", "giadung",
// "priceHist"...):
//   - Nếu là danh sách các món có "id" riêng -> chỉ gửi những món bị sửa/thêm
//     (upserts), id những món bị xoá (removed), và thứ tự id nếu thứ tự đổi
//     hoặc có món mới (order). Sửa giá 1 sản phẩm = chỉ gửi đúng sản phẩm đó.
//   - Còn lại (cài đặt, danh sách chữ...) -> gửi nguyên giá trị mới của mục
//     đó (thường rất nhỏ).
// Nhờ gộp theo id, 2 máy cùng sửa 2 sản phẩm KHÁC NHAU cùng lúc sẽ không đè
// mất thay đổi của nhau như khi gửi cả khối dữ liệu.

function isIdItem(x) {
  return !!x && typeof x === "object" && !Array.isArray(x) && (typeof x.id === "string" || typeof x.id === "number");
}

function isIdList(arr) {
  if (!Array.isArray(arr) || !arr.every(isIdItem)) return false;
  return new Set(arr.map((x) => x.id)).size === arr.length;
}

function same(a, b) {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameIdSeq(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// Trả về null nếu không có gì thay đổi.
export function diffData(prev, next) {
  const p = prev || {};
  const n = next || {};
  const patch = { set: {}, unset: [], lists: {} };
  let changed = false;
  const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
  for (const k of keys) {
    const a = p[k];
    const b = n[k];
    if (same(a, b)) continue;
    changed = true;
    if (b === undefined) {
      patch.unset.push(k);
      continue;
    }
    if (isIdList(a) && isIdList(b)) {
      const aById = new Map(a.map((x) => [x.id, x]));
      const bIdSet = new Set(b.map((x) => x.id));
      const upserts = b.filter((x) => !aById.has(x.id) || !same(aById.get(x.id), x));
      const removed = a.filter((x) => !bIdSet.has(x.id)).map((x) => x.id);
      const hasNew = b.some((x) => !aById.has(x.id));
      const keptInOldOrder = a.map((x) => x.id).filter((id) => bIdSet.has(id));
      const keptInNewOrder = b.map((x) => x.id).filter((id) => aById.has(id));
      const order = hasNew || !sameIdSeq(keptInOldOrder, keptInNewOrder) ? b.map((x) => x.id) : null;
      patch.lists[k] = { upserts, removed, order };
    } else {
      patch.set[k] = b;
    }
  }
  return changed ? patch : null;
}

// Áp patch lên base, trả về object MỚI (không sửa trực tiếp base).
export function applyPatch(base, patch) {
  const out = { ...(base || {}) };
  if (!patch) return out;
  for (const k of Object.keys(patch.set || {})) out[k] = patch.set[k];
  for (const k of patch.unset || []) delete out[k];
  for (const k of Object.keys(patch.lists || {})) {
    const { upserts = [], removed = [], order = null } = patch.lists[k];
    const cur = Array.isArray(out[k]) ? out[k] : [];
    const removedSet = new Set(removed);
    const upMap = new Map(upserts.map((x) => [x.id, x]));
    const curIdItems = new Map(cur.filter(isIdItem).map((x) => [x.id, x]));
    let result;
    if (order) {
      const inOrder = new Set(order);
      result = [];
      for (const id of order) {
        if (removedSet.has(id)) continue;
        const it = upMap.has(id) ? upMap.get(id) : curIdItems.get(id);
        // Món có trong "order" nhưng server không còn (đã bị máy khác xoá) và
        // mình cũng không sửa -> tôn trọng việc xoá đó, bỏ qua.
        if (it !== undefined) result.push(it);
      }
      // Giữ lại những món server đang có mà máy này chưa biết tới (VD máy
      // khác vừa thêm) — không được làm mất.
      for (const it of cur) {
        if (!isIdItem(it)) continue;
        if (!inOrder.has(it.id) && !removedSet.has(it.id)) result.push(it);
      }
    } else {
      result = cur
        .filter((it) => !(isIdItem(it) && removedSet.has(it.id)))
        .map((it) => (isIdItem(it) && upMap.has(it.id) ? upMap.get(it.id) : it));
      for (const it of upserts) if (!curIdItems.has(it.id)) result.push(it);
    }
    out[k] = result;
  }
  return out;
}

// Patch này có XOÁ thứ gì đang có trên server không? Dùng để chặn vai trò
// Nhân viên (được thêm/sửa, không được xoá). Bắt cả kiểu xoá "lồng bên
// trong" — VD xoá 1 size của sản phẩm được gửi lên dưới dạng "sửa sản phẩm"
// với danh sách size ít đi — bằng cách so từng danh sách có id con bên trong.
function losesNestedIds(oldVal, newVal) {
  if (isIdList(oldVal)) {
    if (!Array.isArray(newVal)) return oldVal.length > 0;
    const newById = new Map(newVal.filter(isIdItem).map((x) => [x.id, x]));
    for (const x of oldVal) {
      if (!newById.has(x.id)) return true;
      if (losesNestedIds(x, newById.get(x.id))) return true;
    }
    return false;
  }
  if (oldVal && typeof oldVal === "object" && !Array.isArray(oldVal)) {
    if (!newVal || typeof newVal !== "object" || Array.isArray(newVal)) return false;
    for (const key of Object.keys(oldVal)) {
      if (losesNestedIds(oldVal[key], newVal[key])) return true;
    }
  }
  return false;
}

export function patchRemovesItems(base, patch) {
  if (!patch) return false;
  const b = base || {};
  if ((patch.unset || []).length) return true;
  for (const k of Object.keys(patch.lists || {})) {
    const { upserts = [], removed = [] } = patch.lists[k];
    if (removed.length) return true;
    const cur = Array.isArray(b[k]) ? b[k] : [];
    const curById = new Map(cur.filter(isIdItem).map((x) => [x.id, x]));
    for (const u of upserts) {
      const old = curById.get(u.id);
      if (old && losesNestedIds(old, u)) return true;
    }
  }
  for (const k of Object.keys(patch.set || {})) {
    if (losesNestedIds(b[k], patch.set[k])) return true;
  }
  return false;
}

export function patchSize(patch) {
  return patch ? JSON.stringify(patch).length : 0;
}
