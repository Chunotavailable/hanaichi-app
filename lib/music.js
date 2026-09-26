// lib/music.js — Nhạc nền piano waltz không lời, phát ở mọi trang.
// Nhạc của Kevin MacLeod (incompetech.com), miễn phí, giấy phép CC BY 4.0
// (yêu cầu ghi nguồn — đã ghi ở khung nhạc bên dưới).
//
// Lưu ý về iPhone/Safari: trình duyệt di động chỉ cho phép audio.play()
// chạy khi được gọi TRỰC TIẾP, ĐỒNG BỘ bên trong một thao tác chạm của
// người dùng — không được đi qua useEffect phản ứng theo state (khi đó
// đã "mất" cử chỉ chạm gốc nên bị chặn âm thầm). Vì vậy mọi lệnh play()/
// pause()/đổi bài ở đây đều gọi thẳng trong onClick, không qua effect.
// Cũng không tự động phát khi vừa mở trang vì trình duyệt di động sẽ luôn
// chặn việc này.
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme";

export const TRACKS = [
  { title: "Frost Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Frost%20Waltz.mp3" },
  { title: "Frost Waltz (Alternate)", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Frost%20Waltz%20(Alternate).mp3" },
  { title: "Fairytale Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fairytale%20Waltz.mp3" },
  { title: "Waltz of the Carnies", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Waltz%20of%20the%20Carnies.mp3" },
];

const VOL_KEY = "hanaichi_music_vol";

export function BackgroundMusic() {
  const { theme: THEME } = useTheme();
  const audioRef = useRef(null);
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = parseFloat(window.localStorage.getItem(VOL_KEY));
      if (!isNaN(v)) setVolume(v);
    } catch (e) {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    try {
      window.localStorage.setItem(VOL_KEY, String(volume));
    } catch (e) {
      /* ignore */
    }
  }, [volume]);

  // Bài kết thúc -> tự chuyển bài tiếp theo và phát luôn (đây là tiếp nối
  // của phiên phát đã được người dùng cho phép trước đó, không phải phát mới).
  function handleEnded() {
    const next = (trackIdx + 1) % TRACKS.length;
    setTrackIdx(next);
    const a = audioRef.current;
    if (a) {
      a.src = TRACKS[next].src;
      a.play().catch(() => setPlaying(false));
    }
  }

  // Bấm nút phát/tạm dừng — GỌI THẲNG trong onClick để iOS chấp nhận là thao tác của người dùng.
  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }

  // Đổi bài — cũng thao tác trực tiếp lên thẻ audio ngay trong onClick.
  function switchTrack(dir) {
    const next = (trackIdx + dir + TRACKS.length) % TRACKS.length;
    setTrackIdx(next);
    const a = audioRef.current;
    if (!a) return;
    a.src = TRACKS[next].src;
    if (playing) {
      a.play().catch(() => setPlaying(false));
    }
  }

  if (!ready) return null;

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50 }}>
      <audio ref={audioRef} src={TRACKS[trackIdx].src} playsInline preload="auto" onEnded={handleEnded} />
      {open && (
        <div
          className="hnCard"
          style={{
            marginBottom: 10,
            background: THEME.surface,
            border: `1px solid ${THEME.line}`,
            borderRadius: 16,
            boxShadow: THEME.glow,
            padding: 14,
            width: 220,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: THEME.subtext, marginBottom: 8 }}>🎵 Nhạc nền thư giãn</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, marginBottom: 2, minHeight: 20 }}>
            {TRACKS[trackIdx].title}
          </div>
          <div style={{ fontSize: 11, color: THEME.subtext, marginBottom: 8 }}>Nhạc: Kevin MacLeod (incompetech.com), CC BY 4.0</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => switchTrack(-1)}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: THEME.brand }}
              title="Bài trước"
            >
              ⏮
            </button>
            <button
              onClick={togglePlay}
              style={{
                background: THEME.primary,
                color: THEME.btnText,
                border: "none",
                borderRadius: 999,
                width: 34,
                height: 34,
                fontSize: 15,
                cursor: "pointer",
                flexShrink: 0,
              }}
              title={playing ? "Tạm dừng" : "Phát"}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button
              onClick={() => switchTrack(1)}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: THEME.brand }}
              title="Bài tiếp"
            >
              ⏭
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13 }}>{volume === 0 ? "🔇" : "🔉"}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: THEME.brand }}
            />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Nhạc nền"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: THEME.brand,
          color: "#fff",
          border: "none",
          fontSize: 20,
          cursor: "pointer",
          boxShadow: THEME.glow,
          display: "grid",
          placeItems: "center",
        }}
      >
        {playing ? "🎶" : "🎵"}
      </button>
    </div>
  );
}
