// lib/syncer.js — CHỈ dùng ở trình duyệt.
// Lưu dữ liệu lên server bằng cách CHỈ GỬI PHẦN THAY ĐỔI so với bản server
// đang có (thay vì gửi lại cả khối dữ liệu mỗi lần sửa 1 chỗ nhỏ).
//
// Cách dùng trong 1 trang:
//   const { data, etag } = await loadDoc("/api/gomcan");
//   syncer.init(data, etag);          // bản server đang có
//   syncer.schedule(nextData);        // mỗi lần sửa -> tự tính phần khác & gửi
import { diffData, applyPatch } from "./dataSync";
import { showToast, goLogin } from "./gomcanHelpers";
import { readRoleCookie } from "./perm";
import { fetchRaw, takePrefetched } from "./prefetch";

// Tải dữ liệu + phiên bản (etag) của nó. Hết phiên đăng nhập -> về trang
// đăng nhập; lỗi khác -> ném lỗi để trang hiện nút "Thử lại".
export async function loadDoc(url) {
  let res = null;
  const pre = takePrefetched(url);
  if (pre) res = await pre;
  if (!res || !res.ok) res = await fetchRaw(url);
  if (res.status === 401) {
    goLogin();
    throw new Error("unauthorized");
  }
  if (!res.ok) throw new Error("load failed");
  return { data: res.data, etag: res.etag };
}

export function createSyncer(url, { onServerData, guestWrite } = {}) {
  let ready = false;
  let base = null; // dữ liệu server đang có (theo hiểu biết của máy này)
  let baseEtag = "";
  let latest = null; // dữ liệu mới nhất trên máy này, cần được lưu
  let inflight = false;
  let dirty = false;
  let timer = null;
  let retryTimer = null;
  let retryLaterCount = 0;
  let errorShown = false;

  function init(data, etag) {
    base = data;
    latest = data;
    baseEtag = etag || "";
    retryLaterCount = 0;
    ready = true;
  }

  function schedule(next, delay = 250) {
    latest = next;
    if (!ready) return;
    // Chế độ Khách: chỉ xem, không gửi gì lên server (server cũng sẽ từ chối).
    if (readRoleCookie() === "guest" && !guestWrite) {
      base = next;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }

  function flushNow() {
    clearTimeout(timer);
    return flush();
  }

  function hasPending() {
    return ready && (inflight || !!diffData(base, latest));
  }

  function retryIn(ms) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(flush, ms);
  }

  async function send(method, body, headers = {}) {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      keepalive: JSON.stringify(body).length < 60000, // cho phép gửi nốt khi đóng tab (giới hạn ~64KB)
    });
    let json = {};
    try {
      json = await r.json();
    } catch {}
    if (r.status === 403) {
      const err = new Error("forbidden");
      err.forbidden = true;
      err.message = json.error || "Không có quyền thực hiện thao tác này";
      throw err;
    }
    if (r.status === 401) {
      showToast("Phiên đăng nhập đã hết — đăng nhập lại rồi sửa lại giúp em nhé");
      setTimeout(goLogin, 1500);
      const err = new Error("unauthorized");
      err.unauthorized = true;
      throw err;
    }
    return { status: r.status, ok: r.ok, json };
  }

  function acceptSaved(target, etag) {
    base = target;
    baseEtag = etag || "";
    retryLaterCount = 0;
    errorShown = false;
  }

  async function flush() {
    if (!ready) return;
    if (inflight) {
      dirty = true;
      return;
    }
    const target = latest;
    const patch = diffData(base, target);
    if (!patch) return;
    inflight = true;
    dirty = false;
    let savedOk = false;
    try {
      const res = await send("PATCH", { baseEtag, patch });
      if (res.ok) {
        if (res.json.data) {
          // Trên server có thay đổi từ nơi khác (máy khác vừa sửa, hoặc vừa
          // khôi phục sao lưu) -> nhận bản đã ghép, rồi đặt lại lên trên đó
          // những gì máy này vừa sửa thêm trong lúc chờ.
          const serverData = res.json.data;
          const pendingLocal = diffData(target, latest);
          const merged = pendingLocal ? applyPatch(serverData, pendingLocal) : serverData;
          acceptSaved(serverData, res.json.etag);
          latest = merged;
          if (onServerData) onServerData(merged);
        } else {
          acceptSaved(target, res.json.etag);
        }
        savedOk = true;
      } else if (res.status === 409 && res.json.needFull) {
        // Server chưa chắc có bản mới nhất nhưng biết máy này đang cầm đúng
        // bản mới nhất -> gửi cả khối 1 lần, kèm điều kiện đúng phiên bản.
        const full = await send("POST", target, { "x-if-match": res.json.etag });
        if (full.ok) {
          acceptSaved(target, full.json.etag);
          savedOk = true;
        } else if (full.status === 409) {
          retryIn(3000);
        } else {
          throw new Error("save failed");
        }
      } else if (res.status === 409) {
        // Server tạm thời chưa đọc được bản mới nhất -> chờ vài giây gửi lại.
        retryLaterCount++;
        if (retryLaterCount >= 14 && readRoleCookie() === "admin") {
          // Đã chờ hơn 1 phút (đủ để bản mới nhất lan xong) mà vẫn chưa được
          // -> dự phòng cuối cùng: lưu cả khối như cách cũ để không kẹt mãi.
          const full = await send("POST", target);
          if (!full.ok) throw new Error("save failed");
          acceptSaved(target, full.json.etag);
          savedOk = true;
        } else {
          if (retryLaterCount === 3) showToast("⏳ Đang đồng bộ dữ liệu, giữ trang mở thêm ít giây nhé", 4000, "info");
          retryIn(5000);
        }
      } else if ((res.status >= 500 || res.status === 405 || res.status === 404) && readRoleCookie() === "admin") {
        // Lưới an toàn: cách gửi phần thay đổi gặp lỗi phía server -> lưu cả
        // khối như cách cũ, để việc lưu không bao giờ bị kẹt.
        const full = await send("POST", target);
        if (!full.ok) throw new Error("save failed");
        acceptSaved(target, full.json.etag);
        savedOk = true;
      } else {
        throw new Error("save failed");
      }
    } catch (e) {
      if (e && e.forbidden) {
        // Server không cho phép thay đổi này (VD Nhân viên xoá) -> báo rõ và
        // đưa màn hình về đúng dữ liệu đang lưu, không thử lại vô ích.
        showToast("🔒 " + e.message);
        latest = base;
        if (onServerData) onServerData(base);
      } else if (!e || !e.unauthorized) {
        if (!errorShown) {
          showToast("⚠️ Chưa lưu được thay đổi vừa rồi — sẽ tự thử lại, kiểm tra mạng giúp em nhé");
          errorShown = true;
        }
        retryIn(8000);
      }
    } finally {
      inflight = false;
      // Có sửa thêm trong lúc đang gửi -> gửi tiếp phần đó.
      if (dirty || (savedOk && diffData(base, latest))) {
        clearTimeout(timer);
        timer = setTimeout(flush, 250);
      }
    }
  }

  // Tự gửi nốt khi chuyển tab/ẩn app trên điện thoại, và hỏi lại trước khi
  // đóng trang nếu vẫn còn thay đổi chưa lưu xong.
  function attachLifecycle() {
    if (typeof window === "undefined") return () => {};
    const onHide = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    const onBeforeUnload = (e) => {
      if (hasPending()) {
        flushNow();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushNow();
    };
  }

  return { init, schedule, flushNow, hasPending, attachLifecycle };
}
