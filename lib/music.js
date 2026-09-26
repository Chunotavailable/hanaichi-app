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
];

const VOL_KEY = "hanaichi_music_vol";
const CUSTOM_TRACKS_KEY = "hanaichi_custom_tracks";

// Đoán tên bài từ link người dùng dán vào (lấy tên file, bỏ đuôi, decode %20...).
function guessTitleFromUrl(url) {
  try {
    const clean = url.split("?")[0].split("#")[0];
    const last = decodeURIComponent(clean.split("/").filter(Boolean).pop() || "");
    const noExt = last.replace(/\.(mp3|m4a|wav|ogg|aac|flac)$/i, "");
    return noExt || "Nhạc của bạn";
  } catch (e) {
    return "Nhạc của bạn";
  }
}

export function BackgroundMusic() {
  const { theme: THEME } = useTheme();
  const audioRef = useRef(null);
  const [trackIdx, setTrackIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [customTracks, setCustomTracks] = useState([]);
  const [newLink, setNewLink] = useState("");
  const [linkError, setLinkError] = useState("");

  const allTracks = [...TRACKS, ...customTracks];

  useEffect(() => {
    try {
      const v = parseFloat(window.localStorage.getItem(VOL_KEY));
      if (!isNaN(v)) setVolume(v);
    } catch (e) {
      /* ignore */
    }
    try {
      const raw = window.localStorage.getItem(CUSTOM_TRACKS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setCustomTracks(arr);
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

  function persistCustomTracks(next) {
    setCustomTracks(next);
    try {
      window.localStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
  }

  function addCustomTrack() {
    const url = newLink.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      setLinkError("Link chưa đúng, dán link nhạc bắt đầu bằng http:// hoặc https:// giúp em ạ");
      return;
    }
    setLinkError("");
    const track = { title: guessTitleFromUrl(url), src: url };
    persistCustomTracks([...customTracks, track]);
    setNewLink("");
  }

  function removeCustomTrack(i) {
    const realIdx = TRACKS.length + i;
    const next = customTracks.filter((_, idx) => idx !== i);
    persistCustomTracks(next);
    // Nếu đang phát đúng bài vừa xoá thì dừng lại và quay về bài đầu tiên.
    if (trackIdx === realIdx) {
      const a = audioRef.current;
      if (a) a.pause();
      setPlaying(false);
      setTrackIdx(0);
      if (a) a.src = TRACKS[0].src;
    } else if (trackIdx > realIdx) {
      setTrackIdx(trackIdx - 1);
    }
  }

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
            width: 240,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: THEME.subtext, marginBottom: 8 }}>🎵 Nhạc nền thư giãn</div>
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

          <div style={{ borderTop: `1px dashed ${THEME.line}`, marginTop: 12, paddingTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.subtext, marginBottom: 6 }}>➕ Thêm link nhạc yêu thích</div>
            <input
              value={newLink}
              onChange={(e) => { setNewLink(e.target.value); setLinkError(""); }}
              onKeyDown={(e) => e.key === "Enter" && addCustomTrack()}
              placeholder="Dán link file nhạc (.mp3...)"
              style={{ width: "100%", boxSizing: "border-box", padding: "7px 9px", borderRadius: 8, border: `1px solid ${THEME.line}`, fontSize: 13, outline: "none", background: THEME.bg, color: THEME.text }}
            />
            {linkError && <div style={{ fontSize: 11.5, color: THEME.brand, marginTop: 4 }}>{linkError}</div>}
            <button
              onClick={addCustomTrack}
              style={{ marginTop: 6, width: "100%", background: THEME.chipBg, color: THEME.brand, border: `1px solid ${THEME.chipLine}`, borderRadius: 8, padding: "6px 0", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
            >
              Thêm vào danh sách
            </button>

            {customTracks.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                {customTracks.map((t, i) => (
                  <div key={t.src + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, fontSize: 12.5 }}>
                    <span
                      onClick={() => { setTrackIdx(TRACKS.length + i); const a = audioRef.current; if (a) { a.src = t.src; if (playing) a.play().catch(() => setPlaying(false)); } }}
                      style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", color: trackIdx === TRACKS.length + i ? THEME.brand : THEME.text, fontWeight: trackIdx === TRACKS.length + i ? 700 : 400 }}
                      title={t.title}
                    >
                      🎵 {t.title}
                    </span>
                    <button
                      onClick={() => removeCustomTrack(i)}
                      title="Xoá bài này"
                      style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: THEME.subtext }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
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
