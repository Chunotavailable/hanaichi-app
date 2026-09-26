// lib/sound.js
// Âm thanh phản hồi thao tác — tự tạo bằng Web Audio API (không cần file âm thanh
// bên ngoài, luôn hoạt động, không phụ thuộc mạng). Người dùng có thể tắt tiếng
// trình duyệt bình thường nếu không muốn nghe.
let ctx = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch (e) {
    return null;
  }
}

function tone(freq, start, duration, type = "sine", peakGain = 0.09) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + start);
  gain.gain.linearRampToValueAtTime(peakGain, c.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration + 0.02);
}

/** Xác nhận thao tác nhẹ nhàng: thêm mới, lưu. */
export function playTick() {
  tone(720, 0, 0.09, "sine", 0.08);
}

/** Hoàn thành / thành công: 2 nốt đi lên. */
export function playSuccess() {
  tone(660, 0, 0.1, "sine", 0.08);
  tone(990, 0.09, 0.15, "sine", 0.09);
}

/** Xóa: nốt đi xuống, ngắn. */
export function playDelete() {
  tone(420, 0, 0.07, "sine", 0.07);
  tone(300, 0.06, 0.1, "sine", 0.06);
}

/** Click rất nhẹ: copy, chuyển theme, chuyển tab. */
export function playClick() {
  tone(500, 0, 0.045, "sine", 0.05);
}
