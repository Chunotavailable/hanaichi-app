// pages/_app.js
import Head from "next/head";
import { ThemeProvider } from "../lib/theme";

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
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
