// pages/_app.js
import { useEffect } from "react";
import Head from "next/head";
import { ThemeProvider } from "../lib/theme";
import { playPop } from "../lib/sound";
import { PermProvider } from "../lib/perm";

// Hiệu ứng khi bấm: 1 vòng tròn mờ màu đỏ mận toả ra từ đúng chỗ vừa bấm, cho
// mọi nút / tab / thẻ bấm được. Vẽ ở lớp riêng phủ trên cùng (không đụng tới
// bố cục của phần tử bị bấm) và tự xoá sau ~0,5 giây.
function spawnRipple(x, y) {
  const el = document.createElement("span");
  el.className = "hnRipple";
  el.style.left = x + "px";
  el.style.top = y + "px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 550);
}

function GlobalClickPop() {
  useEffect(() => {
    function onClick(e) {
      const hit = e.target.closest("button, a, .menuCard, .hnClickable, [role='button']");
      if (e.target.closest("button, .menuCard")) playPop();
      if (hit && !hit.disabled && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // Bấm bằng bàn phím (không có toạ độ) thì toả từ giữa phần tử.
        let x = e.clientX;
        let y = e.clientY;
        if (!x && !y) {
          const r = hit.getBoundingClientRect();
          x = r.left + r.width / 2;
          y = r.top + r.height / 2;
        }
        spawnRipple(x, y);
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <GlobalClickPop />
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          max-width: 100%;
          overflow-x: hidden;
          font-family: "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        body {
          background: #f5ebe3;
          color: #2c1a1e;
          font-size: 15px;
          line-height: 1.5;
        }
        a {
          color: inherit;
        }
        button,
        input,
        textarea,
        select {
          font-family: inherit;
        }
        svg {
          flex-shrink: 0;
        }
        /* Ô tìm kiếm đã có nút xoá riêng -> ẩn nút X mặc định của trình duyệt. */
        input[type="search"]::-webkit-search-cancel-button {
          -webkit-appearance: none;
          display: none;
        }
        ::placeholder {
          color: #a8929a;
          opacity: 1;
        }
        /* Trạng thái rê chuột / bấm / focus thống nhất cho mọi nút */
        @media (hover: hover) {
          button:not(:disabled):hover,
          a.hnBtnLink:hover {
            filter: brightness(0.96);
          }
          .hnCard.hnClickable:hover {
            border-color: #e2c8cd !important;
            box-shadow: 0 2px 4px rgba(44, 26, 30, 0.05), 0 12px 28px rgba(44, 26, 30, 0.09) !important;
          }
        }
        button:focus-visible,
        a:focus-visible {
          outline: 2px solid #9e2a3b;
          outline-offset: 2px;
        }
        input:focus,
        textarea:focus,
        select:focus {
          border-color: #c98a95 !important;
          box-shadow: 0 0 0 3px #f8ecee;
        }
        button:disabled {
          opacity: 0.5;
        }
        .hnFade {
          animation: hnFadeIn 0.15s ease;
        }
        /* Ô thông tin bấm-để-sửa: tô nền nhẹ khi rê chuột để biết là sửa được. */
        @media (hover: hover) {
          .hnEditable:hover {
            background: #fbf1ea;
            box-shadow: 0 0 0 6px #fbf1ea;
          }
        }
        /* Hàng nút vuốt ngang (size, danh mục...): ẩn thanh cuộn cho gọn. */
        .hnHScroll {
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .hnHScroll::-webkit-scrollbar {
          display: none;
        }
        /* Máy tính: chuột không vuốt ngang được → cho các nút xuống dòng để
           hiện đủ, không bị cắt chữ. Điện thoại vẫn giữ 1 hàng vuốt ngang. */
        @media (min-width: 641px) {
          .hnHScroll {
            flex-wrap: wrap;
            overflow-x: visible !important;
          }
        }
        .hnHScroll > * {
          flex-shrink: 0;
        }

        /* ===== Hiệu ứng chuyển động dùng chung toàn app ===== */
        @keyframes hnFadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes hnFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes hnPop {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          60% {
            transform: scale(1.03);
            opacity: 1;
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes hnSpinOnce {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(180deg);
          }
        }
        @keyframes hnSpin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes hnBlink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.35;
          }
        }
        .hnBlink {
          animation: hnBlink 1.1s ease-in-out infinite;
        }
        /* Nhãn "XẢ KHO": nháy kiểu phồng/xẹp + toả sáng viền ngoài (nổi bật hơn
           kiểu mờ/tỏ cũ), animation-delay được tính theo giờ hệ thống (xem
           xaKhoBlinkDelay() trong closet.js) để mọi thẻ trên trang nháy ĐỒNG
           BỘ cùng 1 nhịp, dù mỗi thẻ được render vào lúc khác nhau. */
        @keyframes hnXaKhoPulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55), 0 2px 6px rgba(185, 28, 28, 0.35);
          }
          50% {
            transform: scale(1.09);
            box-shadow: 0 0 0 7px rgba(220, 38, 38, 0), 0 2px 10px rgba(185, 28, 28, 0.55);
          }
        }
        .xaKhoBadge {
          animation: hnXaKhoPulse 1.3s ease-in-out infinite;
          will-change: transform, box-shadow;
        }
        main {
          animation: hnFadeIn 0.25s ease;
        }
        .hnRipple {
          position: fixed;
          z-index: 9999;
          width: 12px;
          height: 12px;
          margin: -6px 0 0 -6px;
          border-radius: 50%;
          background: rgba(158, 42, 59, 0.28);
          pointer-events: none;
          animation: hnRipple 0.5s ease-out forwards;
        }
        @keyframes hnRipple {
          from {
            transform: scale(1);
            opacity: 1;
          }
          to {
            transform: scale(7);
            opacity: 0;
          }
        }
        /* Thẻ / dòng bấm được: lún nhẹ khi nhấn xuống. */
        .hnClickable:active {
          transform: scale(0.985);
        }
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
        button,
        a,
        .hnClickable {
          transition: transform 0.12s ease, background-color 0.15s ease, opacity 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        button:not(:disabled):active,
        .menuCard:active,
        a:active {
          transform: scale(0.97);
        }
        button:disabled {
          cursor: default;
        }
        .hnCard {
          animation: hnFadeUp 0.28s ease both;
        }
        .hnPop {
          animation: hnPop 0.28s ease both;
        }
        .hnDone {
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        /* Thẻ sản phẩm trong danh sách dài (Closet 200+ mã): trình duyệt bỏ qua
           việc vẽ những thẻ đang nằm ngoài màn hình, chỉ vẽ khi sắp cuộn tới —
           cuộn mượt hơn hẳn trên điện thoại yếu. */
        .hnListItem {
          content-visibility: auto;
          contain-intrinsic-size: auto 300px;
        }
        .hnRowItem {
          content-visibility: auto;
          contain-intrinsic-size: auto 78px;
        }
        /* Menu đầu trang: máy tính thì xuống dòng bình thường (chuột không
           vuốt ngang được, để 1 hàng sẽ bị cắt mất nút); chỉ điện thoại màn
           hẹp mới gom thành 1 hàng vuốt ngang cho gọn. */
        .hnNavScroll {
          flex-wrap: wrap;
        }
        @media (max-width: 640px) {
          .hnNavScroll {
            flex-wrap: nowrap;
            overflow-x: auto;
            margin: 0 -18px;
            padding: 0 18px 2px;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
          }
          .hnNavScroll::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
      <PermProvider>
        <Component {...pageProps} />
      </PermProvider>
    </ThemeProvider>
  );
}
