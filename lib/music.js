// lib/music.js — Nhạc nền piano waltz không lời, phát ở mọi trang.
// Nhạc của Kevin MacLeod (incompetech.com), miễn phí, giấy phép CC BY 4.0
// (yêu cầu ghi nguồn — đã ghi ở khung nhạc bên dưới).
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./theme";
import { playClick } from "./sound";

export const TRACKS = [
  { title: "Frost Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Frost%20Waltz.mp3" },
  { title: "Frost Waltz (Alternate)", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Frost%20Waltz%20(Alternate).mp3" },
  { title: "Fairytale Waltz", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fairytale%20Waltz.mp3" },
  { title: "Waltz of the Carnies", src: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Waltz%20of%20the%20Carnies.mp3" },
];

const VOL_KEY = "hanaichi_music_vol";
const ON_KEY = "hanaichi_music_on";

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
      const on = window.localStorage.getItem(ON_KEY);
      if (on === "1") setPlaying(true);
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

  useEffect(() => {
    if (!ready || !audioRef.current) return;
    if (playing) {
      audioRef.current.play().catch(() => setPlaying(false));
    } else {
      audioRef.current.pause();
    }
    try {
      window.localStorage.setItem(ON_KEY, playing ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }, [playing, trackIdx, ready]);

  function nextTrack(dir) {
    playClick();
    setTrackIdx((i) => (i + dir + TRACKS.length) % TRACKS.length);
  }

  if (!ready) return null;

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50 }}>
      <audio
        ref={audioRef}
        src={TRACKS[trackIdx].src}
        onEnded={() => setTrackIdx((i) => (i + 1) % TRACKS.length)}
      />
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
              onClick={() => nextTrack(-1)}
              style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: THEME.brand }}
              title="Bài trước"
            >
              ⏮
            </button>
            <button
              onClick={() => {
                playClick();
                setPlaying((p) => !p);
              }}
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
              onClick={() => nextTrack(1)}
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
        onClick={() => {
          playClick();
          setOpen((v) => !v);
        }}
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
