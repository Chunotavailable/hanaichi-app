// lib/sound.js
// Âm thanh duy nhất còn giữ lại: tiếng "pop" nhỏ khi bấm bất kỳ nút nào,
// tự tạo bằng Web Audio API (không cần file âm thanh bên ngoài).
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

/** Pop rất nhỏ, phát khi bấm bất kỳ nút nào — cảm giác bấm nút vật lý. */
export function playPop() {
  tone(850, 0, 0.03, "sine", 0.035);
}
