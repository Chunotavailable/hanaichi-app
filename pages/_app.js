// pages/_app.js
import { useEffect } from "react";
import Head from "next/head";
import { ThemeProvider } from "../lib/theme";
import { playPop } from "../lib/sound";

function GlobalClickPop() {
  useEffect(() => {
    function onClick(e) {
      if (e.target.closest("button, .menuCard")) playPop();
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
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap" rel="stylesheet" />
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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        body {
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        a {
          color: inherit;
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
        button,
        a {
          transition: transform 0.12s ease, background-color 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
        }
        button:active,
        .menuCard:active,
        a:active {
          transform: scale(0.96);
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
      `}</style>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
