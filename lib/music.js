// lib/music.js — Nhạc nền piano waltz không lời, phát ở mọi trang.
// Nhạc của Kevin MacLeod (incompetech.com), miễn phí, giấy phép CC BY 4.0
// (yêu cầu ghi nguồn — đã ghi ở khung nhạc bên dưới).
//
// Nhạc tự động phát khi vào web (xem effect bên dưới). Lưu ý về
// iPhone/Safari: trình duyệt di động chỉ cho phép audio.play() chạy khi
// được gọi TRỰC TIẾP, ĐỒNG BỘ bên trong một thao tác chạm của người dùng,
// nên lệnh tự phát khi vừa mở trang có thể bị chặn âm thầm trên di động —
// khi đó người dùng chỉ cần bấm nút ▶ một lần là phát bình thường. Vì vậy
// mọi lệnh play()/pause()/đổi bài do người dùng bấm đều gọi thẳng trong
// onClick, không qua effect.
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme";

export const TRACKS = [
  { title: "Frost Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Frost%20Waltz.mp3" },
  { title: "Frost Waltz (Alternate)", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Frost%20Waltz%20(Alternate).mp3" },
  { title: "Fairytale Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fairytale%20Waltz.mp3" },
  { title: "Waltz of the Carnies", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Waltz%20of%20the%20Carnies.mp3" },
  { title: "Feather Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Feather%20Waltz.mp3" },
  { title: "Burn the World Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Burn%20the%20World%20Waltz.mp3" },
  { title: "Ancient Mystery Waltz (Vivace)", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ancient%20Mystery%20Waltz%20Vivace.mp3" },
  { title: "Grand Dark Waltz (Allegro)", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Grand%20Dark%20Waltz%20Allegro.mp3" },
  { title: "Grand Dark Waltz (Moderato)", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Grand%20Dark%20Waltz%20Moderato.mp3" },
  { title: "Grand Dark Waltz Trio (Allegro)", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Grand%20Dark%20Waltz%20Trio%20Allegro.mp3" },
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

  const allTracks = TRACKS;

  useEffect(() => {
    try {
      const v = parseFloat(window.localStorage.getItem(VOL_KEY));
      if (!isNaN(v)) setVolume(v);
    } catch (e) {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Tự động phát khi vào web. Trình duyệt máy tính thường cho phép; trình
  // duyệt di động (đặc biệt iOS/Safari) sẽ âm thầm chặn vì chưa có thao
  // tác chạm nào của người dùng — khi đó người dùng chỉ cần bấm nút ▶ như
  // bình thường, không có gì bị lỗi cả.
  useEffect(() => {
    if (!ready) return;
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
    const next = (trackIdx + 1) % allTracks.length;
    setTrackIdx(next);
    const a = audioRef.current;
    if (a) {
      a.src = allTracks[next].src;
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
    const next = (trackIdx + dir + allTracks.length) % allTracks.length;
    setTrackIdx(next);
    const a = audioRef.current;
    if (!a) return;
    a.src = allTracks[next].src;
    if (playing) {
      a.play().catch(() => setPlaying(false));
    }
  }

  if (!ready) return null;

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50 }}>
      <audio ref={audioRef} src={allTracks[trackIdx].src} playsInline preload="auto" onEnded={handleEnded} />
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
          <div style={{ fontSize: 14, fontWeight: 600, color: THEME.text, marginBottom: 2, minHeight: 20 }}>
            {allTracks[trackIdx].title}
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
